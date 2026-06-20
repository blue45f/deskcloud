I now have complete and precise coverage of all five areas. Let me compile the final spec.

# DeskCloud (@desk/platform) — Precise Capability Spec

Yardstick for measuring candidate services against the existing DeskCloud multi-tenant + billing core. All paths absolute; line refs verified against source. Root: `/Users/hjunkim/WebstormProjects/desk-platform`.

**Topline reality check:** This is a working scaffold, not a finished product. Monorepo = `packages/{shared,core,billing}` + `apps/{api,web}` + `vendor/`. Billing is **TEST/STUB only — no real money movement**. The 11+ "Desks" are **marketing entries in a static catalog array; they do NOT exist as registered tenants/services in this repo** — the only real Desk-like consumer wired up is the cross-app **Inquiry board**.

---

## 1. THE DESK ONBOARDING CONTRACT

A Desk becomes "registered" by being a **tenant** in the central API, then reading `tenant.plan` and enforcing `PlanLimit` via shared/vendored code. There is no registration handshake beyond tenant signup + key issuance. Two integration tiers exist:

### Tenant identity & API keys
- **Tenant record** (internal, `packages/core/src/ports.ts:9-20` `TenantRecord`): `{ id, name, slug, publishableKey, secretKeyHash, corsOrigins[], plan, createdAt, updatedAt }`. Public DTO `TenantDto` (`packages/shared/src/dto.ts:4-14`) **never** includes the secret hash. `TenantWithSecretDto` (`dto.ts:20-23`) adds plaintext `secretKey`, returned **once** at signup/rotate.
- **Publishable key** `pk_…` (`packages/shared/src/constants.ts:19`) — public-safe, plaintext stored, browser embed. **Secret key** `sk_…` (`constants.ts:20`) — server-only, **SHA-256(key + DESK_KEY_PEPPER) hash stored** (`packages/shared/src/keys.ts:35-37`), plaintext shown once. Keys = `prefix + base64url(randomBytes(24))` (`keys.ts:17-19`, `constants.ts:23`).
- **Issue/verify/rotate** lives in `packages/core/src/tenant-service.ts`: `signup()` (57-71), `authenticateBySecretKey()` (84-89, hash-narrow then `timingSafeEqual` via `verifySecretKey`), `findByPublishableKey()` (92-94), `rotateKeys()` (119-128, new sk + new pk, old key instantly invalid). Storage abstracted behind `TenantStore` port (`ports.ts:42-53`) — hexagonal; `apps/api` supplies the Drizzle impl.

### CORS allowlist
- Pure logic in `packages/core/src/cors.ts`: `isOriginAllowed(origin, allowlist)` (16-21) — `'*'` allows all, else normalized (trailing-slash-stripped, lowercased) exact match. `corsOriginSchema` validates `https?://host[:port]` or `'*'` (`packages/shared/src/schemas.ts:23-31`).
- Enforced at the gate: `PublishableKeyGuard` (`packages/core/src/nest/publishable-key.guard.ts:38-44`) reads `X-Desk-Key: pk_…`, resolves tenant, checks request `Origin` against `tenant.corsOrigins`, throws `ForbiddenException` on mismatch.

### Usage-metering hooks
- `UsageMeter` (`packages/core/src/usage-meter.ts:22-71`): `record(tenantId, metric, n, period)` (26-34), `getMetric` (37-39), `getUsage` → `Record<UsageMetric, number>` (42-50), `reset` (53-55), and the enforcement entry point `checkAllowed(tenantId, plan, metric)` (61-70) which calls `checkLimit` **before** recording. Backed by `UsageStore` port (`ports.ts:65-74`) with atomic `increment`. Core metrics are fixed: `USAGE_METRICS = ['api_calls','events','storage_mb','seats']` (`constants.ts:10-15`).

### How a Desk reads tenant.plan and enforces PlanLimit
Two parallel enforcement systems exist (this is a real inconsistency to flag):
- **Core path** (`@desk/shared` `PLAN_LIMITS`): fixed-key `PlanLimit` interface (`packages/shared/src/plans.ts:10-27`) + `checkLimit(plan, metric, current)` returning `{allowed, limit, remaining}` (96-105). Hard-cap semantics only.
- **Billing path** (`@desk/billing` `DESK_PLANS`): generic per-Desk metric map + richer `checkLimit` with soft/hard cap + `upgradeUrl` (`packages/billing/src/enforce-limit.ts:69-133`). NestJS adapter: `@EnforceLimit('metric')` decorator + `UsageLimitGuard` + `UsageLimitResolver` (Desk injects) (`packages/billing/src/nest/usage-limit.guard.ts`).

