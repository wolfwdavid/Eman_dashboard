// Table-driven tests for the pure voice command grammar.
import { describe, it, expect } from 'vitest';
import { grants } from '$lib/data';
import { parse, normalize, optionLabel, FILTER_VALUES, type Intent, type Ctx } from './commands';

const ctx: Ctx = { grants };
const opts = [
	{ id: 'a-id', label: 'Option A' },
	{ id: 'b-id', label: 'Option B' },
	{ id: 'c-id', label: 'Option C' }
];

describe('normalize', () => {
	it.each([
		['Ben & Jerry’s', 'ben and jerrys'],
		['Please show $10K Grants.', 'show 10k grants'],
		['hey, can you show me 501(c)(3) funders?', 'show me 501c3 funders'],
		['show 501 c 3 required', 'show 501c3 required'],
		['five oh one c three required', '501c3 required'],
		['  Okay   RESET!! ', 'reset'],
		['would you please clear filters', 'clear filters']
	])('%s -> %s', (raw, out) => {
		expect(normalize(raw)).toBe(out);
	});
});

const filt = (axis: 'status' | 'gate' | 'type', value: string) =>
	expect.objectContaining({ kind: 'filter', axis, value });

describe('filters', () => {
	it.each([
		['show recurring grants', 'status', 'recurring'],
		['only applied', 'status', 'applied'],
		['show in progress', 'status', 'in-progress'],
		['show to research', 'status', 'to-research'],
		['show not eligible yet', 'status', 'not-eligible-yet'],
		['show not eligible', 'status', 'not-eligible'],
		['show declined', 'status', 'declined'],
		['show active funders', 'status', 'active'],
		['Show Recurring Grants.', 'status', 'recurring'],
		['show open grants', 'gate', 'open'],
		['show open', 'gate', 'open'],
		['only gated', 'gate', 'gated'],
		['show unknown', 'gate', 'unknown'],
		['show fellowships', 'type', 'Fellowship'],
		['show investments', 'type', 'Investment'],
		['show grants', 'type', 'Grant'],
		['filter by recurring', 'status', 'recurring']
	] as const)('%s', (raw, axis, value) => {
		expect(parse(raw, ctx)).toEqual(filt(axis, value));
	});

	it('every emitted filter value is in the closed sets', () => {
		const phrases = [
			'show recurring grants',
			'show open',
			'show fellowships',
			'only applied',
			'show not eligible yet'
		];
		for (const p of phrases) {
			const i = parse(p, ctx);
			expect(i.kind).toBe('filter');
			if (i.kind === 'filter') {
				expect(FILTER_VALUES[i.axis] as readonly string[]).toContain(i.value);
			}
		}
	});

	it('bare "open templates" is never a gate filter', () => {
		expect(parse('open templates', ctx)).toEqual({ kind: 'panel', name: 'templates' });
	});
});

describe('system phrases', () => {
	it.each([
		['reset', { kind: 'reset' }],
		['clear filters', { kind: 'reset' }],
		['show all', { kind: 'reset' }],
		['everything', { kind: 'reset' }],
		['clear', { kind: 'reset' }],
		['close', { kind: 'close' }],
		['close that', { kind: 'close' }],
		['go back', { kind: 'close' }],
		['dismiss', { kind: 'close' }],
		['open templates', { kind: 'panel', name: 'templates' }],
		['templates', { kind: 'panel', name: 'templates' }],
		['show templates', { kind: 'panel', name: 'templates' }],
		['share', { kind: 'panel', name: 'share' }],
		['open share', { kind: 'panel', name: 'share' }],
		['open qr', { kind: 'panel', name: 'share' }],
		['show qr', { kind: 'panel', name: 'share' }],
		["what's due next", { kind: 'fact', fact: 'next-deadlines' }],
		['next deadline', { kind: 'fact', fact: 'next-deadlines' }],
		['next deadlines', { kind: 'fact', fact: 'next-deadlines' }],
		['what is due', { kind: 'fact', fact: 'next-deadlines' }],
		['upcoming deadlines', { kind: 'fact', fact: 'next-deadlines' }],
		['how much is secured', { kind: 'fact', fact: 'secured' }],
		['how much have we secured', { kind: 'fact', fact: 'secured' }],
		['secured total', { kind: 'fact', fact: 'secured' }],
		['how much money', { kind: 'fact', fact: 'secured' }]
	] as [string, Intent][])('%s', (raw, intent) => {
		expect(parse(raw, ctx)).toEqual(intent);
	});
});

