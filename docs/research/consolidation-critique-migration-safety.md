This fully grounds the critique. Each original is a live GitHub repo with its own deploy workflow (`deploy-vercel.yml`, `deploy-fly.yml`, `deploy-netlify.yml`, `deploy-pages.yml`) and CI gates, and the monorepo has no remote at all. The plan's own commit messages contradict its blob-cleanup premise (the 3 absorbed subtrees were already imported full-history, baking the 241M in permanently). I have everything needed.

---

# Adversarial Critique — Migration-Safety & Operations Lens

I verified the plan's premises against the actual trees before writing this. Key confirmations that sharpen the critique:
- The monorepo has **no git remote and a single local `main`** (`git remote -v` empty). The plan's entire CI/branch-protection/cutover edifice is being designed for infrastructure that does not yet exist.
- **node_modules was never materialized** — "lockfile resolves" is literally all that's true. The plan admits this but still schedules cutover/archival downstream of an install that has never once succeeded.
- All 5 originals are **live `blue45f/*` GitHub repos** each carrying its own deploy workflow (`deploy-vercel.yml`, `deploy-fly.yml`, `deploy-netlify.yml`, `deploy-pages.yml`) and CI gates.
- `deskcloud-deploy/docker-compose.yml` builds **11 backends from `../<repo>`** sibling paths — that file is the live production source of truth for the EC2 co-host, and it points at the originals, not the monorepo.

## Risk 1 — The plan IS the dual-source-of-truth, and it has no reconciliation mechanism (highest)

The plan asserts (§4.2) "the monorepo becomes source-of-truth... NOT a read-only aggregate." But the originals remain live, branch-protected, and **actively receiving concurrent commits from other Claude/codex sessions** (per memory: `rotifolk-codex-parallel`, `orbit-ui-concurrent-sessions`, `resume-concurrent-git`). The moment a Desk is `subtree add`-ed, you have two writable copies and **the plan describes no re-sync from origin during the weeks-long Stages 2–5.** A subtree import is a point-in-time snapshot; `b8fc0002`/`44a1ff88`/`17b31b7e` froze platform/seo-gateway/remote-devtools at whatever HEAD they had when imported, and any subsequent commit to those origins (e.g. termsdesk's live `fix(api): retry transient postgres queries`) silently diverges. By the time you "prove parity" at cutover, the monorepo copy is stale against a moving original.

De-risk:
- **Invert the default to read-only mirror first.** Until a Desk's deploy is cut over, the monorepo copy is a *mirror*, not a fork. No feature commits land in `desks/<name>/` in the monorepo; changes flow origin→monorepo via `git subtree pull` only. This makes drift one-directional and re-syncable instead of a merge conflict.
- **Freeze the original at cutover, not the monorepo at import.** Declare per-Desk: origin stays canonical and writable; monorepo is downstream until the cutover commit, at which point you push-protect the original (or open a banner PR "moved to monorepo") in the *same* change that flips the deploy. One source is always authoritative; the handoff is atomic.
- **Provenance must be a resolvable ref, not a commit message.** `--squash` with "source SHA in the message" (§4.1) is unparseable by tooling and unverifiable after the original is archived. Tag each origin at import (`pre-monorepo/<name>`) and record the SHA in a machine-readable `MIGRATION.lock` so you can `git diff` monorepo-copy vs origin-tag at any time to detect drift.

## Risk 2 — Cutover archives an original that the LIVE deploy still builds from

This is the sharpest operational landmine and the plan walks right past it. `deskcloud-deploy/docker-compose.yml` line 34–210 builds 11 services from `../surveydesk`, `../chatdesk`, `../desk-platform`, etc. The plan's §4.3 cutover trigger is "monorepo build green AND prod deploy verified from monorepo path," then "archive the original." But:
- **GitHub "Archive" makes a repo read-only, not absent.** A local `../surveydesk` working copy on the EC2/deploy host keeps building fine after archival — so "archived" gives false confidence that the original is decommissioned while the live compose still depends on it. The actual cutover is editing **one shared file** (`build.context: ../surveydesk` → `./desks/surveydesk`) that the plan defers to "the wiring plan's phase" — meaning the substrate plan archives originals whose deploy dependency it explicitly punted on wiring.
- **The compose file is a single shared artifact across all 11 backends.** Repointing one `build.context` and redeploying re-evaluates the whole compose; if any *other* service's monorepo path isn't ready, you can't partially cut over without risking the co-hosted neighbors (memory `sibling-deploy-infra`: termsdesk redeploy clobbers Caddy vhosts — same blast radius class).

De-risk:
- **Deploy-parity test before archive, from the monorepo path, on a throwaway host.** Build the image via `turbo prune --docker --scope=@desk/<x>-api` from `./desks/<x>`, run it against a Neon *branch* (not prod), hit the health/contract endpoints, and diff the running image digest/behavior against the current `../<x>`-built image. Only then flip `build.context`.
- **Never archive at cutover. Archive on a delay.** Sequence: (1) repoint `build.context`, (2) redeploy, (3) run live for a soak window (days), (4) *then* archive. Archival is reversible-but-annoying; keep it strictly downstream of proven live traffic on the new path.
- **One `build.context` flip = one PR to `deskcloud-deploy`, one service at a time**, with the old context kept as a commented fallback line for instant revert. The plan already wants per-Desk commits in the monorepo; mirror that discipline in the deploy repo.

## Risk 3 — "Lockfile resolves" → cutover schedule built on an install that has never succeeded

The plan's Stage-0 exit gate (§1.5) is sound, but Stages 2–5 (absorb 16, cut over, archive) are scheduled as "mechanically cheap" *on the assumption Stage 0 passes*. I confirmed `node_modules` has never been materialized. The plan itself flags the real hazards — `allowBuilds` native fan-out (puppeteer/chromium, pglite, embedded-postgres, sharp, @swc) firing for the first time, and cross-subtree tsconfig-path/build-order breakage — but then treats them as Stage-0-local. They are not: the same class of failure recurs *per Desk* in Stage 2–3 (8 of which carry their own SDK packages and `realtimedesk`'s WS path trap), and the plan gives each only an "S" effort with no rollback-per-Desk defined beyond "fix forward."

