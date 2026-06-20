Facts confirmed: 241M .git, no turbo.json, nested workspace+lock files present (including remote-devtools sdk/client nested locks). I have everything needed.

# DeskCloud Monorepo — Construction & Migration Plan (Substrate)

This is the substrate plan beneath `docs/INTEGRATION-PLAN.md`. It governs how the monorepo is built, scaled, tooled, remoted, and CI'd — not the architecture/billing/admin/design wiring (that plan owns those). Wherever this plan touches a wiring axis, it only lays the floor the wiring stands on.

Verified current state (2026-06-20): root `pnpm-lock.yaml` (727 KB) + `pnpm-workspace.yaml` resolve, **`.git` is 241M**, **no `turbo.json`**, and **6 nested `pnpm-workspace.yaml`/`pnpm-lock.yaml`** survive inside the subtrees (`platform/`, `desks/seo-gateway/`, `desks/remote-devtools/`, plus `remote-devtools/sdk` and `remote-devtools/client` nested locks). These nested files are the first cleanup target.

---

## 1. Workspace Unification Completion (finish the 3-repo monorepo)

Current state is "lockfile resolves" — not "monorepo works." Close the gap in this exact order.

### 1.1 Lift nested workspace + lock files
The root `pnpm-workspace.yaml` already globs into the subtrees and already merged their `overrides`/`allowBuilds`/`auditConfig`/`minimumReleaseAgeExclude`/`packageExtensions`. The nested files are now dead weight that confuse pnpm, IDEs, Vercel root-dir detection, and `turbo`.

Steps:
1. Confirm no glob still points *at* a nested workspace as a project (it shouldn't — pnpm only reads the root). 
2. Delete all 6 nested files:
   - `platform/pnpm-workspace.yaml`, `platform/pnpm-lock.yaml`
   - `desks/seo-gateway/pnpm-workspace.yaml`, `desks/seo-gateway/pnpm-lock.yaml`
   - `desks/remote-devtools/pnpm-workspace.yaml`, `desks/remote-devtools/pnpm-lock.yaml`
   - `desks/remote-devtools/sdk/pnpm-lock.yaml`, `desks/remote-devtools/client/pnpm-lock.yaml`
3. Grep each subtree's package.json scripts/CI for hardcoded references to a local lockfile or `--frozen-lockfile` cwd assumptions (remote-devtools' turbo `extends: ["//"]` assumes its own root — that root is now the monorepo root, which is what we want).
- **Risk:** deleting a nested lock that pinned a *different* transitive than the merged root lock → silent version drift. **Mitigation:** do the delete and the real install (1.2) in one commit; diff the resolved tree before/after with `pnpm list -r --depth 0` snapshots.

### 1.2 Real install (not lockfile-only)
```
pnpm install            # full node_modules materialization, runs allowBuilds
```
- **Risk:** `allowBuilds` native builds (esbuild, @swc/core, @nestjs/core, pglite, embedded-postgres, sharp, puppeteer) fire for the first time on this machine; a missing toolchain (e.g. puppeteer chromium fetch) can fail the whole install. **Mitigation:** the merged `allowBuilds` is already the union; if a build script blocks, isolate with `pnpm install --config.confirmModulesPurge=false` and resolve per-package, don't loosen the global gate.

### 1.3 Per-package build/test/lint validation
Run topologically, capture which packages fail:
```
pnpm -r build      # pnpm respects workspace:* topo order today
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```
- **Risk (highest):** the seo-gateway and remote-devtools subtrees were authored as *independent roots* with their own `tsconfig` paths, their own `vite`/`vitest` configs resolving from their old root, and (remote-devtools) a WS adapter with the `/socket.io` exact-match path trap. Build order across the *combined* graph may differ from each repo's isolated order. **Mitigation:** fix forward per-package; do NOT rewrite tsconfig `extends` to the new `tsconfig.base.json` yet (that's a Stage-1 task) — first prove the as-imported code builds, then standardize.

