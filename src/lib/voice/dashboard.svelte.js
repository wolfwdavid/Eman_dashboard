// The real Dashboard object the voice widget hands to createActions().
// Thin wiring over the existing stores; no browser globals, no new state.
import { ui, setFilter, resetFilters, select, deselect } from '$lib/state/crystarium.svelte.js';
import { panels, openPanel, closePanels } from '$lib/state/panels.svelte.js';

/** @type {import('./actions').Dashboard} */
export const dashboard = {
	setFilter,
	resetFilters,
	select,
	deselect,
	openPanel,
	closePanels,
	getSelected: () => ui.selected,
	getFilter: () => ({ ...ui.filter }),
	getPanels: () => ({ templates: panels.templates, share: panels.share })
};
