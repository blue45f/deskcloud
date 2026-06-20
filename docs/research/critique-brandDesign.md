This is a strategy/architecture critique, not a frontend build, so the skill's build-oriented setup scripts (which expect a PRODUCT.md in a real project tree) don't apply — my cwd is a bare projects root, not the DeskCloud repo. I have the plan text and the family-resemblance steer, which is everything the critique needs. I'll deliver the critique directly rather than running build scaffolding that has no target.

---

# Brand / IA / Design-System Critique — DeskCloud Consolidation

The plan is technically rigorous and its Axis-4 instincts are mostly right (alias-layer tokens, bespoke inner panels, accent-hue-only differentiation). But viewed purely through brand/audience/design-system, it has a **positioning blind spot the four dossiers structurally can't surface**: the dossiers audit *capability parity* (does it have tenancy, billing, keys), and the plan inherits that frame. Capability parity is orthogonal to *audience coherence*. Two products can both be "fully-built Desks" and still not belong in the same buyer's portal. Below are the five biggest risks, ranked by brand damage, each with a concrete fix.

---

## Risk 1 — Audience incoherence: the portal now serves two buyers who never co-purchase (BIGGEST risk)

**The attack.** Every business Desk (TermsDesk, inquiry desks, the SaaS family) is bought by an **ops/legal/founder/admin** persona — someone who manages a business function. spa-seo-gateway (a Rendertron/Prerender replacement) and remote-devtools (a CDP debugging console) are bought by an **engineer** — someone debugging a render pipeline or a production session. These are not the same wallet, not the same job-to-be-done, and critically **not the same moment of need**. The plan's headline cross-sell ("a dev on free remote-devtools sees 'add spa-seo-gateway'") is plausible *within the dev track* — but the plan also implies cross-sell *across* tracks (the "한 번 가입, 전체 패밀리에 적용" account model, "use 2+ Desks → discount"). A legal-ops buyer of TermsDesk has **zero** use for a CDP session replay tool. Bundling them doesn't read as "powerful platform"; it reads as "this vendor doesn't know who it's for."

**Why the plan misses it.** Axis 1.3 frames the grouping decision as an *IA/navigation* problem ("a flat grid would bury them") and solves it with a `track` field. But the real question isn't "where do they sit in the catalog" — it's "**does DeskCloud's one-sentence value prop survive their inclusion?**" The plan never states that sentence. If DeskCloud is "비즈니스 운영을 위한 Desk 패밀리," the dev tools are an exception that erodes it. If it's "한 계정으로 운영하는 모든 SaaS 인프라," it's so broad it means nothing (the AT&T-store problem: sells everything, stands for nothing).

**Fix — separate the *story* from the *substrate*.** Keep the shared platform plumbing (one billing engine, one operator console, one token authority) — that's sound and invisible to buyers. But split the **public-facing portal narrative**:
- DeskCloud's marketing/catalog homepage stays a **business-Desk** story. That's the brand.
- The two dev tools live under a distinct surfaced sub-brand — **"DeskCloud for Developers"** or a named track ("DeskCloud Labs / Infra") — with its **own entry point, its own hero, its own catalog facet**, reachable but not interleaved into the business grid.
- Make this an explicit, written **positioning rule in PRODUCT.md/DESIGN.md**: "DeskCloud sells business operations; the Developer track is a co-resident product line sharing infrastructure, not a peer in the business catalog." Without that sentence committed, every future Desk decision re-litigates this.

The plan's `track` field is the *mechanism* for this — but the plan treats it as cosmetic IA ("presentational only"). It's not cosmetic; it's load-bearing brand architecture. Elevate it.

---

## Risk 2 — "Developer & Infra vs Business Desks" as a *catalog binary* signals an incoherent product

