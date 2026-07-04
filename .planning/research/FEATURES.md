# Feature Research

**Domain:** Premium 3D grant/funding pipeline "command center" dashboard (FFXIII Crystarium navigation metaphor), static SvelteKit + Threlte, 28-row build-time CSV dataset
**Researched:** 2026-07-04
**Confidence:** HIGH (every feature grounded in the actual `data/grants.csv`; Crystarium mechanics are a design mapping, MEDIUM on exact visual choices)

---

## Dataset Grounding (the source of truth for every feature below)

All 28 rows of `data/grants.csv` were tabulated. These distributions drive the whole UI:

**Status distribution (the pipeline funnel — 8 distinct values):**

| Status | Count | Example funders |
|--------|-------|-----------------|
| To research | 17 | Ford (x2), Third Wave, Kellogg, Yield Giving, SNF, Milbank, 37 Angels… |
| In progress | 3 | Harry S. Black (BofA), Ben & Jerry's, NYC Office for Prevention of Hate Crimes |
| Recurring | 2 | Awesome Foundation, Matriarch Digital Media |
| Not eligible (yet) | 2 | Just Thrive, TD Bank |
| Active funder | 1 | **NY Community Trust** (sole current funder) |
| Applied | 1 | Brava Thrive Grant |
| Declined | 1 | Hey Helen Grant |
| Not eligible | 1 | Truist Foundation |

**501(c)(3) gate (a real axis — org is 501c3-*pending*):**

| Value | Count | Meaning for UI |
|-------|-------|----------------|
| No | 12 | Open now — pursuable today |
| Yes — or fiscal sponsor | 5 | Gated, but fiscal-sponsor pathway unlocks (NY Community Trust is a possible sponsor) |
| Likely yes | 3 | Probably gated — needs verification |
| Unknown | 8 | Unverified gate |

**Amount shapes (the parser must normalize all of these):**
- Secured/received: `$20,000 (received 2025)` (NY Community Trust) — the ONLY banked dollar
- Range + avg: `$5,000-$20,000 (avg $10,000)`, `Up to $30,000 (avg $20,000)`
- Range: `~$50,000-$200,000`, `$5,000-$35,000 (2-year)`, `$2,000-$6,000`
- Open-ended large: `$100,000+`, `Large`
- Fixed: `$1,000`, `$500 (micro)`, `$10,000`
- Micro/unspecified: `Micro (amount TBD)`
- Non-cash / non-grant: `Equity investment` (37 Angels), `Fellowship support` (Echoing Green), `TBD (includes AI access)` (Brava)
- TBD: ~11 rows

**Deadline shapes (the parser must normalize all of these):**
- Hard date: `2026-06-30 (decision by Oct 31)`, `2026-09-01`, `2027-02-18 (2026 cycle passed)`, `2025-12-30 (passed)`
- Rolling: `Rolling (monthly)`, `Rolling (monthly review)`, `Rolling`
- Annual/relationship: `Annual relationship`, `Annual`
- Window: `Opens ~Oct 31-Nov 30; awards Dec`, `Opens ~Oct 2026`, `Check 2026 cycle (awards Dec-Feb)`
- Recheck/reapply: `Reapply Jan 2026`, `Ongoing (recheck 2026-03-01)`, `2025 cycle (recheck)`
- Invitation only / Open calls: `Invitation only`, `Open calls`
- Empty / TBD: `--`, `TBD`