De-risk:
- **Make "deploy parity proven" — not "monorepo build green" — the cutover gate.** A green `pnpm -r build` does not prove the *deployed artifact* (Docker image via turbo-prune, Vercel rootDirectory build) is byte-equivalent in behavior to the original's. Add an explicit artifact-parity check per frontend (Vercel preview from `rootDirectory=desks/<x>/apps/web` returns same routes/SSR as the original's deploy) and per backend (image health + contract test) to the cutover checklist (§2.4 step 8 currently just "defer to wiring plan").
- **Per-Desk rollback must be a defined command, not a vibe.** Because originals stay canonical (Risk 1), rollback = "don't flip build.context / don't repoint Vercel; the original deploy is untouched and still live." Write that down as the explicit rollback for every Desk so a failed absorption is a no-op, not a recovery project.

## Risk 4 — Losing 6–9 per-repo CI gates behind a single root `ci.yml` that runs on a private repo with broken Actions billing

The originals carry rich, *deploy-coupled* workflows: spa-seo-gateway has `deploy-fly.yml` + `deploy-netlify.yml` + `branch-protection.yml` + `auto-merge-on-green.yml`; remote-devtools adds `pr-checklist-enforcer.yml` + `verify.yml`; termsdesk has `sonarqube.yml` + `deploy-vercel.yml`. The plan collapses "~18 per-repo ci.yml" into one turbo-affected root CI (§5.1) — but per fleet convention (and stated in §4.2/Stage-1 risk) **private-repo Actions billing makes CI startup fail**, so the plan's own mitigation is "rely on local verify gate." That means consolidating ~18 *enforced, server-side* gates down to **one CI that won't even start** plus a local pre-push hook. That is a strict reduction in enforced safety at exactly the moment blast radius is highest (live prod services).

De-risk:
- **Don't decommission an original's CI/deploy workflow until that Desk is cut over AND its equivalent gate is proven green in the monorepo.** Gate parity is part of cutover, same as deploy parity.
- **Resolve the Actions-billing question before Stage 1, not as a footnote.** If server-side CI genuinely can't run, the consolidation removes the only enforced gate the live services have. Either (a) keep the originals' CI alive as the real gate until cutover, or (b) fund/enable Actions for the one `deskcloud` repo so the root CI is real. "Local verify gate" is not equivalent to branch-protection-enforced CI for a repo carrying 11 production backends.
- **Carry per-Desk path-filtered jobs, not just one mega-filter.** A single `--filter='...[origin/main]'` job means one Desk's flaky Postgres-service test red-blocks merges touching an unrelated Desk. Keep `dorny/paths-filter` job-per-area so failures are scoped, preserving the isolation the per-repo CIs gave for free.

