# DeskCloud Monorepo — Construction & Migration Plan (FINAL)

> **Status:** Decisive. This is the _substrate_ plan beneath `docs/INTEGRATION-PLAN.md` (architecture / billing / admin / family-design wiring). It governs **how the monorepo is built, scaled, tooled, remoted, deployed, and cut over** — not what gets wired on top.
>
> It merges the original consolidation plan with three adversarial critiques (scale/cost, migration-safety, monorepo-vs-polyrepo). Where a critique changed the decision it is called out inline as **[CHANGED BY CRITIQUE]**.
>
> **Verified live (2026-06-20):** `.git` = 241M, worktree = 554M, **`devtools-frontend/` = 299M / 4,709 files / NO `package.json`** (52% of the worktree, the largest 15 history blobs are all `*.json.gz` trace fixtures _inside_ it), no git remote, single local `main`, `node_modules` never materialized, **10 nested config files survive** (4 `pnpm-workspace.yaml` + 6 `pnpm-lock.yaml`), one inner `turbo.json`.

> **Implementation boundary override (2026-06-21):** the owner directive now favors integrated
> operation over separate repos even when the work is large. The implementation absorbs
> `deskcloud-sdk` as `packages/deskcloud-sdk`, `deskcloud-deploy` as `deploy/stack`, `seo-gateway`
> as `desks/seo-gateway` / product name `SEOGatewayDesk`, and `remote-devtools` as
> `desks/remote-devtools` / workspace package `@desk/remote-devtools`. Older sections below that
> recommend quarantining `remote-devtools` are retained as historical decision record and are
> superseded by this override. `@heejun/web-config-preset` remains outside the DeskCloud monorepo.

---

## 1. TL;DR — Recommended Consolidation Boundary

**Current implementation: build one integrated DeskCloud monorepo and operate the developer-tool Desks from the same console.** The earlier cost critique recommended quarantining `remote-devtools`, but the owner directive now explicitly prefers integrated operation over keeping `seo-gateway` and `remote-devtools` separate. The 299MB vendored DevTools frontend remains a known clone/CI cost, so it is treated as a documented heavy asset under `desks/remote-devtools/devtools-frontend` rather than as a reason to run a separate repo.

The decisive cut:

**IN (one monorepo, `workspace:*`, history-preserving import):**

- `platform/` — the `@desk/*` provider (the _only_ true tight-coupling anchor). **[done, reconcile]**
- `desks/seo-gateway/` — deep platform wiring, already absorbed. **[done]**
- `desks/remote-devtools/` — CDP/rrweb developer-tool Desk, absorbed as workspace package `@desk/remote-devtools`. **[done, heavy asset documented]**
- The **14 homogeneous backend Desks** (including `termsdesk`) — same `apps/{api,web}` + Nest + Drizzle + PGlite shape; cheap to absorb, and they are where "one billing / one admin / one design" delivers value.

**OUT (stay sibling repos, consume `@desk/*` / `@heejun/*` via published packages):**

- **`@heejun/web-config-preset`** — cross-fleet standard with a consumer set strictly larger than DeskCloud.

**Why this integrated boundary is accepted:** unified console, billing, service-domain isolation, and cross-Desk contract changes are more valuable than keeping the developer-tool Desks on a separate cadence. The cost tradeoff is acknowledged explicitly: `remote-devtools` raises clone/IDE/CI cost, so CI filters and heavy-asset hygiene matter more than they did in the lighter partial-monorepo plan.

**The one gating spike (decide first):** the boundary's "publish `@desk/*`" option depends on a working registry. npm publish currently 401s (per heejun-platform memory). **Resolve publish-auth before committing the boundary:**

- If publish-auth works → published artifacts can serve external consumers, but the source of truth for DeskCloud products remains this monorepo.
- If publish-auth is unfixable → all DeskCloud-owned packages continue to consume `@desk/*` and `@heejun/deskcloud` via `workspace:*` inside the monorepo. `remote-devtools`, `seo-gateway`, SDK, and deploy stack stay integrated.

---

