# Requirements: Eman_dashboard

**Defined:** 2026-07-04
**Core Value:** The Crystarium sphere grid makes the entire grant pipeline legible and navigable at a glance — funder status, funding amount, and deadline urgency are all readable from the shape and glow of the grid before a single click.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data & Custom Tools

- [ ] **DATA-01**: A custom Node build tool ingests `data/grants.csv` and emits a typed JSON dataset consumed by the app (no runtime fetch)
- [ ] **DATA-02**: An amount normalizer parses messy amount strings (e.g. "$5,000-$20,000 (avg $10,000)", "$20,000 (received 2025)", "TBD", "$100,000+") into a typed struct (min/max/avg/received/tbd/equity), never a bare number
- [ ] **DATA-03**: A deadline normalizer parses messy deadline strings (e.g. "2026-06-30 (decision by Oct 31)", "Rolling (monthly)", "Invitation only", "2025-12-30 (passed)") into a typed struct (date/cadence/note/passed)
- [ ] **DATA-04**: Status is normalized to a fixed enum and the 501(c)(3) column to a tri-state (yes / no / unknown)
- [ ] **DATA-05**: A data validator (schema/enum/URL/date) fails the build when a grant row is malformed
- [ ] **DATA-06**: A QR-code generation tool produces codes for two site URLs from a single config module at build time (absolute external URLs)

### Crystarium (3D Navigation)

- [ ] **CRYS-01**: A faithful FFXIII Crystarium sphere grid renders in 3D as the primary navigation surface (Threlte canvas, browser-guarded so WebGL never runs during prerender)
- [ ] **CRYS-02**: Each funder is a crystal node; node positions are computed deterministically from the data via a pure layout module (status-sectored radial layout)
- [ ] **CRYS-03**: Node visual state (activation level / color) encodes the funder's grant status
- [ ] **CRYS-04**: Node scale encodes the funder's funding amount
- [ ] **CRYS-05**: Node glow/pulse encodes deadline urgency (passed/rolling/declined nodes do NOT glow urgent)
- [ ] **CRYS-06**: Connecting paths render between related nodes (progression spine, funder families, and the NY Community Trust fiscal-sponsor beam to 501c3-gated funders)
- [ ] **CRYS-07**: Camera orbits the grid and focuses on a node when selected (overview vs. detail zoom)
- [ ] **CRYS-08**: Hover and selection states are visually distinct, enhanced by bloom/glow postprocessing

### Grant Detail

- [ ] **DETL-01**: Selecting a node opens a detail view showing all of that funder's fields
- [ ] **DETL-02**: Normalized Amount and Deadline are shown human-readable alongside the original raw value
- [ ] **DETL-03**: The Next Action is presented as a call-to-action and the external Link opens the funder site in a new tab

### Pipeline Overview

- [ ] **PIPE-01**: An overview shows totals by status (count of funders per status)
- [ ] **PIPE-02**: An overview shows funding secured vs. potential, excluding declined, not-eligible, and equity (37 Angels) rows from "potential"
- [ ] **PIPE-03**: An overview surfaces upcoming deadlines on a timeline ordered by urgency
- [ ] **PIPE-04**: An overview shows the 501(c)(3)-gated vs. open funder split
- [ ] **PIPE-05**: The user can filter/segment the grid by status, by 501(c)(3) requirement, and by type

### QR Panel

- [ ] **QRUI-01**: A QR panel displays scannable QR codes for the two configured website URLs
- [ ] **QRUI-02**: The two target URLs are swappable via a single config module without touching component code

### Deployment

- [x] **DPLY-01**: The site fully prerenders to static files via `adapter-static`
- [x] **DPLY-02**: The GitHub Pages base path resolves correctly for repo `Eman_dashboard` (all assets/links routed through `base`), with `.nojekyll` and a `404.html` SPA fallback
- [ ] **DPLY-03**: A GitHub Actions workflow builds and publishes the site to GitHub Pages

### Premium Aesthetic

- [ ] **AEST-01**: An intro/activation animation plays on load and on status-advance (GSAP), giving the grid a game-UI feel
- [ ] **AEST-02**: A dark premium glassmorphism HUD/legend styles the overlay as an RPG interface

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Immersion

- **IMM-01**: Sound cues on hover/select/activation
- **IMM-02**: Ambient particle effects beyond bloom
- **IMM-03**: Node "leveling" progression animations across a full status arc

### Analytics

- **ANLY-01**: Expanded LayerChart analytics panel (amount distribution, richer charts) beyond the core PIPE overview

### Resilience

- **RESL-01**: Non-WebGL 2D fallback view of the pipeline for devices without WebGL

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Accessibility layer (WCAG, screen reader, keyboard-first, reduced-motion) | Deliberately waived for this build; full 3D/visual investment is the priority. DID's accessibility-first mission is served by sibling `diversityincludesdisability_*` projects |
| In-app CRUD editing of grant data | Data is build-time ingested from CSV; edits happen in the CSV source |
| Backend / database / auth / real-time | Static site, no server; data baked at build time |
| Multiple theme variants | Single premium 3D version only |
| Runtime CSV upload | Data is a build-time contract, not user-supplied at runtime |
| Treating 37 Angels equity investment as grant funding | It is equity, not a grant — excluded from funding totals |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DPLY-01 | Phase 1 | Complete |
| DPLY-02 | Phase 1 | Complete |
| DPLY-03 | Phase 1 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| DATA-05 | Phase 2 | Pending |
| DATA-06 | Phase 2 | Pending |
| CRYS-01 | Phase 3 | Pending |
| CRYS-02 | Phase 3 | Pending |
| CRYS-03 | Phase 3 | Pending |
| CRYS-04 | Phase 3 | Pending |
| CRYS-05 | Phase 3 | Pending |
| CRYS-06 | Phase 3 | Pending |
| CRYS-07 | Phase 3 | Pending |
| CRYS-08 | Phase 3 | Pending |
| DETL-01 | Phase 4 | Pending |
| DETL-02 | Phase 4 | Pending |
| DETL-03 | Phase 4 | Pending |
| PIPE-01 | Phase 4 | Pending |
| PIPE-02 | Phase 4 | Pending |
| PIPE-03 | Phase 4 | Pending |
| PIPE-04 | Phase 4 | Pending |
| PIPE-05 | Phase 4 | Pending |
| QRUI-01 | Phase 4 | Pending |
| QRUI-02 | Phase 4 | Pending |
| AEST-01 | Phase 5 | Pending |
| AEST-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29 (100%)
- Unmapped: 0

*Note: the earlier "26 total" count was superseded when the requirements were expanded to the current 29 (DATA 6, CRYS 8, DETL 3, PIPE 5, QRUI 2, DPLY 3, AEST 2).*

---
*Requirements defined: 2026-07-04*
*Last updated: 2026-07-04 after roadmap creation (traceability populated)*
