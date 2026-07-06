// Parity tests for the browser aggregates twin (mirrors tools/aggregates.mjs).
// Numbers are computed BY RULE over the real 28-record dataset — the HUD's
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

	it('potentialTotal === 296500 over 9 contributors', () => {
		expect(potentialTotal(grants)).toBe(296500);
	});

	it('potentialContributors.length === 9', () => {
		expect(potentialContributors(grants)).toHaveLength(9);
	});

	it('estimate prefers avg → max → min → null', () => {
		expect(estimate({ amount: { avg: 10, max: 20, min: 5 } } as any)).toBe(10);
		expect(estimate({ amount: { avg: null, max: 20, min: 5 } } as any)).toBe(20);
		expect(estimate({ amount: { avg: null, max: null, min: 5 } } as any)).toBe(5);
		expect(estimate({ amount: { avg: null, max: null, min: null } } as any)).toBeNull();
	});
});

describe('aggregates — group counts (Σ28)', () => {
	it('countByStatus = 17/3/2/2/1/1/1/1 and sums to 28', () => {
		const c = countByStatus(grants);
		expect(c['to-research']).toBe(17);
		expect(c['in-progress']).toBe(3);
		expect(c['recurring']).toBe(2);
		expect(c['not-eligible-yet']).toBe(2);
		expect(c['active']).toBe(1);
		expect(c['applied']).toBe(1);
		expect(c['declined']).toBe(1);
		expect(c['not-eligible']).toBe(1);
		expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(28);
	});

	it('by501c3 = no 12 / yes 8 / unknown 8 and sums to 28', () => {
		const g = by501c3(grants);
		expect(g['no']).toBe(12);
		expect(g['yes']).toBe(8);
		expect(g['unknown']).toBe(8);
		expect(Object.values(g).reduce((a, b) => a + b, 0)).toBe(28);
	});
});