**Money at a glance:** Secured = **$20,000** (1 funder). Parseable potential pipeline (using avg/mid of each stated range, excluding TBD/equity/fellowship) ≈ **$300K–$400K+** across ~11 funders, with two Ford nodes alone carrying `$50K–$200K` and `$100K+`. This "small secured, large latent potential" shape is the emotional core the dashboard should dramatize.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Any grant-pipeline command center must have these or it fails as a tracker, regardless of the 3D skin.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Pipeline-by-status view** | The org owner's #1 question is "where does each funder stand?" 8 statuses, funnel from To-research→Active | MEDIUM | Group/segment the 28 nodes by the `Status` column. Drives Crystarium tier layout AND a status legend. |
| **Secured vs. potential totals** | "How much do I have vs. could I have?" Secured=$20K (NY Community Trust), potential=parsed pipeline sum | MEDIUM | Requires amount parser (min/max/avg/received/TBD flags). Headline HUD stat. |
| **Upcoming-deadline surfacing + urgency** | Grants are deadline-driven; missing one = missing money. Hard dates: 2026-06-30, 2026-09-01, 2027-02-18; passed: Hey Helen 2025-12-30 | MEDIUM | Parser must yield normalized date + cadence + note. Urgency = glow/pulse intensity by days-to-deadline. Passed deadlines flagged distinctly. |
| **Funder detail record** | Click a funder → see everything. All 9 CSV fields per row | LOW–MEDIUM | Detail panel surfacing Funder, Type, Amount(raw+parsed), Deadline(raw+parsed), 501c3 gate, Fit/Eligibility, Status, Next Action, Link. |
| **External link out** | Every row has a real `Link` (BofA portal, foundation sites). Owner must jump to the application | LOW | `target="_blank" rel="noopener"`. Primary secondary-CTA in detail view. |
| **Next Action as CTA** | Each row's `Next Action` is the literal to-do ("Assemble attachments…", "Prep LOI…", "Reapply in 2026 window") | LOW | Surface `Next Action` as the headline call-to-action in detail view, not buried text. |
| **Filter/segment: by status** | "Show me only In-progress (3)" or "hide Not eligible (3 total)" | MEDIUM | Filter dims/hides Crystarium nodes + recomputes HUD totals. |
| **Filter/segment: by 501(c)(3) gate** | Org is 501c3-*pending* — "what can I pursue TODAY?" = the 12 `No` funders | MEDIUM | Toggle: Open (12) / Gated (Yes+Likely, 8) / Unknown (8). High owner value given pending status. |
| **Filter/segment: by Type** | Mostly `Grant`, but `Grant/Fellowship` (Echoing Green) and `Investment (not grant)` (37 Angels) are outliers | LOW | Small filter; mainly to visually flag 37 Angels as equity (not grant money). |
| **Amount + deadline normalization (ingest)** | Every table stake above depends on parsing the messy strings | HIGH | The custom build tool. Foundational — see dependencies. |
| **Responsive fallback / non-WebGL safety** | Some viewers (funders, board) open on phones/old machines | MEDIUM | At minimum a graceful 2D list fallback if WebGL fails. NOT full a11y (explicitly out of scope) — just "doesn't show a black screen." |

### Differentiators (Competitive Advantage — the reason this project exists)

These make it a **premium game UI**, not a spreadsheet. They are the Core Value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Crystarium sphere grid as primary nav** | The entire 28-funder pipeline is legible from shape/glow before a click | HIGH | See "Crystarium Encoding Model" below. The centerpiece. |
| **Status → node activation level** | A funder's pipeline stage reads as crystal "level" — dormant→fully lit | MEDIUM | To-research=dim L1, In-progress=L2, Applied=L3, Active=fully-activated L4 crystal. Recurring=looping pulse. Declined/Not-eligible=cracked/greyed. |
| **Amount → node scale** | Big funders literally loom larger (two Ford nodes dominate; Giving Joy $500 is a speck) | MEDIUM | Scale from parsed avg/max. Clamp so TBD nodes get a neutral default size. |
| **Deadline proximity → glow/pulse urgency** | Nodes with near deadlines pulse hot; passed deadlines burn out | MEDIUM | Days-to-deadline → emissive intensity + pulse rate. Hey Helen (passed) visibly extinguished. |
| **Unlock/activation animation on advance** | The Crystarium "spend CP, node bursts to life" beat = advancing a funder's status | MEDIUM–HIGH | Static data, so plays as (a) staged reveal on load along the pipeline, and (b) a replay burst when a node is focused. Sells the RPG fantasy. |
| **Connecting paths between nodes** | Crystarium's glowing routes = relationships/progression, not decoration | MEDIUM | Encode as: pipeline-progression spine (To-research→…→Active rings) + thematic links (two Ford nodes linked; NY Community Trust→fiscal-sponsor-gated nodes it can unlock). |
| **Camera: orbit + focus-on-node + overview/detail zoom** | Console-game feel; overview shows the whole grid, focus dollies to a crystal | MEDIUM | Idle slow orbit; click = smooth dolly/lerp to node + open detail; ESC/back = pull to overview. |
| **RPG-styled HUD / legend** | Status colors, secured/potential totals, filter toggles all skinned as an FFXIII stat panel | MEDIUM | Glassmorphic dark panel, glow accents. Doubles as the status legend and the analytics entry point. |
| **Sound cues** | Hover chime, select confirm, activation swell — the FFXIII audio signature | LOW–MEDIUM | Small sample set; must be mute-by-default toggle (autoplay policy + owner may present silently). |
| **Particle / glow / bloom atmosphere** | The "crystal" material — bloom, floating motes, depth fog | MEDIUM | Post-processing (bloom). Watch perf budget on 28 nodes + particles. |
| **Intro animation** | Grid assembles from the center on first load = "booting the command center" | MEDIUM | The staged reveal; also the natural place to play the load-time data bind. Skippable. |
| **Analytics overview panel** | Charts that answer strategy questions, styled premium | MEDIUM–HIGH | See "Analytics Charts" below — 5 concrete charts with real numbers. |
| **QR code panel (2 configurable URLs)** | Board/donor-facing: scan to visit DID site + donation/tracker page | LOW–MEDIUM | Config-driven URLs (not finalized). Custom QR-gen build tool. Placement = dedicated HUD panel or overview corner widget (recommend a "beacon" node/panel, see below). |
| **Fiscal-sponsor pathway highlight** | NY Community Trust is a *possible fiscal sponsor* — it can "unlock" the 5 `Yes—or fiscal sponsor` gated funders | MEDIUM | A signature path/beam from the Active core to gated nodes. Turns a data footnote into a visual strategy story. Pure differentiator. |

