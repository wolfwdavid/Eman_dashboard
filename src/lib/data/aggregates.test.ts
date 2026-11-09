// Parity tests for the browser aggregates twin (mirrors tools/aggregates.mjs).
// Numbers are computed BY RULE over the real 40-record dataset — the HUD's
// single source of truth. Any drift here is a real numeric regression.
import { describe, it, expect } from 'vitest';
import { grants } from '$lib/data';
import {
	estimate,
	securedTotal,
	potentialTotal,
	potentialContributors,
	countByStatus,
	by501c3
} from './aggregates';

describe('aggregates — headline totals (computed, not hardcoded)', () => {
	it('securedTotal === 20000 (banked NY Community Trust)', () => {
		expect(securedTotal(grants)).toBe(20000);
	});

	it('potentialTotal === 491500 over 14 contributors', () => {
		expect(potentialTotal(grants)).toBe(491500); // re-pinned 2026-11-09 after 12 rows were added
	});

	it('potentialContributors.length === 14', () => {
		expect(potentialContributors(grants)).toHaveLength(14); // re-pinned 2026-11-09 after 12 rows were added
	});

	it('estimate prefers avg → max → min → null', () => {
		expect(estimate({ amount: { avg: 10, max: 20, min: 5 } } as any)).toBe(10);
		expect(estimate({ amount: { avg: null, max: 20, min: 5 } } as any)).toBe(20);
		expect(estimate({ amount: { avg: null, max: null, min: 5 } } as any)).toBe(5);
		expect(estimate({ amount: { avg: null, max: null, min: null } } as any)).toBeNull();
	});
});

describe('aggregates — group counts (Σ40)', () => {
	it('countByStatus = 22/3/3/5/1/1/1/4 and sums to 40', () => {
		const c = countByStatus(grants);
		expect(c['to-research']).toBe(22); // re-pinned 2026-11-09 after 12 rows were added
		expect(c['in-progress']).toBe(3);
		expect(c['recurring']).toBe(3); // re-pinned 2026-11-09 after 12 rows were added
		expect(c['not-eligible-yet']).toBe(5); // re-pinned 2026-11-09 after 12 rows were added
		expect(c['active']).toBe(1);
		expect(c['applied']).toBe(1);
		expect(c['declined']).toBe(1);
		expect(c['not-eligible']).toBe(4); // re-pinned 2026-11-09 after 12 rows were added
		expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(40); // re-pinned 2026-11-09 after 12 rows were added
	});

	it('by501c3 = no 14 / yes 17 / unknown 9 and sums to 40', () => {
		const g = by501c3(grants);
		expect(g['no']).toBe(14); // re-pinned 2026-11-09 after 12 rows were added
		expect(g['yes']).toBe(17); // re-pinned 2026-11-09 after 12 rows were added
		expect(g['unknown']).toBe(9); // re-pinned 2026-11-09 after 12 rows were added
		expect(Object.values(g).reduce((a, b) => a + b, 0)).toBe(40); // re-pinned 2026-11-09 after 12 rows were added
	});
});
