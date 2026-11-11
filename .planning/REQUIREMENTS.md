# Requirements: Eman_dashboard — v1.1 FFXIII Fidelity

**Defined:** 2026-07-06
**Core Value:** The Crystarium must LOOK like the FFXIII Crystarium — a luminous constellation in a deep cosmic void — while every v1.0 data encoding stays intact.

## v1.1 Requirements

### Visual Fidelity (Phase 6)

- [x] **VIS-01**: Deep-space backdrop — indigo-violet cosmic void with soft nebula glow and a fine starfield replaces the flat navy background; the grid reads as a floating constellation
- [x] **VIS-02**: Nodes are luminous crystal orbs/gems — bright emissive core, fresnel rim glow, translucent crystal body, soft halo — replacing the matte low-poly icosahedra; hue=status, scale=amount, pulse=deadline encodings preserved exactly
- [x] **VIS-03**: Paths are thin, gently curved luminous filaments with animated energy flow, replacing the thick straight lines; the fiscal-sponsor beam stays visually distinct (gold→cyan)
- [x] **VIS-04**: Bloom retuned for the new emissives — tight FFXIII-style glow without washout; dpr cap and smooth perf preserved; prerender/base-path invariants untouched
- [x] **VIS-05**: Composition polish — camera framing, subtle depth fog, and node-size ratios tuned so status/amount/urgency remain legible at a glance in the new style

### Mobile Friendly (Phase 6.1 — INSERTED)

- [x] **MOB-01**: On viewports ≤768px the HUD re-lays out cleanly: compact stacked title+readout, legend hidden behind a toggle, slim collapsed drawer, full-width bottom-sheet detail panel, centered QR modal — zero overlapping/ghosting panels, no horizontal scroll
- [x] **MOB-02**: One primary surface at a time on mobile — opening the detail sheet hides/dims the drawer, legend toggle, and SHARE; closing restores them
- [x] **MOB-03**: Touch ergonomics — all interactive chips/buttons ≥44px, native one-finger orbit + pinch zoom work, node tap-picking works (hit-proxy)
- [x] **MOB-04**: Portrait camera framing — aspect-aware default/intro camera so the constellation fits a phone screen; mobile dpr capped ≤1.5 for GPU headroom; all regression gates stay green

### Immersion & Analytics (Phase 7 — deferred to next session)

- [ ] **IMM-01**: Sound cues on hover/select/activation (with a mute toggle)
- [ ] **IMM-02**: Ambient particle drift beyond bloom
- [ ] **IMM-03**: Node "leveling" progression animation vocabulary
- [ ] **ANLY-01**: Expanded analytics panel (amount distribution + richer charts)

### Voice Commands (Phase 8 — promoted from backlog 2026-11-10)

- [ ] **VOICE-01**: A push-to-talk mic button in the chat widget captures speech with the Web Speech API, shows a live transcript and a visible listening state, and stops after 8 s of silence
- [ ] **VOICE-02**: Spoken dashboard commands run instantly without the LLM: filter by status/gate/type, reset filters, open TEMPLATES/SHARE, close, read the next deadlines and the secured total
- [ ] **VOICE-03**: "Open <funder>" selects a grant by fuzzy funder/program name; ambiguous matches offer a short "did you mean" list
- [ ] **VOICE-04**: Speech that is not a command is sent to the existing chat as a question, with the transcript visible before the reply
- [ ] **VOICE-05**: Browsers without the Web Speech API record audio and transcribe it through a new POST /chat/transcribe endpoint that reuses did_agent/voice.py, capped at 1 MB and 10 requests/min per IP, audio MIME types only
- [ ] **VOICE-06**: Bot replies and command confirmations can be read aloud; the toggle is off by default and remembered
- [ ] **VOICE-07**: The voice feature is keyboard-operable (44px target, aria-pressed) and announces transcripts, results and replies through an aria-live region; every voice command keeps its existing mouse/keyboard equivalent

## Out of Scope

| Feature | Reason |
|---------|--------|
| Accessibility layer | Still deliberately waived (v1.0 decision stands) |
| Data/HUD functional changes | v1.0 verified; v1.1 is visual/immersion only |
| New 3D dependencies | Current Threlte/three/postprocessing stack is sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIS-01 | Phase 6 | Complete |
| VIS-02 | Phase 6 | Complete |
| VIS-03 | Phase 6 | Complete |
| VIS-04 | Phase 6 | Complete |
| VIS-05 | Phase 6 | Complete |
| MOB-01 | Phase 6.1 | Complete |
| MOB-02 | Phase 6.1 | Complete |
| MOB-03 | Phase 6.1 | Complete |
| MOB-04 | Phase 6.1 | Complete |
| IMM-01 | Phase 7 | Pending |
| IMM-02 | Phase 7 | Pending |
| IMM-03 | Phase 7 | Pending |
| ANLY-01 | Phase 7 | Pending |
| VOICE-01 | Phase 8 | Pending |
| VOICE-02 | Phase 8 | Pending |
| VOICE-03 | Phase 8 | Pending |
| VOICE-04 | Phase 8 | Pending |
| VOICE-05 | Phase 8 | Pending |
| VOICE-06 | Phase 8 | Pending |
| VOICE-07 | Phase 8 | Pending |

---
*Requirements defined: 2026-07-06 (v1.1)*
