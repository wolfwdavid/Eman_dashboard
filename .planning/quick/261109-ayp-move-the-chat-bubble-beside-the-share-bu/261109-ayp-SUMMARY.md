---
phase: quick-261109-ayp
plan: 01
subsystem: ui
tags: [css, chat-widget, layout, responsive]
requires: []
provides: [desktop chat bubble placed beside the SHARE (QR) button]
affects: [src/lib/ChatWidget.svelte]
key-files:
  created: []
  modified: [src/lib/ChatWidget.svelte]
decisions:
  - "Desktop breakpoint min-width 769px is the exact complement of QrPanel's max-width 768px"
  - "right: 145px = 24px QR offset + 109px SHARE width + 12px gap"
metrics:
  tasks: 1
  files: 1
  completed: 2026-11-09
---

# Quick 261109-ayp: Move chat bubble beside SHARE button Summary

On desktop (>768px), the chat bubble now sits 12px to the left of the SHARE (QR) button. A `@media (min-width: 769px) { .chat-toggle { right: 145px; } }` rule in ChatWidget.svelte does this. Mobile, the chat panel and QrPanel are unchanged.

## Commit
- 67547ad: fix(chat): place chat bubble beside SHARE button on desktop

## Verification
- The plan's greps pass: `min-width: 769px` (line 129), `right: 145px` (line 130), `bottom: 90px; right: 24px` (line 134). QrPanel.svelte is unmodified.
- `pnpm build` exits 0 and prints "Wrote site to build / done". The built CSS `build/_app/immutable/assets/0.*.css` contains `right:145px`.
- The build did not change any tracked generated files.

## Deviations from Plan

**1. [Rule 3 - Blocking] Skipped pnpm 11's pre-run dependency check**
- **Issue:** `pnpm build` failed with ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY. node_modules was installed by an older pnpm, so pnpm 11's verify-deps-before-run tried to purge and reinstall it, and it can't do that without a TTY.
- **Fix:** I ran the build with `npm_config_verify_deps_before_run=false` (environment only). I did not touch node_modules and did not edit any config.
- **Follow-up (deferred):** Run `pnpm install` once in a real terminal to bring node_modules up to the pnpm 11 layout.

## Known Edge Case (not fixed, per plan)
When the QR panel is open on desktop, it grows upward from SHARE. Its bottom edge sits at about 70px and the bubble's top at about 80px, so the panel's bottom-left corner comes within about 10px of the bubble. If the open panel is wider than about 120px, it may touch the bubble horizontally. QrPanel was left as-is.

## Known Stubs
None.

## Self-Check: PASSED
- src/lib/ChatWidget.svelte is modified and committed (67547ad, found in git log).
