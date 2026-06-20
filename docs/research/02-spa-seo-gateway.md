I now have a complete picture. Synthesizing the report.

# spa-seo-gateway — Analysis for DeskCloud Unification

## 1. WHAT IT IS + tech stack + workspace layout

A **high-performance dynamic-rendering SEO gateway**: an SPA's bot traffic is rendered on-demand with headless Chromium so bots get finished HTML while humans get the original SPA. Cache/SWR/warming are stated as secondary optimizations; the core is on-demand bot-time rendering (`README.md:5`). It positions itself as the OSS replacement for Rendertron / Prerender.io (`README.md:7`).

**Tech stack — Fastify, NOT NestJS.** The HTTP layer is plain Fastify v5 throughout (`apps/gateway/package.json` deps `fastify`, `@fastify/compress|cors|http-proxy|rate-limit`; all packages depend on `fastify@^5.8.5`). The control plane is hand-written Fastify route handlers + Zod v4 validation — no NestJS, no DI container, no decorators. The render engine is `puppeteer` + `puppeteer-cluster` (`packages/core/package.json`). Node ≥24.16, pnpm 11, ESM `"type":"module"`, TypeScript 6 (`package.json`).

**Three modes via `GATEWAY_MODE`** (`packages/core/src/config.ts:64` → enum `render-only | proxy | cms | saas`), wired in `apps/gateway/src/main.ts:77-87`:
- `render-only`/`proxy` → `registerRoutes` (single-site).
- `cms` → `registerCms` (one org, many sites, host-based).
- `saas` → `registerMultiTenant` (external multi-tenant, apiKey/host).
Admin UI (`registerAdminUI`) is registered in every mode and auto-detects mode (`README.md:26-28`).

**Workspace (pnpm, `pnpm-workspace.yaml` = `packages/*` + `apps/*`):**
- `packages/core` → `@heejun/spa-seo-gateway-core` v1.9.0 — framework-agnostic engine (renderer, pool, cache, quality gate, metrics, adapters, audit, warmer; 23 files in `packages/core/src/`).
- `packages/admin-ui` → `@heejun/spa-seo-gateway-admin-ui` v1.10.0 — Fastify plugin serving the built React SPA + admin REST API (single file `packages/admin-ui/src/index.ts`, 408 lines).
- `packages/multi-tenant` → `@heejun/spa-seo-gateway-multi-tenant` v1.9.1 — **saas mode** (single file `packages/multi-tenant/src/index.ts`, 701 lines).
- `packages/cms` → `@heejun/spa-seo-gateway-cms` v1.9.1 — **cms mode** (single file, 388 lines).
- `packages/cli`, `packages/anthropic`, `packages/openai` — CLI + optional BYO AI adapters.
- `apps/gateway` — runnable single binary composing the above.
- `apps/admin-frontend` — Vite + React 19 (React Compiler) + Tailwind v4 SPA; builds into `packages/admin-ui/public` (`apps/admin-frontend/vite.config.ts` `outDir`).
- `apps/demo` — static Vercel demo build.

## 2. EXISTING MULTI-TENANCY MODEL (saas mode)

All of saas lives in `packages/multi-tenant/src/index.ts`.

**Tenant identification** — `registerMultiTenant` takes `resolve?: Array<'host'|'apiKey'|'subdomain'|'pathPrefix'>` (default `['host','apiKey']`, `index.ts:342,351`). A `preHandler` hook resolves the tenant per request (`index.ts:523-550`):
- `host` → `store.byHost(x-forwarded-host || host)` matches `new URL(tenant.origin).host`.
- `apiKey` → `store.byApiKey(req.headers['x-api-key'])`.
- `subdomain` → first label of host as tenant id.
- `pathPrefix` → `/t/:id` regex.
Resolved tenant is attached as `req.tenant` only if `tenant.enabled` (`index.ts:549`), via a Fastify module augmentation (`index.ts:212-216`).

**API keys** — generated client-side (`apps/admin-frontend/src/lib/apikey.ts`): 160-bit Web-Crypto random, `tk_live_` prefix. Stored **in plaintext** inside the tenant record (schema `apiKey: z.string().min(20)`, `index.ts:65`). Verification is a **linear plaintext scan** (`InMemoryTenantStore.byApiKey` loops all tenants, `index.ts:121-124`; `FileTenantStore.byApiKey` re-reads + `.find`, `index.ts:176-178`). No hashing, no key rotation server-side (rotation just regenerates client-side and re-POSTs the tenant, `TenantDetail.tsx` `rotateApiKey`). The key doubles as the auth token for the tenant-facing `POST /api/cache/invalidate` (`index.ts:659-681`).

