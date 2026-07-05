// aggregates.mjs — pure selectors over Grant[] (DATA-01/04 support).
// The headline numbers (secured vs. potential) are computed here BY RULE, not
// baked as magic numbers into the JSON, so the Phase 4 HUD can recompute them
// under filters. Imported by both the tool tests and (later) the app.
// Pure and importable: no fs, no side effects.

/** @typedef {import('../src/lib/data/types').Grant} Grant */

// Statuses that disqualify a row from the "potential" pipeline entirely.
const NON_POTENTIAL_STATUSES = new Set(['declined', 'not-eligible', 'not-eligible-yet']);

/**
 * Single best numeric estimate for a row: explicit/derived avg, else the max
 * (e.g. "Up to $X"), else the min (e.g. "$X+"). null when no figure exists.
 * @param {Grant} g
 * @returns {number | null}
 */
export function estimate(g) {
	const { avg, max, min } = g.amount;
	return avg ?? max ?? min ?? null;
}

/**
 * Σ of banked amounts — rows flagged amount.isReceived.
 * Uses the single received figure (avg === min === max for received rows).
 * @param {Grant[]} grants
 * @returns {number}  20000 for the current dataset (NY Community Trust only).
 */
export function securedTotal(grants) {
	return grants
		.filter((g) => g.amount.isReceived)
		.reduce((sum, g) => sum + (g.amount.avg ?? estimate(g) ?? 0), 0);
}

/**
 * Rows that contribute to potentialTotal — partitioned BY RULE:
 *   not received (that's secured), not equity, status not declined/ineligible,
 *   and a non-null numeric estimate.
 * @param {Grant[]} grants
 * @returns {Grant[]}
 */
export function potentialContributors(grants) {
	return grants.filter(
		(g) =>
			!g.amount.isReceived &&
			!g.amount.isEquity &&
			!NON_POTENTIAL_STATUSES.has(g.status) &&
			estimate(g) !== null
	);
}

/**
 * Σ estimate over the potential contributors.
 * @param {Grant[]} grants
 * @returns {number}  296500 for the current dataset.
 */
export function potentialTotal(grants) {
	return potentialContributors(grants).reduce((sum, g) => sum + estimate(g), 0);
}

/**
 * Group-count by status enum.
 * @param {Grant[]} grants
 * @returns {Record<string, number>}
 */
export function countByStatus(grants) {
	const out = {};
	for (const g of grants) out[g.status] = (out[g.status] ?? 0) + 1;
	return out;
}

/**
 * Group-count by the 501c3 tri-state.
 * @param {Grant[]} grants
 * @returns {Record<string, number>}
 */
export function by501c3(grants) {
	const out = {};
	for (const g of grants) out[g.requires501c3] = (out[g.requires501c3] ?? 0) + 1;
	return out;
}