describe('pending follow-ups', () => {
	const two = opts.slice(0, 2);
	const open = (o: { id: string; label: string }): Intent => ({
		kind: 'open-grant',
		id: o.id,
		label: o.label
	});
	it.each([
		['first', 0],
		['1st', 0],
		['one', 0],
		['number one', 0],
		['the first one', 0],
		['second', 1],
		['two', 1],
		['2nd', 1],
		['number two', 1],
		['the second one', 1],
		['third', 2],
		['three', 2],
		['last', 2]
	])('%s -> option %i of 3', (raw, idx) => {
		expect(parse(raw, { grants, pending: opts })).toEqual(open(opts[idx]));
	});

	it('last resolves to the final option of two', () => {
		expect(parse('the last one', { grants, pending: two })).toEqual(open(two[1]));
	});

	// An ordinal past the end of the list asks again; the choices stay open.
	it.each(['third', 'the third one', 'number three', '3'])('%s of two re-asks', (raw) => {
		expect(parse(raw, { grants, pending: two })).toEqual({ kind: 'did-you-mean', options: two });
	});

	it('"the one" alone is not "the first one"', () => {
		expect(parse('the one', { grants, pending: opts })).toEqual({
			kind: 'did-you-mean',
			options: opts
		});
		expect(parse('the one', ctx).kind).toBe('chat');
	});

	it.each(['neither', 'none', 'none of these', 'cancel', 'never mind'])('%s cancels', (raw) => {
		expect(parse(raw, { grants, pending: opts })).toEqual({ kind: 'cancel-pending' });
	});

	it('pending list is ignored when nothing matches', () => {
		expect(parse('show recurring grants', { grants, pending: opts })).toEqual(
			filt('status', 'recurring')
		);
	});

	it('ordinals do nothing without a pending list', () => {
		expect(parse('the second one', ctx).kind).toBe('chat');
	});
});

describe('chat fallthrough', () => {
	// Inherited Object.prototype keys must never be read as table entries.
	it.each(['constructor', 'toString', '__proto__', 'valueOf', 'hasOwnProperty', 'show constructor'])(
		'%s is not a command',
		(raw) => {
			expect(parse(raw, ctx)).toEqual({ kind: 'chat', text: raw });
		}
	);
	it('inherited keys are not ordinals while options are pending', () => {
		expect(parse('constructor', { grants, pending: opts })).toEqual({ kind: 'chat', text: 'constructor' });
	});
	it('keeps the original trimmed transcript', () => {
		expect(parse('  Tell me about the Ford Foundation!  ', ctx)).toEqual({
			kind: 'chat',
			text: 'Tell me about the Ford Foundation!'
		});
	});
	it('empty speech goes to chat', () => {
		expect(parse('   ', ctx).kind).toBe('chat');
	});
});

// ---------------------------------------------------------------------------
// Navigate: fuzzy funder matcher, did-you-mean, question guard
// ---------------------------------------------------------------------------

const idOf = (re: RegExp): string => {
	const hits = grants.filter((g) => re.test(`${g.funder} ${g.program ?? ''}`));
	if (hits.length !== 1) throw new Error(`idOf(${re}) matched ${hits.length} rows`);
	return hits[0].id;
};

describe('navigate: single matches', () => {
	it.each([
		['open north star', /north star/i],
		['open ben and jerrys', /ben & jerry/i],
		["open Ben & Jerry's", /ben & jerry/i],
		['go to kellogg', /kellogg/i],
		['show snf', /\(SNF\)/],
		['open s n f', /\(SNF\)/],
		['open thirty seven angels', /37 angels/i],
		['open t 7 summit', /t7 summit/i],
		['open the third wave mobilize', /mobilize/i],
		['take me to tisch', /tisch/i],
		['find echoing green', /echoing green/i]
	])('%s', (raw, re) => {
		const out = parse(raw, ctx);
		expect(out.kind).toBe('open-grant');
		if (out.kind === 'open-grant') expect(out.id).toBe(idOf(re));
	});

	it('labels single-row funders by funder name', () => {
		expect(parse('open north star', ctx)).toEqual({
			kind: 'open-grant',
			id: idOf(/north star/i),
			label: 'North Star Fund'
		});
	});
});