**Master admin manages** (all guarded by `guardAdmin` = `x-admin-token` header OR `seo-admin` httpOnly cookie === `config.adminToken`, `index.ts:353-365`):
- Tenant CRUD: `GET/POST /admin/api/tenants`, `DELETE /admin/api/tenants/:id` (`index.ts:381-428`).
- Tenant members: `GET/POST /admin/api/tenants/:id/members`, `DELETE …/:email` — roles `owner|admin|editor|viewer`, status `active|invited|suspended`, with last-owner / last-active-owner guards (`index.ts:431-520`, `memberOwnerError` at `:292`).
- Stats + cache clear: `GET /admin/api/multi-tenant/stats`, `POST …/cache/clear` (`index.ts:684-698`).

**Types / persistence:**
```ts
type Tenant = { id; name; origin; apiKey; routes: RouteOverride[];
                members?: TenantMember[]; plan: 'free'|'pro'|'enterprise';
                enabled; createdAt? }   // index.ts:57-101
interface TenantStore { list; byId; byApiKey; byHost; upsert; remove }  // index.ts:103-110
```
Two impls: `InMemoryTenantStore` and `FileTenantStore` (atomic write via tmp+rename, `index.ts:163-168`). **Persistence is a single JSON file on local disk** (`config.tenantStoreFile = '.data/tenants.json'`, `config.ts:65`; wired in `main.ts:78`). The docs explicitly note: "분산 환경에서는 외부 KV/DB 어댑터를 직접 구현" (`docs/MULTI-TENANT.md`) — no DB, no Drizzle, no shared store. Per-tenant rate limiting is an **in-process Map** by plan (`PLAN_LIMITS` free 100 / pro 1000 / enterprise ∞ rpm, `index.ts:219-241`) — not durable, not cluster-safe.

## 3. EXISTING ADMIN APP — domain-specific vs generic platform ops

The standalone admin is the React SPA in `apps/admin-frontend` (served at `/admin/ui` by the `admin-ui` Fastify plugin). Pages live in `apps/admin-frontend/src/pages/` (23 pages); the single source of truth for nav/router/command-palette is `apps/admin-frontend/src/lib/nav.ts`. Mode-specific pages are filtered: `sites` → `modes:['cms']`, `tenants` → `modes:['saas']` (`nav.ts`).

What it does, split for the unified-console plan:

**GENERIC platform ops (a unified DeskCloud console would absorb these):**
- **Tenant CRUD + plan + enable/disable** — `Tenants.tsx` (list/filter/create/edit/delete, plan pills free/pro/enterprise) + `TenantDetail.tsx` (metadata edit, ⌘S save). Pure tenancy.
- **API-key management** — generate (`lib/apikey.ts`), mask-display, copy, rotate (`Tenants.tsx`, `TenantDetail.tsx`). Pure credential ops.
- **Members / RBAC** — owner/admin/editor/viewer + invited/active/suspended (`MemberAuthControl.tsx`, multi-tenant member routes). Pure IAM.
- **Auth** — `LoginForm`/`AuthGate` (admin token → cookie) + Firebase auth (`lib/firebaseAuth/*`) for member sign-in. Platform identity.
- **Audit log** — `AuditLog.tsx` + core HMAC hash-chain (`audit.ts`, `verifyAuditChain`). Platform observability.
- **Support / feedback / changelog / notifications / search** — already delegated to DeskCloud (`components/deskcloud/*`, `Support.tsx`, `FeedbackWidget`). **DeskCloud is already a dependency** (`@heejun/deskcloud@^0.1.0` in `apps/admin-frontend/package.json`; pk_-only browser clients in `components/deskcloud/clients.ts`, env-gated, first-party fallback).

**DOMAIN-SPECIFIC (must stay as gateway panels contributed to the console):**
- **Routes / RouteOverride editor** — `Routes.tsx`, `RoutesEditor.tsx` (pattern regex, ttlMs, waitUntil, waitSelector, blockResourceTypes, viewport, schemaTemplate, A/B variants).
- **Sites** (cms) — `Sites.tsx`, `SiteDetail.tsx` (origin/routes/webhooks per site).
- **Cache ops** — `Cache.tsx` (invalidate URL, clear namespace, hit-ratio stats).
- **Warming** — `Warm.tsx` (sitemap-driven prerender warm).
- **Render test / Lighthouse / Visual diff / AI schema** — `RenderTest.tsx`, `Lighthouse.tsx`, `VisualDiff.tsx`, `AiSchema.tsx` (all rendering-engine-specific).
- **Metrics** — `Metrics.tsx` parses Prometheus `/metrics` (cache hit ratio, inflight, render histograms, errors) — gateway-specific telemetry.

## 4. METERING UNITS that matter for billing

