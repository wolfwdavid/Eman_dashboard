import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	securedTotal,
	potentialTotal,
	countByStatus,
	by501c3,
	potentialContributors
} from './aggregates.mjs';

// Key off the REAL generated dataset — the aggregates are only meaningful over
// the actual 40 records the app compiles against, not a hand-rolled fixture.
const grants = JSON.parse(readFileSync('src/lib/data/grants.generated.json', 'utf8'));

describe('aggregates over the real generated dataset', () => {
	it('has exactly 40 records', () => {
		expect(grants).toHaveLength(40); // re-pinned 2026-11-09 after 12 rows were added
	});

	it('securedTotal === 20000 (NY Community Trust only) — HARD assert', () => {
		expect(securedTotal(grants)).toBe(20000);
	});

	it('countByStatus deep-equals the expected distribution and sums to 40', () => {
		const c = countByStatus(grants);
		expect(c).toEqual({
			'to-research': 22, // re-pinned 2026-11-09 after 12 rows were added
			'in-progress': 3,
			recurring: 3, // re-pinned 2026-11-09 after 12 rows were added
			'not-eligible-yet': 5, // re-pinned 2026-11-09 after 12 rows were added
			active: 1,
			applied: 1,
			declined: 1,
			'not-eligible': 4 // re-pinned 2026-11-09 after 12 rows were added
		});
		expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(40); // re-pinned 2026-11-09 after 12 rows were added
	});

	it('potentialTotal === 491500 (avg ?? max ?? min over the 14 contributing rows)', () => {
		expect(potentialTotal(grants)).toBe(491500); // re-pinned 2026-11-09 after 12 rows were added
	});

	it('by501c3 sums to 40', () => {
		const c = by501c3(grants);
		expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(40); // re-pinned 2026-11-09 after 12 rows were added
	});
});

describe('potentialTotal EXCLUSION membership (the point of the test)', () => {
	const contributors = potentialContributors(grants);
	const funders = contributors.map((g) => g.funder);

	it('excludes Hey Helen (declined)', () => {
		expect(funders.some((f) => f.includes('Hey Helen'))).toBe(false);
	});

	it('excludes TD Bank and Truist (not-eligible*)', () => {
		expect(funders.some((f) => f.includes('TD Bank'))).toBe(false);
		expect(funders.some((f) => f.includes('Truist'))).toBe(false);
	});

	it('excludes 37 Angels (equity investment)', () => {
		expect(funders.some((f) => f.includes('37 Angels'))).toBe(false);
	});

	it('excludes NY Community Trust (isReceived → secured, never double-counted)', () => {
		expect(funders.some((f) => f.includes('NY Community Trust'))).toBe(false);
	});

	it('excludes Just Thrive (not-eligible-yet) even though it has a numeric estimate', () => {
		expect(funders.some((f) => f.includes('Just Thrive'))).toBe(false);
	});

	it('the contributing set is exactly the 14 expected rows summing to 491500', () => {
		expect(contributors).toHaveLength(14); // re-pinned 2026-11-09 after 12 rows were added
		const sum = contributors.reduce(
			(acc, g) => acc + (g.amount.avg ?? g.amount.max ?? g.amount.min),
			0
		);
		expect(sum).toBe(491500); // re-pinned 2026-11-09 after 12 rows were added
	});
});
