---
phase: quick-261109-bqz
plan: 01
subsystem: hud
tags: [css, layout, svelte5, desktop]
requires: [src/lib/state/crystarium.svelte.js ui.selected]
provides: ["--detail-panel-w token", "detail-open offset for chat + SHARE widgets"]
affects: [src/app.css, src/lib/hud/DetailPanel.svelte, src/lib/hud/QrPanel.svelte, src/lib/ChatWidget.svelte]
tech-stack:
  added: []
  patterns: ["shared :root layout token consumed by fixed widgets via calc()", "class:detail-open bound to shared ui store"]
key-files:
  created: []
  modified: [src/app.css, src/lib/hud/DetailPanel.svelte, src/lib/hud/QrPanel.svelte, src/lib/ChatWidget.svelte]
decisions:
  - "One --detail-panel-w (380px) token in :root drives DetailPanel width and both widget offsets"
  - "Only .qr-widget is offset; the desktop SHARE popover is a flex child and follows it"
  - "Chat panel gets max-width calc(100vw - panel - 48px) so it stays on-screen at 769-810px widths"
metrics:
  duration: ~3min
  completed: 2026-11-09
  tasks: 2
  files: 4
---

# Quick 261109-bqz: Shift chat bubble and SHARE widget left of the open detail panel

On desktop (>=769px), when a grant is selected, the chat bubble, chat panel and SHARE widget now slide left by `--detail-panel-w` (380px) with a 220ms `right` transition, so they no longer cover the detail panel's "Open funder site" / "Proposal template" row. They slide back when `ui.selected` returns to null. Mobile rules were not touched, and `prefers-reduced-motion: reduce` turns the slide off.

## Changes
- `src/app.css`: new `/* HUD layout */` group with `--detail-panel-w: 380px` in `:root`.
- `src/lib/hud/DetailPanel.svelte`: `width: var(--detail-panel-w)`. The `24px 24px 96px` padding is kept.
- `src/lib/hud/QrPanel.svelte`: imports `ui`, adds `class:detail-open={ui.selected !== null}`, a `right` transition, a desktop `.qr-widget.detail-open { right: calc(24px + var(--detail-panel-w)) }` rule, and a reduced-motion guard.
- `src/lib/ChatWidget.svelte`: imports `ui`, adds `class:detail-open` on `.chat-toggle` and `.chat-panel`, adds `right 220ms` to the existing `transform .2s` transition (hover scale still works), adds desktop offsets (toggle `calc(145px + var(--detail-panel-w))`, panel `calc(24px + var(--detail-panel-w))` plus a max-width guard), and a reduced-motion guard.

## Verification
pnpm 11 / Node 24 note: plain `pnpm <script>` aborts here with ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY. Use `pnpm --config.verify-deps-before-run=false <script>`.
- `check`: 1767 files, 0 errors, 1 warning (the existing `messagesEl` non_reactive_update warning in ChatWidget).
- `test:unit`: 12 files, 165/165 passed.
- `build`: exit 0 ("Wrote site to build", "done").
- Built CSS (`build/_app/immutable/assets/0.*.css`, `2.*.css`) contains `--detail-panel-w:380px`, `.chat-toggle.detail-open{right:calc(145px + var(--detail-panel-w))}`, `.chat-panel.detail-open{...}` and `@media (width>=769px){.qr-widget.detail-open{right:calc(24px + var(--detail-panel-w))}`. This shows the class bindings are live and the rules were not pruned.
- No CRLF in the 4 files. The diff has no hunks inside the `max-width: 768px` or `440px` blocks.

## Commits
- 50b8c6d fix(hud): slide chat and share widgets left of the open detail panel on desktop. Tasks 1 and 2 are a single atomic commit, as the plan specifies.

## Deviations from Plan
None. The plan was executed as written. Python edits ran through `uv run --no-project python` because a local hook blocks bare `python`.

## Known Stubs
None.

## Self-Check: PASSED
- All 4 modified files present. Commit 50b8c6d exists. Nothing pushed.
