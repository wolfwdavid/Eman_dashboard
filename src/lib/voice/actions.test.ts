// Tests for the pure actions adapter, driven by a recording fake Dashboard.
import { describe, it, expect } from 'vitest';
import type { Grant } from '$lib/data/types';
import { grants as realGrants } from '$lib/data';
import { createActions, filterConfirmation, type Dashboard } from './actions';

const NOW = new Date(2026, 10, 10);

function g(id: string, over: Partial<Grant> = {}): Grant {
	return {
		id,
		funder: id.toUpperCase(),
		program: null,
		type: 'Grant',
		amount: {
			raw: '',
			min: null,
			max: null,
			avg: null,
			isReceived: false,
			isTBD: true,
			isEquity: false,
			isMicro: false
		},
		deadline: { raw: '', date: null, cadence: 'annual', note: null, isPassed: false },
		requires501c3: 'no',
		requires501c3Raw: 'No',
		fit: '',
		status: 'to-research',
		statusLabel: '',
		nextAction: null,
		link: 'https://example.org',
		template: null,
		...over
	} as Grant;
}

const GRANTS: Grant[] = [
	g('a', { status: 'recurring', type: 'Grant', requires501c3: 'no' }),
	g('b', { status: 'recurring', type: 'Grant/Fellowship', requires501c3: 'yes' }),
	g('c', { status: 'recurring', type: 'Investment', requires501c3: 'unknown' }),
	g('d', { status: 'active', type: 'Grant', requires501c3: 'no' }),
	g('e', { status: 'in-progress', type: 'Grant', requires501c3: 'no' }),
	g('f', { status: 'applied', type: 'Grant', requires501c3: 'no' }),
	g('h', { status: 'not-eligible-yet', type: 'Grant', requires501c3: 'no' }),
	g('i', { status: 'not-eligible', type: 'Grant', requires501c3: 'no' }),
	g('j', { status: 'declined', type: 'Grant', requires501c3: 'no' }),
	g('k', { status: 'to-research', type: 'Grant', requires501c3: 'no' }),
	g('fam1', { funder: 'Family', program: 'One' }),
	g('fam2', { funder: 'Family', program: 'Two' })
];

function fake(init?: { selected?: string | null; templates?: boolean; share?: boolean }) {
	const calls: string[] = [];
	let filter = { status: 'all', gate: 'all', type: 'all' };
	let selected = init?.selected ?? null;
	const panels = { templates: init?.templates ?? false, share: init?.share ?? false };
	const dash: Dashboard = {
		setFilter(axis, value) {
			calls.push(`setFilter:${axis}:${value}`);
			filter = { ...filter, [axis]: value };
		},
		resetFilters() {
			calls.push('resetFilters');
			filter = { status: 'all', gate: 'all', type: 'all' };
		},
		select(id) {
			calls.push(`select:${id}`);
			selected = id;
		},
		deselect() {
			calls.push('deselect');
			selected = null;
		},
		openPanel(name) {
			calls.push(`openPanel:${name}`);
			panels[name] = true;
		},
		closePanels() {
			calls.push('closePanels');
			panels.templates = false;
			panels.share = false;
		},
		getSelected: () => selected,
		getFilter: () => ({ ...filter }),
		getPanels: () => ({ ...panels })
	};
	return { dash, calls };
}

const mk = (grants = GRANTS, init?: Parameters<typeof fake>[0], oneSurface?: () => boolean) => {
	const f = fake(init);
	return { ...f, actions: createActions(f.dash, { grants, now: () => NOW, oneSurface }) };
};

// Fresh dashboard per call so filter axes do not accumulate across assertions.
const fresh = (axis: 'status' | 'gate' | 'type', value: string, init?: Parameters<typeof fake>[0]) =>
	mk(GRANTS, init).actions.run({ kind: 'filter', axis, value, label: value }).text;

const filt = (axis: 'status' | 'gate' | 'type', value: string) =>
	({ kind: 'filter', axis, value, label: value }) as const;

