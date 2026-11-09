---
phase: quick-261109-bqz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app.css
  - src/lib/hud/DetailPanel.svelte
  - src/lib/hud/QrPanel.svelte
  - src/lib/ChatWidget.svelte
autonomous: true
requirements: [QUICK-261109-bqz]

must_haves:
  truths:
    - "On desktop (>=769px) with a grant selected, the chat bubble and SHARE button sit just LEFT of the 380px detail panel and no longer cover its last row (Open funder site / Proposal template)"
    - "On desktop with a grant selected, the open chat panel and the open SHARE popover also sit left of the detail panel"
    - "When the detail panel closes (ui.selected === null) both widgets slide back to their original bottom-right positions"
    - "Mobile (<=768px) layout of chat bubble, SHARE widget and detail bottom-sheet is unchanged"
    - "With prefers-reduced-motion: reduce the shift happens instantly (no right transition)"
  artifacts:
    - path: "src/app.css"
      provides: "Shared detail-panel width token"
      contains: "--detail-panel-w: 380px"
    - path: "src/lib/hud/DetailPanel.svelte"
      provides: "Panel width driven by the token; 96px bottom padding kept"
      contains: "width: var(--detail-panel-w)"
    - path: "src/lib/hud/QrPanel.svelte"
      provides: "detail-open class + desktop right offset"
      contains: "class:detail-open={ui.selected !== null}"
    - path: "src/lib/ChatWidget.svelte"
      provides: "detail-open class on toggle + panel + desktop right offsets"
      contains: "calc(145px + var(--detail-panel-w))"
  key_links:
    - from: "src/lib/hud/QrPanel.svelte"
      to: "src/lib/state/crystarium.svelte.js"
      via: "import { ui } and class:detail-open"
      pattern: "import \\{ ui \\} from '\\$lib/state/crystarium\\.svelte\\.js'"
    - from: "src/lib/ChatWidget.svelte"
      to: "src/lib/state/crystarium.svelte.js"
      via: "import { ui } and class:detail-open on .chat-toggle and .chat-panel"
      pattern: "import \\{ ui \\} from '\\$lib/state/crystarium\\.svelte\\.js'"
    - from: "src/lib/hud/QrPanel.svelte + src/lib/ChatWidget.svelte"
      to: "src/app.css :root"
      via: "var(--detail-panel-w) in calc()"
      pattern: "var\\(--detail-panel-w\\)"
---

<objective>
On desktop, when a grant's detail panel is open, shift the fixed chat bubble (and its open chat panel) and the SHARE widget (and its popover) left by the panel's width so they no longer overlap the panel's bottom action row. Return them when the panel closes. Mobile untouched.

Purpose: Verified live on "The Awesome Foundation" grant — the chat bubble covers the Proposal template button. The 96px padding from f0ab9e3 only helps once the panel scrolls.
Output: one shared CSS token + three component edits, verified by svelte-check, vitest and a production build.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@src/lib/state/crystarium.svelte.js
@src/lib/hud/DetailPanel.svelte
@src/lib/hud/QrPanel.svelte
@src/lib/ChatWidget.svelte
@src/app.css

All commands run from the project root:
`C:/Users/Mkaru/Documents/Hello_World/hugginface_profile/Websites/Eman/Eman_dashboard` (shell cwd resets between calls — `cd` in every command or use absolute paths).

<interfaces>
From src/lib/state/crystarium.svelte.js (Svelte 5 runes module, plain import works anywhere incl. +layout.svelte):
```js
export const ui = $state({ selected: null, /* filter, hovered, cameraFocus ... */ });
// selectGrant(id) sets ui.selected = id; closing sets ui.selected = null
```

Current relevant CSS (verified by reading the files):

