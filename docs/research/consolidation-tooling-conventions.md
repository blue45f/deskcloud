I now have a complete picture. Each Desk backend has its own `apps/api/Dockerfile`, and `deskcloud-deploy` is a central compose orchestrator pointing at sibling repos. The new `deskcloud/` monorepo only has 3 subtrees so far (platform, seo-gateway, remote-devtools) with leftover per-subtree workspace/lock files. I have everything needed to produce the findings.

# DeskCloud Monorepo Tooling + Conventions Reality — Findings & Recommendations

Investigation covered the new `/Users/hjunkim/WebstormProjects/deskcloud` monorepo plus ~33 sibling repos under `~/WebstormProjects` (sampled termsdesk, surveydesk, aidigestdesk, addesk, desk-platform, deskcloud-deploy, spa-seo-gateway, remote-devtools, web-config-preset, orbit-ui, pettography).

## 0. Current state of `deskcloud/` (baseline)

The monorepo is **physically assembled but not yet operationalized**. It contains only 3 subtrees so far:
- `platform/` ← desk-platform (`@desk/{shared,core,billing}` + `apps/{api,web}` + `vendor/`)
- `desks/seo-gateway/` ← spa-seo-gateway
- `desks/remote-devtools/` ← remote-devtools

Evidence of half-migration: root `pnpm-workspace.yaml` globs into the subtrees, but each subtree **still carries its own `pnpm-workspace.yaml` + `pnpm-lock.yaml`** (`deskcloud/platform/pnpm-lock.yaml`, `deskcloud/desks/seo-gateway/pnpm-lock.yaml`). Root CLAUDE.md flags these as "ignored on install, cleanup pending." Root has `package.json` (pnpm@11.4.0, node ≥24.16, scripts using `pnpm -r`), `tsconfig.base.json` (TS target ES2023, Bundler resolution, strict), `.npmrc` (`resolution-mode=highest`, `auto-install-peers`, `engine-strict`). **No `.github/` CI exists in the monorepo yet.** The 16 backend `*desk` apps (addesk, authdesk, changelogdesk, chatdesk, communitydesk, filedesk, mediadesk, moderationdesk, notifydesk, realtimedesk, reviewdesk, searchdesk, surveydesk, termsdesk + aidigestdesk + desk-platform) are NOT yet in the monorepo.

---

## 1. TASK RUNNER

**Findings (evidence):**
- `grep turbo.json/nx.json/lerna.json` across all repos: **only `remote-devtools/turbo.json` exists** (a minimal 20-line config — `build`/`build:internal`/`build:external`/`typecheck` tasks with `dependsOn: ["^build"]`, `extends: ["//"]`). No nx, no lerna anywhere.
- Every other repo (incl. desk-platform, all `*desk` apps) orchestrates via **plain `pnpm -r`** recursive scripts. The new monorepo root already does this: `"build": "pnpm -r build"`, `"test": "pnpm -r test"`, plus filtered `"build:platform": "pnpm --filter \"./platform/**\" -r build"`.
- Build dependency order today relies on pnpm's topological `-r` ordering (it already respects `workspace:*` graph).

**Recommendation: Adopt Turborepo at the monorepo root.** At ~18 sub-repos × (web + api + 2-3 packages) this becomes 50-70 workspace projects. Plain `pnpm -r` re-runs everything with no caching and no `--affected` filtering, which makes CI minutes and local loops painful at this scale. Turbo gives: (a) content-hash caching of `build`/`typecheck`/`lint`/`test`, (b) `turbo run build --filter='...[origin/main]'` affected-only execution that pairs directly with CI path filtering (topic 4), (c) `turbo prune --docker` for per-Desk Docker builds (topic 5). It's the lowest-friction choice because `remote-devtools` already uses it and the team knows it; nx would be a heavier re-architecture. Add `turbo.json` with `tasks: { build: { dependsOn: ["^build"], outputs: ["dist/**"] }, typecheck: {}, lint: {}, test: { dependsOn: ["^build"] } }` and keep the `pnpm -r` scripts as a fallback. Do NOT introduce nx/lerna.

---

## 2. VERSIONING / RELEASE

