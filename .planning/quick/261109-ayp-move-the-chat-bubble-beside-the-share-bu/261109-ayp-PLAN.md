---
phase: quick-261109-ayp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/ChatWidget.svelte
autonomous: true
requirements: [QUICK-261109-ayp]

must_haves:
  truths:
    - "On desktop (viewport > 768px) the chat bubble sits to the LEFT of the SHARE button with a 12px gap, and the two do not overlap"
    - "On mobile (viewport <= 768px) the chat bubble stays at right 24px / bottom 24px, exactly as before"
    - "The chat panel still opens at bottom 90px / right 24px on every viewport"
    - "pnpm build succeeds"
  artifacts:
    - path: "src/lib/ChatWidget.svelte"
      provides: "Desktop-only media query that moves .chat-toggle beside the SHARE button"
      contains: "@media (min-width: 769px)"
  key_links:
    - from: "src/lib/ChatWidget.svelte (.chat-toggle desktop right offset)"
      to: "src/lib/hud/QrPanel.svelte (.qr-widget right: 24px + .toggle 109px wide)"
      via: "right: 145px = 24 + 109 + 12"
      pattern: "right:\s*145px"
---

<objective>
Stop the chat bubble from overlapping the SHARE (QR) button on desktop. Today both are pinned at
right 24px / bottom 24px. On desktop only, move `.chat-toggle` left so it sits beside SHARE with a
12px gap.

Purpose: both widgets have to be visible and clickable on desktop.
Output: one CSS media-query block added to src/lib/ChatWidget.svelte. Nothing else changes.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@src/lib/ChatWidget.svelte

<interfaces>
Current CSS (src/lib/ChatWidget.svelte, lines 117-139):
```css
.chat-toggle {
	position: fixed; bottom: 24px; right: 24px;
	width: 56px; height: 56px; border-radius: 50%;
	... z-index: 10000; ...
}
.chat-panel { position: fixed; bottom: 90px; right: 24px; width: 380px; ... }
@media (max-width: 440px) { .chat-panel { width: calc(100vw - 20px); right: 10px; bottom: 80px; } }
```

src/lib/hud/QrPanel.svelte (reference only, DO NOT EDIT):
- `.qr-widget { position: fixed; right: 24px; bottom: 24px; z-index: 30; }`
- `@media (max-width: 768px) { .qr-widget { right: 12px; bottom: 88px; } }`. On mobile it already
  sits above the chat bubble, so mobile has no collision.
- Measured on the live site at 1646x860: the SHARE `.toggle` is 109px wide x 34px tall.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add a desktop-only offset to .chat-toggle and verify the build</name>
  <files>src/lib/ChatWidget.svelte</files>
  <action>
In the `<style>` block of src/lib/ChatWidget.svelte, put this block directly after the `.chat-toggle:hover` rule (line 125):

```css
/* Desktop: sit beside the SHARE (QR) button instead of on top of it.
   right = 24px (QR widget offset) + 109px (SHARE button width) + 12px gap.
   Mobile (<=768px) keeps right: 24px; the QR widget already moves above the bubble there. */
@media (min-width: 769px) {
	.chat-toggle { right: 145px; }
}
```

Rules:
- Use `min-width: 769px` so this is the exact complement of QrPanel's `max-width: 768px` breakpoint.
- Leave `bottom: 24px` alone. The bubble (56px) and SHARE (34px) both start at the bottom edge, which is fine.
- Do NOT change `.chat-panel`. Its position stays bottom 90px / right 24px.
- Do NOT edit src/lib/hud/QrPanel.svelte.
- Do NOT touch the `max-width: 440px` rule, the mobile layout, or the z-index values.

Then run `pnpm build` from the project root. Use pnpm, not npm. The build also runs build:data and build:qr.

Commit only src/lib/ChatWidget.svelte with a message that describes the change, e.g.
`fix(chat): place chat bubble beside SHARE button on desktop`. The message must not mention Claude,
AI, or assistants. If build:data or build:qr regenerated tracked files without changing their
content, do not stage them. If the content did change, restore them with `git checkout --` before
committing. They are out of scope.

Known edge case to report but not fix: when the QR panel is OPEN on desktop it grows upward from
the SHARE button. Its bottom edge is at about 70px, while the bubble's top is at 80px, so the panel's
bottom-left corner can come within about 10px of the bubble. If the open panel is wider than about
120px it may touch the bubble horizontally. Record this in the SUMMARY. Do not change QrPanel.
  </action>
  <verify>
    <automated>cd C:/Users/Mkaru/Documents/Hello_World/hugginface_profile/Websites/Eman/Eman_dashboard && grep -n "min-width: 769px" src/lib/ChatWidget.svelte && grep -n "right: 145px" src/lib/ChatWidget.svelte && grep -n "bottom: 90px; right: 24px" src/lib/ChatWidget.svelte && git diff --quiet -- src/lib/hud/QrPanel.svelte && pnpm build</automated>
  </verify>
  <done>
- ChatWidget.svelte has the `@media (min-width: 769px) { .chat-toggle { right: 145px; } }` block
- `.chat-panel` and the mobile rules are byte-identical to before
- QrPanel.svelte is unmodified
- `pnpm build` exits 0
- One commit with a message describing the change only, with no AI or assistant mention
  </done>
</task>

</tasks>

<verification>
- Desktop (> 768px): SHARE spans right 24..133px, the chat bubble spans right 145..201px, leaving a 12px gap and no overlap.
- Mobile (<= 768px): the bubble stays at right 24 / bottom 24 and QR stays at right 12 / bottom 88, the same as before.
- `pnpm build` passes.
</verification>

<success_criteria>
The two widgets no longer overlap on desktop, mobile layout is unchanged, the build is green, and the change is committed.
</success_criteria>

<output>
After completion, create `.planning/quick/261109-ayp-move-the-chat-bubble-beside-the-share-bu/261109-ayp-SUMMARY.md`
</output>