### 1.4 Resolve version drift → pnpm catalog
The three subtrees carry independent React / Tailwind / Nest / Vite / vitest / zod / drizzle versions. The merged root `overrides` masks *security* drift but not *first-party* drift. Introduce a root `catalog:` (orbit-ui is the in-fleet reference pattern, the only repo already using catalogs).

Concrete catalog entries (toolchain spine): `react`, `react-dom`, `@types/react`, `@types/react-dom`, `typescript`, `@types/node`, `vite`, `@vitejs/plugin-react-swc`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/*`, `zod`, `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-fastify`, `drizzle-orm`, `drizzle-kit`, `tailwindcss`, `@electric-sql/pglite`, and the `@heejun/*` config carets.

Migration mechanics:
1. Add `catalog:` block to root `pnpm-workspace.yaml` pinning the **highest** currently-resolved version of each (consistent with `.npmrc resolution-mode=highest`).
2. Rewrite each sub-package's `package.json` first-party deps to `"react": "catalog:"` etc. (codemod: a `jq`/`sed` pass keyed on the catalog key list).
3. `pnpm install` → single lock.
4. Once first-party deps are catalog-pinned, the root `overrides` block collapses to **transitive security pins only** (undici, ws, fastify floor, etc.) — keep those; drop any override now redundant with a catalog entry.
- **Risk:** picking "highest" forces a sub-repo onto a newer major (e.g. Tailwind 3→4, vitest 3→4) it isn't ready for. **Mitigation:** catalog-pin only where versions are already within one major across subtrees; for genuine major splits, use a **named catalog** (`catalog: { ... }` + `catalogs: { legacy: { tailwindcss: "^3" } }`) and reference `catalog:legacy` from the lagging package until it's upgraded — don't force the major as part of unification.

### 1.5 Exit criterion (Stage 0 done)
`pnpm install --frozen-lockfile && pnpm -r build && pnpm -r typecheck && pnpm -r test && pnpm -r lint` all green from a clean clone, with zero nested workspace/lock files. This is the gate before any new Desk is absorbed.

---

## 2. Scaling to the Full Family (how far the monorepo extends)

### 2.1 Decision: absorb 16, keep 2 separate
**Absorb (history-preserving `git subtree`):** all 14 backend Desks + aidigestdesk + (already-in) desk-platform. ~426 commits, ~79MB `.git` total — trivial against the existing 241M (which is 96% remote-devtools).

**Keep SEPARATE — argued:**
- **`deskcloud-sdk` (`@heejun/deskcloud`)** — published npm artifact (`files:["dist"]`, tsup, consumed by pettography via `^0.1.0`, and already in the monorepo's `minimumReleaseAgeExclude`). Vendoring it conflates internal app churn with a public SemVer surface and forces external consumers to track the monorepo. Its identity is "published package." Keep standalone; reference via npm caret + catalog if ever needed internally.
- **`deskcloud-deploy`** — deploy harness with no `package.json` (compose + Caddyfile + `deploy.sh` + a secrets `.env`). Absorbing it couples deploy infra to app CI, drags secrets into the shared tree, and breaks its job of being the *outside* deployer of *all* services. Keep as a sibling infra repo; only rewrite its `build.context` paths to point at the monorepo (see §5).
- **`@heejun/web-config-preset`** — cross-fleet standard with a consumer set strictly larger than DeskCloud (resume, pettography, rotifolk, proto-live pull it from npm). Moving it in gains nothing but coupling; you'd still publish from inside. Consume it like every sibling does: npm caret pinned through the catalog. Keep external.

### 2.2 Prefix layout (final target)
```
deskcloud/
  platform/                 ← desk-platform (provider of @desk/*)   [done, reconcile]
  desks/
    seo-gateway/            ← spa-seo-gateway        [done]
    remote-devtools/        ← remote-devtools        [done]
    addesk/  authdesk/  filedesk/  reviewdesk/  surveydesk/         [batch 1]
    chatdesk/ communitydesk/ mediadesk/ moderationdesk/
    notifydesk/ searchdesk/ changelogdesk/ realtimedesk/           [batch 2]
    aidigestdesk/  termsdesk/                                       [batch 3]
  docs/  turbo.json  pnpm-workspace.yaml  ...
```
Each Desk keeps its internal `apps/{api,web}` + `packages/{shared,widget,(sdk)}` shape unchanged under its prefix.

### 2.3 Batches & order (de-risk simplest → highest blast radius)
- **Batch 0 (now):** reconcile `desk-platform` drift into `platform/`. It's the `@desk/*` provider; Desks must resolve `@desk/*` from the workspace, not in-src copies. **Do this before any Desk lands** or you import 14 broken `@desk/*` references.
- **Batch 1 — clone Desks, no SDK pkg (5):** `addesk, authdesk, filedesk, reviewdesk, surveydesk`. Establishes `desks/<name>/{apps,packages}/*` globs + shared→widget build order. S each.
- **Batch 2 — clone Desks, with SDK pkg (8):** `chatdesk, communitydesk, mediadesk, moderationdesk, notifydesk, searchdesk, changelogdesk`, and **`realtimedesk` last** (WS `/socket.io` exact-match path trap — same as remote-devtools). S each.
- **Batch 3 — special shape (2), solo:** `aidigestdesk` (no `apps/api`; `apps/toss` + `packages/content`; Vercel + GH Pages) then `termsdesk` (114 commits, prod-live Vercel-web/EC2-api split, Sonar + api-proxy + own SDK) **absorbed last with live-deploy verification**.
- **Batch 4 — alignment (post-absorption, not absorption):** route `@desk/*` via workspace deps everywhere, roll `@heejun/web-config-preset` across all Desks (currently 0 consume it), catalog-pin them.

### 2.4 Per-batch checklist (run for every Desk)
1. **Pre:** target repo clean & pushed; record `git rev-parse HEAD` of source for provenance.
2. **Import:** `git subtree add --prefix desks/<name> <path-or-remote> <branch> --squash` (see §4 for the `--squash` decision).
3. **Lift nested config:** delete the Desk's `pnpm-workspace.yaml` + `pnpm-lock.yaml`; merge its unique `overrides`/`allowBuilds`/`packageExtensions` into root (most are already the union — diff and add only deltas).
4. **Resolve:** `pnpm install --lockfile-only` → confirm no new unresolved/duplicate; then full `pnpm install`.
5. **Catalog-pin** first-party deps to `catalog:`.
6. **Validate:** `pnpm --filter "./desks/<name>/**" -r build typecheck test lint`.
7. **Turbo wire:** ensure tasks resolve under root `turbo.json` (no per-Desk `turbo.json` except remote-devtools' until §3 normalizes).
8. **Deploy wire:** point `deskcloud-deploy` compose `build.context` at `./desks/<name>` (backends) and create/repoint Vercel project `rootDirectory` (frontends) — defer activation to the wiring plan's phase.
9. **Commit** one Desk per commit (keeps `subtree` provenance and bisectability).

---

## 3. Tooling

### 3.1 Task runner — Turborepo at root (recommended)
At 50–70 workspace projects, plain `pnpm -r` re-runs everything with no cache and no affected filtering. remote-devtools already ships a `turbo.json` and the team knows turbo — lowest friction. nx/lerna would be a heavier re-architecture; **do not** introduce them.

Root `turbo.json`:
```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!**/node_modules/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint":      {},
    "test":      { "dependsOn": ["^build"] }
  }
}
```
Keep the existing `pnpm -r` scripts as a fallback. Delete remote-devtools' inner `turbo.json` (its `extends: ["//"]` now resolves to the monorepo root, so a single root config covers it). 

**Remote cache:** optional, not Stage-1. Vercel Remote Cache is free for the personal/team tier and pairs with the existing Vercel usage; enable it later via `turbo login`/`turbo link` once CI is green, so CI runners and local share a cache. Do not block construction on it.

### 3.2 Versioning — two-tier (matches reality)
- **Internal `@desk/*` + all apps:** stay `private: true`, consumed via `workspace:*`, "version" = git SHA. No changesets.
- **Published packages:** Changesets at root **only if** a package must remain npm-published from inside the monorepo. Today none of the absorbed code is published (`@heejun/deskcloud` and `web-config-preset` stay external). So: **no Changesets needed at construction time.** Add it only when/if `deskcloud-sdk` is ever vendored in (not planned).

### 3.3 Shared config — keep `@heejun/web-config-preset` external (see §2.1), consume via catalog caret.

### 3.4 pnpm catalog — yes (detailed in §1.4). Single biggest maintenance-tax reducer at this scale.

---

## 4. Git / Remote / Originals Strategy

### 4.1 The size problem is remote-devtools, not the Desks
`.git` is 241M and the 16 candidate Desks add only ~79M. The prior cloud "teleport" choked on **remote-devtools' 600M source history** (blob bloat), now compressed into the monorepo. Two levers:

1. **Subtree `--squash` for all remaining absorptions.** History-preserving at the *Desk* granularity (one squashed commit per import, with the source SHA in the message) without compounding 426 commits of multi-MB blob churn. Owner's "history-preserving" directive is satisfied at the repo-import level; full per-commit history remains in the untouched originals. *(The 3 already-absorbed subtrees were full-history — that's fine and done; apply `--squash` going forward to cap growth.)*
2. **Blob cleanup on the heavy history** before any full-tree cloud op: run `git filter-repo --analyze` to find the 600M blobs (likely build artifacts/screenshots/recordings committed under remote-devtools), then `git filter-repo --strip-blobs-bigger-than 5M` (or BFG) on a *copy*, validate, and force-adopt. This is the actual fix for "teleport failed on size." Schedule it as its own stage — it rewrites history, so do it **before** pushing a remote and before more absorptions.
3. Routine `git gc --aggressive --prune=now` after each batch.

### 4.2 Remote — single new GitHub remote `deskcloud` (private), monorepo is source-of-truth going forward
- Create `blue45f/deskcloud` private (Actions billing → CI startup may fail on private; rely on local verify gate per fleet convention, same as other private repos).
- The monorepo becomes **source-of-truth** for absorbed code. It is NOT a read-only aggregate — owner directive is *physical consolidation*, deep operational merge. A read-only mirror would defeat "one architecture/billing/admin."
- Push only **after** §4.1 blob cleanup (don't push 241M+ then rewrite).

### 4.3 Originals' fate
- **During migration (Stages 0–N):** originals stay **untouched** (current state — additive/reversible). They're the rollback and the full-history archive.
- **After a Desk is absorbed, validated, and its deploy is cut over:** **archive** the original (GitHub "Archive repository" → read-only, not deleted). Don't delete — they're the per-commit history vault behind the squashed imports and the fallback if a subtree import is found defective.
- **`deskcloud-deploy` / `deskcloud-sdk` / `web-config-preset`:** remain active, never archived (they're the separate-by-design repos).
- **Cutover trigger per Desk:** monorepo build+test green for that Desk AND its prod deploy verified from the monorepo path (§5). Until then the original is the live source.

### 4.4 Branch protection & CODEOWNERS
- Branch protection: PR + CI + CodeRabbit gate (CHANGES_REQUESTED-only blocks), admins=false relaxed per fleet private-repo convention; owner `--admin` bypass available on gate exhaustion.
- `CODEOWNERS`: scope by prefix — `/platform/ @blue45f`, `/desks/<name>/ @blue45f`, `/turbo.json /pnpm-workspace.yaml /.github/ @blue45f` (root infra). Single-owner today, but the file makes path-ownership explicit for future and drives PR review routing.

---

## 5. CI/CD Consolidation

### 5.1 One root CI, turbo-affected + path-filtered
Replace ~18 per-repo `ci.yml` with a single `.github/workflows/ci.yml`:
```
checkout (fetch-depth: 0)         # affected diffing needs full history
→ pnpm/action-setup@v6 (from packageManager)
→ setup-node@v6 (node 24, cache: pnpm)
→ pnpm install --frozen-lockfile
→ pnpm exec turbo run lint typecheck test build --filter='...[origin/main]'
```
- Carry over wholesale from the canonical fleet CI: `concurrency` cancel-in-progress, `paths-ignore` for md/docs, the **`coderabbit-gate.yml`** (CHANGES_REQUESTED-only github-script gate).
- **Postgres service containers:** several backends need PG; gate via `dorny/paths-filter` matrix so a single-Desk or docs change doesn't spin up every service. (Most Desks use PGlite fallback in test, so many won't need the service at all.)
- **SonarCloud:** keep the free Automatic Analysis as one `blue45f_deskcloud` project — **no CI token scan** (conflicts with automatic analysis per fleet rule). termsdesk's existing Sonar config folds into this single project.

### 5.2 Husky + commitlint at root
Single husky install at monorepo root: `commit-msg` (commitlint, **body ≤100** — hard fleet gate), `pre-commit` (lint-staged, path-scoped), `pre-push` (`turbo run build typecheck test --filter='...[origin/main]'` + `lint:security`). No `--no-verify` (fleet §5 hook rule).

### 5.3 Deploy — keep per-app/per-Desk (do NOT collapse)
- **Frontends → Vercel, one project per Desk web app**, `rootDirectory = desks/<name>/apps/web`, build `turbo run build --filter=@desk/<x>-web`, ignored-build-step via `turbo-ignore` so only changed apps redeploy. **Critical:** the Vercel free **100-deploy/24h team-wide** limit means `turbo-ignore` affected-only is mandatory or a single monorepo push burns the budget across all Desk projects.
- **Backends → keep `deskcloud-deploy` central compose + Caddy on EC2 (termsdesk co-host, $0 extra).** Switch each service `build.context` from `../<repo>` to `./desks/<x>` (or to a checked-out monorepo path), and build images via **`turbo prune --docker --scope=@desk/<x>-api`** so each Dockerfile gets only its lockfile slice + deps, not the whole monorepo. The single central Caddyfile actually *fixes* the known vhost-clobber hazard by owning all vhosts in one place.
- **aidigestdesk:** preserve its GH Pages path (`VITE_BASE_PATH=/aidigestdesk/`, `deploy-pages.yml`) — it's the one non-Vercel frontend; handle it solo in Batch 3.

---

## 6. Sequencing vs the Architecture Plan (P0–P5)

Almost all of this plan is **P0/P1 substrate** that must land before the wiring plan can stand on it:

| Substrate step | Slots at | Why before wiring |
|---|---|---|
| §1 workspace unification (3-repo) | **P0** | Nothing builds reliably until this is green |
| §3 turbo + catalog + husky/CI scaffolding | **P0→P1** | Affected CI & dedupe needed before more code lands |
| §4.1 remote-devtools blob cleanup | **P0** (one-shot) | Must precede remote push & further absorption |
| §4.2 GitHub remote + branch protection/CODEOWNERS | **P1** | Gate-enforced merges before family scaling |
| §2 Batch 0 (platform drift reconcile) | **P1** | `@desk/*` provider must be correct before Desks resolve it — this is the floor under the wiring plan's "single architecture/billing/admin" |
| §2 Batches 1–2 (clone Desks) | **P1→P2** | Bulk absorption; wiring (billing/admin/design) layers on top per-Desk afterward |
| §5.3 deploy repointing | **P2** | Per-Desk, activated as the wiring plan cuts each Desk over |
| §2 Batch 3 (aidigest, termsdesk) | **P2→P3** | Highest blast radius; align with wiring's "spa-seo first then remote-devtools" risk ordering |
| §2 Batch 4 (web-config-preset + @desk/* workspace routing) | **P3+** | Alignment overlaps the wiring plan's standardization axis |

Rule of thumb: the wiring plan's P0–P5 *cannot start its billing/admin/design work on a Desk until that Desk is absorbed and green* — so each wiring phase is preceded by the corresponding absorption batch here.

---

## 7. Phased Roadmap for the Consolidation Itself

| Stage | Scope | Effort | Biggest risk |
|---|---|---|---|
| **Stage 0 — Finish 3-repo workspace** | Lift 6 nested workspace/lock files; real `pnpm install`; per-pkg build/test/lint green; introduce catalog + named-catalog for major splits | **M** | `allowBuilds` native build failures + cross-subtree build-order/tsconfig-path breakage masking as "green lockfile" |
| **Stage 0.5 — Heavy-history cleanup** | `git filter-repo --analyze` → strip remote-devtools' >5M blobs on a copy, validate, adopt; `git gc` | **M** | History rewrite invalidates the 3 done subtree merges' SHAs — must happen before remote push & before more absorptions, and be validated against a fresh clone |
| **Stage 1 — Tooling & CI** | Root `turbo.json` (+ drop inner one); root husky/commitlint; single `ci.yml` (turbo-affected + paths-filter + Postgres matrix); `coderabbit-gate.yml`; create private `deskcloud` remote; branch protection + CODEOWNERS; push | **M** | Vercel/Sonar project wiring + private-repo Actions-billing CI startup failure (mitigate: local verify gate) |
| **Stage 2 — Batch 0+1** | Reconcile `platform` drift; absorb `addesk, authdesk, filedesk, reviewdesk, surveydesk` (`--squash`), per-batch checklist | **M** | `@desk/*` must resolve from workspace, not in-src copies — platform drift reconcile is the linchpin |
| **Stage 3 — Batch 2** | Absorb 7 SDK-pkg Desks + `realtimedesk` last | **M** | `realtimedesk` WS `/socket.io` exact-match path trap (proven in remote-devtools) |
| **Stage 4 — Batch 3** | `aidigestdesk` (no-api, GH Pages) then `termsdesk` (prod-live, Vercel/EC2 split, Sonar) solo, with live-deploy verification | **L** | termsdesk blast radius — prod is live; verify deploy from monorepo path before cutover/archive |
| **Stage 5 — Alignment & cutover** | Route `@desk/*` via workspace deps fleet-wide; roll `@heejun/web-config-preset` across all Desks; repoint all deploys; archive cut-over originals | **L** | `web-config-preset` rollout regressions across 14 Desks that currently consume 0 of it; archiving an original before its deploy is proven |

**Net:** Stage 0 + 0.5 + 1 are the true "monorepo works" milestone and the prerequisite for everything the wiring plan does. Absorbing the family (Stages 2–4) is mechanically cheap (~79M, ~426 commits, near-clone Desks) — the only genuinely hard items are the remote-devtools blob cleanup (Stage 0.5) and termsdesk (Stage 4).

**Key files:** `/Users/hjunkim/WebstormProjects/deskcloud/pnpm-workspace.yaml` (add `catalog:`, holds merged union), `/Users/hjunkim/WebstormProjects/deskcloud/package.json` (root scripts), `/Users/hjunkim/WebstormProjects/deskcloud/turbo.json` (to create), the 8 nested lock/workspace files to delete (listed §1.1), `/Users/hjunkim/WebstormProjects/deskcloud-deploy/docker-compose.yml` + `Caddyfile` (rewrite `build.context` → `./desks/<x>`), `/Users/hjunkim/WebstormProjects/orbit-ui/pnpm-workspace.yaml` (catalog reference), `/Users/hjunkim/WebstormProjects/termsdesk/.github/workflows/ci.yml` + `coderabbit-gate.yml` (canonical CI to consolidate).