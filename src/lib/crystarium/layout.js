// PURE, deterministic Crystarium layout — the load-bearing automated core of Phase 3.
//
// computeLayout(grants) → { nodes, edges, center }
//   Node: { id, x, y, z, scale, ring, sector, status, isTBD, isEquity, pulse, beamTarget }
//   Edge: { from, to, kind: 'spine' | 'family' | 'beam' }
//
// HARD CONSTRAINTS (why this file is unit-testable and identical across builds):
//   • NO `three` import        — positions are plain numbers, never THREE.Vector3.
//   • NO `Date` / `Date.now()`  — the deadline-pulse SET is derived from the clock-free
//                                 `deadline.isPassed` flag + cadence + status, never `now`.
//   • NO `Math.random()`        — the angular fan is index-derived, fully deterministic.
//
// Encoding (03-UI-SPEC §Crystarium Layout Contract):
//   radius = status funnel (center = secured/active, rim = frontier)
//   angle  = 501(c)(3) gate (front = open, rear-left = gated, side = unknown)
//   scale  = log-scaled representative amount (TBD → fixed minimal "raw-ore" crystal)

/** @typedef {import('../data/types').Grant} Grant */

// ── Locked constants (world units — tunable in Phase 5 polish; ship these) ──────────
const RING_RADIUS = { active: 0, applied: 6, 'in-progress': 11, 'to-research': 17, recurring: 9, dim: 20 };
const DOME_CURVE = 0.35; // elevation gain per unit radius
const SPREAD = 0.12; // deterministic angular fan step (radians, index-derived — NOT random)
const SCALE_MIN = 0.6;
const SCALE_MAX = 2.4;
const TBD_SCALE = 0.5; // "unformed raw-ore crystal" — never 0
const AMT_FLOOR = 500;
const AMT_CEIL = 200000;

const CENTER_ID = 'ny-community-trust';

// Statuses that fall to the dim outer arc (fallen off the dome).
const DIM_STATUSES = new Set(['declined', 'not-eligible', 'not-eligible-yet']);

// Sector base angles (radians) by requires501(c)(3) tri-state.
//   'no'      → "open now" front arc   (θ base 270°, span 200–340°)
//   'yes'     → "gated" rear-left arc  (θ base  80°, span  20–140°)
//   'unknown' → "unknown" side arc     (θ base 170°, span 140–200°)
const deg = (d) => (d * Math.PI) / 180;
const SECTOR_BASE = { no: deg(270), yes: deg(80), unknown: deg(170) };
// Deterministic cluster order when concatenating a ring's sectors for spine wiring.
const SECTOR_ORDER = ['no', 'yes', 'unknown'];

/** Bucket a grant status onto its layout ring. */
function ringOf(status) {
	if (DIM_STATUSES.has(status)) return 'dim';
	return status; // active | applied | in-progress | to-research | recurring
}

/** Representative amount for scale/order (explicit avg, else max, else min). */
const rep = (g) => g.amount.avg ?? g.amount.max ?? g.amount.min;

/** Log-scaled node size (CRYS-04). TBD → fixed minimal; quantified → log-lerp in [0.6, 2.4]. */
function scaleFor(g) {
	if (g.amount.isTBD) return TBD_SCALE;
	const a = Math.max(AMT_FLOOR, Math.min(AMT_CEIL, rep(g)));
	const t = (Math.log(a) - Math.log(AMT_FLOOR)) / (Math.log(AMT_CEIL) - Math.log(AMT_FLOOR));
	return SCALE_MIN + t * (SCALE_MAX - SCALE_MIN);
}

/** Larger crystals lift slightly so they read as "taller." */
const amountBump = (scale) => (scale - SCALE_MIN) * 0.5;

/**
 * Deterministic comparator within a (ring, sector) bucket:
 * representative amount desc, tie-break deadline.date asc (nulls last), final tie-break id asc.
 */