describe('filter confirmations', () => {
	it('plural and singular for status', () => {
		const { actions, calls } = mk();
		expect(actions.run(filt('status', 'recurring')).text).toBe('Showing 3 recurring grants');
		expect(calls).toEqual(['setFilter:status:recurring']);
		expect(actions.run(filt('status', 'active')).text).toBe('Showing 1 active grant');
	});

	it('status wording for every status', () => {
		expect(fresh('status', 'in-progress')).toBe('Showing 1 in progress grant');
		expect(fresh('status', 'applied')).toBe('Showing 1 applied grant');
		expect(fresh('status', 'not-eligible')).toBe('Showing 1 not eligible grant');
		expect(fresh('status', 'declined')).toBe('Showing 1 declined grant');
		expect(fresh('status', 'to-research')).toBe('Showing 3 grants to research');
		expect(fresh('status', 'not-eligible-yet')).toBe(
			'Showing 1 grant that is not eligible yet'
		);
	});

	it('plural forms via filterConfirmation', () => {
		expect(filterConfirmation('status', 'to-research', 4)).toBe('Showing 4 grants to research');
		expect(filterConfirmation('status', 'not-eligible-yet', 2)).toBe(
			'Showing 2 grants that are not eligible yet'
		);
		expect(filterConfirmation('status', 'in-progress', 2)).toBe('Showing 2 in progress grants');
		expect(filterConfirmation('status', 'not-eligible', 5)).toBe('Showing 5 not eligible grants');
		expect(filterConfirmation('gate', 'open', 6)).toBe('Showing 6 grants open without a 501(c)(3)');
		expect(filterConfirmation('gate', 'gated', 6)).toBe('Showing 6 grants that require a 501(c)(3)');
		expect(filterConfirmation('gate', 'unknown', 6)).toBe(
			'Showing 6 grants with an unknown 501(c)(3) requirement'
		);
		expect(filterConfirmation('type', 'Grant', 7)).toBe('Showing 7 grant-type opportunities');
		expect(filterConfirmation('type', 'Fellowship', 7)).toBe('Showing 7 fellowships');
		expect(filterConfirmation('type', 'Investment', 7)).toBe('Showing 7 investments');
	});

	it('singular forms for gate and type', () => {
		expect(fresh('gate', 'gated')).toBe('Showing 1 grant that requires a 501(c)(3)');
		expect(fresh('gate', 'unknown')).toBe(
			'Showing 1 grant with an unknown 501(c)(3) requirement'
		);
		expect(fresh('type', 'Fellowship')).toBe('Showing 1 fellowship');
		expect(fresh('type', 'Investment')).toBe('Showing 1 investment');
	});

	it('gate open count plural', () => {
		const { actions } = mk();
		// every grant except b (yes) and c (unknown)
		expect(actions.run(filt('gate', 'open')).text).toBe('Showing 10 grants open without a 501(c)(3)');
	});

	it('counts against the combined filter, keeping other axes', () => {
		const { actions } = mk();
		actions.run(filt('type', 'Fellowship'));
		expect(actions.run(filt('status', 'recurring')).text).toBe('Showing 1 recurring grant');
	});

	it('zero matches still applies the filter and offers reset', () => {
		const { actions, calls } = mk();
		const r = actions.run(filt('status', 'recurring'));
		expect(r.text).toContain('3');
		actions.run(filt('type', 'Investment'));
		const z = actions.run(filt('gate', 'open'));
		expect(z.text).toBe('No grants match that filter. Say “reset” to clear filters.');
		expect(calls).toContain('setFilter:gate:open');
	});

	it('spoken form reads 501(c)(3) aloud while text keeps it', () => {
		const { actions } = mk();
		const r = actions.run(filt('gate', 'gated'));
		expect(r.text).toContain('501(c)(3)');
		expect(r.spoken).toContain('five oh one C three');
		expect(r.spoken).not.toContain('501(c)(3)');
		expect(r.opened).toBeNull();
	});

	it('rejects an invalid filter value with no dashboard call', () => {
		const { actions, calls } = mk();
		const r = actions.run({ kind: 'filter', axis: 'status', value: 'bogus', label: 'x' });
		expect(r.text).toBe("I couldn't apply that filter.");
		expect(calls).toEqual([]);
	});
});

describe('reset', () => {
	it('clears filters and counts all grants', () => {
		const { actions, calls } = mk();
		expect(actions.run({ kind: 'reset' }).text).toBe('Filters cleared. Showing all 12 grants.');
		expect(calls).toEqual(['resetFilters']);
	});
	it('singular when only one grant exists', () => {
		const { actions } = mk([g('only')]);
		expect(actions.run({ kind: 'reset' }).text).toBe('Filters cleared. Showing the 1 grant.');
	});
});

describe('open-grant', () => {
	it('selects a known id', () => {
		const { actions, calls } = mk();
		const r = actions.run({ kind: 'open-grant', id: 'a', label: 'A' });
		expect(calls).toEqual(['select:a']);
		expect(r.text).toBe('Opening A.');
		expect(r.opened).toBe('detail');
	});
	it('makes no select call for an unknown id', () => {
		const { actions, calls } = mk();
		const r = actions.run({ kind: 'open-grant', id: 'nope', label: 'Nope' });
		expect(calls.some((c) => c.startsWith('select'))).toBe(false);
		expect(r.text).toBe("I couldn't find that funder.");
		expect(r.opened).toBeNull();
	});
	it('closes an open TEMPLATES or SHARE panel first, so the detail is what shows', () => {
		for (const init of [{ templates: true }, { share: true }, { templates: true, share: true }]) {
			const { actions, calls, dash } = mk(GRANTS, init);
			const r = actions.run({ kind: 'open-grant', id: 'a', label: 'A' });
			expect(calls).toEqual(['closePanels', 'select:a']);
			expect(dash.getPanels()).toEqual({ templates: false, share: false });
			expect(r.opened).toBe('detail');
		}
	});
	it('"close" after that closes the grant, not a hidden panel', () => {
		const { actions, calls } = mk(GRANTS, { templates: true });
		actions.run({ kind: 'open-grant', id: 'a', label: 'A' });
		expect(actions.run({ kind: 'close' }).text).toBe('Closed A.');
		expect(calls).toEqual(['closePanels', 'select:a', 'deselect']);
	});
	it('leaves an open panel alone when the funder is unknown', () => {
		const { actions, calls } = mk(GRANTS, { templates: true });
		actions.run({ kind: 'open-grant', id: 'nope', label: 'Nope' });
		expect(calls).toEqual([]);
	});
});

