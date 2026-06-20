---

# TermsDesk — Gold-Standard DeskCloud Desk: Analysis Report

**Repo:** `/Users/hjunkim/WebstormProjects/termsdesk` (pnpm monorepo · `web:5270` / `api:4070` · NestJS 11 + Drizzle + Zod · React 19 + Vite 8 + Tailwind v4)
**Method:** read `git log` (60 commits + 10-week `--stat`), `README.md`, `docs/*`, root `package.json`/`pnpm-workspace.yaml`, `apps/api/src/*` modules, `apps/web/src/*`, `packages/{shared,sdk}/src/*`. **No `CHANGELOG.md` and no committed `CLAUDE.md` exist** (`git ls-files | grep -i claude` → empty; the §7.2 exception note in memory does not apply here). Product evolution is reconstructed from commit history.

---

## 1. RECENTLY-ADDED FEATURES

The repo's first commit (`ce10daa`) scaffolded the monorepo; the early arc built the **core terms-registry product** (immutable versioning, content-hash freeze, consent receipts, RBAC, API keys, CSV export, embed SDK). The **recent** arc (top of `git log`) is dominated by two thrusts: a large new **Brokerage** product surface, and **platform/design-system adoption**.

### PRODUCT features (recently added)

| Feature | What it adds | Commits |
|---|---|---|
| **Brokerage marketplace (flagship new product)** | A whole "terms-request" two-sided marketplace: requesters post draft/review/update/translate jobs; experts/providers bid; an operator moderates. New `apps/api/src/brokerage/` module (1,310-line service), `packages/shared/src/brokerage.ts` contracts, and 7 web pages (`RequestsPage`, `MarketplacePage`, `ExpertProfilePage`, `ModerationPage`, `RequestDetailPage`, etc.). | `4ca6b21`, `c7505d2` (3,094 LoC), `1bc3d62` (3,111 LoC web) |
| **Import-to-policy bridge** | Delivered brokerage work imports into a policy **draft version** — wiring the marketplace back into the core version-management spine. | `d6fe4b7`, `edc4c45` |
| **Mock escrow** | `held → released → refunded` status on accept/complete/cancel. Explicitly **no real money movement** (`packages/shared/src/brokerage.ts:53-65`, "실제 자금 이동 없음"). | `5214959`, `65b6035`, `90dc679` |
| **Provider ratings & reviews** | Rating/review contract + API + UI (`ee4eb46`, `3cf7512`, `2366d9d`). | three commits |
| **Dispute workflow** | Deepened dispute flow with shared contracts, API, and moderation/request-detail UI. | `05dd124`, `bff9c8d`, `1dae98d` |
| **Brokerage attachment uploads (S3/R2)** | `attachment-storage.service.ts` + `@aws-sdk` client; env-gated S3/R2 bucket. | `8679376`, `f479856`, `c8fa1a2`, `1e41762` |
| **In-app notifications** | New `notifications` module + shared contract; events emitted on brokerage actions; **NotificationBell with unread badge** in the topbar. | `5edf87d`, `4ed3f19`, `36ef118` |
| **Quick-start request templates** | Pre-filled request templates on `RequestsPage`. | `c86f45f` |
| **Public provider directory + expert pages** | Unauthenticated `public-providers` API + `PublicExpertsPage`/`PublicExpertProfilePage` (SEO surface). | `e629424`, `ff8f235` |
| **Beta sitemap** | `SitemapPage.tsx` (219 LoC) + nav, root sitemap routed through API. | `79c66e3`, `aab9764`, `bc20bec` |
| **Dashboard signals** | Actionable brokerage signals surfaced on the dashboard. | `dca5b51` |

Note: the **pre-existing core product surface** (also present and mature) includes immutable policy versioning + `DiffView`/`VersionTimeline`, append-only **consent receipts**, **tamper-evidence verify endpoint** (`7fc2e1c`), **CSV export** (`apps/api/src/export/export.controller.ts` → `GET /export/consents.csv`, `GET /export/policies/:id/versions.csv`), **insights/analytics** (`GET /insights/consents/daily`, `/reconsent`, `/apikeys`), **public terms rendering** + **embed.js widget** + **React `<ConsentGate>` SDK**, **inquiries/support** boards, and Google Sign-In + guest demo mode.

