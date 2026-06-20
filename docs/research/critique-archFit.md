The Drizzle stores and `apps/api` with a `db/schema.ts`, `tenants.controller.ts`, `billing` module DO exist — so `@desk/core` is more real than my interim read suggested: it's a NestJS service (`apps/api`) with Drizzle-backed tenant/usage/subscription/member stores and a tenants controller. This materially strengthens the plan's feasibility for the *control-plane delegation* — the system-of-record substrate is genuinely there (HTTP service + Drizzle), not vaporware. Billing is still STUB.

I now have enough ground truth to write the adversarial critique. I have verified, against the actual code, every load-bearing claim the feasibility verdict depends on.

---

# Adversarial critique — Architecture & Tenancy-Fit

**Verdict up front:** the plan's *direction* survives code contact, and several claims I expected to be hand-waved are real (`apps/api` is a genuine NestJS+Drizzle system-of-record with `drizzle-tenant/usage/subscription/member.store.ts` and a `tenants.controller.ts`; remote-devtools genuinely lacks an SDK credential and genuinely has a nullable `orgId` awaiting backfill). But the plan systematically **mis-sizes the two hardest seams** and papers over **three consistency/identity gaps** that will bite. It is harder than the plan claims in exactly the places it rates S–M. Below are the 5 failure points, each grounded in code I read.

---

## 1. The "delegate to `@desk/core` (S–M)" sizing is wrong because there is an *identity-model impedance mismatch*, not just a backing-store swap

The plan treats both candidates' tenancy delegation as "swap the backing store." But the three systems have **three different tenant identity shapes**:

- `@desk/core`: `TenantService` over a `TenantStore` port; keys are **hashed** (`secret-key.guard.ts:15` "해시 매칭", `publishable-key.guard.ts` `findByPublishableKey`), pk_/sk_ split. Persistence is Drizzle in `apps/api/src/stores/`.
- spa-seo-gateway: `multi-tenant/src/index.ts:122` `if (t.apiKey === key)` and `:177` `.find((t) => t.apiKey === key)` — **single plaintext `apiKey`, linear scan**, schema `apiKey: z.string().min(20)`. No pk/sk split, no hash.
- remote-devtools: `OrganizationEntity` + JWT claims, **no key concept at all** (gateway handshake is `deviceId`-only, confirmed at `createRoom` lines 150–168).

So "delegation" is really a **three-way identity reconciliation**: spa-seo must split one key into pk_/sk_ AND migrate plaintext→hash AND re-issue to every existing tenant (breaking every embedded customer integration); remote-devtools must *invent* the key concept from nothing. Neither is a backing-store swap; both are **breaking identity migrations**. The plan acknowledges the spa-seo key migration as a Phase-2 risk but still rates the *delegation* itself S–M and buries the "re-issue keys" as a parenthetical. Re-issuing live credentials is a customer-comms + dual-validation-window project, not an S.

**Fix / de-risk:** Decouple "adopt `@desk/core` as system-of-record" from "adopt the pk_/sk_ key format." Phase A: point spa-seo's resolver at `@desk/core`'s `TenantStore` while keeping the *legacy plaintext key column* as one more hashed-on-write lookup index (store `sha256(legacyKey)` so existing keys keep working without re-issue). Phase B: issue pk_/sk_ alongside, dual-accept both, and sunset plaintext on a published date. This turns a breaking re-issue into an additive migration.

---

## 2. The Fastify-data-plane / NestJS-control-plane split is a **two-headed system with a latency-and-availability coupling the plan never prices**

The plan's signature move — "render plane stays Fastify, control plane calls `@desk/core` for tenant lookup on every request" — converts spa-seo's current **in-process** resolve (the `preHandler` reads an in-memory/JSON `TenantStore`, line 351 `['host','apiKey']`) into a **cross-service network hop on the hot path**. The whole justification for keeping Fastify is "the Chromium hot path needs lean overhead" — but you've just put a synchronous `@desk/core` HTTP call (or shared-Neon query) in front of *every* render request, including cache hits, which the plan itself says are "near-free." That is the opposite of lean: you've added a control-plane dependency to the one path that was fast, and coupled render availability to `apps/api` uptime.

