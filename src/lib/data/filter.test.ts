// Tests for the pure filter predicate — imported by BOTH the scene (dim/guard)
// and the UI (charts/list), so they agree by construction. Keyed to the real
// 28-record dataset: gate 12 open / 8 gated / 8 unknown; types 26 Grant / 1
// Fellowship / 1 Investment.
import { describe, it, expect } from 'vitest';
import { grants } from '$lib/data';
import { matchesFilter, gateBucket, typeBucket, type FilterState } from './filter';

const ALL: FilterState = { status: 'all', gate: 'all', type: 'all' };
const g = (id: string) => grants.find((x) => x.id === id)!;

describe('gateBucket', () => {
	it('maps requires501c3 no→open, yes→gated, unknown→unknown', () => {
		expect(gateBucket(g('third-wave-fund-disability-frontlines-fund'))).toBe('open'); // no
		expect(gateBucket(g('harry-s-black-allon-fuller-fund-bank-of-america'))).toBe('gated'); // yes
		expect(gateBucket(g('brava-thrive-grant'))).toBe('unknown'); // unknown
	});
});

describe('typeBucket', () => {
	it("collapses 'Grant/Fellowship'→'Fellowship'; keeps Grant/Investment", () => {
		expect(typeBucket(g('echoing-green-fellowship'))).toBe('Fellowship'); // Grant/Fellowship
		expect(typeBucket(g('ny-community-trust'))).toBe('Grant');
		expect(typeBucket(g('37-angels'))).toBe('Investment');
	});
});

describe('matchesFilter', () => {
	it('all-all-all matches every grant', () => {
		expect(grants.every((x) => matchesFilter(x, ALL))).toBe(true);
	});

	it('status axis narrows to that status only', () => {
		const out = grants.filter((x) => matchesFilter(x, { ...ALL, status: 'in-progress' }));
		expect(out).toHaveLength(3);
		expect(out.every((x) => x.status === 'in-progress')).toBe(true);
	});

	it('gate axis narrows: open 12 / gated 8 / unknown 8', () => {
		expect(grants.filter((x) => matchesFilter(x, { ...ALL, gate: 'open' }))).toHaveLength(12);
		expect(grants.filter((x) => matchesFilter(x, { ...ALL, gate: 'gated' }))).toHaveLength(8);
		expect(grants.filter((x) => matchesFilter(x, { ...ALL, gate: 'unknown' }))).toHaveLength(8);
	});

	it('type axis narrows: Grant 26 / Fellowship 1 / Investment 1', () => {
		expect(grants.filter((x) => matchesFilter(x, { ...ALL, type: 'Grant' }))).toHaveLength(26);
		expect(grants.filter((x) => matchesFilter(x, { ...ALL, type: 'Fellowship' }))).toHaveLength(1);
		expect(grants.filter((x) => matchesFilter(x, { ...ALL, type: 'Investment' }))).toHaveLength(1);
	});

	it('combined axes AND together', () => {
		// to-research AND open gate → excludes gated/unknown to-research rows
		const out = grants.filter((x) => matchesFilter(x, { status: 'to-research', gate: 'open', type: 'all' }));
		expect(out.every((x) => x.status === 'to-research' && gateBucket(x) === 'open')).toBe(true);
		expect(out.length).toBeGreaterThan(0);
	});

	it('a zero-match combo returns []', () => {
		// active status is only NY Community Trust (gate open) → active + gated = none
		const out = grants.filter((x) => matchesFilter(x, { status: 'active', gate: 'gated', type: 'all' }));
		expect(out).toEqual([]);
	});
});
