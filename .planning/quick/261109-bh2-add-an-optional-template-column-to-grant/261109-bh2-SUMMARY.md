---
phase: quick-261109-bh2
plan: 01
subsystem: data, hud
tags: [grants, csv, ingest, zod, detail-panel]
requires: []
provides:
  - "Optional Template column in data/grants.csv (nullable URL, end-to-end)"
  - "Secondary 'Proposal template ↗' button in the grant detail panel"
affects: [data/grants.csv, ingest build gate, DetailPanel]
tech-stack:
  added: []
  patterns: ["reuse clean() helper for optional columns", "z.url().nullable() for optional links"]
key-files:
  created: []
  modified:
    - data/grants.csv
    - data/__fixtures__/grants.bad.csv
    - tools/ingest-grants.mjs
    - tools/schema.mjs
    - tools/validate.test.mjs
    - src/lib/data/types.ts
    - src/lib/data/grants.generated.json
    - src/lib/hud/DetailPanel.svelte
    - HOW-TO-UPDATE.md
decisions:
  - "Template is a nullable URL: missing column / empty / '--' map to null; a non-empty value that is not a URL fails the build, the same way Link does"
  - "The secondary button uses a ghost style built from existing tokens (--node-hue, --text-lo, --text-hi); no raw hex"
metrics:
  duration: ~5min
  completed: 2026-11-09
  tasks: 3
  files: 9
---

# Quick 261109-bh2: Optional Template column for grants Summary

There is now an optional `Template` CSV column, validated as a nullable URL from ingest through to the type. The Awesome Foundation – Disability Chapter grant's detail panel shows a ghost-style "Proposal template ↗" button that opens its Google Doc in a new tab. Every other grant still shows only "Open funder site ↗".

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | d982f14 | feat(data): add optional Template column for proposal draft links |
| 2 | 871fb79 | feat(hud): show proposal template button in grant detail panel |
| 3 | — | verification only (nothing to commit) |

## Verification

- **TDD RED:** after the 3 new schema cases were added, `test:unit` gave 1 failed / 164 passed. The failure was the non-URL template case, because zod drops unknown keys.
- **GREEN:** vitest **165/165 passed** (12 files), including both ingest integration cases.
- **Generated JSON:** 28 grants, **1 non-null template** (`the-awesome-foundation-disability-chapter` → `https://docs.google.com/document/d/1bLo6ETX5dTVqA0Byw9zpnrxGilltqLBQEhq_1Ta9utE/edit`), **27 null**.
- **Missing column:** I ran the pre-change grants.csv (no Template header) through the new ingest. It PASSED with 28/28 null templates.
- **Bad fixture:** it still fails for its original reason (`row 13 — Hey Helen Grant • link: Invalid URL`). The error is the same before and after the change.
- **svelte-check:** 0 errors, 1 warning. The warning is old and unrelated: `ChatWidget.svelte` `messagesEl` non_reactive_update.
- **Build:** exit 0 (`✓ built in 7.84s` … `Wrote site to "build"` `✔ done`). The template URL is in `build/_app/immutable/chunks/Bysn2LSi.js`. The build left `grants.generated.json` unchanged (deterministic) and the working tree clean.
- **Agent:** `agent/.venv` pytest run from inside `agent/` gave 33 passed. Running it from the repo root fails at collection (`ModuleNotFoundError: did_agent`), which is a path issue that has nothing to do with this change. DictReader ignores the extra column.
- Both CSVs still have 29 lines, LF endings and a trailing newline.

## Deviations from Plan

- **pnpm invocation:** the constraint said to set `npm_config_verify_deps_before_run=false`, but that env var alone did **not** prevent `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` under pnpm 11.27.0. The CLI flag `pnpm --config.verify-deps-before-run=false <script>` does work. I used it for `test:unit`, `check`, and `build` (the env var was also set for build). The nested `pnpm build:data` / `pnpm build:qr` calls inside `build` ran without errors.
- Prettier is not installed in node_modules (`npx --no-install` refused), so I did not run a format check. The files were hand-formatted to match the existing tab style.
- `tools/uat-detail.mjs` is unchanged, as the plan said. It does not assert on the link row.

## Known Stubs

None.

## Self-Check: PASSED

- d982f14 and 871fb79 present in `git log`; all 9 modified files committed; nothing pushed.