function bucketCompare(a, b) {
	const ra = rep(a.g) ?? -Infinity;
	const rb = rep(b.g) ?? -Infinity;
	if (rb !== ra) return rb - ra;
	const da = a.g.deadline.date;
	const db = b.g.deadline.date;
	if (da !== db) {
		if (da === null) return 1;
		if (db === null) return -1;
		return da < db ? -1 : 1;
	}
	return a.g.id < b.g.id ? -1 : a.g.id > b.g.id ? 1 : 0;
}

/**
 * Build the 28 positioned nodes.
 * @param {Grant[]} grants
 * @returns {{ nodes: any[], ringOrder: Record<string, string[]> }}
 */
function buildNodes(grants) {
	// Precompute ring/sector/scale/radius per grant.
	const enriched = grants.map((g) => {
		const ring = ringOf(g.status);
		const sector = g.requires501c3; // 'yes' | 'no' | 'unknown'
		return { g, ring, sector, scale: scaleFor(g), radius: RING_RADIUS[ring] };
	});

	// Group by (ring, sector), sort each bucket, assign a within-bucket index for the fan.
	const buckets = new Map();
	for (const e of enriched) {
		const key = `${e.ring}|${e.sector}`;
		if (!buckets.has(key)) buckets.set(key, []);
		buckets.get(key).push(e);
	}
	const themeIndex = new Map(); // grant id → { i, n }
	for (const list of buckets.values()) {
		list.sort(bucketCompare);
		const n = list.length;
		list.forEach((e, i) => themeIndex.set(e.g.id, { i, n }));
	}

	// Position every node.
	const nodeById = new Map();
	for (const e of enriched) {
		const { g, ring, sector, scale, radius } = e;
		const { i, n } = themeIndex.get(g.id);
		const theta = SECTOR_BASE[sector] + (i - (n - 1) / 2) * SPREAD;
		const bump = amountBump(scale);

		let x = 0;
		let z = 0;
		let y;
		if (radius === 0) {
			// Core: master crystal at the origin, low-center.
			x = 0;
			z = 0;
			y = bump;
		} else {
			x = radius * Math.cos(theta);
			z = radius * Math.sin(theta);
			if (ring === 'dim') {
				// Fallen off the dome: pushed below the core.
				y = -3 - bump;
			} else if (ring === 'recurring') {
				// Inclined satellite orbit: dome height + a small fixed +y tilt.
				y = radius * DOME_CURVE + bump + 2;
			} else {
				y = radius * DOME_CURVE + bump;
			}
		}

		const node = {
			id: g.id,
			x,
			y,
			z,
			scale,
			ring,
			sector,
			status: g.status,
			isTBD: g.amount.isTBD,
			isEquity: g.amount.isEquity,
			pulse: false, // set in the derivation pass below
			beamTarget: false // set in the derivation pass below
		};
		nodeById.set(g.id, node);
	}

	// Deterministic per-ring cluster order (sectors concatenated in SECTOR_ORDER, each sorted).
	const ringOrder = {};
	for (const [key, list] of buckets) {
		const [ring, sector] = key.split('|');
		if (!ringOrder[ring]) ringOrder[ring] = {};
		ringOrder[ring][sector] = list.map((e) => e.g.id);
	}
	const flatRingOrder = {};
	for (const ring of Object.keys(ringOrder)) {
		flatRingOrder[ring] = SECTOR_ORDER.flatMap((s) => ringOrder[ring][s] ?? []);
	}

	// Emit nodes in the original grants order for a stable, diff-friendly result.
	const nodes = grants.map((g) => nodeById.get(g.id));
	return { nodes, ringOrder: flatRingOrder };
}

/**
 * Compute the deterministic Crystarium layout.
 * (Task 1 scope: positions / rings / sectors / scale. Per-node pulse + beamTarget flags
 * and the spine/family/beam edges are derived in Task 2.)
 * @param {Grant[]} grants - the 28 typed grant records
 * @returns {{ nodes: any[], edges: any[], center: string }}
 */
export function computeLayout(grants) {
	const { nodes } = buildNodes(grants);
	return { nodes, edges: [], center: CENTER_ID };
}

export default computeLayout;
