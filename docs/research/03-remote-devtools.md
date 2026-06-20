I now have everything needed. Let me compile the final analysis.

# Remote DevTools — DeskCloud Integration Analysis

Repo: `/Users/hjunkim/WebstormProjects/remote-devtools` (package `remote-debug-tools`, MIT, live demo at remote-devtools.vercel.app). It is a CDP-based remote web-debugging platform: realtime monitoring, rrweb session recording/replay, and Jira/Slack issue-tracker integration.

---

## 1. WHAT IT IS + component/workspace map

A **single-rooted pnpm workspace** (`pnpm-workspace.yaml:1-5`: `client`, `sdk`, `figma-plugin`, `.`). The NestJS backend lives at the repo root (a NestJS monorepo via `nest-cli.json`), not in `packages/`. Build orchestrated by `package.json:18-22` (`build:internal`, `build:external`, `build:react`).

| Component | Path | Stack | Role |
|---|---|---|---|
| **Backend — internal** `remote-platform-internal` (:3000) | `apps/remote-platform-internal` | NestJS 11 + TypeORM + PG | DevTools UI serving, session-replay APIs, dashboard, accounts/auth/billing, Google Sheets. Modules: `auth`, `accounts`, `billing`, `session-replay`, `dashboard`, `activity`, `presence`, `remote-devtools` (live console), `user-profile`, `ticket-form`, `webview` (sessions CRUD), `s3` (`apps/remote-platform-internal/src/modules/*`) |
| **Backend — external** `remote-platform-external` (:3001) | `apps/remote-platform-external` | NestJS 11 | SDK serving, **CDP/WebSocket data ingestion**, Jira/Slack/Figma. Modules: `webview` (WS gateway), `buffer`, `jira`, `slack`, `figma` |
| **Shared libs** | `libs/{core,entity,common,constants,interfaces}` | TypeORM | `core` = DB services (Record/Network/DOM/Screen/Runtime/S3); `entity` = 17 TypeORM entities; `common` = filters/interceptors; aliases `@remote-platform/*` |
| **Client** | `client/` | React 19 + Vite 8 + Tailwind 4 + Radix + TanStack Query v5 + Zustand | Unified ops console **+ absorbed admin**. Pages incl. `Dashboard`, `Sessions`, `SessionDetail`, `RemoteDevTools`, `SettingsProfile`, `SettingsTeam`, `SignIn/SignUp`, `Pricing`, `Landing`, `Design` (`client/src/pages/*`) |
| **SDK** | `sdk/` | TypeScript, Vite UMD/ESM, **zero runtime framework deps** (`sdk/package.json`) | Browser instrumentation: CDP shim + rrweb capture, floating button, network rewrite. Entry `sdk/common/remoteDebugger.ts` |
| **DevTools UI** | `devtools-frontend/` | Vendored Chrome DevTools frontend | **4,753 files** — a forked Chrome DevTools frontend serving the replay/live inspector UI |
| **Figma plugin** | `figma-plugin/` | TS, only `axios` dep | Designer↔dev collaboration tool |
| **Debug Recorder Admin** | **REMOVED / folded into `client/`** | — | See §3 — per `CLAUDE.md`, the former `debug-recorder-admin/` app is gone; its surfaces now live under `client/` routes |

---

## 2. TENANCY MODEL

**Verdict: multi-tenant control plane is mostly built; the data plane (ingestion) is still effectively single-tenant. The SDK has NO project/apiKey/site auth at all.**

**Tenancy entities exist and are wired into the control plane:**
- `OrganizationEntity` — `libs/entity/src/organization.entity.ts:30-96`: `id/slug/plan('free'|'starter'|'pro')/stripeCustomerId/billingSubscriptionId/subscriptionStatus`. Its header comment (lines 10-18) calls it "scaffolding… intentionally NOT yet wired into other entities or query scopes."
- `AccountEntity` (`account.entity.ts`) + `OrganizationMemberEntity` (`organization-member.entity.ts:15-22`, roles `owner|admin|member|viewer`, unique `[orgId,accountId]`) — a real account/org/membership model.
- Signup provisions a tenant: `AccountsService.register` (`accounts.service.ts:74-115`) creates org + owner member + issues a JWT. Member CRUD is org-scoped (`listMembers`/`inviteMember` filter by `orgId`).

**Auth model (`apps/remote-platform-internal/src/modules/auth/`):**
- `AuthService` (`auth.service.ts`) — provider-agnostic JWT (HS256 self-issued, or RS256 verify for Clerk/Auth0). Claims: `sub/org/plan/member/role` (lines 31-39).
- `AuthGuard` (`auth.guard.ts:27`) — **no-op when no `AUTH_JWT_SECRET`/`AUTH_JWT_PUBLIC_KEY`** ("self-host bypass"). When enabled, populates `req.auth`.
- `PlanGuard` + `@RequirePlan` (`plan.guard.ts`) — plan-tier gating, loads `OrganizationEntity.plan`.

