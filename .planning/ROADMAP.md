# Roadmap: Eman_dashboard

## Milestones

- ✅ **v1.0 Grant Crystarium MVP** — Phases 1-5 (shipped 2026-07-06) — [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 FFXIII Fidelity** — Phases 6-7 (in progress)

## Phases

<details>
<summary>✅ v1.0 Grant Crystarium MVP (Phases 1-5) — SHIPPED 2026-07-06</summary>

- [x] Phase 1: Deploy Skeleton + Toolchain (3/3 plans) — completed 2026-07-04
- [x] Phase 2: Data Pipeline + Custom Tools (4/4 plans) — completed 2026-07-04
- [x] Phase 3: 3D Crystarium Scene (4/4 plans) — completed 2026-07-05
- [x] Phase 4: HUD / Overlay UI + Fallback (5/5 plans) — completed 2026-07-06
- [x] Phase 5: Premium Polish / Animation / Perf (2/2 plans) — completed 2026-07-06

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · Audit: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

</details>

### 🚧 v1.1 FFXIII Fidelity (In Progress)

- [x] **Phase 6: FFXIII Visual Fidelity Overhaul** — The Crystarium reads as the real FFXIII Crystarium: luminous crystal orbs in a nebula void, thin curved light-filaments, tight bloom — all v1.0 data encodings preserved. (VIS-01..05) — completed 2026-07-06
- [x] **Phase 6.1: Mobile Friendly (INSERTED)** ✓ 2026-07-06 — — Responsive HUD re-layout, one-surface-at-a-time mobile UX, touch ergonomics, portrait camera framing + mobile dpr cap. (MOB-01..04)
- [ ] **Phase 7: Immersion & Analytics** — Sound cues, ambient particles, node leveling vocabulary, expanded analytics. (IMM-01..03, ANLY-01)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Deploy Skeleton + Toolchain | v1.0 | 3/3 | Complete | 2026-07-04 |
| 2. Data Pipeline + Custom Tools | v1.0 | 4/4 | Complete | 2026-07-04 |
| 3. 3D Crystarium Scene | v1.0 | 4/4 | Complete | 2026-07-05 |
| 4. HUD / Overlay UI + Fallback | v1.0 | 5/5 | Complete | 2026-07-06 |
| 5. Premium Polish / Animation / Perf | v1.0 | 2/2 | Complete | 2026-07-06 |
| 6. FFXIII Visual Fidelity Overhaul | v1.1 | 1/1 | Complete | 2026-07-06 |
| 6.1 Mobile Friendly (INSERTED) | v1.1 | 1/1 | Complete | 2026-07-06 |
| 7. Immersion & Analytics | v1.1 | 0/2 | Not started | - |

---

*Next milestone: run `/gsd:new-milestone` (candidate: the DID grant-automation agent, plus v2 backlog: sound cues, particles, node leveling, expanded analytics, robust WebGL fallback, real QR target URLs).*

## Backlog

### Phase 999.1: Voice commands for the DID Grant Assistant (BACKLOG)

**Goal:** Hands-free operation of the assistant and dashboard — push-to-talk mic in the chat widget; instant local commands (filter by status/gate/type, open a grant by fuzzy funder name, open TEMPLATES/SHARE, read next deadlines, reset) plus spoken questions routed to the existing POST /chat; Web Speech API first with a server /chat/transcribe fallback reusing did_agent/voice.py; optional spoken replies; keyboard-operable + aria-live, no wake word. Owner (2026-11-09): plan only, do NOT build yet. Full plan (9 tasks, acceptance criteria, risks, 6 owner decisions): Websites/Eman/plans/voice-commands-plan.md (private notes repo).
**Requirements:** TBD (VOICE-01…; also a PROJECT.md scope change — accessibility features are currently excluded)
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)
