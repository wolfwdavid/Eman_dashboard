// actions.ts - PURE adapter from a parsed Intent to dashboard calls plus the
// exact confirmation copy (08-UI-SPEC "Command confirmations").
// The Dashboard is injected, so this file never touches stores, the DOM or the
// clock (`data.now` is injected too) and runs unchanged in node.
import type { Grant } from '../data/types';
import { matchesFilter, type FilterState } from '../data/filter';
import { FILTER_VALUES, optionLabel, type Intent } from './commands';
import { nextDeadlinesText, securedText } from './facts';
import { toSpeech } from './tts';

export type PanelName = 'templates' | 'share';

export interface Dashboard {
	setFilter(axis: 'status' | 'gate' | 'type', value: string): void;
	resetFilters(): void;
	select(id: string): void;
	deselect(): void;
	openPanel(name: PanelName): void;
	closePanels(): void;
	getSelected(): string | null;
	getFilter(): FilterState;
	getPanels(): { templates: boolean; share: boolean };
}

export type ActionResult = {
	text: string;
	spoken: string;
	opened: 'detail' | 'templates' | 'share' | null;
};

type Axis = 'status' | 'gate' | 'type';
type Phrase = { one: string; many: string }; // {n} placeholder in `many`; `one` is the full singular

// Lookup of the confirmation wording, keyed by axis then value.
const STATUS_WORD: Record<string, string> = {
	active: 'active',
	'in-progress': 'in progress',
	applied: 'applied',
	recurring: 'recurring',
	'not-eligible': 'not eligible',
	declined: 'declined'
};

function phrase(axis: Axis, value: string): Phrase | null {
	if (axis === 'status') {
		if (value === 'to-research')
			return { many: 'Showing {n} grants to research', one: 'Showing 1 grant to research' };
		if (value === 'not-eligible-yet')
			return {
				many: 'Showing {n} grants that are not eligible yet',
				one: 'Showing 1 grant that is not eligible yet'
			};
		const w = STATUS_WORD[value];
		return w ? { many: `Showing {n} ${w} grants`, one: `Showing 1 ${w} grant` } : null;
	}
	if (axis === 'gate') {
		if (value === 'open')
			return {
				many: 'Showing {n} grants open without a 501(c)(3)',
				one: 'Showing 1 grant open without a 501(c)(3)'
			};
		if (value === 'gated')
			return {
				many: 'Showing {n} grants that require a 501(c)(3)',
				one: 'Showing 1 grant that requires a 501(c)(3)'
			};
		if (value === 'unknown')
			return {
				many: 'Showing {n} grants with an unknown 501(c)(3) requirement',
				one: 'Showing 1 grant with an unknown 501(c)(3) requirement'
			};
		return null;
	}
	if (value === 'Grant')
		return { many: 'Showing {n} grant-type opportunities', one: 'Showing 1 grant-type opportunity' };
	if (value === 'Fellowship') return { many: 'Showing {n} fellowships', one: 'Showing 1 fellowship' };
	if (value === 'Investment') return { many: 'Showing {n} investments', one: 'Showing 1 investment' };
	return null;
}

const ZERO = 'No grants match that filter. Say “reset” to clear filters.';

/** Confirmation text for a filter with `n` matches. */
export function filterConfirmation(axis: Axis, value: string, n: number): string {
	if (n === 0) return ZERO;
	const p = phrase(axis, value);
	if (!p) return `Showing ${n} ${n === 1 ? 'grant' : 'grants'}`;
	return n === 1 ? p.one : p.many.replace('{n}', String(n));
}

const result = (text: string, opened: ActionResult['opened'] = null): ActionResult => ({
	text,
	spoken: toSpeech(text),
	opened
});

type Runnable = Exclude<Intent, { kind: 'chat' } | { kind: 'did-you-mean' }>;

export function createActions(dash: Dashboard, data: { grants: Grant[]; now: () => Date }) {
	const { grants } = data;

	function run(intent: Runnable): ActionResult {
		switch (intent.kind) {
			case 'filter': {
				const { axis, value } = intent;
				const allowed = (FILTER_VALUES as Record<string, readonly string[]>)[axis];
				if (!allowed || !allowed.includes(value)) return result("I couldn't apply that filter.");
				dash.setFilter(axis, value);
				const next = { ...dash.getFilter(), [axis]: value };
				const n = grants.filter((g) => matchesFilter(g, next)).length;
				return result(filterConfirmation(axis, value, n));
			}
			case 'reset': {
				dash.resetFilters();
				const n = grants.length;
				return result(
					n === 1 ? 'Filters cleared. Showing the 1 grant.' : `Filters cleared. Showing all ${n} grants.`
				);
			}
			case 'open-grant': {
				const g = grants.find((x) => x.id === intent.id);
				if (!g) return result("I couldn't find that funder.");
				dash.select(g.id);
				return result(`Opening ${intent.label}.`, 'detail');
			}
			case 'panel': {
				if (intent.name === 'templates') {
					dash.openPanel('templates');
					return result('Templates list opened.', 'templates');
				}
				if (intent.name === 'share') {
					dash.openPanel('share');
					return result('Share panel opened.', 'share');
				}
				return result("I couldn't open that panel.");
			}
			case 'close': {
				const p = dash.getPanels();
				if (p.templates || p.share) {
					dash.closePanels();
					const text =
						p.templates && p.share
							? 'Closed the templates list and the share panel.'
							: p.templates
								? 'Closed the templates list.'
								: 'Closed the share panel.';
					return result(text);
				}
				const sel = dash.getSelected();
				if (sel !== null) {
					const g = grants.find((x) => x.id === sel);
					dash.deselect();
					return result(`Closed ${g ? optionLabel(g, grants) : 'the grant'}.`);
				}
				return result('Nothing to close.');
			}
			case 'fact':
				return result(
					intent.fact === 'secured' ? securedText(grants) : nextDeadlinesText(grants, data.now())
				);
			case 'cancel-pending':
				return result('OK, cancelled.');
			default: {
				const _never: never = intent;
				return _never;
			}
		}
	}

	return { run };
}