**`PlanLimit` shape (core, `plans.ts:10-27`):**
```ts
interface PlanLimit { label; priceKrwMonthly; priceUsdCentsMonthly; seats; api_calls; events; storage_mb; removableBadge }
```
**`PlanDef` shape (billing/vendor, generic metrics, `limits.ts:28-41`):** `{ plan, label, priceKrwMonthly, priceUsdCentsMonthly, limits: Record<M, number>, features: {removeBranding, customDomain, webhooks}, overagePerUnitKrw? }`.

### Reality: the actual live "Desk" contract is the Inquiry REST API
The only cross-app contract a sibling actually consumes today is **keyless** (`docs/INQUIRY_INTEGRATION.md`): siblings POST/GET `/api/v1/apps/:appId/inquiries` directly with no SDK, no key — `appId` is just the repo slug. The publishable/secret-key SDK contract (`createXClient`) is **documented and marketed but the SDK package `@heejun/deskcloud` does not exist in this repo** (`apps/web/src/data/deskCatalog.ts:36`).

---

## 2. THE PRICING / BILLING MODEL

### Plans / tiers
`PLANS = ['free','pro','scale','enterprise']` (`constants.ts:2`). Real values from `DESK_PLANS` (`packages/billing/src/limits.ts:106-170`) and `PLAN_LIMITS` (`packages/shared/src/plans.ts:29-70`):

| Plan | KRW/mo | USD¢/mo | seats | api_calls | events | storage_mb | removableBadge |
|---|---|---|---|---|---|---|---|
| free | 0 | 0 | 1 | 10,000 | 1,000 | 100 | false |
| pro | 29,000 | 1,900 | 5 | 200,000 | 50,000 | 5,000 | true |
| scale | 99,000 | 7,900 | 20 | 2,000,000 | 500,000 | 50,000 | true |
| enterprise | 0 (sales) | 0 | UNLIMITED(-1) | -1 | -1 | -1 | true |

Billing's `DESK_PLANS` uses **per-Desk generic metrics** instead: `responses, notifications, searches, storageBytes, mediaCount, seats, projects` (`limits.ts:95-103`) — e.g. free `responses:100`, pro `responses:10_000`, with `overagePerUnitKrw: { responses:5, notifications:1 }` (pro). Feature flags per plan: `{removeBranding, customDomain, webhooks}` — free=all false, pro adds webhooks, scale adds customDomain, enterprise=all true.

### Limit dimensions / PlanLimit map shapes
Two shapes coexist (documented as a deliberate dual-source with a "no drift" warning, `vendor/README.md`): the **fixed-key** `PlanLimit` (core/shared, drives `apps/web` pricing + `/api/usage`) and the **generic** `PlanDef` (`limits: Record<M,number>`, drives `/api/billing/plans` + overage). `UNLIMITED = -1` (`constants.ts:32`).

### Usage metering + enforcement
- Metered via `UsageMeter` over `usage_counters` table (`(tenantId, period, metric)` unique, `apps/api/src/db/schema.ts:62-77`). Period = `'current'`→`YYYY-MM` UTC.
- Enforcement policy (`enforce-limit.ts:96-133`): **Free = hard-cap** (block, `allowed=false`); **paid = soft-cap** (allow over-limit, `softCapHit=true`, bill overage); 80% threshold triggers `softCapHit`; enterprise always allowed. Returns `upgradeUrl` + `suggestedPlan` (next tier up).
- Metered overage: `computeOverage()` (`packages/billing/src/overage.ts:61-74`) builds an invoice (`baseKrw + Σ overUnits*unitPriceKrw`) — **display/preview only, never charged**.

### Payment adapters & maturity
`BillingAdapter` port (`packages/billing/src/adapter.ts:66-79`): `createCheckout / getSubscription / cancel / verifyWebhook`. Three impls, **all STUB/TEST-only, in-memory `Map`, `charged: false` always**:
- `StubBillingAdapter` (`stub-adapter.ts`) — default; fake checkout URL, immediate in-memory activation.
- `TossBillingAdapter` (`toss-adapter.ts`) — guards `test_` key prefix, throws on live keys (line 38); fake `test.tosspayments.test` URL.
- `StripeBillingAdapter` (`stripe-adapter.ts`) — guards `sk_test_` prefix; fake `checkout.stripe.test` URL.
Selected by `createBillingAdapter(provider)` from `DESK_BILLING_PROVIDER` env (`factory.ts:14-24`). Webhook verification is stubbed signature-header matching (`x-stub-signature: stub-ok`, etc.) feeding a subscription state machine (`subscription.ts:60-85` transitions; `applyEvent` 143-174).

