// CRYS-02 / CRYS-04 — unit assertions for the PURE deterministic layout module.
// These are the phase's load-bearing automated verification surface: layout math is
// tested here (3D pixels are verified manually). Counts/derivations are computed from
// the real 28-record dataset, never hardcoded from prose.
import { describe, it, expect } from 'vitest';
import { computeLayout } from './layout.js';
import grants from '../data/grants.generated.json';
import type { Grant } from '../data/types';

const GRANTS = grants as unknown as Grant[];
const layout = computeLayout(GRANTS);
const byId = (id: string) => layout.nodes.find((n) => n.id === id)!;

// Derived-from-data expectations (recomputed here so the tests fail loudly if the
// dataset ever drifts, instead of trusting a prose number).
const EXPECTED_TBD = GRANTS.filter((g) => g.amount.isTBD).length; // 16
const RING_COUNTS = {
	active: 1,
	applied: 1,
	'in-progress': 3,
	'to-research': 17,
	recurring: 2,
	dim: 4
} as const;

describe('computeLayout — shape & determinism (CRYS-02)', () => {
	it('returns exactly 28 nodes', () => {
		expect(layout.nodes).toHaveLength(28);
		expect(layout.nodes).toHaveLength(GRANTS.length);
	});

	it('every node has finite x/y/z/scale', () => {
		for (const n of layout.nodes) {
			expect(Number.isFinite(n.x), `${n.id}.x`).toBe(true);
			expect(Number.isFinite(n.y), `${n.id}.y`).toBe(true);
			expect(Number.isFinite(n.z), `${n.id}.z`).toBe(true);
			expect(Number.isFinite(n.scale), `${n.id}.scale`).toBe(true);
		}
	});

	it('is deterministic: identical output across calls (no Date/RNG)', () => {
		expect(computeLayout(GRANTS)).toEqual(computeLayout(GRANTS));
	});

	it('exposes { nodes, edges, center } with the active funder as center', () => {
		expect(layout.center).toBe('ny-community-trust');
		expect(Array.isArray(layout.nodes)).toBe(true);
		expect(Array.isArray(layout.edges)).toBe(true);
	});
});

describe('computeLayout — center at origin (CRYS-02/03)', () => {
	it('center node sits at the origin (ring 0, radius 0)', () => {
		const core = byId('ny-community-trust');
		expect(core.status).toBe('active');
		expect(core.ring).toBe('active');
		expect(core.x).toBe(0);
		expect(core.z).toBe(0);
	});
});

describe('computeLayout — ring buckets by status funnel (CRYS-02)', () => {
	const ringCount = (ring: string) => layout.nodes.filter((n) => n.ring === ring).length;

	it('buckets 28 nodes into the status-funnel rings (declined+not-eligible+not-eligible-yet → dim)', () => {
		expect(ringCount('active')).toBe(RING_COUNTS.active);
		expect(ringCount('applied')).toBe(RING_COUNTS.applied);
		expect(ringCount('in-progress')).toBe(RING_COUNTS['in-progress']);
		expect(ringCount('to-research')).toBe(RING_COUNTS['to-research']);
		expect(ringCount('recurring')).toBe(RING_COUNTS.recurring);
		expect(ringCount('dim')).toBe(RING_COUNTS.dim);
	});

	it('ring counts sum to 28', () => {
		const total = Object.values(RING_COUNTS).reduce((a, b) => a + b, 0);
		expect(total).toBe(28);
	});
});

describe('computeLayout — scale encodes amount, TBD → minimal (CRYS-04)', () => {
	it('every TBD node gets the fixed minimal scale (0.5), never 0', () => {
		const tbd = layout.nodes.filter((n) => n.isTBD);
		expect(tbd.length).toBe(EXPECTED_TBD);
		expect(EXPECTED_TBD).toBe(16); // data note: UI-SPEC said "~13"; dataset has 16
		for (const n of tbd) expect(n.scale).toBe(0.5);
	});

	it('log-scales quantified amounts within [0.5, 2.4]', () => {
		for (const n of layout.nodes) {
			expect(n.scale).toBeGreaterThanOrEqual(0.5);
			expect(n.scale).toBeLessThanOrEqual(2.4);
		}
	});

	it('giving-joy-grants ($500 floor) ≈ 0.6', () => {
		expect(byId('giving-joy-grants').scale).toBeCloseTo(0.6, 5);
	});

	it('ford-justfilms ($125k avg) scales large (> 2.2)', () => {
		expect(byId('ford-foundation-justfilms-documentary-production').scale).toBeGreaterThan(2.2);
	});
});

describe('computeLayout — dome wrap (CRYS-02)', () => {
	it('rim rings sit higher than the core (y grows with radius)', () => {
		const core = byId('ny-community-trust');
		const rim = byId('ford-foundation-justfilms-documentary-production'); // to-research, radius 17
		expect(rim.y).toBeGreaterThan(core.y);
	});

	it('dim-arc nodes are pushed below the core (fallen off the dome)', () => {
		const core = byId('ny-community-trust');
		const dim = layout.nodes.filter((n) => n.ring === 'dim');
		for (const n of dim) expect(n.y).toBeLessThan(core.y);
	});
});
