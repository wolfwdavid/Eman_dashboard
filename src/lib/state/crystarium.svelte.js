// Runes singleton — the Phase-3 → Phase-4 bridge (03-RESEARCH §Pattern 2).
//
// Phase 3 (the scene) WRITES selected/hovered/cameraFocus on raycast events.
// Phase 4 (DetailPanel, filters) READS them. Do NOT build the consumers here.
//
// A module-level `$state` (not Svelte context) is deliberate: the Canvas is
// conditionally mounted behind `{#if browser && mounted}`, and a plain module
// import survives mount/unmount cleanly where context would be re-created.

export const ui = $state({
	selected: null, // id of the node under primary focus (one at a time)
	hovered: null, // id of the node under the pointer (secondary)
	filter: 'all', // Phase-4 status filter (reserved; scene does not read it)
	cameraFocus: null // id the camera should frame; mirrors `selected` on select
});

/** Primary focus: select a node and ask the camera to frame it. */
export function select(id) {
	ui.selected = id;
	ui.cameraFocus = id;
}

/** Clear the primary focus and release the camera back to idle orbit. */
export function deselect() {
	ui.selected = null;
	ui.cameraFocus = null;
}

/** Secondary focus: hover (pass null on pointerleave). */
export function hover(id) {
	ui.hovered = id;
}