**The attack.** A two-bucket split where one bucket is "Business Desks" (the brand's whole reason to exist, N items) and the other is "Developer & Infra" (2 items, bolted on) doesn't read as deliberate product architecture — it reads as **a junk drawer**. The asymmetry is the tell. Buyers infer: "the business stuff is the real product; these two are where they put things that didn't fit." That's worse for the dev tools' credibility (they look like afterthoughts) *and* worse for the business brand (it looks diluted). A binary facet makes the seam visible at exactly the moment you want it invisible.

**Why the plan misses it.** The plan picks the sub-grouping because the alternatives it considered were "flat grid" (buries them) and "separate umbrella" (loses plumbing). It never considered that **a 2-item track surfaced as a top-level catalog peer is itself a brand statement** — and a bad one, because of the asymmetry.

**Fix — don't surface the split as a symmetric binary.** Three better moves, in order of preference:
1. **Track as a destination, not a filter.** The business catalog is the default homepage. "For Developers" is a separate *landing destination* (own URL, own hero, own copy register), not a toggle sitting beside "Business" in the same grid. This removes the asymmetric-bucket optics entirely — the dev tools are a *coherent small set on their own page*, not the runt half of a binary.
2. If they must coexist in one catalog, **group by job-to-be-done, not by audience-type** ("운영 자동화 / 고객 응대 / 콘텐츠 / **개발·인프라**") so "개발·인프라" is one peer among 4-5 functional categories, not 1 of 2 — the asymmetry dissolves into a normal taxonomy.
3. Whichever you pick, the `DeskEntry.track` field is fine to keep as the data primitive; the critique is about **how it's rendered**, which the plan explicitly defers ("presentational IA only") without designing. Design it.

---

## Risk 3 — One shared design system genuinely does NOT fit a CDP DevTools UI and a render-config surface — and the plan's own boundary is drawn in the wrong place

**The attack (steelmanned for the owner's family-resemblance goal).** The plan's Axis-4 instinct — shell converges, inner panels stay bespoke — is *correct*. But it draws the shared-DNA boundary by **artifact type** ("shell = rail/topbar/auth/palette/badge; panels = opaque children") rather than by **interaction density**, and that mis-cut will either over-homogenize or fracture, depending on the panel. Specifically:

- A **CDP DevTools workspace** (vendored Chrome DevTools frontend, 4,753 files) is not a "panel" in any meaningful design-system sense. It is a **foreign application with its own complete design language** (Chrome's monospace-dense, split-pane, multi-tab inspector idiom). Wrapping it in a Pretendard/OKLCH DeskCloud shell creates a **violent seam**: a soft, rounded, Korean-typography business chrome containing a hard, gray, Roboto-Mono Chrome inspector. That's not "family resemblance with character" — that's two unrelated organisms stapled together. The shell badge ("Powered by DeskCloud") on top of Chrome DevTools will look like a browser extension chrome-wrapping a Google product, not like a DeskCloud Desk.

- A **render/cache config surface** (RouteOverride editor, Lighthouse, VisualDiff) IS form-and-table UI that the shared system fits *well* — closer to the business Desks than the plan credits. The plan lumps it with the CDP workspace as equally "bespoke / opaque," but it isn't: this one *should* take more shared DNA, not less.

So the plan simultaneously **under-shares** on the render-config surface (treating fitting form UI as untouchable) and **over-promises cohesion** on the CDP workspace (implying a badge + shell makes it family when nothing short of a full reskin would, and a reskin of 4,753 vendored files is correctly out of scope).

**Why the family-resemblance steer makes this sharper, not softer.** The owner wants *shared DNA + per-Desk character*, not flat uniformity. The CDP workspace is the one surface where you **cannot** add shared DNA cheaply (it's a vendored foreign app), AND where forcing uniformity would be destructive. So the honest answer is: **the CDP workspace is not a sibling in the family — it's a tenant the family hosts.** Pretending the shell makes it a sibling is the failure mode; admitting it's a hosted foreign surface is the correct call.

**Fix — re-draw the boundary by surface kind, three tiers not two:**

| Tier | Surfaces | Shared DNA | Character |
|---|---|---|---|
| **Family member** (full DNA) | business Desks, **render-config surface**, session-list/dashboard/Jira-config in remote-devtools | tokens + typography + shell + components + accent | accent hue + domain iconography |
| **Hosted foreign surface** (shell-only, explicit seam) | the vendored CDP DevTools workspace, rrweb replay viewport | DeskCloud shell *around* it; an explicit **"외부 도구 / embedded tool" affordance** at the boundary so the seam reads as intentional, not broken | keeps Chrome's native language entirely; DeskCloud does NOT try to reskin it |
| **Chrome only** | auth gate, ⌘K, marketing header | full DNA | none |

The key addition the plan lacks: **a designed boundary treatment for the foreign surface** (a labeled frame / "embedded debugger" chrome / mode-shift indicator) so a buyer understands "I am now inside a hosted tool" rather than experiencing a jarring unexplained style break. That's the difference between "credible embedded developer tool" and "broken-looking page." Write this boundary contract into `@desk/console-shell` — the plan says to write a contract but only specifies *what the shell owns*, not *how the seam to a foreign surface is rendered*.

---

## Risk 4 — Under-sharing on the family side: the plan gives the family enough *chrome* but not enough *DNA to read as siblings* at the surface where it matters

**The attack (the inverse failure the prompt asked me to flag).** The plan's shared DNA is almost entirely **shell-level** (rail, topbar, palette, badge, header lockup, auth gate) plus **token-level** (OKLCH, Pretendard). That's the *frame*. But two products can share an identical frame and still not read as siblings if the **content inside the frame** uses unrelated component vocabularies — different table styles, different empty states, different button hierarchies, different data-density conventions. The plan extracts `@desk/console-shell` but stops there; it does **not** mandate a shared **component layer** (`@desk/ui`: buttons, tables, forms, badges, empty states, toasts, dialogs) across the family-member tier. Without that, you get "same picture frame, different paintings" — siblings by chrome, strangers by content. The owner's "read as siblings" goal lives in the content, not just the frame.

**Why the plan misses it.** Axis 4.1's shared-DNA list is heavy on chrome and tokens and light on **interactive component primitives**. It mentions "shared card-radius / shadow scale / nav active-idle styles" — that's surface decoration, not a component contract. The dossiers note all three repos are "Radix shadcn-style," which the plan reads as "already aligned" — but shadcn-style means *each repo copied components locally and diverged*; structural similarity is not a shared system.

**Fix — add a `@desk/ui` component layer to the family-member tier, between tokens and shell.** Extract the genuinely-shared interactive primitives (Button, Table/DataGrid, Form fields, Badge/Status, EmptyState, Dialog/`useConfirm`, Toast) as one published package the family-member surfaces *consume*, not copy. This is where "read as siblings" is actually won. Per-Desk character then rides on top (accent, density preset, domain components) — which is exactly the family-resemblance model the owner wants, applied one layer deeper than the plan goes. Crucially: this layer is **family-member tier only**; the hosted CDP surface (Tier 2) is explicitly exempt — it keeps Chrome's components. That exemption is what prevents this fix from becoming the over-homogenization the owner warned against.

---

## Risk 5 — Naming: the plan's "keep their names" call is right, but the *display contract* is under-specified, creating a family-legibility gap

**The attack.** The plan correctly refuses forced "*Desk" rebrands (SEO equity, OSS recognition — good call, matches the family-resemblance-not-uniformity steer). But it then leaves the display-name treatment as a throwaway ("display names like 'Remote DevTools — a DeskCloud service' cost nothing"). The problem: **"spa-seo-gateway" and "remote-devtools" are repo slugs, not product names.** A business-Desk portal listing "TermsDesk," "InquiryDesk," … "spa-seo-gateway" has a **register break** — two entries shout "internal repo" while the rest are products. That's a legibility tell that undercuts the whole family. Keeping the *equity* of the name does not require exposing the *slug*.

**Fix — give the dev tools real product display names that preserve equity without exposing slugs.** e.g. "Prerender Gateway" / "Render Gateway" (keeps the Rendertron/Prerender SEO association) and "Remote DevTools" (already a real name — just stop showing the hyphenated slug). Then the family-legibility rule: **every catalog entry is a Product Name, never a repo slug; the slug stays in code/URLs only.** This is a 1-hour `DESK_CATALOG` change in Phase 0 and it's the cheapest single win for family coherence. The plan's instinct (don't rebrand to *Desk) is right; it just under-delivers on the part that actually costs nothing.

---

## Bottom line (the one structural correction)

The plan optimizes **capability assimilation** (does each candidate gain tenancy/billing/console) brilliantly and **design uniformity-avoidance** well. Its blind spot is **audience architecture**: it treats "are they Desks?" (yes, capability-wise) as settling "do they belong in the buyer-facing portal the same way?" (no, audience-wise). The four fixes that follow from this, in priority order:

1. **Split the public narrative, not just the catalog facet** — DeskCloud markets business ops; the Developer track is a co-resident product line on its own destination (Risk 1, 2). Commit the positioning sentence to PRODUCT.md.
2. **Three design tiers, cut by surface kind** — Family member (full DNA + a shared `@desk/ui` component layer) / Hosted foreign surface (shell-only, *designed* seam) / Chrome. The CDP workspace is a hosted tenant, not a sibling; the render-config surface is a sibling and should take MORE DNA than the plan gives it (Risk 3, 4).
3. **Add `@desk/ui` to win "read as siblings"** at the content layer, family-member tier only, CDP surface exempt (Risk 4).
4. **Product display names, never repo slugs, in the catalog** (Risk 5).

None of these contradict the plan's sound technical core (native hot paths, control-plane re-home, alias-layer tokens, bespoke panels). They correct the *brand/IA layer the dossiers couldn't see* — because parity audits measure whether a thing is built, never whether it belongs.