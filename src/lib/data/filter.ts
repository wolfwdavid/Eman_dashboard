// filter.ts — the ONE pure filter predicate, imported by BOTH the scene
// (CrystalNode dim + raycast guard) and the UI (charts / filter bar / list), so
// scene-dim logic and chart logic agree by construction. Pure, no side effects.
import type { Grant } from './types';

/**
 * The three-axis filter shape carried by `ui.filter`. Fields are plain strings
 * because filter values originate as strings from the DOM filter chips; the
 * comments document the allowed values each axis accepts.
 */
export type FilterState = {
	status: string; // GrantStatus | 'all'
	gate: string; // 'all' | 'open' | 'gated' | 'unknown'
	type: string; // 'all' | 'Grant' | 'Fellowship' | 'Investment'
};

/** Map the 501(c)(3) tri-state to a filter gate bucket. */
export const gateBucket = (g: Grant): 'open' | 'gated' | 'unknown' =>
	g.requires501c3 === 'no' ? 'open' : g.requires501c3 === 'yes' ? 'gated' : 'unknown';

/** Collapse the grant type into the 3 filterable buckets. */
export const typeBucket = (g: Grant): 'Grant' | 'Fellowship' | 'Investment' =>
	g.type === 'Grant/Fellowship' ? 'Fellowship' : g.type;

/**
 * True when the grant satisfies ALL active axes. An 'all' axis is a wildcard, so
 * `{ status:'all', gate:'all', type:'all' }` matches every grant.
 */
export function matchesFilter(g: Grant, f: FilterState): boolean {
	return (
		(f.status === 'all' || g.status === f.status) &&
		(f.gate === 'all' || gateBucket(g) === f.gate) &&
		(f.type === 'all' || typeBucket(g) === f.type)
	);
}
