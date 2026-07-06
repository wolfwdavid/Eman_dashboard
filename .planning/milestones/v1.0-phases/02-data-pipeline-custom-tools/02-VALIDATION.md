---
phase: 2
slug: data-pipeline-custom-tools
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-04
updated: 2026-07-04
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Canonical detail: `02-RESEARCH.md` → "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (unit) — parsers, aggregates, build-gate |
| **Config file** | `vitest.config.ts` (add if not present) |
| **Quick run command** | `pnpm exec vitest run tools/` |
| **Full suite command** | `pnpm exec vitest run && node tools/ingest-grants.mjs && node tools/generate-qr.mjs && pnpm build` |
| **Estimated runtime** | ~8 seconds |

> Note: final plans fold validation into `tools/schema.mjs` + `tools/ingest-grants.mjs` (zod gate) rather than a standalone `validate-grants.mjs`, and colocate tests as `tools/normalize/*.test.mjs`, `tools/aggregates.test.mjs`, `tools/qr.test.mjs`, `tools/validate.test.mjs`. The build gate is wired via explicit `&&` chaining in `package.json` (pnpm does not auto-run `prebuild`).

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run tests/data`
- **After every plan wave:** Run the full suite (parsers + real ingest + validate + QR)
- **Before `/gsd:verify-work`:** Full suite green + `pnpm build` succeeds (prebuild ingest+validate pass)
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01 | ingest | 1 | DATA-01 | unit+run | `node tools/ingest-grants.mjs` emits `src/lib/data/grants.generated.json` with 28 records | ❌ W0 | ⬜ pending |
| 2-02 | amount | 1 | DATA-02 | unit | vitest: every literal amount string → correct `{min,max,avg,isReceived,isTBD,isEquity}`; TBD → nulls not 0 | ❌ W0 | ⬜ pending |
| 2-03 | deadline | 1 | DATA-03 | unit | vitest: every literal deadline string → correct `{date,cadence,note,isPassed}`; no blind `new Date()` | ❌ W0 | ⬜ pending |
| 2-04 | status/501c3 | 1 | DATA-04 | unit | vitest: 8 status strings → enum; 501c3 strings → yes/no/unknown; `countByStatus` sums to 28 | ❌ W0 | ⬜ pending |
| 2-05 | aggregates | 1 | DATA-02/04 | unit | vitest: `securedTotal===20000`; `potentialTotal===296500`; declined/not-eligible/equity/TBD excluded | ❌ W0 | ⬜ pending |
| 2-06 | validate/gate | 2 | DATA-05 | unit+build | vitest: a bad-CSV fixture makes validate exit non-zero; good CSV exits 0; `pnpm build` fails on bad data | ❌ W0 | ⬜ pending |
| 2-07 | QR | 2 | DATA-06 | unit+run | `node tools/generate-qr.mjs` reads `src/lib/config/sites.js` (2 URLs) → inline SVG output; scannable | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` (created in plan 02-01)
- [ ] Colocated test files: `tools/normalize/amount.test.mjs`, `tools/normalize/deadline.test.mjs`, `tools/aggregates.test.mjs`, `tools/qr.test.mjs`, `tools/validate.test.mjs`
- [ ] `data/grants.bad.csv` — a deliberately malformed row (Hey Helen bad URL, still 28 rows) to prove the build gate fires; integration test uses `GRANTS_CSV` env override so it never clobbers the real JSON
- [ ] `papaparse`, `zod` (v4), `qrcode` (+ types) installed as dev/prod deps

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QR codes actually scan to the two URLs | DATA-06 | Requires a phone camera; URLs are placeholders until user supplies real ones | Render the generated SVGs, scan with a phone — confirms encoding (target URLs are placeholders, swapped later) |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