src/lib/hud/DetailPanel.svelte (line ~154):
```css
.panel { position: fixed; top: 0; right: 0; z-index: 30; ... width: 380px; max-width: 100vw;
         height: 100vh; padding: 24px 24px 96px; /* keep this */ ... }
@media (max-width: 768px) { .panel { ... width: 100vw; ... } }   /* bottom sheet — leave alone */
```

src/lib/hud/QrPanel.svelte (`<script lang="ts">`, imports scale/cubicOut/qrCodes; local `let open = $state(false)`):
```svelte
<div class="qr-widget" class:open> {#if open} <button class="scrim"> <div class="panel"> ... {/if} <button class="toggle"> </div>
```
```css
.qr-widget { position: fixed; right: 24px; bottom: 24px; z-index: 30; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
.panel { transform-origin: bottom right; ... }   /* NOT fixed on desktop — it is a flex child of .qr-widget, so it moves with it */
@media (max-width: 768px) { .qr-widget { right: 12px; bottom: 88px; } .panel { position: fixed; top: 50%; left: 50%; ... } }
```
=> Only `.qr-widget` needs to shift; the desktop popover follows automatically. Mobile .panel is a centered modal (unaffected).

src/lib/ChatWidget.svelte (`<script>` plain JS, no imports currently; first line `let open = $state(false);`):
```svelte
<button class="chat-toggle" onclick={() => open = !open} title="Chat with DID assistant">&#128172;</button>
{#if open}
<div class="chat-panel" role="dialog" aria-label="Chat with DID Grant Assistant"> ... </div>
{/if}
```
```css
.chat-toggle { position: fixed; bottom: 24px; right: 24px; ... z-index: 10000; ... transition: transform .2s; }
.chat-toggle:hover { transform: scale(1.08); }
@media (min-width: 769px) { .chat-toggle { right: 145px; } }
.chat-panel { position: fixed; bottom: 90px; right: 24px; width: 380px; max-height: 520px; ... z-index: 10000; }
@media (max-width: 440px) { .chat-panel { width: calc(100vw - 20px); right: 10px; bottom: 80px; } }
```
NOTE: `.chat-toggle` already has `transition: transform .2s` — the new `right` transition must be MERGED into that declaration, not replace it (otherwise the hover scale animation is lost).

src/app.css: `:root {` block at line ~22 starting with `/* Surface tiers */ --bg: ...`.
No test file references 380px / these components' CSS (grep confirmed), so the token swap breaks no test.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add --detail-panel-w token and shift chat + SHARE widgets while a grant is open (desktop only)</name>
  <files>src/app.css, src/lib/hud/DetailPanel.svelte, src/lib/hud/QrPanel.svelte, src/lib/ChatWidget.svelte</files>
  <action>
1. **src/app.css** — inside the `:root {` block at ~line 22 (the 03-UI-SPEC semantic-token block), add near the top (e.g. after the surface-tier tokens) a small commented group:
   `/* HUD layout */` and `--detail-panel-w: 380px; /* DetailPanel width; ChatWidget + QrPanel offset by this on desktop while a grant is open */`.

2. **src/lib/hud/DetailPanel.svelte** — in `.panel` replace `width: 380px;` with `width: var(--detail-panel-w);`. Keep `max-width: 100vw;` and KEEP `padding: 24px 24px 96px;` and its comment unchanged (spec item 4). Do not touch the `@media (max-width: 768px)` block.

3. **src/lib/hud/QrPanel.svelte**
   - In the `<script lang="ts">` add `import { ui } from '$lib/state/crystarium.svelte.js';` alongside the other imports. Optionally add one line to the header comment noting the widget slides left of the detail panel on desktop while a grant is open.
   - Markup: `<div class="qr-widget" class:open class:detail-open={ui.selected !== null}>`.
   - CSS: add `transition: right 220ms cubic-bezier(.2, .8, .2, 1);` to `.qr-widget`.
   - Add (place before the existing mobile `@media (max-width: 768px)` block):
     ```css
     /* Desktop: while the detail panel is open (fixed 380px column on the right),
        slide the widget just outside it so it never covers the panel's action row. */
     @media (min-width: 769px) {
       .qr-widget.detail-open { right: calc(24px + var(--detail-panel-w)); }
     }
     @media (prefers-reduced-motion: reduce) {
       .qr-widget { transition: none; }
     }
     ```
   - Do NOT add any offset to `.panel` — on desktop it is a non-fixed flex child of `.qr-widget` (align-items: flex-end) and moves with it; on mobile it is a centered fixed modal (out of scope). Confirm this by reading the component before finalizing.

