I now have the full picture. The Desks DO reference `@desk/*` (8/5/6/4 src refs each — via shared widget/portal embed), the existing `deskcloud/` consolidation monorepo already absorbed platform + seo-gateway + remote-devtools (766 commits, 241M .git), and the deploy/SDK are standalone harness/published tool. Here is the complete inventory and plan.

---

# DeskCloud Family Absorption Inventory

## Key context discovered
- **`deskcloud/` already exists** as the unified target monorepo (766 commits, **241M** `.git`, workspace covers `platform/` + `desks/seo-gateway` + `desks/remote-devtools`). The three "already consolidated" repos live here under `desks/`. **The 14 Desks + desk-platform are NOT yet inside it.**
- Every Desk is the **identical canonical stack**: pnpm@11.4.0 monorepo → `apps/api` (NestJS + Drizzle + `@electric-sql/pglite` fallback, `nest build`) + `apps/web` (Vite + React) + `packages/{shared,widget,(sdk)}`. Nested Dockerfiles, no root Vercel except aidigestdesk/termsdesk.
- **Platform coupling is real but in-source, not via npm dep**: Desks reference `@desk/*` 4–8× in `apps/`+`packages/` (widget/portal embed, `pk_/sk_`), but none declare `@desk/platform` in package.json. The clean dependency is only self-referenced by `desk-platform` and `deskcloud/platform`.
- **No Desk uses `@heejun/web-config-preset`** (zero hits) — they predate the preset rollout; that's a post-absorption alignment task, not a blocker.
- `deskcloud-deploy` compose orchestrates the live fleet (surveydesk, changelogdesk, reviewdesk, mediadesk, notifydesk, moderationdesk, realtimedesk, searchdesk, communitydesk, chatdesk, deskplatform + caddy) — it is the **deploy harness**, not app code.
- `deskcloud-sdk` publishes as **`@heejun/deskcloud`** (npm package, `files:["dist"]`, tsup build) — a **published client SDK**.

## Inventory table

| repo | stack (fw / ORM / build) | monorepo? | commits | .git | deploy target | CI? | consumes @desk/platform? | uses web-config-preset? | absorb difficulty |
|---|---|---|---|---|---|---|---|---|---|
| addesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; shared,widget) | 15 | 3.2M | EC2 (compose/Caddy) | 1wf | in-src ref | no | **S** |
| aidigestdesk | Vite+React SPA (content pkg; no api) | yes (toss,web; content) | 79 | 11M | Vercel + GH Pages | 3wf | no | no | **M** (no api, has toss app + Pages) |
| authdesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; shared,widget) | 12 | 2.9M | EC2 | none | in-src ref | no | **S** |
| changelogdesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; shared,widget) | 13 | 3.6M | EC2 | 2wf | in-src ref (8) | no | **S** |
| chatdesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; sdk,shared,widget) | 15 | 3.8M | EC2 | 2wf | in-src ref | no | **S** |
| communitydesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; sdk,shared,widget) | 14 | 3.7M | EC2 | 2wf | in-src ref (5) | no | **S** |
| filedesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; shared,widget) | 10 | 2.5M | EC2 | none | in-src ref (4) | no | **S** |
| mediadesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; sdk,shared,widget) | 14 | 3.5M | EC2 | 2wf | in-src ref | no | **S** |
| moderationdesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; sdk,shared,widget) | 13 | 3.6M | EC2 | 2wf | in-src ref | no | **S** |
| notifydesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; sdk,shared,widget) | 13 | 3.7M | EC2 | 2wf | in-src ref | no | **S** |
| realtimedesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; sdk,shared,widget) | 13 | 2.6M | EC2 | 2wf | in-src ref (6) | no | **S** (WS adapter pathing) |
| reviewdesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; shared,widget) | 13 | 4.2M | EC2 | 2wf | in-src ref (4) | no | **S** |
| searchdesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; sdk,shared,widget) | 13 | 3.6M | EC2 | 2wf | in-src ref | no | **S** |
| surveydesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; shared,widget) | 13 | 4.4M | EC2 | 2wf | in-src ref | no | **S** |
| termsdesk | NestJS+Drizzle+PGlite / Vite+React | yes (api,web; sdk,shared) | 114 | 14M | Vercel(web)+EC2(api)+Sonar | 4wf | in-src ref | no | **L** (mature, prod-live, Sonar/proxy/SDK, 114 commits) |
| desk-platform | NestJS+Drizzle / Vite+React (BM/billing/core) | yes (api,web; billing,core,shared) | 23 | 4.6M | Vercel(web)→EC2 api | 2wf | **self (provider)** | no | **M** (already in `deskcloud/platform`; reconcile drift) |
| **deskcloud-sdk** | tsup lib → npm `@heejun/deskcloud` | yes (minimal) | 2 | 356K | npm publish | none | no (it IS the client) | no | **DO NOT ABSORB** |
| **deskcloud-deploy** | compose+Caddy+deploy.sh+docs (no package.json) | no | 3 | 256K | n/a (it deploys others) | none | no (orchestrates all) | no | **DO NOT ABSORB** |
| desk-platform→`deskcloud/platform` | *(already consolidated)* | — | — | — | — | — | — | — | already in `deskcloud/` |
| spa-seo-gateway→`deskcloud/desks/seo-gateway` | *(already consolidated)* | — | 225 | 29M | — | 8wf | — | — | already in `deskcloud/` |
| remote-devtools→`deskcloud/desks/remote-devtools` | *(already consolidated)* | — | 511 | 600M | — | 9wf | — | — | already in `deskcloud/` |

---

## (1) Absorption batches — recommended order

