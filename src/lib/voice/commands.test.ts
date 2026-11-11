// Table-driven tests for the pure voice command grammar.
import { describe, it, expect } from 'vitest';
import { grants } from '$lib/data';
import { parse, normalize, FILTER_VALUES, type Intent, type Ctx } from './commands';

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

	it('third is ignored when only two options exist', () => {
		expect(parse('third', { grants, pending: two }).kind).toBe('chat');
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