### Anti-Features (Deliberately NOT Built)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **In-app CRUD editing of grants** | "Let me update status/amounts in the UI" | Requires backend/auth/state; PROJECT explicitly scopes data as build-time CSV ingest | Edit `data/grants.csv`, rebuild. Document the edit→rebuild loop. |
| **Auth / login / user accounts** | "Only Eman should see it" | Static GH Pages site, no server; adds huge surface | Data is public-safe (sanitized). No credentials ever committed. Obscure URL if needed. |
| **Backend / database / real-time sync** | "Live pipeline updates" | Contradicts static-adapter GH Pages constraint | Baked at build time; 28 rows change rarely. |
| **Real-time collaboration / comments** | "Board can annotate" | Needs server + auth + presence infra for a single-owner tool | Out of scope; share the URL, discuss offline. |
| **Full WCAG accessibility retrofit** | Normally table stakes; DID is an a11y org | Explicitly waived for THIS build to maximize 3D investment; served by sibling `diversityincludesdisability_*` projects | Provide graceful non-WebGL fallback only; add prominent link to the accessible sibling site. |
| **Multiple theme variants / light mode** | "Give options" | PROJECT specifies single premium dark 3D version | One opinionated dark premium look. |
| **Generic charting library dashboard** | "Just use a BI tool" | Defeats the entire Crystarium differentiator; commoditizes the product | Custom Threlte grid IS the product; charts are a secondary panel. |
| **Node drag/rearrange / manual layout** | "Let me organize the grid" | Layout is data-derived (status/amount/deadline); manual placement breaks the encoding | Layout is deterministic from CSV. Filters, not reorder. |
| **Runtime CSV upload** | "Drop in a new sheet" | Needs client parser + validation UX for a build-time concern | Custom ingest tool at build; validate there. |
| **37 Angels treated as grant money** | It's in the sheet | It's `Equity investment`, not a grant — inflates "potential" falsely | Type filter flags it; exclude from grant-money totals; distinct node material. |

---

## Crystarium Encoding Model (metaphor → concrete CSV fields)

This is the load-bearing design decision. Recommended mapping, opinionated:

| Crystarium element | Encodes CSV field | Concrete rule |
|--------------------|-------------------|---------------|
| **The center / core** | The org (DID) itself + the Active core | Dead-center "master crystal" = NY Community Trust (the sole **Active funder**, $20K secured) as the lit heart the grid grows from. |
| **Concentric tier / ring (distance from center)** | `Status` as a pipeline funnel | Ring 0 = Active (1). Ring 1 = Applied (1). Ring 2 = In progress (3). Ring 3 = To research (17, the outer frontier). Outermost/detached = Recurring (2) as an orbiting satellite pair; Declined + Not eligible (3) as a dim "cracked" outer arc. Distance from center = distance from secured money. |
| **Angular sector within a ring** | `501(c)(3) Required` (or `Type`) | Cluster each ring's nodes by gate: an "Open now" arc (the 12 `No`) vs a "Gated" arc (`Yes`/`Likely`) vs "Unknown" arc. Lets the owner see, per stage, what's pursuable today. |
| **Node scale (size)** | `Amount` (parsed avg/max) | Ford nodes loom; Giving Joy ($500) is a speck; TBD → neutral default. |
| **Node emissive color / hue** | `Status` | One hue per status (Active=gold, In-progress=cyan, Applied=violet, To-research=dim blue, Recurring=green loop, Declined/Not-eligible=grey/red-cracked). This is the legend. |
| **Node glow intensity + pulse rate** | `Deadline` proximity | Near hard date → bright fast pulse; far/rolling → steady dim; passed (Hey Helen) → burnt-out flicker; Invitation-only/Open-calls → slow "locked" shimmer. |
| **Node "level" / facet count** | `Status` progression | Facets light up as status advances To-research(1)→In-progress(2)→Applied(3)→Active(4, fully crystallized). |
| **Locked / dormant / cracked state** | `Status` = Not eligible / Declined | Greyed, un-selectable-feeling (still clickable for detail), visually "can't activate yet." TD Bank / Just Thrive (`Not eligible (yet)`) shown as *lockable-later* (gate icon) vs Truist (`Not eligible`) fully dark. |
| **Connecting paths (glowing routes)** | Pipeline spine + relationships | (a) Radial spine linking rings = the advancement route a funder travels. (b) Family links: the two **Ford Foundation** nodes joined; the two BofA-related nodes (Harry S. Black + BofA Charitable). (c) **Fiscal-sponsor beam**: from NY Community Trust core to the 5 `Yes—or fiscal sponsor` nodes it could unlock. |
| **Unlock/activation animation** | A status advance (To-research→…→Active) | Static data → plays as staged reveal on intro (rings light center-out), and a replay burst when a node is focused. Represents "this funder moved forward." |
| **Selection / hover / focus states** | Interaction | Hover = node lifts + chime + tooltip (Funder + Amount + days-to-deadline). Select = camera dolly + detail panel + activation burst. Focus dims siblings (depth-of-field). |
| **Camera behavior** | Navigation | Idle slow auto-orbit (overview). Click → smooth dolly-to-node (detail zoom). Back/ESC → pull to overview. Optional "top-down map" toggle for the analyst view. |

**Why status-as-rings beats type-as-branches:** the owner's core mental model is the funnel (research → active → money). Rings make "how far from cash" spatially literal and make the lonely gold center (1 Active) vs. crowded outer frontier (17 To-research) an instant, honest story about the pipeline's real state.

---

## Detail View — field-by-field presentation

Triggered on node select. Surface all 9 columns, but *shaped*:

| CSV field | Presentation |
|-----------|--------------|
| `Funder / Program` | Panel title. |
| `Type` | Small tag/badge (flag `Investment (not grant)` and `Grant/Fellowship` distinctly). |
| `Amount` | Show **parsed** primary figure large (e.g. "avg $10,000" / "$50K–$200K" / "Secured $20,000" / "TBD"), raw string as subtext. Secured vs potential color-coded. |
| `Deadline` | Parsed as a **countdown / cadence chip** ("in 361 days", "Rolling · monthly", "Invitation only", "Passed", "Opens ~Oct 2026"), raw string as subtext. |
| `501(c)(3) Required` | Gate badge: Open / Gated (fiscal-sponsor note) / Likely / Unknown. For gated-with-sponsor, show the NY Community Trust pathway hint. |
| `Fit / Eligibility` | Body prose — the "why this funder" narrative. |
| `Status` | Status pill matching node hue + the "level" indicator. |
| `Next Action` | **Primary CTA banner** — the literal to-do, visually the loudest thing. |
| `Link` | Secondary CTA button "Open funder site ↗" (`_blank`, `noopener`). |

---

## Analytics Charts (concrete, with real numbers)

Secondary "strategy" panel, RPG-skinned. Five charts, each mapped to real data:

| Chart | Type | Real numbers |
|-------|------|--------------|
| **Status distribution** | Donut / radial bar | To research 17 · In progress 3 · Recurring 2 · Not eligible (yet) 2 · Active 1 · Applied 1 · Declined 1 · Not eligible 1. Instantly shows a top-of-funnel-heavy pipeline. |
| **Secured vs. potential** | Two-bar / gauge | Secured **$20,000** (1 funder) vs. potential **~$300K–$400K+** (parsed pipeline). The dramatic gap = the headline. |
| **501(c)(3) gate split** | Stacked bar / segmented | Open (No) 12 · Gated (Yes) 5 · Likely 3 · Unknown 8. Answers "what can I pursue while 501c3-pending?" |
| **Deadline timeline** | Horizontal timeline / mini-gantt | Plot hard dates: Harry S. Black 2026-06-30, Ford JustFilms 2026-09-01, Ben & Jerry's 2027-02-18; window band Oct–Dec 2026 (NYC Office, NYC Commission, Ford NYC); "Rolling" lane (Awesome, Matriarch, Kellogg, SNF, 37 Angels); "Passed" marker (Hey Helen 2025-12-30). |
| **Amount distribution** | Histogram / bubble | Buckets: micro (<$1K: Giving Joy $500) · small ($1K–$10K: Awesome, Hey Helen, NYC x2) · mid ($10K–$50K: Harry S. Black, Ben & Jerry's, Third Wave) · large ($50K+: Ford x2) · TBD/non-cash (~13). Shows most volume is unquantified — a research prompt. |

---

## QR Code Panel

- **Two configurable URLs** (not finalized) — must be config-driven (`config/qr.json` or similar) so URLs drop in without code changes.
- **Custom QR-gen build tool** (user wants purpose-built tooling) — generates SVG/PNG at build time from config.
- **Placement recommendation:** a dedicated **HUD panel** reachable from the overview (a corner "beacon" widget), OR a special non-funder **"broadcast" node** parked outside the grid rings styled as a transmitter crystal. Prefer the HUD panel for clarity; the beacon-node is the higher-flair option if a game-diegetic feel is wanted. Two side-by-side QR tiles with labels ("Visit DID", "Support / Tracker").
- Keep it out of the funder-node encoding entirely — it's a viewer/donor bridge, not pipeline data.

---

## Feature Dependencies

```
[CSV Ingest + Normalizer tool]   <-- FOUNDATION, everything binds to this
    ├──requires──> amount parser (min/max/avg/received/TBD/equity flags)
    ├──requires──> deadline parser (date + cadence + window + passed flags)
    └──requires──> status normalizer (8 canonical statuses)
        │
        ├──enables──> [Crystarium layout engine] (ring=status, angle=gate, scale=amount)
        │                  └──enables──> [Node materials/states] (color, glow, level, locked)
        │                       └──enables──> [Paths + fiscal-sponsor beam]
        │                            └──enables──> [Unlock/activation + intro animation]
        │
        ├──enables──> [Detail view] (needs parsed fields + selection state)
        ├──enables──> [Filters] (status / 501c3 / type)  ──recompute──> [HUD totals]
        └──enables──> [Analytics charts] (aggregations)

[QR-gen build tool] ── independent ──> [QR panel]   (config-driven URLs)

[Camera controller] ──enhances──> [Crystarium] (orbit/focus/zoom)
[Sound + particles/bloom] ──enhances──> [Crystarium]  (pure polish, last)

[Non-WebGL 2D fallback] ──conflicts-with──> nothing, but must read the SAME normalized JSON
```

### Dependency Notes

- **Ingest tool is the gate for everything.** No node can be sized, colored, or pulsed until Amount/Deadline/Status are normalized. Build it first, ship a validated `grants.json` + a schema.
- **Layout engine before materials before animation.** Positions must be deterministic before you can light facets by level or draw progression paths.
- **QR tool is fully parallel** — no dependency on grant data; can be built any time.
- **Filters must recompute HUD totals** — secured/potential and counts update live when segmenting.
- **Fallback reads the same JSON** — the ingest output must serve both the 3D grid and a plain list.

---

## MVP Definition

### Launch With (v1)

- [ ] **CSV ingest + normalizer tool** — foundation; produces typed `grants.json` (amount/deadline/status parsed). Without this nothing binds.
- [ ] **Crystarium grid, data-bound** — 28 nodes, ring=status, scale=amount, hue=status, glow=deadline. The product.
- [ ] **Select → detail view** — all 9 fields shaped, Next Action CTA, external Link.
- [ ] **Camera orbit + focus-on-node** — overview↔detail navigation.
- [ ] **HUD: secured vs potential + status legend** — the at-a-glance headline ($20K vs ~$300K+).
- [ ] **Filters: status + 501(c)(3) gate** — the two highest-value segments (pipeline stage, pursuable-today).
- [ ] **QR panel (2 config URLs)** + QR-gen tool.
- [ ] **Non-WebGL 2D fallback list** — reads same JSON; prevents black-screen failure.
- [ ] **Static build to GH Pages** with correct base path.

### Add After Validation (v1.x)

- [ ] **Analytics charts panel** (5 charts) — once the grid reads well, add the strategy layer.
- [ ] **Unlock/activation + intro animation** — staged reveal; adds the RPG beat.
- [ ] **Connecting paths + fiscal-sponsor beam** — relationship storytelling.
- [ ] **Sound cues** (mute-by-default).
- [ ] **Type filter** + explicit equity/fellowship flagging.
- [ ] **Deadline-urgency pulse tuning** + passed-deadline burnout.

### Future Consideration (v2+)

- [ ] **Particle atmosphere / advanced bloom** — polish once perf is proven on target devices.
- [ ] **Top-down "map" analyst camera mode.**
- [ ] **Per-node "activation replay" cinematic** on focus.
- [ ] **Deep-link URLs** to a specific funder node (shareable).

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| CSV ingest + normalizer | HIGH | HIGH | P1 |
| Crystarium grid (data-bound) | HIGH | HIGH | P1 |
| Detail view + Next Action CTA + Link | HIGH | MEDIUM | P1 |
| Camera orbit + focus | HIGH | MEDIUM | P1 |
| HUD: secured vs potential + legend | HIGH | MEDIUM | P1 |
| Filters: status + 501c3 gate | HIGH | MEDIUM | P1 |
| QR panel + gen tool | MEDIUM | LOW | P1 |
| Non-WebGL fallback | MEDIUM | MEDIUM | P1 |
| Analytics charts (5) | HIGH | MEDIUM–HIGH | P2 |
| Activation/intro animation | MEDIUM | MEDIUM–HIGH | P2 |
| Paths + fiscal-sponsor beam | MEDIUM | MEDIUM | P2 |
| Deadline-urgency pulse | MEDIUM | MEDIUM | P2 |
| Sound cues | LOW–MEDIUM | LOW–MEDIUM | P2 |
| Type filter / equity flagging | LOW | LOW | P2 |
| Particle atmosphere / bloom | MEDIUM | MEDIUM | P3 |
| Deep-link to node | LOW | LOW | P3 |
| Analyst top-down camera | LOW | MEDIUM | P3 |

**Priority key:** P1 = must have for launch · P2 = should have, add after core · P3 = future/polish.

---

## Competitor / Reference Feature Analysis

| Feature | Flat grant trackers (`reference-grant-tracker.html`, Airtable/Notion) | FFXIII Crystarium (game) | Our Approach |
|---------|-----------------------------------------------------------------------|--------------------------|--------------|
| Pipeline visibility | Table rows + status column | Rings/tiers of progression | Status = concentric rings; funnel is spatial |
| Amount emphasis | A text cell | Node size = power invested | Node scale = parsed amount |
| Deadline urgency | A date cell / maybe sort | n/a | Glow/pulse by proximity; burnout when passed |
| Navigation | Scroll/filter a table | Orbit + focus a sphere grid | Orbit + dolly-to-node + detail panel |
| "Advance" feedback | Edit a dropdown | CP-spend activation burst | Activation animation = status advance |
| Money math | Manual sum / formula | n/a | Auto secured-vs-potential HUD + charts |
| Gate handling (501c3) | A column | n/a | Angular sectors + fiscal-sponsor beam |

Our approach = flat-tracker **completeness** (all 9 fields, real totals, filters) wearing the Crystarium's **spatial legibility** (status/amount/deadline readable pre-click). We keep the analytics rigor a spreadsheet has and add the "read the whole pipeline at a glance" that a table never gives.

## Sources

- `data/grants.csv` (28 rows, all statuses/amounts/deadlines/gates tabulated) — HIGH confidence, primary source.
- `.planning/PROJECT.md` (scope, constraints, out-of-scope, key decisions) — HIGH.
- `data/reference-grant-tracker.html` (existing flat tracker, design/data cross-check) — referenced.
- FFXIII Crystarium mechanics (rings/nodes/paths/CP-activation/role-branches) — game-design knowledge, MEDIUM confidence on exact visual mapping (a design proposal, not a spec).

---
*Feature research for: premium 3D grant-pipeline command center (Crystarium metaphor)*
*Researched: 2026-07-04*