The Desks are near-clones; the existing `deskcloud/pnpm-workspace.yaml` already has the `allowBuilds`/`overrides` union for the NestJS+PGlite+Drizzle+Vite stack, so adding more Desks is low-friction. Order by maturity (de-risk on the simplest first) and dependency direction.

- **Batch 0 — Foundation (already done / reconcile first):** `desk-platform`. It is the `@desk/*` provider every Desk references; it already lives at `deskcloud/platform`. Action: **reconcile drift** between standalone `desk-platform` (23 commits, latest) and the absorbed `deskcloud/platform` copy before pulling Desks in, so Desks resolve `@desk/*` from the monorepo workspace instead of in-src copies.
- **Batch 1 — Canonical-clone Desks, no-SDK (simplest, 4 repos):** `addesk`, `authdesk`, `filedesk`, `reviewdesk`, `surveydesk` (`packages/{shared,widget}` only, lowest commits 10–15). Establishes the `desks/<name>/apps/*` + `desks/<name>/packages/*` workspace globs and the shared→widget build order. Pure mechanical S each.
- **Batch 2 — Canonical-clone Desks, with SDK pkg (8 repos):** `chatdesk`, `communitydesk`, `mediadesk`, `moderationdesk`, `notifydesk`, `searchdesk`, `changelogdesk`, plus `realtimedesk` last in the batch (WS adapter `/socket.io` path gotcha — same trap as remote-devtools). Same stack, one extra `sdk` package to wire.
- **Batch 3 — Special-shape / high-value (3 repos), one at a time:**
  - `aidigestdesk` — **no `apps/api`** (SPA-only with `apps/toss` + `packages/content`, deploys Vercel + **GH Pages**). Needs its own non-NestJS web build path and Pages workflow handling. Do solo.
  - `termsdesk` — **most mature (114 commits, prod-live)**, Vercel-web + EC2-api split, Sonar + api-proxy rewrites + own SDK. Highest blast radius → absorb **last**, solo, with live-deploy verification.
  - (`desk-platform` drift-merge finalized here if not fully done in Batch 0.)
- **Batch 4 — Post-absorption alignment (not "absorption", but the cleanup the workspace comment defers):** collapse 14× duplicate `pnpm-workspace.yaml`/tsconfig into the root, route `@desk/*` via workspace deps (drop in-src platform copies), and roll `@heejun/web-config-preset` across all newly-absorbed Desks (currently 0 consume it).

## (2) Repos that should NOT be absorbed

- **`deskcloud-deploy` — KEEP SEPARATE (deploy harness).** No `package.json`, no app code; it is `docker-compose.yml` + `Caddyfile` + `deploy.sh` + `gen-env.sh` + a live `.env` (secrets) orchestrating the whole EC2 fleet. Pulling it into the app monorepo would (a) couple deploy infra to app CI, (b) drag a secrets `.env` into the shared tree, and (c) break its job of being the *outside* one-command deployer of *all* services. It's the right shape as a sibling infra repo — like a `deploy/` companion, not a workspace member.
- **`deskcloud-sdk` (`@heejun/deskcloud`) — KEEP SEPARATE (published tool).** It's a tsup-built, `files:["dist"]`, npm-publishable **client SDK** consumers install — an external contract with its own SemVer/release cadence. Vendoring it into the monorepo would conflate internal app churn with the public package's release surface and force external consumers to track the monorepo. It can be referenced as a workspace dep *if* ever needed, but its identity is "published artifact," so it stays standalone. (Note: it's also already pinned as `@heejun/deskcloud@0.1.0` in the monorepo's `minimumReleaseAgeExclude`, confirming it's consumed as a published package, not source.)

## (3) Total scale signal (the "teleport failed on size" check)

**Candidate Desks + infra actually to absorb (16 repos):** addesk, aidigestdesk, authdesk, changelogdesk, chatdesk, communitydesk, filedesk, mediadesk, moderationdesk, notifydesk, realtimedesk, reviewdesk, searchdesk, surveydesk, termsdesk, desk-platform.
- **Σ commits ≈ 426** (Desks 389 + desk-platform 23 + the two heavy outliers being aidigest 79 / terms 114 dominate).
- **Σ .git ≈ 78.6 MB** (Desks ~63MB + desk-platform 4.6MB; termsdesk 14M and aidigestdesk 11M are the bulk).
- Excluded harness/SDK: deskcloud-deploy 256K + deskcloud-sdk 356K (negligible, and not absorbed anyway).

**Already-consolidated trio (for the size-budget reality check):** spa-seo-gateway 29M/225c + remote-devtools **600M**/511c + (platform already inside) → the **existing `deskcloud/.git` is already 241M / 766 commits**.

**Scale verdict:** The 16 candidates add only **~79MB** of `.git` and ~426 commits — trivial. **The teleport size problem is NOT the Desks; it is `remote-devtools` at 600MB** (already absorbed, ballooning `deskcloud/.git` to 241M). Absorbing the remaining Desks via history-preserving `git subtree`/`filter-repo` keeps `deskcloud/.git` well under ~320MB total — but if a cloud "teleport" already choked, the fix is to **shrink/shallow the remote-devtools history (BFG/filter-repo on its 600M blob bloat), not to fear the Desks**. Recommend: absorb Desks with `--squash` subtree (or shallow import) to avoid compounding history weight, and treat remote-devtools blob cleanup as a prerequisite for any full-tree cloud operation.

Relevant paths: target monorepo `/Users/hjunkim/WebstormProjects/deskcloud` (workspace `/Users/hjunkim/WebstormProjects/deskcloud/pnpm-workspace.yaml`); deploy harness `/Users/hjunkim/WebstormProjects/deskcloud-deploy/docker-compose.yml`; published SDK `/Users/hjunkim/WebstormProjects/deskcloud-sdk/package.json`.