Billing-relevant units the gateway could meter (current state in parens):
- **Renders/month** — the real headless-Chromium event. Counted as a Prometheus counter only: `gateway_http_requests_total{kind=origin}` and `gateway_render_duration_ms` (`metrics.ts`, `renderer.ts`). Not attributed durably per tenant for billing.
- **Cache hits vs misses** — `gateway_cache_events_total{event=hit|miss|swr}` (`cache.ts:128-139`). A miss == a render == cost; a hit is near-free.
- **Render concurrency** — `gateway_inflight_renders` gauge + pool `maxConcurrency=poolMax` (default 8, `config.ts:75`, `pool.ts:46`). This is the hard throughput cap.
- **Cached page count / cache storage** — memory LRU `maxItems` 500 / `maxBytes` 100 MB + Redis tier (`config.ts:140-163`); Brotli-compressed entries (`cache.ts:28-34`). Not metered per tenant.
- **Warming jobs** — `warmFromSitemap` cron + on-demand (`warm-cron.ts`, `prerender-warmer.ts`); each warmed URL is a render. `report.warmed` is logged/audited, not billed.
- **Bandwidth/egress** — response bytes (`render-test` reports `Buffer.byteLength`); not aggregated/metered.
- **Tenant count** — `multi-tenant/stats.tenantCount` (`index.ts:689`).

**Real cost driver = headless Chromium CPU/RAM per render (cache miss).** Each miss launches a Chromium context through `puppeteer-cluster CONCURRENCY_CONTEXT`, capped at `poolMax`, recycled every `maxRequestsPerBrowser` (1000) to fight memory leaks (`pool.ts`). So the billable primitives are **renders (cache misses) + warming jobs (each is a render) + concurrency ceiling**; cache hits, bandwidth, and stored-page count are second-order. Resource blocking (images/fonts/ad domains) exists precisely to cut per-render CPU 50–70% (`config.ts:82-121`, `README.md:36`).

## 5. EXISTING PRICING/PLANS (verbatim)

**No pricing exists** (no dollar amounts, no `$`, no per-month strings anywhere outside DeskCloud UI copy). There is only a **plan enum and a rate-limit table**:
```ts
// packages/multi-tenant/src/index.ts:81
plan: z.enum(['free', 'pro', 'enterprise']).default('free')

// packages/multi-tenant/src/index.ts:219-223  (requests per minute)
const PLAN_LIMITS: Record<Tenant['plan'], number> = {
  free: 100,
  pro: 1000,
  enterprise: Number.POSITIVE_INFINITY,
}
```
A **`BillingAdapter` interface exists but is never invoked** — a BYO stub:
```ts
// packages/core/src/adapters.ts:46-58
export type UsageEvent = { tenantId; metric: 'render'|'cache_hit'|'warm'; count; ts }
export interface BillingAdapter {
  reportUsage(events: UsageEvent[]): Promise<void>
  getLimits(plan: string): Promise<Record<string, number>>
}
```
`getBillingAdapter`/`setBillingAdapter`/`reportUsage` are exported from `core/src/index.ts` but **have zero call sites** in `packages/`/`apps/` (verified by grep). So metering→billing is entirely unwired; only the plan→rate-limit mapping is live.

## 6. DESIGN LANGUAGE of the admin UI