## 2. Stage 0 — Finish the Current 3-Repo Workspace

> Current truth is "lockfile resolves," nothing more. `node_modules` has never materialized. Close that gap **before** absorbing or cutting over anything. **[CHANGED BY CRITIQUE: migration-safety]** — the schedule downstream of Stage 0 assumed an install that has never succeeded; treat Stage 0 as a hard, unproven gate, not a formality.

### 2.1 Lift the 10 nested config files

Root `pnpm-workspace.yaml` already globs the subtrees and merged their `overrides`/`allowBuilds`/`auditConfig`/`minimumReleaseAgeExclude`/`packageExtensions`. Nested files are now dead weight (confuse pnpm, IDEs, Vercel root-dir detection, turbo).

Delete (verified present):

- `platform/pnpm-workspace.yaml`, `platform/pnpm-lock.yaml`
- `desks/seo-gateway/pnpm-workspace.yaml`, `desks/seo-gateway/pnpm-lock.yaml`
- `desks/remote-devtools/pnpm-workspace.yaml`, `desks/remote-devtools/pnpm-lock.yaml` _(moot once remote-devtools is quarantined out per §4.3 — do whichever happens first)_
- `desks/remote-devtools/sdk/pnpm-lock.yaml`, `desks/remote-devtools/client/pnpm-lock.yaml`

Do the delete + real install (2.2) in **one commit**; snapshot `pnpm list -r --depth 0` before/after to catch silent transitive drift from a deleted nested lock.

### 2.2 Real install (not `--lockfile-only`)

```
pnpm install     # full node_modules, runs allowBuilds for the first time on this machine
```

**Risk:** the merged `allowBuilds` union (esbuild, @swc/core, @nestjs/core, pglite, embedded-postgres, sharp, puppeteer-chromium) fires for the first time; a missing toolchain (puppeteer chromium fetch) can fail the whole install. **Mitigation:** resolve per-package; do **not** loosen the global gate. This is the single most likely Stage-0 blocker — budget for it.

### 2.3 Per-package build/test/lint

```
pnpm -r build && pnpm -r typecheck && pnpm -r lint && pnpm -r test
```

