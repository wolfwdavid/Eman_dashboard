import { describe, it, expect } from 'vitest';
import { grants } from '$lib/data';
import { createActions, type Dashboard } from './actions';
import { createRouter, capTranscript, isEmptyUtterance } from './router';
import { COPY } from './copy';

const NOW = new Date(2026, 10, 10);

function fakeDash(): Dashboard {
	let filter = { status: 'all', gate: 'all', type: 'all' } as any;
	let selected: string | null = null;
	const panels = { templates: false, share: false };
	return {
		setFilter: (a, v) => {
			filter = { ...filter, [a]: v };
		},
		resetFilters: () => {
			filter = { status: 'all', gate: 'all', type: 'all' };
		},
		select: (id) => {
			selected = id;
		},
		deselect: () => {
			selected = null;
		},
		openPanel: (n) => {
			panels[n] = true;
		},
		closePanels: () => {
			panels.templates = false;
			panels.share = false;
		},
		getSelected: () => selected,
		getFilter: () => filter,
		getPanels: () => ({ ...panels })
	};
}

const mk = () => createRouter(createActions(fakeDash(), { grants, now: () => NOW }), { grants });

describe('router', () => {
	it('routes a filter command locally with a combined live string', () => {
		const r = mk().route('show recurring grants', { busy: false });
		expect(r.type).toBe('command');
		if (r.type !== 'command') return;
		expect(r.intent.kind).toBe('filter');
		expect(r.text.startsWith('Showing ')).toBe(true);
		expect(r.live).toBe('You said: show recurring grants. ' + r.text);
		expect(r.live.startsWith('You said: show recurring grants. Showing')).toBe(true);
		expect(r.pendingOutcome).toEqual({ kind: 'none' });
	});

	it('returns did-you-mean choices for an ambiguous funder', () => {
		const r = mk().route('open ford', { busy: false });
		expect(r.type).toBe('choices');
		if (r.type !== 'choices') return;
		expect(r.options).toHaveLength(2);
		expect(r.live.startsWith('You said: open ford. Did you mean: 1, ')).toBe(true);
	});

	it('resolves follow-ups against pending options', () => {
		const router = mk();
		const c = router.route('open ford', { busy: false });
		if (c.type !== 'choices') throw new Error('expected choices');
		const second = router.route('the second one', { pending: c.options, busy: false });
		expect(second.type).toBe('command');
		if (second.type !== 'command') return;
		expect(second.intent).toMatchObject({ kind: 'open-grant', id: c.options[1].id });
		expect(second.pendingOutcome).toEqual({ kind: 'chosen', id: c.options[1].id });
		expect(second.opened).toBe('detail');

		const none = router.route('neither', { pending: c.options, busy: false });
		expect(none.type).toBe('command');
		if (none.type !== 'command') return;
		expect(none.text).toBe('OK, cancelled.');
		expect(none.pendingOutcome).toEqual({ kind: 'cancelled' });

		const other = router.route('how much is secured', { pending: c.options, busy: false });
		expect(other.type).toBe('command');
		if (other.type !== 'command') return;
		expect(other.pendingOutcome).toEqual({ kind: 'dropped' });
	});

	it('sends other text as a question with the asking live string', () => {
		const q = 'what grants are due soon for disability orgs';
		const r = mk().route(q, { busy: false });
		expect(r.type).toBe('question');
		if (r.type !== 'question') return;
		expect(r.text).toBe(q);
		expect(r.live).toBe(`You said: ${q}. Asking the assistant, this can take a minute…`);
	});

	it('blocks a second question while busy but still runs commands', () => {
		const router = mk();
		const b = router.route('what grants are due soon for disability orgs', { busy: true });
		expect(b.type).toBe('busy');
		if (b.type !== 'busy') return;
		expect(b.text).toBe(COPY.busy);
		const c = router.route('show recurring grants', { busy: true });
		expect(c.type).toBe('command');
	});

	it('caps and detects empty transcripts', () => {
		expect(capTranscript('  hi  ')).toBe('hi');
		expect(capTranscript('a'.repeat(600))).toHaveLength(500);
		expect(isEmptyUtterance('   ')).toBe(true);
		expect(isEmptyUtterance('show all')).toBe(false);
		const r = mk().route('x '.repeat(400), { busy: false });
		expect(r.type).toBe('question');
		if (r.type === 'question') expect(r.text.length).toBeLessThanOrEqual(500);
	});
});
