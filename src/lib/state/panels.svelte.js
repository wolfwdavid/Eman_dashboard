// Shared open/closed state for the TEMPLATES and SHARE HUD panels.
//
// Kept separate from crystarium.svelte.js on purpose: that module is the Phase-3
// scene bridge and must not grow unrelated state. The voice assistant (ChatWidget)
// is mounted in +layout.svelte, outside both panels, so panel state cannot be a
// component-local `let open`; a module-level rune store lets any code open and
// close the panels while the on-screen toggles keep working unchanged.

/** @type {{ templates: boolean, share: boolean }} */
export const panels = $state({ templates: false, share: false });

/**
 * Open one panel. Any name other than 'templates' or 'share' is ignored.
 * @param {'templates'|'share'} name
 */
export function openPanel(name) {
	if (name === 'templates' || name === 'share') panels[name] = true;
}

/** Close both panels. */
export function closePanels() {
	panels.templates = false;
	panels.share = false;
}