This is the leak in "clean split": tenant resolution is a **control-plane concern executed on the data-plane hot path**. You can't cleanly put it on either side.

**Fix / de-risk:** Make the data plane hold a **read-through cache of resolved tenants keyed by host/keyhash with a short TTL + stale-while-revalidate**, populated from `@desk/core` but never blocking a render on a live control-plane call. `@desk/core` becomes system-of-record for *writes*; the Fastify edge keeps an eventually-consistent read replica in memory. Tenant disable/key-rotation propagates within TTL (document the window; make it a plan-enforced security parameter, e.g. 30–60s). This preserves both "one authority" and "lean hot path" — but it must be designed in Phase 2, not discovered in prod. The plan's "shared Neon DB, thin `@desk/core` client" framing hides this entirely.

---

## 3. Dual-writing tenancy/billing to the platform **while TypeORM keeps the CDP entities IS the consistency nightmare** — and the plan's own data proves it

The plan says keep TypeORM for CDP, delegate org/plan/billing to `@desk/core` — "one tenancy/billing authority, not one ORM." Fine in principle. But look at what's actually in the TypeORM entities: `record.entity.ts:19` `@Index(['orgId','timestamp'])` and `:31` `@Column({name:'org_id', nullable:true})`. **`orgId` is a first-class column on the high-volume CDP tables, and it points at an organization whose system-of-record you're moving to `@desk/core`.** That is a cross-store foreign key with no referential integrity — the exact dual-write hazard the question flags.

Concretely the nightmare cases:
- An org is created/renamed/deleted in `@desk/core`, but millions of TypeORM CDP rows carry `org_id` UUIDs that `@desk/core` no longer knows about → orphaned replays, broken plan-scoped queries.
- Plan enforcement at the **gateway** (concurrent-session cap, retention) must read plan state from `@desk/core` but write/evict CDP data in TypeORM — two stores, no transaction, under a lossy WS load.
- The plan wants to make `org_id` NOT NULL after backfill (`record.entity.ts:29` comment "백필 후 NOT NULL"), but the orgs it references live in a *different database now*. You cannot enforce NOT NULL+FK across a service boundary.

**Fix / de-risk:** Treat `org_id` in TypeORM as an **opaque immutable tenant stamp**, explicitly NOT a foreign key — orgs are *append-only-identified* (UUID minted by `@desk/core`, never reused, soft-deleted only). Forbid hard-delete of orgs in `@desk/core` (tombstone instead) so CDP rows never dangle. Backfill assigns a synthetic "legacy/unattributed" org UUID to pre-existing rows so NOT NULL becomes achievable without inventing real tenancy retroactively. Reconcile via a nightly job that flags CDP `org_id`s absent from `@desk/core`, rather than pretending FK integrity exists. The plan's "keep TypeORM, delegate the rest" is viable *only* with this explicit no-FK / tombstone contract written down — otherwise the two stores drift the first time an org is deleted.

---

## 4. The SDK-credential + gateway-orgId threading is correctly flagged as L, but the plan **under-specifies the one thing that makes it tractable: where the org boundary is enforced**

Verified: the external gateway has **zero auth** (`apps/remote-platform-external/src/modules/webview/` has no Guard/UseGuards), `createRoom` takes `deviceId` only, and `cdp-event-persistence.service.ts` calls `networkService.create`/`runtimeService.create` with no orgId. So today *any* deviceId can open a room and write CDP data attributed to no one. The plan says "issue per-org write keys, validate at `handleConnection`, map key→orgId, stamp orgId on createRoom" — directionally right.

But the plan misses that this is a **stateful, single-instance, lossy** WS server (its own Axis-2 risk section admits "30-min max age, oldest-session flush"). Threading orgId here has two traps the plan doesn't name:
- **Handshake-time vs event-time identity.** If the key→org mapping is resolved only at `handleConnection` and cached on the socket, a key rotation/revocation mid-session keeps writing under the old org until disconnect. For a long-lived CDP socket that can be hours, that's a real tenancy-leak/over-billing window.
- **Buffer eviction crosses tenants.** The "oldest-session flush" evicts buffers globally; once orgId is the billing/isolation key, a noisy free-tier org can evict a paid org's buffered events. Tenancy turns a performance heuristic into a **fairness/SLA bug**.