4. **src/lib/ChatWidget.svelte**
   - First line of `<script>` (plain JS): `import { ui } from '$lib/state/crystarium.svelte.js';`
   - Markup: `<button class="chat-toggle" class:detail-open={ui.selected !== null} ...>` and `<div class="chat-panel" class:detail-open={ui.selected !== null} role="dialog" ...>`.
   - CSS: change `.chat-toggle`'s `transition: transform .2s;` to `transition: transform .2s, right 220ms cubic-bezier(.2, .8, .2, 1);` (MERGE — preserves the hover scale). Add `transition: right 220ms cubic-bezier(.2, .8, .2, 1);` to `.chat-panel`.
   - Extend the existing desktop block (keep its comment; append a line explaining the detail-open offset):
     ```css
     @media (min-width: 769px) {
       .chat-toggle { right: 145px; }
       .chat-toggle.detail-open { right: calc(145px + var(--detail-panel-w)); }
       .chat-panel.detail-open { right: calc(24px + var(--detail-panel-w)); max-width: calc(100vw - var(--detail-panel-w) - 48px); }
     }
     @media (prefers-reduced-motion: reduce) {
       .chat-toggle, .chat-panel { transition: none; }
     }
     ```
     The `max-width` guard keeps the 380px chat panel on-screen at narrow desktop widths (769–~810px) where 380 + 404 would exceed the viewport (Claude's discretion; harmless on wide screens). Leave the `@media (max-width: 440px)` rule untouched.
   - ChatWidget is mounted from src/routes/+layout.svelte (outside +page.svelte); the store is a module-level `$state` so the import works there — svelte-check in Task 2 confirms.

5. Keep LF line endings in all four files (use the Edit tool; do not round-trip through tools that write CRLF). Do not change mobile rules anywhere.
  </action>
  <verify>
    <automated>cd C:/Users/Mkaru/Documents/Hello_World/hugginface_profile/Websites/Eman/Eman_dashboard && grep -c "detail-panel-w: 380px" src/app.css && grep -c "width: var(--detail-panel-w)" src/lib/hud/DetailPanel.svelte && grep -c "padding: 24px 24px 96px" src/lib/hud/DetailPanel.svelte && grep -c "class:detail-open={ui.selected !== null}" src/lib/hud/QrPanel.svelte src/lib/ChatWidget.svelte && grep -c "transform .2s, right 220ms" src/lib/ChatWidget.svelte && ! grep -lU $'\r' src/app.css src/lib/hud/DetailPanel.svelte src/lib/hud/QrPanel.svelte src/lib/ChatWidget.svelte</automated>
  </verify>
  <done>Token defined once in :root and consumed by DetailPanel, QrPanel, ChatWidget; QrPanel has 1 and ChatWidget has 2 `class:detail-open` bindings; desktop-only offset rules + reduced-motion guards present; hover-scale transition preserved; 96px padding kept; no CRLF introduced.</done>
</task>

<task type="auto">
  <name>Task 2: Verify (check / unit / build) and commit atomically</name>
  <files>src/app.css, src/lib/hud/DetailPanel.svelte, src/lib/hud/QrPanel.svelte, src/lib/ChatWidget.svelte</files>
  <action>
Run from the project root, in order (plain `pnpm <script>` aborts with ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY in a non-TTY shell; `--config.verify-deps-before-run=false` is the working workaround — record this in the SUMMARY):

1. `pnpm --config.verify-deps-before-run=false check` → must report 0 errors. Exactly 1 pre-existing warning about `messagesEl` in ChatWidget is acceptable; any NEW warning (e.g. about `ui` or the class directives) must be fixed.
2. `pnpm --config.verify-deps-before-run=false test:unit` → all green (165 tests currently; count must not drop).
3. `pnpm --config.verify-deps-before-run=false build` → exit 0. Then confirm the token and the shifted rules shipped: `grep -rl -- "--detail-panel-w" build/ .svelte-kit/output/client 2>/dev/null` returns at least one CSS file (the build output dir is `build/` per adapter-static; fall back to `.svelte-kit/output` if needed). Also grep that output for `detail-open` to confirm the scoped rules were not tree-shaken as unused (they would be if the class binding were missing).
4. If build regenerated tracked artifacts (e.g. grants.json / QR data from `build:data` / `build:qr`), check `git status`; do NOT commit unrelated regenerated files — restore them with `git checkout -- <file>` if they differ only from regeneration.
5. Commit only the four source files in ONE atomic commit (stage explicitly by path), e.g.:
   `git add src/app.css src/lib/hud/DetailPanel.svelte src/lib/hud/QrPanel.svelte src/lib/ChatWidget.svelte && git commit -m "fix(hud): slide chat and share widgets left of the open detail panel on desktop" -m "Adds a --detail-panel-w token shared by DetailPanel, QrPanel and ChatWidget. While a grant is selected on desktop, the chat bubble, chat panel and SHARE widget offset by the panel width so they no longer cover the panel's action buttons; they return when it closes. Mobile layout unchanged; reduced-motion disables the slide."`
   Message describes the change only: NO mention of Claude/AI/assistants, NO Co-Authored-By trailer (project owner's rule overrides default attribution). Do NOT push.
  </action>
  <verify>
    <automated>cd C:/Users/Mkaru/Documents/Hello_World/hugginface_profile/Websites/Eman/Eman_dashboard && pnpm --config.verify-deps-before-run=false check && pnpm --config.verify-deps-before-run=false test:unit && pnpm --config.verify-deps-before-run=false build && grep -rl -- "--detail-panel-w" build/ && ! git log -1 --format=%B | grep -iqE "claude|co-authored-by"</automated>
  </verify>
  <done>svelte-check 0 errors (only the pre-existing messagesEl warning), vitest all green (>=165), build exits 0 with `--detail-panel-w` and `detail-open` present in built CSS; one commit containing exactly the four files, clean message without AI mentions or trailer; nothing pushed.</done>
</task>

</tasks>

<verification>
- grep: token defined in src/app.css and consumed in all three components.
- svelte-check 0 errors; vitest >=165 passing; production build exit 0.
- Built CSS contains `--detail-panel-w` and `.detail-open` rules (proves the class bindings are live, not pruned).
- Mobile rules (`@media (max-width: 768px)` / `(max-width: 440px)`) byte-identical to before (`git diff` shows no changes inside them).
- Manual (optional, owner): `pnpm dev`, open "The Awesome Foundation" on a >=1024px window — chat bubble and SHARE sit left of the panel, Proposal template button fully clickable; close panel — widgets slide back.
</verification>

<success_criteria>
- Desktop + grant selected: no fixed widget overlaps the detail panel's footprint (right 0..380px).
- Panel closed: widgets at original positions (SHARE right 24px, chat bubble right 145px, chat panel right 24px).
- Mobile unchanged; reduced-motion respected.
- One atomic local commit, LF endings, not pushed.
</success_criteria>

<output>
After completion, create `.planning/quick/261109-bqz-shift-the-chat-bubble-and-share-widget-l/261109-bqz-SUMMARY.md` (include the `--config.verify-deps-before-run=false` pnpm workaround note and the check/test/build results).
</output>