**Read-path scoping is partially live:** the sessions list controller forces the org filter from claims — `webview.controller.ts:119`: `const orgId = auth?.org ?? orgIdParam;` → `recordService.findPaginated({ orgId })` (`record.service.ts:92-93` adds `WHERE r.org_id = :oid`). The live console does the same (`remote-devtools.service.ts:35,49`). `RecordEntity.orgId` exists but is `nullable` (`record.entity.ts:31-32`).

**The gaps (so it's *not* fully multi-tenant-ready):**
1. **The SDK identifies a site only by a generated `deviceId`** (`sdk/domain/base.ts:8,28`, `sdk/common/remoteDebugger.ts:118`), never an apiKey/projectId/site token. `grep` for `apiKey|api_key|projectId|siteId|ingestKey|writeKey` across `apps/ libs/ sdk/ client/src` returns **zero** matches. Any browser can stream to any deployment.
2. **The WebSocket ingestion gateway has no auth and no org scoping** — `WebviewGateway` (`apps/remote-platform-external/src/modules/webview/webview.gateway.ts`) keys rooms by `randomUUID()` + `deviceId` only; `createRoom`→`recordService.create({...})` (lines 165-172) never sets `orgId`. So **written records have `orgId = NULL`**, making org-filtered reads return nothing once a real org is present.
3. Per `LAUNCH.md`: orgId scoping is **"❌ stub: see Phase 1"**, auth integration **"❌ stub"**, while Stripe billing is **"✅ shipped."** `synchronize: true` only — no migration runner.

So: **control plane (accounts/orgs/members/billing/JWT) = ~80% built; data plane (CDP ingest → record/screen/dom/network/runtime) = single-tenant.** For self-host it works frictionlessly (auth disabled = pass-through).

---

## 3. EXISTING ADMIN APP(S)

**The standalone "Debug Recorder Admin" no longer exists as a separate app** — `CLAUDE.md` states: *"The former `debug-recorder-admin/` app has been folded into `client/`."* Its surfaces are now `client/` routes backed by the `remote-devtools` NestJS module (`apps/remote-platform-internal/src/modules/remote-devtools`):

- `/remote-devtools` → `client/src/pages/RemoteDevTools.tsx` — **live CDP console** (sessions, events, send commands; service `remote-devtools.service.ts` + controller `api/remote-devtools`).
- `/settings/profile` → `SettingsProfile.tsx` — devices + Jira ticket templates.
- `/settings/team` → `SettingsTeam.tsx` — org members (invite/role/remove via `api/accounts/organization/members`).
- `/guide`, `/guide/user`, `/guide/dev`, plus `Dashboard`, `Sessions`, `SessionDetail`, `Pricing`.

**Split for a unified DeskCloud console:**

| DOMAIN-SPECIFIC (stays product-side) | GENERIC platform ops (DeskCloud console absorbs) |
|---|---|
| Live CDP console + session list/detail (`RemoteDevTools.tsx`, `Sessions.tsx`, `SessionDetail.tsx`) | Org/tenant CRUD (`OrganizationEntity`, `AccountsService`) |
| Recordings/replays + Timeline/Raw JSON + rrweb replay | Members/roles/invites (`SettingsTeam.tsx`, `organization-member`) |
| Issue-tracker config (Jira/Slack templates, `SettingsProfile`, ticket-form) | **Billing/plans/checkout/portal/webhooks** (`billing` module) → unify with DeskCloud BM |
| Dashboard metrics, activity feed, device registry | Auth/JWT issuance (`AuthService`) → DeskCloud SSO |
| | Plan-tier gating (`PlanGuard`/`@RequirePlan`), Pricing page |
| | Usage/metering — **does not exist yet** (no usage table) |

---

## 4. DATA / ORM STACK

**TypeORM 1.x + `pg` + PostgreSQL**, entities in `libs/entity/src/*` with `@remote-platform/entity` alias; datasource at `libs/core/src/datasource.ts`; **`synchronize: true`, no migration runner** (`LAUNCH.md`). Note `pnpm-workspace.yaml` already pins `drizzle-orm: '>=0.45.2'` as an override (transitive only — Drizzle is not used in app code).

**Divergence from DeskCloud's Drizzle + `@desk/core`: large.** TypeORM uses decorator-based active-record entities, repository injection (`@InjectRepository`), and `QueryBuilder` everywhere (`record.service.ts`); migrating to Drizzle's schema-as-code + SQL-builder touches every service and entity. The `nestjs-zod` skill/CLAUDE.md already standardize validation on Zod, which aligns with Drizzle-Zod.

**Reconciliation options (recommended order):**
1. **Keep TypeORM; integrate `@desk/core` over HTTP/shared-lib (S — lowest risk).** Treat DeskCloud as the system of record for tenants/plans/usage. Remote-DevTools already has a provider-agnostic seam — `BillingService`/`AuthService` verify external JWTs and read org plan; swap their backing store for `@desk/core` API calls. No entity rewrite.
2. **Dual-write tenant/billing tables (M).** Keep TypeORM for the heavy CDP data plane (record/screen/dom/network/runtime — high-volume, TypeORM-tuned with indexes), but let `@desk/core` own `organizations`/`accounts`/`billing_webhook_events`, syncing via webhook. Risk: two sources of truth for org→plan.
3. **Full migrate to Drizzle (L).** Only if DeskCloud mandates a single ORM. The append-only CDP entities are simple columnar tables and port cleanly, but it's a repo-wide rewrite + a real migration runner (currently `synchronize:true`), and re-validation of the rrweb/CDP persistence paths.

---

## 5. METERING UNITS FOR BILLING

**No usage/metering table or counters exist today** — billing only stores subscription *state* (`OrganizationEntity` columns, `BillingWebhookEventEntity` for idempotency). `LAUNCH.md` proposes plan *limits* (Free 100 sessions/mo + 7-day retention; Starter 5k/30-day; Pro 50k/90-day) but they are **not enforced** anywhere.

Candidate units and their real cost drivers (grounded in the code):

| Unit | Where it'd be measured | Real cost driver? |
|---|---|---|
| **Concurrent debug sessions** | `BufferService` caps `MAX_CONCURRENT_SESSIONS = 100` (`buffer.service.ts:33`) | **YES** — WebSocket fan-out + in-memory buffers (each session holds up to `MAX_BUFFER_SIZE_PER_SESSION = 50,000` events, `:24`) |
| **Events/messages ingested** | Gateway `protocolToAllDevtools`/`bufferEvent` → `cdpEventPersistence` (`webview.gateway.ts:520-648`); `MEMORY_WARNING_THRESHOLD = 1,000,000` events (`buffer.service.ts:36`) | **YES** — DB write volume + memory; the dominant ingest cost |
| **Retained replay storage** | rrweb + CDP rows in PG (`screen/dom/network/runtime` tables) + **S3 backup** (`@aws-sdk/client-s3`, `s3` modules) | **YES — the biggest cost driver.** Replay blobs + screen previews; retention tiers in LAUNCH map directly here |
| **Session-minutes** | `RecordEntity.duration` (nanoseconds, `record.entity.ts:39`); gateway computes duration on disconnect (`webview.gateway.ts:1183-1185`) | Moderate — proxy for fan-out time |
| **SDK monthly-active-clients** | Derivable from distinct `deviceId` in `record` per month | Low direct cost; good packaging metric |

**Cost reality:** the two genuine drivers are **(a) WebSocket fan-out / live concurrency** (in-memory buffers, server CPU, the 100-session cap) and **(b) retained replay storage** (PG rows + S3). Events-ingested is the natural billable proxy for (a); retained replay-GB-months for (b).

---

## 6. INTEGRATION-COMPLICATING RUNTIME SPECIFICS

- **Long-lived WebSockets, not request/response.** `WebviewGateway` (`@WebSocketGateway({ path: '/socket.io' })`, raw `ws`, not socket.io) holds in-memory `rooms`/`clientMap`/`devtoolsMap`/`bufferRooms` maps (`webview.gateway.ts:94-107`). This is **stateful and single-instance** — horizontal scaling needs sticky sessions or a shared pub/sub; a metering bridge must hook connect/disconnect/event, not HTTP middleware.
- **Realtime fan-out**: SDK → external gateway → broadcast to N DevTools viewers + persist + buffer. CORP/path traps are documented (exact `/socket.io` no trailing slash; dev Vite proxy + prod nginx).
- **In-memory buffering with caps & eviction** (`BufferService`): ring buffer per session, 30-min max age, oldest-session flush — data can be dropped under load; metering must read from the gateway, not assume durability.
- **Auth split-brain**: ingestion (external :3001 gateway) is **unauthenticated**; the API/read plane (internal :3000) uses `AuthGuard`. DeskCloud auth must cover the gateway too, which means giving the SDK a real credential (see §8).
- **Two separate NestJS processes** (internal + external) co-deployed (PM2 `ecosystem.config.js`, `docker-compose.prod.yml`) — DeskCloud onboarding must account for both.
- **Vendored Chrome DevTools frontend** (4,753 files) — heavy static asset surface, not a typical SPA.

---

## 7. DESIGN LANGUAGE

`client/` is already extremely close to a shared DeskCloud design system:
- **Radix UI primitives** wrapped shadcn-style in `client/src/components/ui/*` (~40 components: button/card/dialog/dropdown/select/tabs/command/data-table/tooltip…), all with `.stories.tsx` + `.test.tsx` and Storybook configured.
- **Tailwind 4** with `@theme inline` token mapping in `client/src/index.css` — **OKLCH design tokens** (`--bg/--fg/--accent/--border/--ring/--surface…`) with light + dark, surfaced as `bg-bg`/`text-fg`/`border-border` utilities (CLAUDE.md mandates tokens over raw palette).
- **CVA + clsx + tailwind-merge** for variants; **lucide-react** icons; **sonner** toasts; **cmdk** Cmd+K palette; **motion** (`motion` v12, the framer-motion successor) for animation; **i18next** for i18n.
- A living **`/design` style-guide page** (`Design.tsx`) already exists.

This is the same Radix + Tailwind-token + CVA + lucide + sonner + cmdk stack the sibling DeskCloud/Desk apps standardize on — **adoption is mostly token-name reconciliation, not a re-platform.** One mismatch to note: `lucide-react ^1.18.0` and `motion`-package naming differ from some siblings.

---

## 8. GAP-TO-DESK — concrete workstreams

| # | Workstream | What's needed | Effort |
|---|---|---|---|
| **8.1** | **Tenancy adapter (data plane)** | Plumb `orgId` into the **ingestion path**: gateway `createRoom`/`recordService.create` must stamp `orgId` (currently NULL — `webview.gateway.ts:165`). Requires the SDK to carry a tenant credential (see 8.4). Then backfill historical `record.orgId` and make it NOT NULL (`LAUNCH.md` Phase 1). Read-path scoping already exists (`webview.controller.ts:119`). | **L** |
| **8.2** | **SDK project/site auth** | Introduce an apiKey/projectId (none exists today — SDK uses bare `deviceId`). Issue per-org write keys, validate at the external gateway `handleConnection`/`createRoom`, map key→orgId. This is the linchpin for real multi-tenancy. | **L** |
| **8.3** | **Auth → DeskCloud SSO** | `AuthService` already verifies external RS256/HS256 JWTs and `AuthGuard`/`PlanGuard` are wired (`auth.service.ts`, `plan.guard.ts`). Swap self-issued tokens for DeskCloud-issued JWTs (map `org/plan/role` claims); extend auth to the **external gateway** (currently unauthenticated). | **S–M** (control plane S; gateway coverage M) |
| **8.4** | **Metering bridge** | No usage table exists. Add usage counters at the two cost centers: gateway connect/disconnect (concurrent sessions, session-minutes) and `cdpEventPersistence` (events ingested), plus a periodic replay-storage-GB rollup (PG + S3). Emit to `@desk/core` metering. Stateful gateway means counters live in the process, flushed periodically. | **M–L** |
| **8.5** | **ORM reconciliation** | Per §4: cheapest is keep TypeORM, delegate tenant/billing to `@desk/core` over HTTP (S). Add a real migration runner (today `synchronize:true` only) regardless. Full Drizzle migration is L. | **S** (HTTP delegate) / **L** (full migrate) |
| **8.6** | **Billing unification** | `billing` module (Stripe checkout/portal/webhook-driven sync, idempotent via `BillingWebhookEventEntity`) is **shipped and provider-agnostic** (`billing.service.ts`, `billing.provider.ts`). Retire its self-owned `organizations.plan`/Stripe state in favor of DeskCloud BM; keep webhook idempotency. Plan catalog (`free/starter/pro` @ $0/$19/$49, `billing.service.ts:35-39`) must reconcile with DeskCloud's plan IDs. | **M** |
| **8.7** | **Retire standalone admin → unified console** | Already half-done: the standalone Debug Recorder Admin is **folded into `client/`** (CLAUDE.md). Remaining: lift the GENERIC surfaces (org/members/billing/usage — `SettingsTeam`, `Pricing`, billing) out of `client/` into the DeskCloud console; keep DOMAIN surfaces (live CDP console, replays, Jira config) in-product. Design system already Radix/Tailwind-token aligned (§7). | **M** |

**Net:** Remote DevTools is the *most billing-ready* of the family (Stripe shipped, org/account/member model + JWT + plan-gating built) but the *least ingestion-ready* for true multi-tenancy — the SDK has no site credential and the CDP WebSocket ingestion path writes `orgId = NULL` with no gateway auth. The hard, load-bearing work (8.1 + 8.2 + 8.4) all converges on giving the SDK a real per-tenant key and threading `orgId` through the long-lived, stateful WebSocket gateway.