### PLATFORM / INFRA (recently added)

| Item | Commit |
|---|---|
| **Native `@heejun/deskcloud` SDK integration** — replaced ~3,600 LoC of bespoke ChangelogWidget/NotificationBell/SearchPalette/FeedbackWidget with the typed browser client + first-party render (`ChangelogLauncher`/`NotifyInbox`). | `83a07b6` (−3,647/+672) |
| **Wired DeskCloud widgets + commit gates** (initial adoption, later refactored to native). | `6eccdd4` |
| **Shared `@heejun` eslint + prettier config adoption**; dropped `class-validator`/`class-transformer`. | `6673226`, `33c1d41` |
| **`/design` living styleguide route + UX polish.** | `2f41e52` (#18) |
| **Theme state moved Context → zustand store.** | `4dcc6a8` (#17) |
| **Global `AllExceptionsFilter`** (backward-compatible error envelope). | `4cc93f0` (#16) |
| **`verbatimModuleSyntax` + non-fatal env validation.** | `2388872` (#15) |
| **Coderabbit gate workflow + commit-msg gate; CI concurrency cancellation & doc-path skips** (cut paid minutes). | `6eccdd4`, `d2f23a9` |
| **Postgres transient-query retry; security/audit gates** (`audit:security` ignore-list persisted in `pnpm-workspace.yaml`). | `3143796`, `0552a11`, `fb2ce7a` |

---

## 2. PLATFORM INTEGRATION

**Critical framing:** TermsDesk does **not** depend on a server-side `@desk/platform` / `@desk/core` / `@desk/billing` package for tenancy or billing. Those concerns are implemented **in-repo**. Its `@desk/platform`-family touchpoint is the **`@heejun/deskcloud` browser SDK** consumed by the web app. This is the actual shape the parity targets must match.

### Tenancy (in-repo, not `@desk/core`)
- `organizations` is a first-class table with `plan` column (`apps/api/src/db/schema.ts:14-24`). Tenant identity rides on the session: `AuthUser { userId, orgId, role, name, email }` (`apps/api/src/common/request-context.ts`), injected by `session.guard.ts:43-53` from the user's `org_id` FK. Every query is scoped `eq(table.orgId, orgId)`. Dual mode: `TERMSDESK_MODE=self-hosted` (single-tenant) vs `saas` (multi-tenant) — `apps/api/src/config.ts:41`.
- The `CoreModule` (`apps/api/src/core/core.module.ts`) is a **local** `@Global()` module exporting `APP_CONFIG`, `DatabaseService`, `AuditService`, `PlanService` — **not** the platform `@desk/core`.

### API keys — single secret key, `tdk_` prefix
- `generateApiKey()` → `tdk_<base64url(24 bytes)>`, prefix = first 11 chars, **SHA-256 hash stored** (`apps/api/src/common/crypto.ts:19-28`). Schema: `api_keys` with unique `keyHash`, CSV `scopes` default `read:current,write:consent` (`schema.ts:45-57`).
- `ApiKeyGuard` (`apps/api/src/auth/api-key.guard.ts:30-68`): `Authorization: Bearer tdk_…` → lookup by hash → reject revoked → set `req.apiKey = { keyId, orgId, scopes }` → **`this.plans.meterApiCall(key.orgId)`** before the handler runs.
- TermsDesk uses **one secret-style key** (`tdk_`), not a separate publishable+secret pair. The **publishable `pk_` / secret `sk_` split lives on the DeskCloud platform side**, consumed by the web app (see below). `.env.example`: *"secret 키(`sk_…`)는 브라우저에 절대 넣지 마세요 — 서버 전용."*

### CORS allowlist
- Server CORS is permissive-reflective: `app.enableCors({ origin: true, credentials: true })` (`apps/api/src/main.ts:25`).
- The **real allowlist** is a per-deployment **soft origin allowlist for public inquiry submission**: `inquiryAllowedOrigins` from `INQUIRY_ALLOWED_ORIGINS` (comma-split, normalized lowercase, trailing-slash-stripped — `config.ts:55-58`), enforced in `inquiries.service.ts` (`assertOriginAllowed` → 403; empty list = allow-all). It is **not** per-org.

### UsageMeter + PlanLimit (the metered dimensions and values)
Single source of truth: `packages/shared/src/plans.ts:30-34`. **4 dimensions metered, values:**

| Plan | members | policies | apiKeys | apiCallsPerMonth | price (display, KRW) |
|---|---|---|---|---|---|
| **free** | 2 | 3 | 1 | 1,000 | 0 |
| **pro** | 5 | 20 | 3 | 50,000 | 49,000 |
| **team** | 20 | ∞ (`UNLIMITED = -1`) | 10 | 500,000 | 149,000 |

Enforcement (`apps/api/src/common/plan.service.ts`):
- `assertCanAddMember` / `assertCanAddPolicy` / `assertCanAddApiKey` → throw **HTTP 402** when at limit (e.g. *"Free 플랜의 멤버 한도(2명)에 도달했습니다 — 설정 > 플랜에서 업그레이드하세요."*).
- `meterApiCall` → atomic upsert into `api_usage` keyed `(orgId, yyyymm)` (UTC month), **conditional** `setWhere: count < limit` so rejected calls don't count; quota exhausted → **HTTP 429** (`PlanQuotaExceededException`). `usage()` returns plan + limits + live usage + `month`.

### Billing (`@desk/billing` — mock, decision-only)
No Stripe/`@desk/billing`/invoice integration. `orgs.service.ts:68-99` `changePlan` updates `organizations.plan` + `planChangedAt` and writes an audit event with `mockBilling: true` and a *"데모 — 실제 결제 없음"* summary. `plans.ts:6`: *"청구는 mock 입니다 — 플랜 변경은 결정 기록(audit)만 남기고 실제 자금 이동이 없습니다."* (Same posture as the mock escrow.)

### Admin surface vs shared console
No shared DeskCloud server console dependency. Admin is **in-app**: roles `owner/admin/publisher/editor/viewer` (`packages/shared/src/constants.ts`) gate `AdminPage`, `SettingsPage`, `ApiKeysPage`, `AuditPage`, `ModerationPage`. The DeskCloud-family relationship is at the **web client** layer: `apps/web/src/services/deskcloud.ts` uses `createChangelogClient` / `createNotifyClient` from `@heejun/deskcloud` with **publishable `pk_` keys only**, env-gated by `VITE_CHANGELOGDESK_URL` / `VITE_NOTIFYDESK_URL` (no endpoint → no render, zero impact). Default `pk_demo` fallback. These render **natively** via TermsDesk's own `ChangelogLauncher`/`NotifyInbox` components (no iframe/widget embed) — the gold-standard "consume the platform SDK but keep your own UI" pattern.

### Own SDK (`packages/sdk`)
`@termsdesk/sdk` (`packages/sdk/src/index.ts`) — zero-dependency client: `createTermsDeskClient({ baseUrl, apiKey })` exposing `getCurrentPolicy()` (scope `read:current`) and `recordConsent()` (scope `write:consent`). React binding `react.tsx` ships a headless `<ConsentGate>` that fetches the current published policy, gates children until consent, records a tamper-evident receipt echoing `contentHash`, and auto-reopens on re-consent. Server/trusted-client oriented (full `tdk_` key), not a browser pk client.

---

## 3. DESIGN-SYSTEM ADOPTION

**Shared preset (family DNA):** Root `package.json` → `"prettier": "@heejun/prettier-config"`, dev-deps `@heejun/eslint-config@^5.0.0` + `@heejun/prettier-config@^3.0.0`; `eslint.config.mjs:1` → `import { base, react, defineConfig } from '@heejun/eslint-config'`. (It consumes the modular `@heejun` configs directly; there's no single `@heejun/web-config-preset` import here.) Stack matches the family: pnpm 11, TS 6, React 19, Vite 8, Tailwind v4, React Compiler (`vite.config.ts` `reactCompilerPreset()`), zustand, TanStack Query.

**Radix + CVA (family component architecture):** 6 Radix primitives wrapped shadcn-style in `apps/web/src/components/ui/*`: Dialog, Dropdown-menu, Tabs, Switch, Tooltip, Slot (+ Label), composed with `class-variance-authority` + `tailwind-merge`.

**Tailwind v4 + OKLCH tokens:** `apps/web/src/styles/index.css` → `@import 'tailwindcss'; @custom-variant dark (&:where(.dark, .dark *));` with an `@theme` token block and a `.dark` override block. **Theme = zustand** (`apps/web/src/app/themeStore.ts`): `light|dark|system`, persisted to `localStorage 'td-theme'`, `.dark` class on `<html>`, `matchMedia` for system.

**Own accent / character (documented intent in `docs/DESIGN.md`):** The family shares the OKLCH-token + Radix + warm-neutral structure; TermsDesk's distinct identity is the **"seal amber"** accent — a ledger/registry, stamp metaphor, deliberately avoiding compliance-reflex navy/teal/green and devtool indigo:
- Identity = *"잉크(ink) + 따뜻한 종이(paper) 중성 + 앰버 '인장(seal)' 강조"*; primary action = **ink (near-black)**, not a category color; accent kept to ≤10% of surface.
- Light accent: `--color-accent: oklch(0.7 0.13 70)` (warm golden-amber, hue 70°), `--accent-strong oklch(0.62 0.14 65)`, `--accent-soft oklch(0.95 0.04 80)`. Dark accent brightened: `oklch(0.76 0.13 72)`.
- Warm-tinted neutrals (no `#000/#fff`): `--bg oklch(0.994 0.003 90)`, `--text oklch(0.26 0.012 75)`.
- Semantics held separate/low-chroma: success `oklch(0.62 0.13 150)`, info `oklch(0.6 0.1 240)`, warning `oklch(0.7 0.15 60)`, danger `oklch(0.58 0.18 25)`.
- Brand mark `apps/web/src/components/layout/Brand.tsx`: a **`SealMark`** SVG (document + ring "stamp") in `fill-accent`/`stroke-accent`, "TermsDesk" + accent-soft "BETA" badge.

**`/design` living styleguide:** `router/index.tsx:47` → public `DesignPage.tsx`. Reads real `getComputedStyle()` OKLCH values; sections for color swatches (accent/surface/ink/semantic), typography scale, spacing/radius/shadow, motion (with reduced-motion), and a component gallery (Buttons, Badges, domain pills `StatusPill`/`DecisionPill`/`PolicyTypeBadge`/`HashTag`, form controls, Tabs, Dialog/Dropdown/Tooltip, Cards, Skeleton/EmptyState) with a live light/dark toggle.

---

## 4. THE PARITY CHECKLIST

> **To be a first-class DeskCloud Desk like TermsDesk, a service must have:**

### A. Platform integration
- [ ] **Multi-tenant data model** with a first-class `organizations` table carrying a `plan` column, dual-mode `self-hosted | saas` (`TERMSDESK_MODE`-style env), and an in-repo `@Global()` core module exporting `Config / Database / Audit / Plan` services.
- [ ] **Tenant-scoped request context** — a typed `AuthUser { userId, orgId, role, … }` injected by a session guard from the user→org FK; **every** data query filtered by `orgId`; RBAC role enum (`owner/admin/…`) gating mutations.
- [ ] **API keys**: prefixed (`<svc>_…`), generated from CSPRNG, **SHA-256-hashed at rest** (never plaintext), CSV scopes, revocation, `Bearer` guard that resolves `orgId` and meters on every call.
- [ ] **UsageMeter + PlanLimit** as a single shared source of truth (`packages/shared/src/plans.ts`-style): explicit **per-dimension numeric limits per tier**, atomic monthly metering keyed `(orgId, yyyymm)` with conditional increment, **402** on resource-create limits and **429** on monthly-call quota, plus a `usage()` endpoint returning limits + live usage.
- [ ] **CORS / origin allowlist**: reflective CORS for the dashboard + a per-deployment **soft origin allowlist** (comma-env, normalized) guarding public ingress endpoints.
- [ ] **Billing wired (mock is acceptable)**: plan change = audit-recorded **decision only** (`mockBilling: true`), display-only prices in the shared plans module — **no real money movement** (matches the offhours money-movement boundary).
- [ ] **DeskCloud platform SDK consumption**: integrate `@heejun/deskcloud` (Changelog + Notify) via **publishable `pk_` keys only**, env-gated (no endpoint → no-op), **rendered natively** with the service's own components (no widget/iframe embed); never ship `sk_` to the browser.
- [ ] **Own typed SDK**: a zero-dep client + framework binding exposing the product's public read/write primitives, scope-guarded.
- [ ] **Hardening**: global exception filter (stable error envelope), throttler, transient-DB-query retry, `verbatimModuleSyntax`, non-fatal env validation, PGlite/embedded-DB zero-config fallback.

### B. Product-feature surface
- [ ] **Core domain object with immutable versioning** + diff/timeline + an enforced invariant (TermsDesk: content-hash freeze on publish).
- [ ] **Append-only audit/event log**, tenant-scoped, written on every meaningful mutation.
- [ ] **CSV / data export** endpoints with proper `Content-Disposition`.
- [ ] **Insights / analytics** endpoints (daily series + per-resource breakdowns).
- [ ] **In-app notifications** (contract + emit-on-event + topbar bell with unread badge).
- [ ] **Public unauthenticated surface** (hosted pages + SEO directory/sitemap + drop-in `embed.js`).
- [ ] **Members / seats & team management** UI honoring plan member limits.
- [ ] **Settings / plan page** showing tier, limits, live usage, upgrade.
- [ ] **Inquiries / support board** with origin-allowlisted public intake.
- [ ] **Optional marketplace/brokerage-style depth** where applicable (requests ↔ providers, ratings/reviews, disputes, mock escrow, attachment uploads), with results feeding back into the core domain object.
- [ ] **Auth breadth**: email signup + Google Sign-In (GIS ID token) + guest demo mode.

### C. Design-system parity
- [ ] **`@heejun` shared eslint/prettier configs** + the standard stack (TS6/React19/Vite8/Tailwind v4/React Compiler/zustand/TanStack Query).
- [ ] **Tailwind v4 `@theme` + OKLCH token system**, warm-neutral (no `#000/#fff`), with a `.dark` override block and a **zustand theme store** (`light|dark|system`, localStorage-persisted).
- [ ] **Radix + CVA component library** in `components/ui/*`.
- [ ] **A distinct, documented accent/character** (`docs/DESIGN.md` "scene sentence" + a deliberate hue that avoids category-reflex colors) expressing the family DNA while staying its own — plus a branded `SealMark`-style logo.
- [ ] **A `/design` living styleguide route** reading real computed token values, with swatches, type scale, motion (reduced-motion aware), and a full component gallery.
- [ ] **a11y baseline** (route announcer, focus management, error boundary, document.title — per the family UX/a11y baseline).
- [ ] **PWA / OG-meta / branded og-image**, and **CI gates**: verify pipeline (format→lint→typecheck→test→build) + CodeRabbit gate + commit-msg gate + concurrency cancellation + security/audit gate.

**Key files for reference:** plan model `packages/shared/src/plans.ts`; plan enforcement `apps/api/src/common/plan.service.ts`; API-key guard `apps/api/src/auth/api-key.guard.ts`; config/env `apps/api/src/config.ts` + `.env.example`; DeskCloud client `apps/web/src/services/deskcloud.ts`; design tokens `apps/web/src/styles/index.css` + `docs/DESIGN.md`; brokerage contracts `packages/shared/src/brokerage.ts`; SDK `packages/sdk/src/{index.ts,react.tsx}`.