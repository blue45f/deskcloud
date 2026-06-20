I'll produce this plan directly as my analysis—the four dossiers contain everything needed (they're already deep source-grounded audits), so the value-add is the decisive synthesis, not more file-reading. Here's the integration plan.

---

# DeskCloud Deep Consolidation Plan — spa-seo-gateway + remote-devtools

**Thesis:** One platform architecture, one billing system, one operator console, one design family. Both candidates assimilate fully; the only sanctioned decoupling is at the *data-plane hot path* (headless-Chromium render loop; the long-lived CDP WebSocket gateway) — those stay where they are for performance/correctness reasons, while every control-plane concern (tenancy, keys, plans, usage, admin, billing) re-homes onto `@desk/*`. Sequence: spa-seo-gateway first (it's already 70% there — Fastify control plane, DeskCloud-aligned tokens, `UsageEvent` shape pre-defined), remote-devtools second (the SDK-credential + stateful-gateway threading is the hard, load-bearing work).

A reality check that shapes everything below: per Dossier E, **TermsDesk does not import `@desk/*` packages** — it *embodies* the contract first-party and *consumes* DeskCloud via the published `@heejun/deskcloud` SDK. And per Dossier A, the `@desk/*` packages are a working scaffold (billing is STUB-only, no operator console exists, the SDK `@heejun/deskcloud` doesn't exist in that repo). So "consolidate onto `@desk/*`" really means two parallel obligations: **(1) reach the TermsDesk capability bar** (the real, shipped definition of "a Desk"), and **(2) build the genuinely-shared substrate the owner wants** (one billing engine, one operator console) that TermsDesk itself predates. I call out where each applies.

---

## AXIS 1 — Desk-fit, grouping & architecture standardization

### 1.1 Desk-fit scorecard against the onboarding contract

Measured against Dossier A's contract (tenant identity, pk_/sk_ keys, CORS allowlist, UsageMeter, plan enforcement) and the Dossier E parity checklist (26 items):

| Contract element | spa-seo-gateway | remote-devtools |
|---|---|---|
| Multi-tenant model | **Has it** (saas mode, `Tenant` + members + RBAC) | **Has it** (Org/Account/Member, JWT claims, plan-gating) — most mature of the two |
| API keys pk_/sk_ split | Partial — `tk_live_` keys, **plaintext, linear scan, no hashing** | **Missing entirely** — SDK uses bare `deviceId`, zero key concept |
| Hashed-at-rest / shown-once | No | No |
| CORS allowlist per-tenant | No (global `origin:true`) | No (split-brain: read plane guarded, ingest gateway unauth) |
| UsageMeter + durable metering | No (Prometheus counters only, not per-tenant durable) | **No usage table at all** |
| Plan-limit enforcement (402/429) | Only rpm rate-limit Map | `PlanGuard` exists but limits **not enforced** |
| Billing | None (interface exists, **zero call sites**) | **Stripe SHIPPED** + webhook idempotency — most billing-ready |
| Two deploy modes | 4 modes incl. saas + self-host | self-host bypass (auth no-op) |
| Design system (Radix/OKLCH) | Close (OKLCH `--app-*`, Radix, already deps `@heejun/deskcloud`) | Closest (Radix shadcn-style, OKLCH tokens, cmdk, sonner) |
| Living `/design` route | Yes | Yes |
| Signature "killer" surface | Bot-time headless render + cache/warm | Live CDP console + rrweb replay |

**Read:** spa-seo-gateway is *control-plane-complete but billing-empty*; remote-devtools is *billing-complete but ingestion-tenancy-broken*. Neither is greenfield. Both clear the "feels fully built" product bar (Dossier E §B) on their domain surface. The gaps are concentrated and **complementary**, which is good — the work is reconciliation, not invention.

### 1.2 Architecture standardization — the decisive calls

**Principle: data plane stays native, control plane re-homes onto `@desk/*`.** This is the least-risky path to "one platform architecture" and I recommend it for both, with different mechanics.

**spa-seo-gateway (Fastify) — wrap, don't rewrite.**
- **Keep** `@heejun/spa-seo-gateway-core` (puppeteer pool, cache, quality gate, warmer) and the **Fastify render data plane** untouched. The Chromium hot path needs Fastify's lean overhead; porting it to NestJS buys nothing and risks the pool/concurrency tuning that *is* the product. This is a sanctioned decoupling, not a compromise.
- **Re-home the control plane**: tenant/key/member/plan/usage CRUD currently in `packages/multi-tenant` and `packages/cms` admin routes moves behind a NestJS+Drizzle service. Two viable shapes:
  - **(Recommended) Shared-DB pattern:** spa-seo-gateway's control plane writes to the **same Drizzle/Postgres (Neon) tenancy schema** the platform owns, via a thin `@desk/core` client. The Fastify `preHandler` tenant resolver (`host|apiKey|subdomain|pathPrefix`) calls `@desk/core`'s tenant lookup (hashed key index) instead of the JSON-file `TenantStore`. Render-time metering emits `UsageEvent` to the platform's `UsageMeter`.
  - The render plane stays Fastify; the control plane becomes a NestJS sidecar (or the platform API itself), sharing one Neon DB. Persistence: JSON-file → Drizzle/Postgres. **Effort: L** (data model migration + key re-issue + resolver rewiring), but bounded because the engine is sacred-cow-untouched.
- **Reject** a full NestJS rewrite of the gateway — it would entangle the render engine with DI for zero benefit (Dossier B §7b agrees).

**remote-devtools (NestJS + TypeORM) — adopt `@desk/core` as the system-of-record for tenancy/billing; keep TypeORM for the CDP data plane.**
- **Recommended path = Dossier C option (1)+(2) hybrid**: `@desk/core`/`@desk/billing` become the **system of record for organizations, plans, usage, and subscription state**; TypeORM **keeps owning the high-volume append-only CDP entities** (record/screen/dom/network/runtime — they're tuned columnar tables with indexes; a Drizzle rewrite is L-effort, repo-wide, and re-validates the rrweb/CDP persistence paths for no user-visible gain).
- Concretely: retire `OrganizationEntity.plan` / Stripe columns as the *source of truth*; have `AuthService`/`PlanGuard` read org→plan from the platform (they already verify external JWTs — swap the backing store). Keep `BillingWebhookEventEntity` idempotency. **Do NOT do a full Drizzle migration** — flag this as the one place "force it onto Drizzle" is wrong; the cost/risk is real and the benefit is cosmetic ORM-uniformity. One *platform architecture* ≠ one ORM in every repo; it means one tenancy/billing/usage authority. TermsDesk validates this — it's Drizzle but doesn't import `@desk/*` either; the contract is behavioral.
- **Add a migration runner regardless** (today `synchronize:true` only) — non-negotiable hardening, parity item E-A11/E-4.
- **Effort: S** for the HTTP/shared-lib delegation of tenancy+billing; **the genuinely hard L work is the SDK credential + gateway orgId threading** (Axis 2 / §8.1-8.2), not the ORM.

**Shared Zod contracts & multi-tenant primitives:** both adopt `@desk/shared` Zod schemas for the tenant/plan/usage DTOs and the pk_/sk_ key model (`prefix + base64url(randomBytes(24))`, SHA-256 + pepper hash, shown-once). remote-devtools aligns naturally (CLAUDE.md already standardizes on Zod / nestjs-zod). spa-seo-gateway already uses Zod v4 — re-point its tenant schemas at `@desk/shared`.

### 1.3 Grouping & branding

**Recommendation: a "Developer & Infra" sub-track inside the one portal, not flat assimilation and not a separate umbrella.** These two are developer/infra tools among mostly business/content Desks; a flat grid would bury them and mismatch buyer intent. Add a portal facet/section ("개발자 · 인프라" vs "비즈니스 Desk") in `DESK_CATALOG` — cheap (it's a static array; add a `track` field to `DeskEntry`) and improves navigation/cross-sell. They remain first-class Desks sharing all platform plumbing; the grouping is presentational IA only.

**Naming: keep their own names under the DeskCloud umbrella — do NOT force "*Desk" rebrands.** "spa-seo-gateway" and "remote-devtools" have SEO equity, OSS positioning (Rendertron/Prerender.io replacement; "8.4k+" stat), and developer recognition. Forcing "RenderDesk"/"DebugDesk" destroys discoverability for near-zero family-cohesion gain — the cohesion comes from shared chrome + the "Powered by DeskCloud" badge (Axis 4), not the name. This matches the owner's family-resemblance-not-uniformity steer. (If the owner later wants catalog-name harmony, *display* names like "Remote DevTools — a DeskCloud service" cost nothing.)

**Assimilation depth & effort per candidate:**
- **spa-seo-gateway: FULL assimilation, feasible. Overall M-L.** Control-plane re-home L · CORS S-M · metering wiring M · billing M · admin retirement M · design alias-layer S. Sanctioned decoupling: render engine + Fastify hot path.
- **remote-devtools: FULL assimilation, feasible. Overall L** (dominated by SDK-key + gateway-orgId threading). Tenancy/billing delegation S · SDK key issuance L · gateway orgId threading L · metering bridge M-L · admin lift M · design S. Sanctioned decoupling: TypeORM CDP data plane + the stateful WebSocket ingest gateway.

---

## AXIS 2 — Unified pricing / billing (one system, priced as cheap as sustainably possible)

### 2.1 The single scheme

**Account-level subscription (one wallet, one invoice) + per-Desk entitlements via the `PlanLimit` map + per-Desk metered overage via `UsageMeter`.** This matches DeskCloud's already-decided account-level model (Dossier A: `unique(tenant_id)`, "한 번 가입, 전체 패밀리에 적용"). Candidates **lose their separate pricing** (spa-seo has none anyway; remote-devtools' `free/starter/pro @ $0/$19/$49` Stripe catalog is retired into the unified catalog, idempotency machinery kept).

The mechanism is exactly the dual-shape DeskCloud already has, used correctly: **account tier** (free/pro/scale/enterprise) sets shared seat/feature flags; **per-Desk metered dimensions** live in the generic `PlanDef.limits: Record<M,number>` map with `overagePerUnitKrw`. Each Desk declares its own metric dimensions (TermsDesk does this with members/policies/apiKeys/apiCallsPerMonth) — the candidates just add render/session/storage/event dimensions to the same map.

### 2.2 Cost-driver → PlanLimit mapping (the unit-economics spine)

The owner wants **cheap headline prices made sustainable by tightly capping the real marginal-cost drivers**. So the metered dimensions are chosen to be *exactly* the things that cost money, and free tiers are generous on cheap units, tight on expensive ones.

**spa-seo-gateway** — bill the renders, not the requests (a cache hit is near-free; a miss is a Chromium launch):
| PlanLimit dimension | Why it's the cost driver | Enforcement |
|---|---|---|
| `renders_per_month` (cache **misses** + warm jobs) | each = headless-Chromium CPU/RAM launch — *the* cost | hard-cap free / soft-cap+overage paid |
| `render_concurrency` (pool ceiling) | hard throughput cap = peak RAM | plan-scoped pool max |
| `cache_storage_mb` | LRU + Redis tier | cap; overage per MB |
| `warm_jobs_per_month` | each warmed URL = a render | folds into renders meter |
| *(not metered for cost)* cache hits, bandwidth, page count | second-order | display-only |

Wire the **already-defined** `UsageEvent{render|cache_hit|warm}` (`packages/core/src/adapters.ts`, currently zero call sites) at the three emit points: render path, `cache.ts:128-139` hit/miss, `warmFromSitemap`. The interface exists — this is M-effort wiring, not design.

**remote-devtools** — bill events ingested + replay-GB-months (the two genuine drivers per Dossier C §5):
| PlanLimit dimension | Why | Enforcement |
|---|---|---|
| `events_ingested_per_month` | DB write volume + buffer memory — dominant ingest cost | metered at `cdpEventPersistence` |
| `replay_storage_gb_months` | **biggest cost** — PG rows + S3 blobs | periodic rollup; retention tiers map here |
| `concurrent_sessions` | WebSocket fan-out + in-memory buffers (the 100-cap) | plan-scoped cap at gateway connect |
| `session_minutes` | proxy for fan-out time | secondary meter |
| *(packaging)* monthly-active SDK clients (distinct deviceId) | low direct cost, good fit signal | informational |

Metering must hook the **stateful gateway** connect/disconnect/event (counters in-process, flushed periodically to `@desk/core`), *not* HTTP middleware — the ingest path is long-lived WS, not request/response. This is the M-L crux.

### 2.3 Illustrative tiers (LABELED ILLUSTRATIVE — low-price intent)

Generous-but-bounded free, cheap paid, overage so flat tiers can't bleed. Anchored to DeskCloud's existing free/pro/scale (₩0 / ₩29k / ₩99k) account tiers; the numbers below are the **per-Desk entitlement ceilings** layered on top.

**spa-seo-gateway (illustrative):**
- **Free:** 5,000 renders/mo, concurrency 2, 100 MB cache — hard-capped (blocks at limit). Generous enough to run a small real site's bot traffic.
- **Pro (in ₩29k account tier):** 100,000 renders/mo, concurrency 8, 5 GB cache; overage ≈ ₩2–4 / 1,000 renders.
- **Scale (₩99k):** 1,000,000 renders/mo, concurrency 24, 50 GB; lower overage unit.
- **Enterprise:** custom concurrency/dedicated pool.

**remote-devtools (illustrative):**
- **Free:** 100 sessions/mo + **7-day** replay retention, concurrency 3, ~50k events/mo — hard-capped. (Matches the LAUNCH.md proposal, made enforceable.)
- **Pro (₩29k):** 5,000 sessions, **30-day** retention, concurrency 10, ~2M events; overage on events + replay-GB-month.
- **Scale (₩99k):** 50,000 sessions, **90-day** retention, concurrency 30; storage overage per GB-month.
- **Enterprise:** custom retention/concurrency.

Retention tiers are the storage-cost lever — short free retention is the single most important guardrail against replay storage bleeding money.

### 2.4 One invoice, bundle, cross-sell

- **One invoice across all Desks** — yes; account-level subscription already enforces it. Per-Desk usage appears as line items under the one wallet.
- **Bundle discount** — yes; the "패밀리 번들" callout already exists. A "use 2+ Desks → discount" lever fits the cheap-and-adoption goal.
- **Free-on-one / paid-on-another cross-sell** — natural and recommended: a dev on free remote-devtools sees "add spa-seo-gateway to your account" with no new signup. The shared wallet makes this one-click.
- **Honesty boundary (per memory):** keep DeskCloud's STUB/decision-only billing posture until a real adapter is deliberately enabled. remote-devtools' shipped Stripe path is the one place real money *could* move — gate it behind the platform's adapter selection and keep webhook idempotency; do not silently wire live charges.

**Biggest risk (Axis 2):** metering the *right* unit durably on the **stateful, lossy** remote-devtools gateway. Its buffers drop events under load (30-min max age, oldest-session flush), so naive "count what's persisted" under-bills and "count what's ingested" can over-bill dropped data. Mitigation: meter at gateway connect/disconnect + a sampled event counter flushed on a timer, reconciled against persisted rows — accept small drift, document it, never block ingestion on the meter.

---

## AXIS 3 — Unified admin / operations console (one back-office, no standalone admins)

### 3.1 What exists vs what's net-new

Per Dossier A, the operator console **does not exist** — DeskCloud has only per-tenant self-service (`/dashboard`) + a single-token inquiry triage page (`/admin/inquiries`). So the unified console is **greenfield**, built on `apps/web` + `@desk/core`, reusing: `AdminTokenGuard` (upgraded from one static token to real operator RBAC), the cross-tenant-queryable Drizzle stores (`TenantService`/`UsageMeter`/`BillingService`), the design system, and the `/admin/inquiries` page as the extension pattern.

### 3.2 Console architecture — shell + per-Desk panels

**Pattern recommendation: shared component lib + route registry + server-driven panels — NOT module federation, NOT iframes.** Reasoning:
- All three repos are React 19 + Vite + Tailwind v4 + Radix already (Dossier D) — a **shared `@desk/console-shell`** package (rail, topbar, ⌘K palette, auth gate, breadcrumb, RBAC context) imported by the console app is the lowest-friction, type-safe integration. Module federation adds build complexity for no benefit at this scale; iframes break shared auth/tokens and the design family.
- Each Desk **registers a manifest** (nav items + panel routes + its admin-API base URL) into a route registry. The console mounts each Desk's domain panel as a lazy-loaded route. Panels are **server-driven where possible**: the panel is a thin React surface that calls the Desk's own admin API (guarded by `AdminTokenGuard`/operator JWT), so the Desk keeps owning its domain logic.

**Generic ops → console (lifted out of both candidates):**
- Tenant/org CRUD, list, search (cross-Desk).
- Publishable+secret API-key issue/rotate (shown-once), per tenant.
- Usage/metering dashboards (cross-Desk, reading `UsageMeter`).
- Plan/limit overrides, subscription/billing ops.
- Support/impersonation, audit.

From **spa-seo-gateway** this absorbs: `Tenants`/`TenantDetail`, member RBAC, Login/AuthGate, AuditLog, and the already-DeskCloud-delegated Support/Feedback/Changelog/Notify/Search (mostly deletion). From **remote-devtools** this absorbs: org/members/invites (`SettingsTeam`), Pricing, the billing module's operator surfaces.

**Domain-specific → per-Desk panel mounted in the shell:**
- **spa-seo-gateway panels:** Routes/RouteOverride editor, Sites, Cache (invalidate/clear/hit-ratio), Warm, RenderTest, Lighthouse, VisualDiff, AiSchema, Metrics (Prometheus). 9 panels, tokens already DeskCloud-aligned.
- **remote-devtools panels:** live CDP console, session list/detail, rrweb replays, Jira/Slack issue-tracker config, dashboard/activity/device registry.

These inner domain surfaces stay bespoke (see Axis 4) — the console shell wraps them, it doesn't homogenize them.

### 3.3 Console ↔ Desk API contract

Each Desk exposes an **admin API** under operator auth. Two-layer auth:
- **Operator identity** issued by the platform (replacing the single static `dev-admin-token-change-me`): real operator JWT with roles. The console holds the operator session.
- **Desk-side guard:** `AdminTokenGuard` upgraded to verify the operator JWT + scope, OR the console proxies admin calls through the platform API which holds a per-Desk admin credential (cleaner — Desks trust only the platform, not browser tokens). **Recommend the proxy pattern**: console → platform admin API → Desk admin API. Keeps Desk admin endpoints off the public internet and centralizes audit.

### 3.4 Operator RBAC, impersonation, audit

- **RBAC roles:** `superadmin` (all Desks, billing, impersonation), `support` (read + impersonate, no plan/billing writes), `billing_ops` (subscription/plan, no impersonation), `desk_operator` (scoped to one Desk's panels). Replaces the single shared token entirely.
- **Impersonation:** operator → "view as tenant" mints a short-lived scoped session with an `impersonatedBy` claim; every action while impersonating is audit-logged with both identities. Cross-Desk: impersonation token carries the account id so it works across each Desk's API.
- **Audit:** append-only audit log in the platform (spa-seo-gateway already has an HMAC hash-chain `verifyAuditChain` worth promoting to a shared `@desk/audit` primitive). Every operator action (key rotate, plan override, impersonate, billing change) writes an entry with operator id + target tenant + Desk.

### 3.5 Disposition of existing standalone admins

- **spa-seo-gateway `apps/admin-frontend` / `registerAdminUI`:** **retire the generic pages** (Tenants, members, auth, audit, support — delete or redirect to the console). **Keep only the 9 domain panels**, repackaged as the console-mounted panel bundle; shrink `registerAdminUI` to serve just those (or retire it entirely if the console hosts the panel bundle). The Fastify admin REST endpoints the panels call **stay** (they're the domain API).
- **remote-devtools standalone admin:** already folded into `client/` (Dossier C §3). **Lift** the generic surfaces (org/members/billing/Pricing) out of `client/` into the console; **keep** domain surfaces (live CDP console, replays, Jira config) in-product, mounted into the shell as panels.
- **Both:** old admin URLs → redirect to the unified console route.

**Biggest risk (Axis 3):** the auth-token upgrade. Today DeskCloud's admin is one static shared token and spa-seo-gateway/remote-devtools each have their own admin auth. Standing up real operator RBAC + impersonation + cross-Desk audit *before* wiring panels is the critical path — get it wrong and you either lock operators out or create a cross-tenant data-leak surface. Do this first (Phase 1) and treat the proxy pattern (Desks never trust browser tokens) as the security backstop.

---

## AXIS 4 — Design as a FAMILY (shared DNA + per-Desk character)

Per Dossier D, the three are today *three design systems* (OKLCH / LAB / HSL color spaces; Pretendard / system / Inter fonts; marketing-header / dark-rail / console chassis). The goal is **shared DNA, distinct character** — not one template stamped flat.

### 4.1 What converges (the shared DNA — these become uniform)

- **Token color space → OKLCH, canonical = DeskCloud's `--color-*`**, published as `@desk/tokens`. spa-seo-gateway's LAB `--app-*` and remote-devtools' HSL `--accent` become **alias layers** (`--app-accent: var(--desk-accent)`) — variable-layer swap only, components untouched (low-risk, Phase 0).
- **Typography → Pretendard Variable (UI/한글) + JetBrains Mono (code)**, as `@desk/typography`. Replace spa-seo-gateway's system font and remote-devtools' Inter (Inter→Pretendard fallback chain for latin).
- **Shared shell/chrome:** `@desk/console-shell` (rail + topbar + ⌘K palette + density toggle + theme toggle + ko/en) — composed from remote-devtools' console skeleton (⌘K, collapsible rail, stat cards) + spa-seo-gateway's console maturity (density toggle, multi-panel IA).
- **Shared auth gate** (sk_/Bearer login + session chip + 미인증/데모/프로덕션 indicator), **"Powered by DeskCloud" badge** (replaces "admin console" / "v1.0 오픈베타" placeholders, links back to `/catalog`), **marketing-header lockup** (sticky, blur, 57px, 1px border), **a11y baseline** (SkipLink, RouteAnnouncer, ErrorBoundary, focus mgmt, `useConfirm` over native dialogs), and **shared card-radius / shadow scale / nav active-idle styles**.

### 4.2 What stays distinct (per-Desk character — do NOT homogenize)

- **Per-Desk accent = one hue token swap** on a shared chroma/lightness curve. Core 277 (violet); spa-seo-gateway ≈ 265–277 (indigo, its instrument-console identity); remote-devtools ≈ 230–250 (blue, its Vercel/Linear monochrome+blue identity). Semantic (ok/warn/err), surfaces, borders shared.
- **Inner domain surfaces stay bespoke** — explicitly: the **CDP DevTools workspace** (the vendored Chrome DevTools frontend, 4,753 files, live console, rrweb replay) and the **render/cache config** (RouteOverride editor, Metrics, Lighthouse, VisualDiff). The shell wraps these; it does not flatten them into sameness. spa-seo-gateway's "engineering paper / instrument console" density and remote-devtools' monochrome-dev-tool polish are *features* of their character.
- Each keeps its own hero/marketing identity and domain iconography under the shared header lockup.

### 4.3 Gap assessment & rollout order

- **remote-devtools is closest** (Radix shadcn-style, OKLCH tokens, cmdk, sonner, motion, living `/design`) — mostly token-name reconciliation + font swap. Note mismatches: `lucide-react ^1.18.0` and `motion` package naming differ from siblings — align versions.
- **spa-seo-gateway** is close on tokens (OKLCH `--app-*`, Radix, lucide) but uses **system fonts** and is **console-only** (no marketing landing) — needs the font adoption + a marketing/intro surface with the shared header lockup. It also **already depends on `@heejun/deskcloud`** and renders its data natively — strong head start.

**Rollout:** (Phase 0) publish `@desk/tokens` + `@desk/typography`, apply as alias layers in both — zero component changes. (Phase 2) extract `@desk/console-shell`, mount panels. (Phase 3) shared auth gate + "Powered by DeskCloud" badge + marketing header lockup. (Phase 4) per-Desk `--desk-accent-hue` — "one system, per-Desk accent."

**Biggest risk (Axis 4):** over-homogenizing the inner domain surfaces. The temptation when extracting a shared shell is to also "tidy" the CDP workspace and the render-config density into the house default — which would destroy the exact character (instrument-console density; dev-tool monochrome) that makes these credible developer tools. Mitigation: the shell owns *only* rail/topbar/auth/palette/badge; panels are opaque children with their own internal tokens-on-the-shared-curve. Make this a written boundary in `@desk/console-shell`'s contract.

---

## PHASED ROADMAP

Sequenced so **spa-seo-gateway (easier) lands before remote-devtools (harder)**. Effort: S ≤ ~3d, M ~1–2wk, L ~3wk+.

### Phase 0 — Quick wins (shared, low-risk, parallel) — **S each**
- Publish `@desk/tokens` (OKLCH canonical) + `@desk/typography`; apply as **alias layers** in both candidates (variable swap, no component edits). [Axis 4]
- Add `track` field to `DESK_CATALOG` + "Developer & Infra" facet; add both candidates as catalog entries (keep their names). [Axis 1]
- Drop "Powered by DeskCloud" badge into both (replace placeholder wordmarks). [Axis 4]
- remote-devtools: add a **migration runner** (kill `synchronize:true`) — hardening prerequisite. [Axis 1]
- **Deps:** none. **Risk:** trivial.

### Phase 1 — Platform substrate (the load-bearing greenfield) — **L**
- Build `@desk/billing` into a **real unified billing engine** with the per-Desk `PlanLimit` map + overage (still STUB/decision-only money movement). Define render/session/storage/event dimensions + illustrative tiers. [Axis 2]
- Stand up **operator RBAC + impersonation + cross-Desk audit** on the platform; upgrade `AdminTokenGuard` from static token; promote spa-seo-gateway's HMAC audit chain to `@desk/audit`. [Axis 3]
- Define `@desk/shared` Zod contracts for tenant/plan/usage + the pk_/sk_ hashed-key model. [Axis 1]
- **Deps:** Phase 0 catalog. **Risk (highest in the whole plan):** the auth/RBAC upgrade is the security critical path — proxy pattern as backstop.

### Phase 2 — spa-seo-gateway assimilation — **L (engine untouched bounds it)**
- Re-home control plane: Fastify `preHandler` tenant resolver → `@desk/core` hashed-key lookup; `TenantStore` JSON-file → shared Neon/Drizzle schema; key migration plaintext→hashed (re-issue keys). [Axis 1]
- Per-tenant CORS allowlist (replace global `origin:true`). [Axis 1]
- Wire the pre-defined `UsageEvent{render|cache_hit|warm}` emit points → `UsageMeter`; durable per-tenant attribution. [Axis 2]
- Map plans into `@desk/billing` (rpm Map → durable render-quota limiter). [Axis 2]
- Extract `@desk/console-shell`; mount the **9 domain panels**; delete generic admin pages; redirect old admin URLs. [Axis 3/4]
- Adopt Pretendard/JetBrains; add marketing/intro surface with shared header lockup; set `--desk-accent-hue` (indigo). [Axis 4]
- **Deps:** Phases 1. **Risk:** breaking the host/apiKey/subdomain/pathPrefix resolve strategies during key migration — feature-flag the resolver, dual-read old+new during cutover.

### Phase 3 — remote-devtools tenancy + billing delegation — **M (control plane) + L (SDK/gateway)**
- Delegate org→plan + subscription state to `@desk/core`/`@desk/billing` (swap `AuthService`/`PlanGuard` backing store); retire self-owned plan/Stripe-as-truth, keep webhook idempotency. [Axis 1/2] — **S-M**
- **SDK project/site credential (the linchpin):** issue per-org write keys (pk_-class); validate at the external gateway `handleConnection`/`createRoom`; map key→orgId. SDK currently has *no* credential. [Axis 1/2] — **L**
- **Thread `orgId` through the stateful WS ingest gateway:** stamp `orgId` on `createRoom`/`recordService.create` (today NULL); backfill historical records; make `orgId` NOT NULL. [Axis 1] — **L**
- **Deps:** Phases 1, and SDK-key must precede orgId-threading. **Risk (biggest for this candidate):** the gateway is stateful + single-instance + lossy; threading tenancy without breaking realtime fan-out or sticky-session scaling is delicate. Stage behind self-host bypass; validate fan-out + buffer eviction under load before flipping.

### Phase 4 — remote-devtools metering + console + design — **M-L**
- Metering bridge at gateway connect/disconnect (concurrent sessions, session-minutes) + sampled `cdpEventPersistence` counter + periodic replay-GB rollup (PG + S3) → `@desk/core`; reconcile drift, never block ingest. [Axis 2] — **M-L**
- Enforce illustrative tiers (retention as the storage lever). [Axis 2]
- Mount remote-devtools domain panels (live CDP console, replays, Jira config) into `@desk/console-shell`; lift generic org/members/billing into the unified console; redirect old admin. [Axis 3]
- Align tokens/fonts (Inter→Pretendard, lucide/motion versions), set `--desk-accent-hue` (blue); keep CDP workspace bespoke. [Axis 4]
- **Deps:** Phase 3. **Risk:** metering accuracy on the lossy gateway (see Axis 2 risk).

### Phase 5 — Cross-sell, bundle, polish — **S-M**
- One-invoice line-items, family-bundle discount, free-on-one/paid-on-another cross-sell prompts. [Axis 2]
- Portal "Developer & Infra" track polish; catalog cross-links; final family-resemblance QA (per-Desk accent breathing, shared chrome consistent). [Axis 1/4]

---

## The single biggest risk, per axis (summary)
- **Axis 1 (architecture):** breaking spa-seo-gateway's tenant-resolve strategies during the plaintext→hashed key migration → dual-read + feature-flag cutover.
- **Axis 2 (billing):** metering the right unit durably on remote-devtools' stateful, lossy WS gateway → meter at connect/disconnect + sampled counter, reconcile drift, never block ingest.
- **Axis 3 (admin):** the operator-auth/RBAC upgrade from a single static token (cross-tenant leak vs lockout) → build RBAC+impersonation+audit first; proxy pattern so Desks never trust browser tokens.
- **Axis 4 (design):** over-homogenizing the inner domain surfaces (CDP workspace, render config) → shell owns only chrome; panels are opaque children with per-Desk character on a shared token curve.

**One-line bottom line:** Keep two native hot paths (Chromium render loop; CDP WebSocket gateway) and assimilate everything else — spa-seo-gateway re-homes its Fastify control plane onto a shared Neon/Drizzle tenancy + wires its pre-built `UsageEvent` meter (M-L); remote-devtools delegates tenancy/billing to `@desk/core` while keeping TypeORM, but must invent an SDK credential and thread `orgId` through its stateful gateway (L) — all billing flows through one account-level wallet with per-Desk metered overage priced cheap-but-bounded, all operations run from one RBAC'd operator console with per-Desk panels, and all surfaces share OKLCH+Pretendard+Radix DNA while each keeps its own accent and bespoke domain UI.