### ACCOUNT-LEVEL vs PER-DESK — definitive answer
**ACCOUNT-LEVEL.** One tenant → exactly **one** subscription. `subscriptions` table has `unique(tenant_id)` (`schema.ts:97`); `DrizzleSubscriptionStore.getOrCreate/save` upsert by tenantId (`drizzle-subscription.store.ts:44-95`). The pricing page states it explicitly: *"한 번 가입, 전체 패밀리에 적용되는 요금"* and a "패밀리 번들 — 하나의 구독으로 모든 Desk" section (`apps/web/src/pages/PricingPage.tsx:153,181-187`). `tenant.plan` is synced from the subscription on webhook/cancel (`billing.service.ts:113,151`). There is **no per-Desk subscription, no per-Desk plan** anywhere.

---

## 3. ADMIN / OPS SURFACES — (critical)

### (a) Tenant-facing console — EXISTS, mature
`/dashboard` (`apps/web/src/pages/DashboardPage.tsx`), gated by `RequireAuth` (`apps/web/src/app/RequireAuth.tsx`) which checks a session = the tenant's **own secret key** stored in localStorage (`apps/web/src/app/sessionStore.ts`). Login = paste `sk_…`, validated via `GET /tenant` (`LoginPage.tsx:45-47`). Panels: **UsagePanel** (meters per metric), **KeysPanel** (publishable key display/copy, **key-rotation UI** with one-time secret dialog, badge preview), **SettingsPanel** (name + CORS origins editor), **BillingPanel** (plan compare, upgrade→checkout, cancel→Free). This is **self-service for one's own tenant only** — not an operator console.

### (b) Operator / superadmin / back-office console — DOES NOT EXIST (almost)
**There is no cross-tenant operator console.** No route lists all tenants, no impersonation, no plan-limit override UI, no cross-Desk usage dashboard, no support tooling. The closest thing:
- **`/admin/inquiries`** (`apps/web/src/pages/AdminInquiriesPage.tsx`) — the **only** back-office surface. It's a **public route** whose data is gated by an `X-Admin-Token` header the operator pastes in (stored in localStorage, `AdminInquiriesPage.tsx:24,283-292`). It triages the **Inquiry board** per `appId` (status changes new→in_progress→resolved→closed). It is **per-app inquiry triage, not tenant/billing administration** — you must type each `appId` manually; there's no global list.

### Guards / auth primitives available to build a unified console on
- **`AdminTokenGuard`** (`packages/core/src/nest/admin-token.guard.ts`) — checks `X-Admin-Token === CoreOptions.adminToken` (single shared static token, `apps/api/src/config.ts:35` default `'dev-admin-token-change-me'`). Currently used **only** on inquiry admin endpoints (`inquiries.controller.ts:83,95`).
- **`SecretKeyGuard`** / **`PublishableKeyGuard`** (`packages/core/src/nest/`) — per-tenant auth, attach `req.deskTenant`.
- Swagger declares an `adminToken` API-key scheme (`apps/api/src/main.ts:37`) but **no `/admin/*` tenant/billing routes exist** — CLAUDE.md notes them as "추후(future) `/admin/*`" (`CLAUDE.md:44`).

**Bottom line for the plan:** A single unified admin console would be **net-new**. The reusable substrate is: `AdminTokenGuard` (needs upgrading from one static token to real operator auth), the existing tenant/usage/subscription Drizzle stores + `TenantService`/`UsageMeter`/`BillingService` (all queryable cross-tenant server-side), and the `apps/web` design system + the existing `/admin/inquiries` page as the one back-office UI pattern to extend. Each Desk does **not** ship its own admin here — they're not even real services; the inquiry triage board is the only multi-app admin precedent.

---

## 4. PORTAL WEB IA + DESIGN SYSTEM

### Routes / nav (`apps/web/src/router/index.tsx`)
- **Public shell** (`PublicLayout`, `SiteHeader`+`SiteFooter`): `/` (Landing), `/catalog`, `/pricing`, `/docs`, `/signup`, `/login`.
- **Standalone-header public**: `/design` (live style guide), `/sitemap`, `/admin/inquiries`.
- **Console** (`RequireAuth`→`AppLayout`): `/dashboard`.
- `*` → NotFound. Code-split with stale-chunk auto-reload guard (`router/index.tsx:18-33`).
- **Header nav** (`SiteHeader.tsx:12-17`): 서비스 카탈로그 / 요금제 / 문서 / 사이트맵 + theme toggle + login/signup or dashboard + `MemberAuthControl` (Firebase Google login, `apps/web/src/lib/firebaseAuth/`).

### Pricing page structure (`pages/PricingPage.tsx`)
4-column plan grid from `GET /api/billing/plans` (single source), with **static fallback** derived from `PLAN_LIMITS` if API unreachable (15-36). Per card: tagline, price (KRW, "문의" for enterprise), CTA (signup / sales mailto), limit list (api_calls/events/storage/seats), feature rows (badge removal/custom domain/webhooks). Pro = featured "인기". Plus a "패밀리 번들" callout.