Capture failures. **Do NOT** rewrite tsconfig `extends` to `tsconfig.base.json` yet — first prove the as-imported code builds, then standardize (that's a wiring-plan task). seo-gateway/remote-devtools were authored as independent roots; combined topo order may differ from each repo's isolated order. Fix forward per-package.

### 2.4 Resolve version drift → pnpm catalog **[CHANGED BY CRITIQUE: scale/cost — "lowest common major", not "highest"]**

The original plan pinned the **highest** resolved version per key (matching `.npmrc resolution-mode=highest`). The scale critique is right: across 18 independently-authored repos, **major drift is the norm**, and "highest" silently drags laggards onto a new major (Tailwind 3→4, vitest 3→4) _mid-import_, so a failure can't be bisected to "import broke it" vs "major broke it."

**Final policy:**

1. **Audit the real spread first** — `jq` sweep of every `package.json` for the catalog keys; measure the Nest/Drizzle/zod/vite/Tailwind/vitest major spread across all consumers **before** writing the catalog.
2. **Default catalog = the lowest common major all consumers already satisfy.** React is uniform (all 19.x, verified) → safe to pin.
3. **Named catalogs are the _normal_ path for any split key**, not the exception: `catalog:tw3`, `catalog:vitest3`, etc. Lagging packages reference the named catalog until upgraded.
4. Upgrades become **separate, revertable PRs decoupled from absorption.**
5. After first-party deps are catalog-pinned, collapse root `overrides` to **transitive security pins only** (undici, ws, fastify floor); drop any override now redundant with a catalog entry.

Catalog spine (toolchain): `react`, `react-dom`, `@types/react(-dom)`, `typescript`, `@types/node`, `vite`, `@vitejs/plugin-react-swc`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/*`, `zod`, `@nestjs/{core,common,platform-fastify}`, `drizzle-orm`, `drizzle-kit`, `tailwindcss`, `@electric-sql/pglite`, `@heejun/*` carets. (orbit-ui is the in-fleet catalog reference pattern.)

### 2.5 Stage 0 exit criterion (hard gate)

From a **clean clone**: `pnpm install --frozen-lockfile && pnpm -r build && pnpm -r typecheck && pnpm -r test && pnpm -r lint` all green, zero nested workspace/lock files. **No Desk is absorbed and no original is cut over until this passes.** This is the only honest "monorepo works" proof.

---

## 3. Tooling (Final)

| Decision          | Choice                                         | Notes                                                                                                                                                                                                          |
| ----------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Task runner**   | **Turborepo at root**                          | remote-devtools already ships turbo; team knows it. Do NOT introduce nx/lerna. Delete the inner `turbo.json` (its `extends:["//"]` now resolves to monorepo root — moot once remote-devtools quarantines out). |
| **Versioning**    | **Two-tier, no Changesets at construction**    | Internal `@desk/*` + apps stay `private:true`, `workspace:*`, version = git SHA. Add Changesets **only if** `@desk/*` is published (Plan A) — then it lives at root for those packages only.                   |
| **Shared config** | **`@heejun/web-config-preset` stays external** | Consume via catalog caret like every sibling.                                                                                                                                                                  |
| **Catalog**       | **Yes** (§2.4)                                 | Biggest maintenance-tax reducer at this scale; lowest-common-major policy.                                                                                                                                     |
| **Remote cache**  | **Vercel Remote Cache, later**                 | `turbo link` after CI is green. Do not block construction on it.                                                                                                                                               |

**Root `turbo.json`** — note `outputs` must be complete or the remote cache is poisoned later **[CHANGED BY CRITIQUE: scale/cost added `coverage/**`, `storybook-static/**`, `\*.tsbuildinfo`]**:

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [
        "dist/**",
        ".next/**",
        "storybook-static/**",
        "!**/node_modules/**",
      ],
    },
    "typecheck": { "dependsOn": ["^build"], "outputs": ["*.tsbuildinfo"] },
    "lint": {},
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
  },
}
```

---

## 4. Git / Remote / Originals — Bloat, Source-of-Truth, Cutover

### 4.1 The size problem is `devtools-frontend`, not "history blobs" **[CHANGED BY CRITIQUE: scale/cost — this is the headline correction]**

The original plan diagnosed "600M of historical blob churn" curable by `git filter-repo --strip-blobs-bigger-than 5M`. **That is wrong and dangerous:**

- The bloat is a **299MB live working-tree directory** (`devtools-frontend/`, 4,709 tracked files), a vendored Chromium DevTools fork with **no `package.json`** — not a build dependency.
- `--strip-blobs-bigger-than 5M` would delete ~20 `*.json.gz` trace fixtures **that HEAD references** → corrupt checkout, _and still leave ~140MB of sub-5MB devtools-frontend files_. The teleport fails again.

**Superseded cost critique:** the earlier recommendation was to quarantine `remote-devtools` out entirely (§4.3). That would have dropped the worktree from 554M → ~255M and, after history purge of its path, `.git` from 241M toward <30M. The current implementation keeps `remote-devtools` integrated and accepts the heavier worktree cost.

### 4.2 Subtree strategy going forward: `--squash`

The 3 already-imported subtrees are **full-history** (commits `b8fc00..`, `44a1ff..`, `17b31b..` say "history preserved"). For all _future_ absorptions use `git subtree add --squash` (one commit per Desk, source SHA in message) — caps blob growth; full per-commit history stays in the (still-live) originals. Accept the inconsistency: the 3 done are full-history exceptions.

**[CHANGED BY CRITIQUE: migration-safety — provenance must be machine-resolvable]** A SHA buried in a squash message is unparseable and unverifiable after archival. Instead:

- Tag each origin at import: `pre-monorepo/<name>`.
- Record `{name, originSHA, importDate}` in a root **`MIGRATION.lock`** so you can `git diff` monorepo-copy vs origin-tag at any time to detect drift.

### 4.3 [SUPERSEDED] Quarantine remote-devtools (un-absorb)

There is no remote yet, so "before pushing a remote" is trivially satisfiable — which means history surgery is the genuinely-first irreversible op, not a mid-sequence Stage 0.5.

Sequence:

1. On a `git filter-repo` **copy** of the repo: `git filter-repo --path desks/remote-devtools --invert-paths` (purges the whole sub-tree _and its blob history_ from the monorepo).
2. Validate the copy: fresh clone → `pnpm install` → `pnpm -r build` green, `.git` shrunk to target.
3. Adopt the rewritten copy as the working repo.
4. remote-devtools continues to live as its own sibling repo (`blue45f/remote-devtools`, untouched original) and consumes `@desk/*` via published caret if it needs anything.

**Provenance contradiction resolved explicitly:** rewriting history invalidates the 3 done subtree-import SHAs. Therefore the **live originals on GitHub — not the monorepo's pre-rewrite commits — are the history vault.** This makes §4.4's "keep originals as truth until parity proven" **mandatory, not optional.** The two decisions are coupled.

(If the owner overrides and insists remote-devtools stays _in_: then it must be a partial-clone-only island and `devtools-frontend` must be replaced by a build-time fetch / submodule of the upstream artifact — never a 299MB vendored tree in the shared `.git`. The recommendation remains: out.)

### 4.4 Source-of-truth = **mirror-first, originals stay canonical until cutover** **[CHANGED BY CRITIQUE: migration-safety — inverts the original §4.2]**

The original asserted "monorepo is source-of-truth immediately, NOT a read-only aggregate." But originals stay **live and branch-protected**, receive **concurrent commits from other Claude/codex sessions** (per memory), and a subtree import is a point-in-time snapshot that silently diverges. The safe inversion:

- **Per Desk, until its deploy is cut over: the monorepo copy is a re-syncable MIRROR.** No feature commits land in `desks/<name>/` in the monorepo; changes flow origin → monorepo via `git subtree pull` only. Drift is one-directional and re-syncable, never a merge conflict.
- **The handoff is atomic at cutover:** in the _same_ change that flips the deploy, the origin is push-protected (or gets a "moved to monorepo" banner PR). One source is always authoritative.
- After absorption is _complete_ (all Desks cut over), the monorepo becomes the singular source-of-truth the owner directive wants — the mirror phase is a migration-window discipline, not the end state.

### 4.5 Remote

- Create `blue45f/deskcloud` **private**. Per fleet convention private-repo Actions billing may fail CI startup — **resolve this before Stage 1** (§6), do not treat it as a footnote: it determines whether server-side CI is real.
- Push **only after** §4.3 history purge + clean-clone validation. **Never** push 241M then force-push a rewrite to a remote shared with concurrent sessions.

### 4.6 Originals' fate & cutover trigger

- **During migration:** originals untouched (current state — additive/reversible). They are the rollback _and_ the per-commit history vault (mandatory per §4.3).
- **Cutover trigger per Desk (raised bar) [CHANGED BY CRITIQUE: migration-safety]:** not "monorepo build green" but **"deploy-parity proven"** — see §5.4. Green `pnpm -r build` does not prove the _deployed artifact_ (Docker image via turbo-prune, Vercel `rootDirectory` build) behaves identically to the original's deploy.
- **Archive on a DELAY, never at cutover:** repoint deploy → redeploy → soak (days of live traffic) → **then** archive. GitHub "Archive" makes a repo read-only, not absent; a local `../<repo>` on the deploy host keeps building after archival, giving false confidence. Keep archival strictly downstream of proven live traffic on the new path.
- `deskcloud-deploy` / `deskcloud-sdk` / `web-config-preset` / `remote-devtools`: never archived (separate-by-design).

### 4.7 Branch protection & CODEOWNERS

- PR + CI + CodeRabbit gate (CHANGES_REQUESTED-only blocks), admins=false relaxed per fleet private convention; owner `--admin` bypass on gate exhaustion.
- **CODEOWNERS is deferred until there is a second owner** **[CHANGED BY CRITIQUE: scale/cost — single-owner CODEOWNERS is pure PR-routing ceremony]**. Keep a stub mapping root infra (`/turbo.json /pnpm-workspace.yaml /.github/`) for intent; don't pay path-routing latency with no reviewer benefit.

---

## 5. Absorption Roadmap

### 5.1 What comes in, batched simplest → highest-blast-radius

- **Batch 0 (linchpin, before any Desk):** reconcile `desk-platform` drift into `platform/`. Desks must resolve `@desk/*` from the workspace (or published caret), not in-src copies. Import 14 broken `@desk/*` references if you skip this.
- **Batch 1 — Desks w/o SDK pkg (5):** `addesk, authdesk, filedesk, reviewdesk, surveydesk`. Establishes the glob + shared→widget build order.
- **Batch 2 — Desks w/ SDK pkg (8):** `chatdesk, communitydesk, mediadesk, moderationdesk, notifydesk, searchdesk, changelogdesk`, and **`realtimedesk` last** (WS `/socket.io` exact-match path trap, proven in remote-devtools).
- **Batch 3 — special shape:** `termsdesk` (prod-live, Vercel-web/EC2-api split, Sonar, own SDK), with live deploy-parity verification.
- **Batch 4 — alignment (post-absorption, not absorption):** route `@desk/*` everywhere, roll `@heejun/web-config-preset` across all Desks (currently 0 consume it), catalog-pin them.

_(remote-devtools removed from all batches — it's OUT per §4.3.)_

### 5.2 History-preserving import method

`git subtree add --prefix desks/<name> <path> <branch> --squash` (§4.2), **from a `--depth=1` source mirror** so you never pull a Desk's full blob churn in the first place **[CHANGED BY CRITIQUE: scale/cost — shallow-on-absorb, cheaper & safer than absorb-full-then-filter-repo]**.

### 5.3 Per-Desk checklist (every Desk)

1. **Pre:** target repo clean & pushed; tag origin `pre-monorepo/<name>`; record SHA in `MIGRATION.lock`.
2. **Import as MIRROR** (§4.4): `subtree add --squash` from `--depth=1`. No feature commits in-monorepo yet.
3. **Lift nested config:** delete the Desk's `pnpm-workspace.yaml`/`pnpm-lock.yaml`; merge only _delta_ `overrides`/`allowBuilds`/`packageExtensions` into root.
4. **Resolve:** `pnpm install --lockfile-only` → confirm no new unresolved/dupe → full `pnpm install`.
5. **Catalog-pin** first-party deps (lowest-common-major / named catalog).
6. **Validate:** `pnpm --filter "./desks/<name>/**" -r build typecheck test lint`.
7. **Turbo wire:** tasks resolve under root `turbo.json`.
8. **Deploy-parity test** (§5.4) — **gate before cutover**.
9. **Cut over** (one PR to `deskcloud-deploy` / repoint Vercel) → soak → archive origin (§4.6).
10. **Commit one Desk per commit** (bisectable provenance).

**Per-Desk rollback is a defined no-op, not a recovery project [CHANGED BY CRITIQUE: migration-safety]:** because originals stay canonical until cutover, rollback = "don't flip `build.context` / don't repoint Vercel; the original deploy is untouched and still live." Write this line into every Desk's checklist.

### 5.4 Deploy-parity test (the cutover gate) **[CHANGED BY CRITIQUE: migration-safety — new, replaces "defer to wiring plan"]**

The original §2.4 step 8 deferred deploy wiring to "the wiring plan's phase" while _this_ plan is the thing that archives originals — a contradiction. Resolve it: deploy parity is part of substrate cutover.

- **Backend:** build the image via `turbo prune --docker --scope=@desk/<x>-api` from `./desks/<x>`, run it against a **Neon branch (not prod)**, hit health + contract endpoints, diff behavior/digest against the current `../<x>`-built image.
- **Frontend:** Vercel preview from `rootDirectory=desks/<x>/apps/web` returns the same routes/SSR as the original's deploy.
- Only on parity-green do you flip `build.context` / repoint Vercel.

---

## 6. CI/CD Consolidation (Final)

### 6.1 Resolve Actions billing BEFORE Stage 1 **[CHANGED BY CRITIQUE: migration-safety]**

Consolidating ~18 enforced server-side gates into **one root CI that won't even start** (private-repo Actions billing failure) + a local pre-push hook is a **strict reduction in enforced safety** at peak blast radius (live prod backends). Decide first:

- (a) **Keep each original's CI + deploy workflow alive as the real enforced gate until that Desk is cut over** (gate parity = part of cutover), AND/OR
- (b) fund/enable Actions for the single `deskcloud` repo so root CI is genuinely enforced.
- "Local verify gate" is the _fallback_, not equivalent to branch-protection-enforced CI for 11 production backends.

### 6.2 Root CI — but affected-filtering comes AFTER `@desk/*` routing **[CHANGED BY CRITIQUE: scale/cost — turbo-affected was scheduled too early]**

`turbo run --filter='...[origin/main]'` is only correct once the dependency graph is fully expressed via `workspace:*` and `dependsOn`/`outputs` are accurate. The original turned on affected-CI in Stage 1 while deferring tsconfig-path + `@desk/*` routing to Batch 4 → affected filtering would **silently skip packages that actually broke** and go green on a real regression.

**Final ordering:**

- **Until `@desk/*` is routed via `workspace:*` everywhere:** CI runs **full `pnpm -r`** (slower, correct).
- **Add a graph-integrity check now:** `turbo run build --dry=json` fails CI if any package imports `@desk/*` but declares zero dependents (catches a missing edge before it hides a break).
- **Switch to `turbo ... --filter='...[origin/main]'` only after** Batch 4 routing lands.

```
checkout (fetch-depth: 0)              # affected diffing needs full history
→ pnpm/action-setup@v6 (from packageManager)
→ setup-node@v6 (node 24, cache: pnpm)
→ pnpm install --frozen-lockfile
→ (phase A) pnpm -r lint typecheck test build   # correct, pre-routing
→ (phase B, post-Batch-4) turbo run lint typecheck test build --filter='...[origin/main]'
```

- Carry over: `concurrency` cancel-in-progress, `paths-ignore` for md/docs, `coderabbit-gate.yml` (CHANGES_REQUESTED-only).
- **Keep `dorny/paths-filter` job-per-area, not one mega-filter [CHANGED BY CRITIQUE: migration-safety]** — one Desk's flaky Postgres test must not red-block merges touching an unrelated Desk. Preserve the isolation per-repo CIs gave for free.
- **Postgres service containers:** gate via paths-filter matrix; most Desks use PGlite in test and won't need it.
- **SonarCloud:** one free Automatic-Analysis `blue45f_deskcloud` project, **no CI token scan** (conflicts with automatic analysis per fleet rule). termsdesk's Sonar folds in.

### 6.3 Husky + commitlint at root

Single root husky: `commit-msg` (commitlint, **body ≤100** — hard fleet gate), `pre-commit` (lint-staged, path-scoped), `pre-push`. **No `--no-verify`** (fleet §5).

**pre-push must be scoped, or engineers reach for `--no-verify` [CHANGED BY CRITIQUE: scale/cost]:** a full affected build+test+lint on a 50–70-project workspace is multi-minute. Scope pre-push to **typecheck + changed-package test + `lint:security`**, not the full graph. Don't pretend a giant pre-push is sustainable.

### 6.4 Deploy — keep per-app/per-Desk, do NOT collapse

- **Frontends → Vercel, one project per Desk web app.** `rootDirectory=desks/<name>/apps/web`, `turbo-ignore` affected-only build. **Mandatory:** the Vercel **100-deploy/24h team-wide** cap means a single monorepo push must not trigger all Desk projects. **[CRITIQUE note]** this is a self-inflicted risk of co-location — `turbo-ignore` must be correct _every_ push; treat a misconfigured ignored-build-step as a budget-nuke incident.
- **Backends → central `deskcloud-deploy` compose + Caddy on EC2** (termsdesk co-host, $0 extra). The live `docker-compose.yml` builds 11 services from `../<repo>` sibling paths — **that file is the real cutover surface.** Switch each `build.context` from `../<x>` to `./desks/<x>`, **one service per PR, old context kept as a commented fallback line for instant revert [CHANGED BY CRITIQUE: migration-safety]**. Build images via `turbo prune --docker --scope=@desk/<x>-api` (lockfile slice only). The single central Caddyfile _fixes_ the known vhost-clobber hazard by owning all vhosts in one place.
- **aidigestdesk:** 운영 사유로 모노레포 경계에서 제외. 기존 GH Pages 경로/파이프라인은 별도 운영 축으로 유지.
- **Don't decommission an original's deploy/CI workflow until that Desk is cut over AND its gate parity is green in the monorepo.**

---

## 7. Sequencing vs the Architecture Plan (P0–P5)

The wiring plan's P0–P5 cannot start billing/admin/design work on a Desk until that Desk is **absorbed, green, and deploy-parity-proven** here. Each wiring phase is preceded by the matching substrate batch.

| Substrate step                                                  | Slots at       | Why before wiring                                                                       |
| --------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| §4.3 remote-devtools quarantine                                 | **superseded** | Owner directive now keeps it integrated; manage heavy asset cost with workspace filters |
| §2 workspace unification (now 2-repo: platform + seo-gateway)   | **P0**         | Nothing builds reliably until green; only honest "works" proof                          |
| §3 turbo + catalog + husky scaffolding                          | **P0→P1**      | dedupe + graph-integrity check before more code lands                                   |
| §6.1 Actions-billing decision + §4.5 remote + branch protection | **P1**         | Enforced gates must exist before family scaling                                         |
| §5 Batch 0 (platform drift reconcile)                           | **P1**         | `@desk/*` provider correct = floor under wiring's "single architecture/billing/admin"   |
| §5 Batches 1–2 (mirror-import Desks)                            | **P1→P2**      | Bulk absorption; wiring layers per-Desk after                                           |
| §5.4 deploy-parity + cutover                                    | **P2**         | Per-Desk, as wiring cuts each Desk over                                                 |
| §5 Batch 3 (termsdesk)                                          | **P2→P3**      | Highest blast radius; termsdesk last                                                    |
| §6.2 phase-B turbo-affected switch + Batch 4 routing            | **P3+**        | Affected CI only after `@desk/*` routed; overlaps wiring standardization                |

---

## 8. Open Decisions for the Owner

1. **Publish-auth spike (no longer a boundary gate):** npm/GitHub-Packages publish for `@desk/*` still matters for external consumers, but it no longer decides whether DeskCloud products stay in the monorepo.
2. **Confirmed boundary:** platform, homogeneous Desks, `SEOGatewayDesk`, `RemoteDevTools`, SDK, and deploy stack are IN. `@heejun/web-config-preset` stays OUT because it serves a wider consumer set.
3. **Actions billing for `deskcloud` private repo:** fund it (real server-side CI) or keep originals' CIs alive as the enforced gate until cutover? (§6.1)
4. **Mirror-first vs source-of-truth-first:** confirm the migration-window discipline (originals canonical until per-Desk cutover, archive-on-delay). This trades the owner's "immediate physical consolidation" framing for safety; the end state is still a single consolidated monorepo.
5. **History rewrite acceptance:** purging `devtools-frontend` (and quarantining remote-devtools) rewrites the 3 done import SHAs; provenance for those then lives only in the live originals. OK?

---

### Net

Stage 0 (2-repo unification) + §4.3 history purge are the true "monorepo works" milestone. Absorbing the 14 homogeneous Desks is mechanically cheap (~79M, near-clones, no inter-coupling). The genuinely hard items are exactly one: **termsdesk** (live prod, absorbed last with deploy-parity). The plan's mechanics were right; the critiques corrected its **scope** (exclude aidigestdesk as non-SaaS operator service), its **size diagnosis** (299MB vendored fork, not history churn), its **safety ordering** (mirror-first, parity-before-archive, history-rewrite-as-commit-zero), and its **CI correctness** (affected-filtering only after `@desk/*` routing).
