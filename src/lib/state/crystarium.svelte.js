// Runes singleton — the Phase-3 → Phase-4 bridge (03-RESEARCH §Pattern 2).
//
// Phase 3 (the scene) WRITES selected/hovered/cameraFocus on raycast events.
// Phase 4 (DetailPanel, filters) READS them. Do NOT build the consumers here.
//
// A module-level `$state` (not Svelte context) is deliberate: the Canvas is
// conditionally mounted behind `{#if browser && mounted}`, and a plain module
// import survives mount/unmount cleanly where context would be re-created.

/**
 * @typedef {{ status: string, gate: 'all'|'open'|'gated'|'unknown', type: 'all'|'Grant'|'Fellowship'|'Investment' }} FilterState
 */

/**
 * @typedef {Object} CrystariumUI
 * @property {string | null} selected   id under primary focus (one at a time)
 * @property {string | null} hovered    id under the pointer (secondary)
 * @property {{status:string,gate:string,type:string}} filter  Phase-4 three-axis filter (status / 501c3 gate / type)
 * @property {string | null} cameraFocus id the camera should frame
 */

/** @type {CrystariumUI} */
export const ui = $state({
	selected: null,
	hovered: null,
	cameraFocus: null,
	filter: { status: 'all', gate: 'all', type: 'all' }
});

/**
 * Set one filter axis (status | gate | type). Additive to the Phase-3 bridge.
 * @param {'status'|'gate'|'type'} axis
 * @param {string} value
 */
export function setFilter(axis, value) {
	ui.filter[axis] = value;
}

/** Reset all three filter axes back to 'all'. */
export function resetFilters() {
	ui.filter = { status: 'all', gate: 'all', type: 'all' };
}

/**
 * Primary focus: select a node and ask the camera to frame it.
 * @param {string | null} id
 */
export function select(id) {
	ui.selected = id;
	ui.cameraFocus = id;
}

/** Clear the primary focus and release the camera back to idle orbit. */
export function deselect() {
	ui.selected = null;
	ui.cameraFocus = null;
}

/**
 * Secondary focus: hover (pass null on pointerleave).
 * @param {string | null} id
 */
export function hover(id) {
	ui.hovered = id;
}