- **Framework:** React 19.2 + React Compiler (babel preset via `@rolldown/plugin-babel`, `vite.config.ts`), React Router 7, TanStack Query 5, Zustand 5, Vite 8 (Rolldown), Tailwind v4. Component primitives via **Radix** (`@radix-ui/react-dialog`) + `lucide-react` icons + Storybook 10. (README §41 still mentions "Alpine.js + Tailwind" for the embedded admin — that's stale; the actual SPA is React.)
- **Tokens:** custom **OKLCH** design system in `apps/admin-frontend/src/styles.css` — "engineering paper / instrument console" theme: warm-neutral paper (`--app-bg: oklch(0.974 0.005 80)`), single violet-blue accent `oklch(0.54 0.185 285)` for primary/focus only (<10% area), 3-status colors (green/amber/red hue-separated), a fixed dark sidebar rail, light/dark via `.dark` variant, compact-density mode. Tailwind `@theme inline` maps tokens to `--color-*` utilities (`bg-surface`, `text-ink`, `badge--ok`, `panel`, `btn-primary`, etc.). No `#000/#fff`. There is a living `/design` style-guide page (`pages/Design.tsx`) and a11y baseline (axe Playwright tests, skip links, route announcer).

This design language is **already DeskCloud-aligned**: `@heejun/deskcloud` is a dependency and its data (changelog/notify/search/feedback) is rendered through the app's own tokens, not vendor widgets (`components/deskcloud/clients.ts`).

## 7. GAP-TO-DESK — what must change

It already has multi-tenant + apiKey + members + admin + a DeskCloud-aligned UI, so this is reconciliation, not greenfield.

**(a) Delegate tenancy/keys/CORS/metering/billing to @desk/core + @desk/billing**
- **Tenancy/keys → @desk/core:** Replace `TenantStore` + `FileTenantStore` JSON-on-disk with `@desk/core`'s multi-tenant store; map `Tenant.id/origin/routes/plan/members` onto DeskCloud's tenant + membership model. Key storage must move from **plaintext in the tenant JSON** to DeskCloud's `pk_`/`sk_` hashed-credential model (the repo already knows pk_/sk_ semantics from `clients.ts`). Replace the linear `byApiKey` scan with an indexed/hashed lookup. **Effort: L** (data model migration + key re-issue + the saas request resolver `preHandler` must call out to @desk/core; risk of breaking host/apiKey/subdomain/pathPrefix strategies).
- **CORS:** today global `origin:true, credentials:false` (`main.ts:56-59`) — must become per-tenant allow-listing driven by tenant config. **Effort: S–M.**
- **Metering:** the `UsageEvent{render|cache_hit|warm}` shape already exists; wire `reportUsage` at the three real emit points — render path in `multi-tenant`/`cms` handlers (`index.ts:623-645`), cache hit/miss in `cache.ts:128-139`, and `warmFromSitemap`. **Effort: M** (the interface is there but completely unwired; needs per-tenant attribution + durable aggregation, not in-process Maps).
- **Billing/plans → @desk/billing:** `PLAN_LIMITS` (rpm) and the free/pro/enterprise enum become @desk/billing plan definitions; the in-process rate-limit Map (`index.ts:224`) must move to a durable/cluster-safe limiter keyed by render quota, not just rpm. There is **no pricing today** so this is additive. **Effort: M.**

**(b) Reconcile Fastify with DeskCloud's NestJS+Drizzle conventions**
- **Recommended: keep the Fastify render engine, front the control plane with the platform.** `@heejun/spa-seo-gateway-core` is deliberately HTTP-agnostic — keep it (puppeteer pool, cache, quality, warmer) untouched. The **render data plane stays Fastify** (Chromium throughput needs the lean Fastify hot path; rewriting it on Nest buys nothing and risks the pool/concurrency tuning). Move only the **control plane** (tenant/key/member/billing CRUD currently in `multi-tenant`/`cms` admin routes) behind DeskCloud's NestJS+Drizzle services, or expose them as @desk/core REST the gateway calls. A full NestJS rewrite of the gateway is **not recommended** (would entangle the render engine with DI for no benefit). Persistence moves JSON-file → **Drizzle/Postgres** (Neon, per the standardization memory). **Effort: L** (control-plane re-home + Drizzle schema for tenants/keys/members/usage; keep render plane Fastify = bounded).

**(c) Retire standalone admin in favor of domain panels in the unified console**
- **Drop** the generic pages — `Tenants`, `TenantDetail`, member RBAC, Login/AuthGate, AuditLog, Support/Feedback/Changelog/Notify/Search — these become the unified DeskCloud console's responsibility (Support/feedback/changelog/notify/search are **already** DeskCloud-delegated, so this is mostly deletion).
- **Contribute as domain panels** only the rendering-specific surfaces: Routes/RouteOverride editor, Sites, Cache, Warm, RenderTest, Lighthouse, VisualDiff, AiSchema, Metrics. These map cleanly to remote-mounted panels because the design tokens are already DeskCloud-aligned (OKLCH system in `styles.css`, Radix + lucide).
- The `admin-ui` Fastify plugin (`registerAdminUI`) and its SPA-fallback static serving can shrink to just the domain panel bundle (or be retired if panels are hosted by the console). **Effort: M** (mechanical removal of generic pages + nav filtering in `nav.ts`; the domain panels still need their gateway REST endpoints, which stay).

**Effort summary:** (a) Tenancy/keys L · CORS S-M · Metering M · Billing M; (b) Control-plane re-home + Drizzle L (render plane stays Fastify = no rewrite); (c) Admin retirement + domain-panel contribution M. **Lowest-risk path:** keep core engine + Fastify render plane as-is, re-home the control plane onto @desk/core/@desk/billing with Drizzle persistence, wire the already-defined `UsageEvent` emit points, and delete the generic admin pages (keeping the 9 domain panels).

Key file refs: `packages/multi-tenant/src/index.ts` (saas), `packages/cms/src/index.ts` (cms), `packages/admin-ui/src/index.ts` (admin plugin/REST), `packages/core/src/adapters.ts:46-70` (unwired BillingAdapter/UsageEvent), `packages/core/src/config.ts:64-65,138-169` (modes, store files, cache), `packages/core/src/cache.ts:128-139` + `packages/core/src/metrics.ts` (metering points), `packages/core/src/pool.ts` (cost driver), `apps/admin-frontend/src/lib/nav.ts` (page/mode map), `apps/admin-frontend/src/styles.css` (OKLCH tokens), `apps/admin-frontend/src/components/deskcloud/clients.ts` (existing DeskCloud delegation).