## Risk 5 — Blob-cleanup history rewrite is mis-scheduled and partly impossible as stated

§4.1/Stage-0.5 proposes `git filter-repo --strip-blobs-bigger-than 5M` to fix the 241M `.git` "before pushing a remote and before more absorptions." Two problems I confirmed:
1. **The bloat is already permanently baked in.** Commits `b8fc0002`/`44a1ff88`/`17b31b7e` imported the 3 subtrees *full-history* (the messages say "history preserved"). The 600M remote-devtools blob history is already inside `deskcloud/.git`. Stripping it now **rewrites every one of those SHAs**, invalidating the exact provenance the plan relies on for rollback (Risk 1) — the plan acknowledges this in the Stage-0.5 risk cell but still orders it, creating a contradiction: you cannot both "keep full-history originals as the per-commit vault behind squashed imports" *and* rewrite the importing commits.
2. **There is no remote yet, so "before pushing a remote" is trivially satisfiable** — which means the *right* sequence is: do all blob surgery **before creating `blue45f/deskcloud` and before the first push, full stop**, and make it the genuinely-first irreversible op, not Stage 0.5 after Stage 0's installs and catalog rewrites have layered new commits on top of the bloated history.

De-risk:
- **Do blob-strip as commit zero of the remote**, on a fresh `git filter-repo` copy, validated against a clean clone + full `pnpm install` + `pnpm -r build`, *then* `git remote add` and push. Never push 241M then rewrite (force-push to a shared remote with concurrent sessions per memory = catastrophe).
- **Resolve the provenance contradiction explicitly:** if you strip blobs (rewriting import SHAs), then the *originals* (still live on GitHub) — not the monorepo's pre-strip commits — are the history vault. That's fine, but it makes Risk 1's "keep originals as truth until parity proven" mandatory, not optional. The two decisions are coupled; the plan treats them independently.
- **Decide subtree strategy before, not during.** The plan uses `--squash` going forward but full-history for the 3 done. After a blob-strip rewrite, that inconsistency is permanent. Pick one (squash-all is correct given the size driver) and note the 3 already-done are full-history exceptions frozen by the rewrite.

## Cross-cutting: the safe ordering the plan inverts

The plan's instinct (simplest→highest blast radius, termsdesk last) is right, but it sequences **irreversible ops (blob rewrite, archive) before parity is proven** and treats **deploy/CI cutover as "the wiring plan's job"** while this substrate plan is the thing that archives originals. The minimal reordering that de-risks everything:

1. Blob-strip + validate on a copy → create remote → push (commit zero, before any new commits).
2. Stage 0 install/build green from clean clone (the only honest "monorepo works" proof).
3. Per Desk: import as **mirror** (read-only, re-syncable) → build green → **deploy-parity test on throwaway host/Neon branch** → flip `build.context`/Vercel rootDir (one PR, revertible) → soak → **then** archive original.
4. Keep each original's CI + deploy workflow alive as the enforced gate until that Desk's gate parity is green in the monorepo.

The one-line summary: **the plan's own commit log and the live `../<repo>` compose contradict its "physical consolidation, monorepo is source-of-truth" framing — the originals are still the live truth, so the safe path is mirror-first, parity-proven, one-Desk-at-a-time, archive-on-delay, with the blob rewrite as the genuine commit-zero before any remote exists.**

Key files grounding this: `/Users/hjunkim/WebstormProjects/deskcloud-deploy/docker-compose.yml` (11 live `../<repo>` build contexts — the real cutover surface), `/Users/hjunkim/WebstormProjects/deskcloud/.git` (241M, full-history imports already baked per `git log`), and the live originals `blue45f/{termsdesk,spa-seo-gateway,remote-devtools,desk-platform,aidigestdesk}` each carrying their own `deploy-*.yml` + CI gates.