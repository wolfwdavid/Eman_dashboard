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
- [ ] **Phase 8: Voice Commands for the DID Grant Assistant** — Push-to-talk mic in the chat widget, instant spoken dashboard commands, spoken questions to the chat, server Whisper fallback, optional spoken replies. (VOICE-01..07) — promoted from backlog 999.1 on 2026-11-10

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
| 8. Voice Commands for the DID Grant Assistant | v1.1 | 0/0 | Not started | - |

### Phase 8: Voice Commands for the DID Grant Assistant

**Goal:** Hands-free operation of the assistant and dashboard — push-to-talk mic in the chat widget; instant local commands (filter by status/gate/type, open a grant by fuzzy funder name, open TEMPLATES/SHARE, read next deadlines and secured total, reset) plus spoken questions routed to the existing POST /chat; Web Speech API first with a server /chat/transcribe fallback reusing did_agent/voice.py; optional spoken replies; keyboard-operable + aria-live, no wake word.
**Requirements**: VOICE-01, VOICE-02, VOICE-03, VOICE-04, VOICE-05, VOICE-06, VOICE-07
**Depends on:** Phase 6.1
**Owner decisions (2026-11-10, "full saved plan, recommended choices"):** scope change approved (accessibility for the voice feature only); STT = Web Speech API with server Whisper fallback; full v1 command set; spoken replies included, off by default; /chat stays open with rate limits (no CHAT_API_TOKEN); Telegram unchanged (voice in, text out). Source plan: Websites/Eman/plans/voice-commands-plan.md (private notes repo).
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 8 to break down)

---

*Next milestone: run `/gsd:new-milestone` (candidate: the DID grant-automation agent, plus v2 backlog: sound cues, particles, node leveling, expanded analytics, robust WebGL fallback, real QR target URLs).*