**Findings (evidence):**
- Two distinct package classes today:
  - **`@desk/{shared,core,billing}`** — `version: 0.1.0`, **`private: true`**, consumed by apps via **`workspace:*`** (`desk-platform/apps/api` deps `@desk/billing/core/shared: "workspace:*"`). Built with **tsup** (dual ESM `dist/index.js` + CJS `dist/index.cjs` + `dist/index.d.ts`, with subpath exports like `./browser`, `./nest`). These are **internal, never published**.
  - **`@heejun/{eslint,prettier,tailwind,typescript,vite}-config`** — live in the **separate `web-config-preset` repo**, **published to npm** (confirmed: `npm view @heejun/eslint-config version` → `5.0.0`). Consumed by every sibling via **semver caret** (`"@heejun/eslint-config": "^5.0.0"`), NOT workspace protocol. Versioned with **Changesets** (`web-config-preset/.changeset/config.json`, `access: public`, `commit: true`).
  - A third published artifact exists: **`@heejun/deskcloud@0.1.0`** on npm (the shared widget/embed; pettography consumes `"@heejun/deskcloud": "^0.1.0"`).
- Changesets is used in exactly **2 repos**: `web-config-preset` and `orbit-ui` (both are *published-library* repos). No `semantic-release` anywhere. The `*desk` product apps have **no release tooling** (they're deployed, not published).

**Recommendation: Two-tier versioning.**
- **Internal `@desk/*` + apps → `workspace:*`, stay `private: true`, no published version.** They're deployed artifacts inside the monorepo; their "version" is the git SHA. No changesets needed for these. This matches today's reality and is correct.
- **For shared config (topic 3): keep `@heejun/web-config-preset` published-and-external, OR if moved in, version it with Changesets.** If `web-config-preset` is folded into the monorepo (see topic 3 recommendation: keep external), it would need a Changesets pipeline + npm publish workflow inside the monorepo, because external consumers (the non-DeskCloud siblings: resume, pettography, etc.) depend on it via npm semver. Since those external consumers exist, **publishing cannot be dropped**.
- Net: add Changesets at the monorepo root ONLY if any package needs to remain npm-published (i.e., `@heejun/deskcloud` widget or config if moved in). All purely-internal `@desk/*` packages stay `workspace:*` + private + unversioned-for-publish.

---

## 3. SHARED CONFIG placement (`@heejun/web-config-preset`)

**Findings (evidence):**
- `web-config-preset` is its **own pnpm monorepo** (`packages/{eslint,prettier,tailwind,typescript,vite}`), publishing 5 npm packages under `@heejun/*`. It is consumed by **the entire WebstormProjects fleet** — both DeskCloud repos AND non-DeskCloud siblings (resume, pettography, rotifolk, proto-live, etc.) — via npm caret ranges. Sibling `eslint.config.mjs` files import from `@heejun/eslint-config`; `package.json` sets `"prettier": "@heejun/prettier-config"`.
- It has its own Changesets release flow and `@heejun/eslint-config@5.0.0` / `@heejun/prettier-config@3.0.0` are live on npm.
- The MEMORY note confirms intent: "web-config-preset 표준 프리셋 … 형제 레포가 의존할 단일 소스" (single source the sibling repos depend on).

**Recommendation: Keep `web-config-preset` EXTERNAL (do not move into the monorepo).** Rationale: its consumer set is strictly larger than DeskCloud — non-DeskCloud apps (resume, pettography, the toss apps, etc.) pull it from npm. If it moves into the deskcloud monorepo, those external repos lose their dependency source (you'd have to keep publishing from inside the monorepo anyway, gaining nothing but coupling). It's a *cross-fleet* standard, not a *DeskCloud* asset. The monorepo should consume `@heejun/*` exactly like the siblings do — via npm caret ranges, pinned through a pnpm catalog (topic 6). Note the catalog/minReleaseAge exclusion the monorepo already carries (`@heejun/eslint-config@5.0.0`, `@heejun/prettier-config@3.0.0`, `@heejun/deskcloud@0.1.0` in `minimumReleaseAgeExclude`) — that pattern is correct; keep it.

---

## 4. CI consolidation

**Findings (evidence):**
- Per-repo CI is **highly standardized** already. The canonical `ci.yml` (termsdesk, surveydesk, aidigestdesk, addesk, desk-platform):
  - `actions/checkout@v6` → `pnpm/action-setup@v6` (version from `packageManager`) → `actions/setup-node@v6` (node 24, `cache: pnpm`) → `pnpm install --frozen-lockfile` → `pnpm run verify`.
  - `verify` = `lint:ci → typecheck → test → build` (termsdesk also `format:check`; aidigestdesk adds `check:bundle`).
  - termsdesk has `paths-ignore` for docs/md, `concurrency` cancel-in-progress, and a Postgres service container.
- A **`coderabbit-gate.yml`** is near-universal: a github-script gate that fails ONLY on CodeRabbit `CHANGES_REQUESTED` against the current head SHA (skips drafts, allows merge if not yet reviewed). Mature repos (spa-seo-gateway, remote-devtools, pettography) add `branch-protection.yml`, `auto-merge-on-green.yml`, `dependabot-auto-merge.yml`, `sonarqube.yml`, deploy workflows.
- husky is consistent where present: `commit-msg` (commitlint, body ≤100), `pre-commit` (lint-staged), `pre-push` (full `verify:push` = `verify` + `lint:security`). aidigestdesk has no husky (CI-only).

**Recommendation: One root CI workflow with Turbo affected-only + path-filtered matrix.**
- Single `.github/workflows/ci.yml`: checkout (with `fetch-depth: 0` for affected diffing) → pnpm/setup-node@24 → `pnpm install --frozen-lockfile` → `pnpm exec turbo run lint typecheck test build --filter='...[origin/main]'`. This replaces ~18 separate `pnpm run verify` runs with a single affected-graph pass that skips untouched Desks.
- For per-Desk service containers (Postgres) that some backends need, gate them behind a `dorny/paths-filter` matrix so a docs-only or single-Desk change doesn't spin up every service.
- **Carry over wholesale**: the `coderabbit-gate.yml` (CHANGES_REQUESTED-only), `concurrency` cancel-in-progress, `paths-ignore` for md/docs, and the husky `commit-msg`/`pre-commit`/`pre-push` trio at the monorepo root (single husky install, lint-staged scoped by path). Keep commitlint body ≤100 (a known hard gate in this fleet).
- Keep SonarCloud as the free Automatic Analysis (one `blue45f_deskcloud` project) — do NOT add a CI token scan (per MEMORY, it conflicts with automatic analysis).

---

## 5. DEPLOY

**Findings (evidence):**
- **Three deploy targets coexist:**
  - **Vercel (per-app, frontends)** — `desk-platform/vercel.json` uses `buildCommand: "pnpm --filter @desk/web... build"`, `outputDirectory: "apps/web/dist"`, and SPA rewrites that proxy `/api/*` to the EC2 backend (`https://16.176.210.195.nip.io/platform/api/*`). aidigestdesk deploys the web app to **GitHub Pages** (`deploy-pages.yml`, `VITE_BASE_PATH=/aidigestdesk/`). spa-seo-gateway has `deploy-fly.yml` + `deploy-netlify.yml`.
  - **EC2 Docker (backends)** — `deskcloud-deploy/` is a **central one-command orchestrator**: a single `docker-compose.yml` whose services (`surveydesk`, `changelogdesk`, `reviewdesk`, `mediadesk`, `notifydesk`, `moderationdesk`, `realtimedesk`, `searchdesk`, `communitydesk`, `chatdesk`, …) each `build.context: ../<repo>`, `dockerfile: apps/api/Dockerfile`, fronted by a shared `Caddyfile` (path-routed vhosts) + `deploy.sh`/`gen-env.sh`. So **each Desk backend ships its own `apps/api/Dockerfile`**; the deployer co-hosts them all on one EC2 box behind Caddy (the termsdesk EC2 cohosting pattern, generalized).
  - **S3 static** — used by multi-env (free-sample) elsewhere in the fleet, not in the Desk core path.

**Recommendation: Keep deploys per-app/per-Desk; do NOT collapse into one deploy.**
- **Frontends → Vercel, one project per Desk web app, with `rootDirectory` set to the Desk's web subpath** (e.g. `desks/surveydesk/apps/web`), build command `turbo run build --filter=@desk/<x>-web`. Vercel's monorepo support handles `rootDirectory` + ignored-build-step (`turbo-ignore`) so only the changed app redeploys. Mind the **Vercel free 100-deploy/24h team-wide limit** (per MEMORY) — affected-only via `turbo-ignore` is essential here to avoid burning the budget on every monorepo push.
- **Backends → keep the `deskcloud-deploy` central compose + Caddy on EC2.** In the monorepo, switch each service's `build.context` from `../<repo>` to the in-repo path (`./desks/<x>`) and use **`turbo prune --docker --scope=@desk/<x>-api`** to produce a minimal context per backend image (so each Dockerfile only gets its slice of the lockfile + deps, not the whole monorepo). This preserves the "$0 extra, co-located on termsdesk EC2" economics while making builds monorepo-aware.
- Watch the **Caddy vhost clobber** hazard (per MEMORY: termsdesk redeploy overwrites `/opt/sibling-caddy`) — the monorepo's single Caddyfile in `deskcloud-deploy` actually *fixes* this by owning all vhosts centrally.

---

## 6. PACKAGE MANAGER / pnpm catalog

**Findings (evidence):**
- pnpm 11.4.0 fleet-wide, node ≥24, `engine-strict`.
- **Only `orbit-ui` uses a pnpm catalog today** (`orbit-ui/pnpm-workspace.yaml` has a `catalog:` block pinning react 19.2, typescript 6, vite 8, vitest 4, testing-library, etc.; packages reference `catalog:`). No other repo, including the new deskcloud monorepo, uses catalogs.
- The deskcloud root `pnpm-workspace.yaml` is **already a merged union** of the 3 subtrees' `overrides` (security pins: undici ^7.28, ws ≥8.21, fastify ≥5.7, drizzle-orm ≥0.45, vitest ≥4.1.9, vite ≥8.0.16…), `allowBuilds` (esbuild, @nestjs/core, @swc/core, pglite, puppeteer, sharp, embedded-postgres/*…), `packageExtensions` (@hookform/resolvers zod peer), `auditConfig.ignoreGhsas`, and a long `minimumReleaseAgeExclude` list. But it has **no `catalog:` block** — versions are still duplicated across every sub-package's `package.json`.

**Recommendation: Yes — add a root pnpm `catalog:` and dedupe.** At 50-70 workspace packages, version drift (react, typescript, vite, vitest, zod, nestjs, drizzle, tailwind, the `@heejun/*` configs) is the single biggest maintenance tax. Copy the orbit-ui pattern up to the deskcloud root: define one `catalog:` for the toolchain (react/react-dom/@types, typescript, @types/node, vite, vitest + coverage/ui, @vitejs/plugin-react-swc, jsdom, testing-library, zod, nestjs core/common, drizzle-orm, tailwind, and the `@heejun/*` config carets) and rewrite each sub-package to `"react": "catalog:"`. This makes the existing `overrides` block mostly redundant for first-party deps (overrides become reserved for transitive security pins only). Keep the merged `allowBuilds`/`packageExtensions`/`auditConfig`/`minimumReleaseAgeExclude` exactly as-is — those are already correctly hoisted to root (pnpm reads root workspace config only). Delete the per-subtree `pnpm-workspace.yaml` + `pnpm-lock.yaml` once the catalog migration + single root `pnpm install` passes (this is the open checklist item in the monorepo's own CLAUDE.md).

---

## Summary table (for the construction plan)

| Topic | Reality today | Recommendation |
|---|---|---|
| Task runner | plain `pnpm -r`; only remote-devtools has turbo.json | **Turborepo at root** (caching + `--filter='...[origin/main]'` affected) |
| Versioning | `@desk/*`=workspace:* private/tsup; `@heejun/*`=npm-published via Changesets | Internal `@desk/*` stay `workspace:*`/private; Changesets only for npm-published packages |
| Shared config | `web-config-preset` = separate repo, npm-published `@heejun/*`, consumed fleet-wide by caret | **Keep external**; consume via npm + catalog (larger consumer set than DeskCloud) |
| CI | per-repo `ci.yml` (verify gate) + `coderabbit-gate.yml`, near-identical | **One root CI** = turbo affected + path-filter matrix; reuse coderabbit-gate + husky trio |
| Deploy | Vercel per-app (web) + central `deskcloud-deploy` compose/Caddy on EC2 (backends) + GH Pages/S3 | **Keep per-app/per-Desk**; Vercel `rootDirectory`+`turbo-ignore`, backends via `turbo prune --docker` into existing compose |
| Catalog | only orbit-ui uses `catalog:`; deskcloud root has merged overrides but no catalog | **Add root `catalog:`** (orbit-ui pattern), dedupe versions, then drop per-subtree workspace/lock files |

**Key relevant files:** `/Users/hjunkim/WebstormProjects/deskcloud/pnpm-workspace.yaml` (already-merged union config, needs catalog block), `/Users/hjunkim/WebstormProjects/deskcloud/package.json` (root scripts), `/Users/hjunkim/WebstormProjects/orbit-ui/pnpm-workspace.yaml` (catalog reference pattern), `/Users/hjunkim/WebstormProjects/remote-devtools/turbo.json` (only existing turbo config), `/Users/hjunkim/WebstormProjects/web-config-preset/.changeset/config.json` (published-config release pattern), `/Users/hjunkim/WebstormProjects/termsdesk/.github/workflows/ci.yml` + `coderabbit-gate.yml` (canonical CI to consolidate), `/Users/hjunkim/WebstormProjects/desk-platform/vercel.json` (per-app Vercel pattern), `/Users/hjunkim/WebstormProjects/deskcloud-deploy/docker-compose.yml` + `Caddyfile` (central backend deploy orchestrator).