### Design system stack
- **Tailwind v4** (`@tailwindcss/vite`, `apps/web/package.json:34,41`) + **OKLCH design tokens** via `@theme` with light defaults and `.dark` runtime overrides (`apps/web/src/styles/index.css:7-92`) — DeskCloud brand = indigo/cyan accent (`--color-accent: oklch(0.62 0.18 277)`). Pretendard font.
- **Radix UI** primitives: `react-dialog`, `react-slot`, `react-tabs`, `react-tooltip` (`package.json:17-20`). **CVA + tailwind-merge + clsx** for variants (`components/ui/buttonVariants.ts`, `utils/cn.ts`). UI kit in `components/ui/` (button, card, badge, dialog, tabs, meter, stat-card, field, feedback, code-block, install-tabs, tooltip).
- **React 19 + React Compiler** (`babel-plugin-react-compiler`, `package.json:38`), **Vite 7 + PWA** plugin, TanStack Query, Zustand.
- Repo-wide lint = **`@heejun/eslint-config`** flat config + `@heejun/prettier-config` (`eslint.config.mjs:1`, root `package.json`). a11y baseline present: SkipLink, RouteAnnouncer, RouteError, ErrorBoundary, focus management (`components/common/`).

### How Desks are listed/marketed
Landing (`pages/LandingPage.tsx`) value props + SDK install tabs (npm/pnpm/yarn/bun) + a `PRODUCT_DESKS` grid + 3-step onboarding. Catalog (`pages/CatalogPage.tsx`) renders each Desk with its `createXClient` SDK snippet. Docs (`pages/DocsPage.tsx`) document the pk_/sk_ split (`createXClient` browser / `createXAdminClient` via `/server`). **All of this markets a non-existent unified SDK** (`@heejun/deskcloud`).

---

## 5. THE DESK CATALOG / REGISTRY

**There is exactly one registry: a static array, `DESK_CATALOG` in `apps/web/src/data/deskCatalog.ts:125-321`.** It is pure data (no API, no DB table) — `readonly DeskEntry[]`. The `DeskEntry` type (`deskCatalog.ts:56-85`): `{ id, name, tagline, what, icon (lucide), tone, status:'live', sdkFactory?, sdkVar?, sdkUsage?, metrics[], isCore? }`.

- 15 entries: 1 core (`@desk/platform`, `isCore:true`) + 14 product Desks: TermsDesk, SurveyDesk, ChangelogDesk, ReviewDesk, MediaDesk, NotifyDesk, ModerationDesk, RealtimeDesk, SearchDesk, CommunityDesk, ChatDesk, AdDesk, AuthDesk, FileDesk. All hardcoded `status:'live'` — **marketing claim, not a runtime/health check.** Derived views: `PRODUCT_DESKS` (filters out core, line 324).
- **To add a new Desk to what users see:** append a `DeskEntry` to `DESK_CATALOG`. That's the entire mechanism — it surfaces it on Landing/Catalog/Docs grids and generates its SDK snippet. No backend registration, no tenant creation, no DB row.
- **The other "registry" of real consumers** is the `appId` list in `docs/INQUIRY_INTEGRATION.md` (rotifolk, offhours, pettography, etc.) — but that's free-form: any slug works against the keyless inquiry API; there's no enforced allowlist of appIds in code.

---

### Key gaps a candidate service is being measured against
1. **No operator/superadmin console** — only per-tenant self-service + per-app inquiry triage. A unified cross-Desk admin (tenant list, impersonation, usage/billing overview, limit overrides) is greenfield.
2. **Single static admin token**, not real operator identity/RBAC.
3. **Dual PlanLimit sources** (`PLAN_LIMITS` fixed-key vs `DESK_PLANS` generic) kept in sync only by a doc warning.
4. **The SDK (`@heejun/deskcloud`) and the 14 product Desks are marketing fiction** in this repo; the only real cross-app integration is the keyless Inquiry board. Billing is account-level, STUB-only, zero real charges.

Relevant files: `/Users/hjunkim/WebstormProjects/desk-platform/{README.md, CLAUDE.md}`, `packages/shared/src/{constants,plans,billing,keys,dto,schemas}.ts`, `packages/core/src/{tenant-service,usage-meter,cors,ports}.ts` + `src/nest/*.ts`, `packages/billing/src/{limits,enforce-limit,adapter,*-adapter,subscription,overage,factory}.ts` + `src/nest/usage-limit.guard.ts`, `apps/api/src/{app.module,main,config}.ts` + `src/{tenants,billing,inquiries,core,db}/*`, `apps/web/src/{router/index,data/deskCatalog,services/api,app/sessionStore}.tsx?` + `src/pages/{Pricing,Dashboard,AdminInquiries,Landing,Sitemap}.tsx` + `src/styles/index.css`, `vendor/{plan-limits.ts,PoweredByDeskCloud.tsx,README.md}`, `docs/INQUIRY_INTEGRATION.md`.