**Fix / de-risk:** Resolve key→orgId at handshake AND stamp every persisted row from the socket-bound orgId (cheap), but make revocation a **server-pushed disconnect** (the control plane can sever a socket on key revoke) rather than relying on next-connect re-check. Make buffer eviction **per-org-fair** (cap buffers per org, evict within the offending org first) before flipping orgId to NOT NULL. Stage exactly as the plan says — behind the existing self-host bypass — but add a load test that asserts a free org cannot evict a paid org's buffer. This is still L; the plan's L is right, but its risk mitigation ("meter at connect/disconnect, never block ingest") addresses billing accuracy and skips the **isolation** failure mode.

---

## 5. The onboarding contract leaks at **"TermsDesk embodies the contract but doesn't import `@desk/*`"** — the plan cites this as validation but it's actually an unowned-divergence risk

The plan leans on "TermsDesk validates the behavioral contract — it's Drizzle but doesn't import `@desk/*`." Read adversarially: that means **the contract has no single enforced definition**. TermsDesk reimplements it; `@desk/core` defines it in `packages/core` + `packages/shared`; the two candidates will adopt a *third* and *fourth* interpretation. There is no conformance test that all Desks satisfy the same tenant/key/usage contract — the plan's own "26-item parity checklist" is a manual audit, not executable. Every new Desk that "embodies first-party" is a fork of the contract that can silently drift (key format, usage event shape, plan-limit semantics). That is precisely where onboarding "leaks": the contract is documentation + four implementations, not one verifiable interface.

**Fix / de-risk:** Promote `@desk/shared`'s Zod schemas (which already exist) into a **published contract-conformance test suite** — a package every Desk imports in CI that asserts: key format/hash, `UsageEvent` shape, plan-limit 402/429 semantics, CORS-allowlist behavior. Make "is a Desk" mean "passes `@desk/conformance`," not "feels fully built (Dossier E §B)." Until that exists, "consolidate onto `@desk/*`" has no teeth and each candidate's assimilation is unfalsifiable.

---

## Net assessment

- **Believe:** data-plane decoupling for both hot paths (Chromium loop; CDP WS) is sound and code-justified. `@desk/core` as control-plane system-of-record is *real* (apps/api + Drizzle stores exist), not vaporware — the plan earns this.
- **Don't believe the sizing:** "tenancy/billing delegation S–M" for both. It's a three-way **identity-model reconciliation** (plaintext→hash→pk/sk for spa-seo; key-from-nothing for remote-devtools), each a breaking credential migration. Re-rate to M–L with an explicit additive-migration design.
- **Biggest unpriced risk the plan hides:** putting tenant resolution (control plane) on the render hot path (data plane) reintroduces the latency/availability coupling the Fastify decoupling was supposed to avoid (#2), and the cross-store `org_id` with no FK integrity is a live consistency hazard the plan's own `record.entity.ts` reveals (#3).
- **Correctly flagged but under-specified:** the gateway orgId/SDK-credential work (L is right) — but the plan addresses billing accuracy and ignores **tenant isolation** (mid-session revocation window; cross-tenant buffer eviction) (#4).
- **Structural gap:** the onboarding contract has four implementations and zero executable conformance, so "fully assimilated" is unverifiable (#5).

Files grounding the above: `desk-platform/packages/core/src/{tenant-service.ts,memory-stores.ts:15,nest/secret-key.guard.ts,nest/publishable-key.guard.ts}`, `desk-platform/apps/api/src/stores/drizzle-tenant.store.ts` (system-of-record is real), `desk-platform/packages/billing/src/adapter.ts:5` (STUB), `spa-seo-gateway/packages/multi-tenant/src/index.ts:122,177,351` (plaintext linear-scan resolver), `remote-devtools/apps/remote-platform-external/src/modules/webview/webview.gateway.ts:145-168` (deviceId-only, unauthenticated createRoom), `remote-devtools/libs/entity/src/record.entity.ts:19,29-32` (nullable cross-store `org_id` awaiting backfill).