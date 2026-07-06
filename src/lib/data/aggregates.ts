// aggregates.ts — PURE selectors over Grant[] (browser/TS twin of
// tools/aggregates.mjs). The headline numbers (secured vs. potential) are
// computed HERE BY RULE, not baked as magic numbers into the JSON, so the
// Phase-4 HUD can recompute them under filters. This is the single source of
// truth for the HUD figures — logic is mirrored EXACTLY from the Node tool so a
// parity test forbids drift. Pure and importable: no fs, no side effects.
import type { Grant } from './types';

// Statuses that disqualify a row from the "potential" pipeline entirely.
const NON_POTENTIAL_STATUSES = new Set<Grant['status']>([
	'declined',
	'not-eligible',
	'not-eligible-yet'
]);

/**
 * Single best numeric estimate for a row: explicit/derived avg, else the max
 * (e.g. "Up to $X"), else the min (e.g. "$X+"). null when no figure exists.
 */
export const estimate = (g: Grant): number | null => {
	const { avg, max, min } = g.amount;
	return avg ?? max ?? min ?? null;
};

/**
 * Σ of banked amounts — rows flagged amount.isReceived.
 * Uses the single received figure (avg === min === max for received rows).
 * → 20000 for the current dataset (NY Community Trust only).
 */
export const securedTotal = (grants: Grant[]): number =>
	grants
		.filter((g) => g.amount.isReceived)
		.reduce((sum, g) => sum + (g.amount.avg ?? estimate(g) ?? 0), 0);

/**
 * Rows that contribute to potentialTotal — partitioned BY RULE:
 *   not received (that's secured), not equity, status not declined/ineligible,
 *   and a non-null numeric estimate.
 * → 9 rows for the current dataset.
 */
export const potentialContributors = (grants: Grant[]): Grant[] =>
	grants.filter(
		(g) =>
			!g.amount.isReceived &&
			!g.amount.isEquity &&
			!NON_POTENTIAL_STATUSES.has(g.status) &&
			estimate(g) !== null
	);

/**
 * Σ estimate over the potential contributors.
 * → 296500 for the current dataset.
 */
export const potentialTotal = (grants: Grant[]): number =>
	potentialContributors(grants).reduce((sum, g) => sum + estimate(g)!, 0);

/** Group-count by status enum. */
export const countByStatus = (grants: Grant[]): Record<string, number> => {
	const out: Record<string, number> = {};
	for (const g of grants) out[g.status] = (out[g.status] ?? 0) + 1;
	return out;
};

/** Group-count by the 501c3 tri-state. */
export const by501c3 = (grants: Grant[]): Record<string, number> => {
	const out: Record<string, number> = {};
	for (const g of grants) out[g.requires501c3] = (out[g.requires501c3] ?? 0) + 1;
	return out;
};