describe('navigate: did you mean', () => {
	it('open ford -> exactly 2 options with funder: program labels', () => {
		const out = parse('open ford', ctx);
		expect(out.kind).toBe('did-you-mean');
		if (out.kind !== 'did-you-mean') return;
		expect(out.options).toHaveLength(2);
		expect(out.options.map((o) => o.label)).toEqual(
			expect.arrayContaining([
				'Ford Foundation: JustFilms Documentary Production',
				'Ford Foundation: NYC Good Neighbor Committee'
			])
		);
	});

	it('open bank of america -> exactly 3 options', () => {
		const out = parse('open bank of america', ctx);
		expect(out.kind).toBe('did-you-mean');
		if (out.kind === 'did-you-mean') expect(out.options).toHaveLength(3);
	});

	it.each([
		['open third wave', 2],
		['open borealis', 2]
	])('%s -> %i options', (raw, n) => {
		const out = parse(raw, ctx);
		expect(out.kind).toBe('did-you-mean');
		if (out.kind === 'did-you-mean') expect(out.options).toHaveLength(n);
	});

	it('open foundation never yields a confident single pick', () => {
		const out = parse('open foundation', ctx);
		expect(out.kind).not.toBe('open-grant');
		if (out.kind === 'did-you-mean') {
			expect(out.options.length).toBeGreaterThanOrEqual(2);
			expect(out.options.length).toBeLessThanOrEqual(3);
		}
	});

	it('option count is always 2 or 3 across many phrases', () => {
		for (const p of ['open ford', 'open foundation', 'open bank', 'open fund', 'open thrive', 'open grants']) {
			const out = parse(p, ctx);
			if (out.kind === 'did-you-mean') {
				expect(out.options.length).toBeGreaterThanOrEqual(2);
				expect(out.options.length).toBeLessThanOrEqual(3);
			}
		}
	});

	it('every emitted id comes from the grants array', () => {
		const ids = new Set(grants.map((g) => g.id));
		for (const p of ['open ford', 'open bank of america', 'open north star', 'open borealis']) {
			const out = parse(p, ctx);
			if (out.kind === 'open-grant') expect(ids.has(out.id)).toBe(true);
			if (out.kind === 'did-you-mean') for (const o of out.options) expect(ids.has(o.id)).toBe(true);
		}
	});

	it('re-matches inside pending options ("the justfilms one")', () => {
		const pending = [
			{ id: idOf(/justfilms/i), label: 'Ford Foundation: JustFilms Documentary Production' },
			{ id: idOf(/good neighbor/i), label: 'Ford Foundation: NYC Good Neighbor Committee' }
		];
		expect(parse('the justfilms one', { grants, pending })).toEqual({
			kind: 'open-grant',
			id: pending[0].id,
			label: pending[0].label
		});
		expect(parse('the good neighbor one', { grants, pending })).toEqual({
			kind: 'open-grant',
			id: pending[1].id,
			label: pending[1].label
		});
	});
});

describe('navigate: pending re-match by name', () => {
	const justfilms = { id: idOf(/justfilms/i), label: 'Ford Foundation: JustFilms Documentary Production' };
	const neighbor = { id: idOf(/good neighbor/i), label: 'Ford Foundation: NYC Good Neighbor Committee' };
	const northStar = { id: idOf(/north star/i), label: 'North Star Fund' };
	const fords = [justfilms, neighbor];

	it('a bare shared funder name keeps the choices open', () => {
		expect(parse('ford', { grants, pending: fords })).toEqual({ kind: 'did-you-mean', options: fords });
		expect(parse('the ford one', { grants, pending: fords })).toEqual({
			kind: 'did-you-mean',
			options: fords
		});
	});

	it('a shared funder name narrows a mixed list to the rows it fits', () => {
		const pending = [justfilms, northStar, neighbor];
		expect(parse('ford', { grants, pending })).toEqual({ kind: 'did-you-mean', options: fords });
	});

	it('a bare name that fits one option opens it', () => {
		const pending = [justfilms, northStar, neighbor];
		expect(parse('justfilms', { grants, pending })).toEqual({ kind: 'open-grant', ...justfilms });
		expect(parse('north star', { grants, pending })).toEqual({ kind: 'open-grant', ...northStar });
	});

	it('commands and questions are not swallowed by the pending list', () => {
		expect(parse('show recurring grants', { grants, pending: fords })).toEqual(
			filt('status', 'recurring')
		);
		expect(parse('reset', { grants, pending: fords })).toEqual({ kind: 'reset' });
		expect(parse('what is the deadline for ford', { grants, pending: fords }).kind).toBe('chat');
		expect(parse('ford deadline', { grants, pending: fords }).kind).toBe('chat');
	});
});

