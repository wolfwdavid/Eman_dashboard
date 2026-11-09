---
phase: quick-261109-c9g
plan: 01
subsystem: hud
tags: [hud, templates, svelte5, data-helper]
requires: []
provides:
  - grantsWithTemplates(list) pure helper (exported from $lib/data)
  - TemplatesPanel HUD widget (top-left, under the title card)
affects:
  - src/routes/+page.svelte (new .top-left fixed stack)
  - src/lib/hud/SceneTitle.svelte (no longer self-positioned)
tech-stack:
  added: []
  patterns: [local $state toggle widget mirroring QrPanel, flex stack instead of height math]
key-files:
  created:
    - src/lib/data/templates.ts
    - src/lib/data/templates.test.ts
    - src/lib/hud/TemplatesPanel.svelte
  modified:
    - src/lib/data/index.ts
    - src/lib/hud/SceneTitle.svelte
    - src/routes/+page.svelte
decisions:
  - "Title card + TEMPLATES widget live in one fixed .top-left flex stack in +page.svelte; SceneTitle is a plain flex child"
  - "The .top-left stack raises z-index 10 -> 40 while the list is open (:has(.templates-root.open)) so the mobile scrim/modal sits above drawer (20) and DetailPanel/QR (30)"
metrics:
  duration: ~10 min
  completed: 2026-11-09
  tasks: 2
  files: 6
---

# Quick 261109-c9g: TEMPLATES button under the Grant Crystarium title — Summary

The landing view now has a TEMPLATES toggle, with a count badge, directly under the GRANT CRYSTARIUM title card. It opens a glass list of every grant whose Template column in data/grants.csv is filled in. Today that is one grant: The Awesome Foundation / Disability Chapter. Each row has an "Open ↗" link that opens the template in a new tab, and clicking the row's name opens that grant's DetailPanel.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | 4afd3cf | feat(data): add grantsWithTemplates helper for proposal template list |
| 2 | e9018d7 | feat(hud): add TEMPLATES list under the Grant Crystarium title |

Task 1 was test-first: templates.test.ts failed first (module missing), then passed after templates.ts was added. RED and GREEN went into one commit per the one-commit-per-task constraint.

## Verification

- svelte-check: 0 errors, 1 warning (the existing `messagesEl` warning in ChatWidget.svelte; no new warnings)
- vitest: 13 files, 171/171 passed (165 existing + 6 new)
- `BASE_PATH=/Eman_dashboard` build: exit 0; `node tools/verify-build.mjs`: all 6 checks PASS, "verify-build: PASSED"
- build/index.html prerenders "GRANT CRYSTARIUM" and the TEMPLATES toggle with badge `1`; `templates-root` is present in the built CSS and JS
- No raw hex in TemplatesPanel.svelte; all 3 edited/created Svelte files are LF (0 CR)
- The build did NOT rewrite grants.generated.json or qr.generated.js (git status was clean apart from the intended files)

## Environment notes

- pnpm 11 / Node 24: plain `pnpm <script>` aborts with ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY. Used `pnpm --config.verify-deps-before-run=false <script>` for check, test:unit and build.
- A local hook blocks bare `python`. Scripted edits were done with a node script in the session scratchpad.
- NEW gotcha: in Git Bash, `BASE_PATH=/Eman_dashboard` gets rewritten by MSYS path conversion into a Windows path, and the build fails ("config.kit.paths.base ... must be root-relative"). Prefix it with `MSYS_NO_PATHCONV=1`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mobile scrim/modal would render under other HUD layers**
- **Found during:** Task 2
- **Issue:** `.top-left` (z-index 10, position fixed) creates a stacking context, so the panel's z-39 scrim and z-40 modal could only stack within z-10. The drawer (20), DetailPanel and QR widget (30) would have painted over the modal.
- **Fix:** `.top-left:has(:global(.templates-root.open)) { z-index: 40; }` in +page.svelte.
- **Files:** src/routes/+page.svelte
- **Commit:** e9018d7

**2. [Rule 1 - Bug] Badge aria-label read "1 templates"**
- **Fix:** The label is now pluralized (`1 template` / `N templates`).
- **Files:** src/lib/hud/TemplatesPanel.svelte
- **Commit:** e9018d7

**3. [Rule 3 - Blocking] MSYS path conversion broke the BASE_PATH build**
- **Fix:** Ran the build with `MSYS_NO_PATHCONV=1` (environment only, no code change).

## Known Stubs

None. The empty-state copy ("No templates yet...") is intentional and only shows when no grant has a template.

## Not done

- No visual check in a browser (the plan marked it optional).

## Self-Check: PASSED

- FOUND: src/lib/data/templates.ts, src/lib/data/templates.test.ts, src/lib/hud/TemplatesPanel.svelte
- FOUND: commits 4afd3cf, e9018d7