describe('panels', () => {
	it('opens templates', () => {
		const { actions, calls } = mk();
		const r = actions.run({ kind: 'panel', name: 'templates' });
		expect(calls).toEqual(['openPanel:templates']);
		expect(r.text).toBe('Templates list opened.');
		expect(r.opened).toBe('templates');
	});
	it('opens share', () => {
		const { actions, calls } = mk();
		const r = actions.run({ kind: 'panel', name: 'share' });
		expect(calls).toEqual(['openPanel:share']);
		expect(r.text).toBe('Share panel opened.');
		expect(r.opened).toBe('share');
	});
	// One surface at a time (phones): the detail sheet hides both panels, so it steps aside.
	it('deselects the grant first when only one surface fits', () => {
		for (const name of ['templates', 'share'] as const) {
			const { actions, calls, dash } = mk(GRANTS, { selected: 'a' }, () => true);
			const r = actions.run({ kind: 'panel', name });
			expect(calls).toEqual(['deselect', `openPanel:${name}`]);
			expect(dash.getSelected()).toBeNull();
			expect(r.opened).toBe(name);
		}
	});
	it('keeps the grant open beside the panel on a wide screen', () => {
		for (const oneSurface of [() => false, undefined]) {
			const { actions, calls, dash } = mk(GRANTS, { selected: 'a' }, oneSurface);
			actions.run({ kind: 'panel', name: 'templates' });
			expect(calls).toEqual(['openPanel:templates']);
			expect(dash.getSelected()).toBe('a');
		}
	});
	it('does not deselect when no grant is open', () => {
		const { actions, calls } = mk(GRANTS, undefined, () => true);
		actions.run({ kind: 'panel', name: 'share' });
		expect(calls).toEqual(['openPanel:share']);
	});
});

describe('close priority', () => {
	it('closes the templates list first and leaves the grant alone', () => {
		const { actions, calls } = mk(GRANTS, { templates: true, selected: 'a' });
		expect(actions.run({ kind: 'close' }).text).toBe('Closed the templates list.');
		expect(calls).toEqual(['closePanels']);
	});
	it('closes the share panel', () => {
		const { actions } = mk(GRANTS, { share: true });
		expect(actions.run({ kind: 'close' }).text).toBe('Closed the share panel.');
	});
	it('closes both panels', () => {
		const { actions } = mk(GRANTS, { templates: true, share: true });
		expect(actions.run({ kind: 'close' }).text).toBe(
			'Closed the templates list and the share panel.'
		);
	});
	it('then closes the grant on a second close, using the option label', () => {
		const { actions, calls } = mk(GRANTS, { templates: true, selected: 'fam1' });
		actions.run({ kind: 'close' });
		const r = actions.run({ kind: 'close' });
		expect(r.text).toBe('Closed Family: One.');
		expect(calls).toEqual(['closePanels', 'deselect']);
	});
	it('says Nothing to close with no calls', () => {
		const { actions, calls } = mk();
		expect(actions.run({ kind: 'close' }).text).toBe('Nothing to close.');
		expect(calls).toEqual([]);
	});
});

describe('facts and cancel', () => {
	it('secured uses the live aggregates', () => {
		const { actions } = mk(realGrants);
		const r = actions.run({ kind: 'fact', fact: 'secured' });
		expect(r.text).toMatch(/^\$[\d,]+ secured so far, out of \$[\d,]+ potential\.$/);
	});
	it('next deadlines use the injected clock', () => {
		const { actions } = mk([g('x', { deadline: { raw: '', date: '2026-12-01', cadence: 'annual', note: null, isPassed: false } })]);
		expect(actions.run({ kind: 'fact', fact: 'next-deadlines' }).text).toBe(
			'Next deadline: X, December 1, 2026.'
		);
	});
	it('no dated deadlines', () => {
		const { actions } = mk([g('x')]);
		expect(actions.run({ kind: 'fact', fact: 'next-deadlines' }).text).toBe(
			'No dated deadlines are coming up.'
		);
	});
	it('cancel-pending', () => {
		const { actions } = mk();
		expect(actions.run({ kind: 'cancel-pending' }).text).toBe('OK, cancelled.');
	});
});