// Reproduced against the shipped dataset: one shared word must not pick a grant.
describe('navigate: matcher quality on the real dataset', () => {
	const options = (raw: string): string[] => {
		const out = parse(raw, ctx);
		if (out.kind !== 'did-you-mean') throw new Error(`${raw} -> ${out.kind}, expected did-you-mean`);
		return out.options.map((o) => o.label);
	};
	const rowOf = (label: string) => grants.find((g) => optionLabel(g, grants) === label)!;
	const text = (label: string) => {
		const g = rowOf(label);
		return `${g.funder} ${g.program ?? ''}`;
	};

	it('open bank offers TD Bank and Bank of America rows, never a single pick', () => {
		const labels = options('open bank');
		expect(labels).toHaveLength(3);
		expect(labels).toContain('TD Bank');
		expect(labels.filter((l) => /bank of america/i.test(l)).length).toBe(2);
	});

	it('open new york offers both New York funders', () => {
		const labels = options('open new york');
		expect([...labels].sort()).toEqual(['NY Community Trust', "New York Women's Foundation"]);
	});

	it('find funding offers the rows that share the word', () => {
		expect([...options('find funding')].sort()).toEqual(['Impact Funding Solutions', 'TD Bank']);
	});

	it.each([
		['show nyc grants', /nyc/i],
		['find organizing grants', /organizing/i],
		['open thrive', /thrive/i],
		['open community', /community/i]
	] as const)('%s offers only rows that contain the word', (raw, re) => {
		const labels = options(raw);
		expect(labels.length).toBeGreaterThanOrEqual(2);
		expect(labels.length).toBeLessThanOrEqual(3);
		for (const l of labels) expect(text(l)).toMatch(re);
	});

	it.each(['open foundation', 'open fund', 'open grants', 'find the foundation'])(
		'%s (generic words only) goes to chat',
		(raw) => {
			expect(parse(raw, ctx).kind).toBe('chat');
		}
	);

	it.each([
		['find fellowships', 'Echoing Green Fellowship'],
		['open queens', 'Queens Centers for Progress'],
		['open x', 'Just Thrive (Justworks x The Well Work)']
	])('%s offers its one plausible row alone, unpadded', (raw, label) => {
		expect(options(raw)).toEqual([label]);
	});

	it('a program name alone suggests but does not open', () => {
		expect(options('open mobilize')).toEqual(['Third Wave Fund: Mobilize Power Fund']);
	});

	it('no list is padded with a row unrelated to the query', () => {
		for (const p of ['find fellowships', 'open x', 'find women', 'open queens', 'open hey helen']) {
			const out = parse(p, ctx);
			if (out.kind === 'did-you-mean') {
				expect(out.options.map((o) => o.label)).not.toContain('NY Community Trust');
			}
		}
	});

	it('a funder whose name starts with a filler word still opens', () => {
		expect(parse('open hey helen grant', ctx)).toEqual(
			expect.objectContaining({ kind: 'open-grant', id: idOf(/hey helen/i) })
		);
	});

	it('every funder still resolves by its full name', () => {
		for (const g of grants) {
			if (normalize(g.funder).split(' ').length > 6) continue;
			const out = parse(`open ${g.funder}`, ctx);
			const ids =
				out.kind === 'open-grant' ? [out.id] : out.kind === 'did-you-mean' ? out.options.map((o) => o.id) : [];
			expect(ids, g.funder).toContain(g.id);
			const rows = grants.filter((x) => x.funder === g.funder).length;
			// "Bank of America" is part of three funder names, so those always ask.
			const lc = (x: { funder: string }) => x.funder.toLowerCase();
			const shared = grants.some(
				(x) => x.funder !== g.funder && (lc(x).includes(lc(g)) || lc(g).includes(lc(x)))
			);
			if (rows === 1 && !shared) expect(out.kind, g.funder).toBe('open-grant');
		}
	});
});

describe('navigate: question guard and unknown names', () => {
	it.each([
		'what is the deadline for ford',
		'show me how to apply to ford',
		'how do I apply to north star',
		'open the north star fund nyc organizing grants and tell me everything about it',
		'open zzzz quux'
	])('%s -> chat', (raw) => {
		expect(parse(raw, ctx).kind).toBe('chat');
	});
});

describe('performance', () => {
	// D-07 budget: a transcript is parsed in under 50 ms. Averaged over 100 parses so a
	// busy machine (CI, a parallel browser run) cannot fail it on scheduling noise.
	it('a parse averages under the 50 ms command budget', () => {
		const phrases = ['open north star', 'open ford', 'show recurring grants', 'open zzzz quux'];
		const runs = 100;
		const t0 = performance.now();
		for (let i = 0; i < runs; i++) parse(phrases[i % phrases.length], ctx);
		expect((performance.now() - t0) / runs).toBeLessThan(50);
	});
});
