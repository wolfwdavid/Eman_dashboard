// Canonical Grant data model for the Eman_dashboard grant pipeline.
// Single source of truth for record shape — mirrored by the zod schema in tools/schema.mjs.
// Every downstream Crystarium / HUD feature (Phase 3/4) imports these types.

export type GrantType = 'Grant' | 'Grant/Fellowship' | 'Investment';

export type GrantStatus =
	| 'active'
	| 'in-progress'
	| 'to-research'
	| 'recurring'
	| 'applied'
	| 'declined'
	| 'not-eligible'
	| 'not-eligible-yet';

export type Cadence =
	| 'rolling'
	| 'annual'
	| 'invitation'
	| 'one-time'
	| 'passed'
	| 'unknown';

export type Requires501c3 = 'yes' | 'no' | 'unknown';

export interface GrantAmount {
	raw: string;
	min: number | null;
	max: number | null;
	avg: number | null; // explicit "(avg $X)"; else midpoint of a full range; else null
	isReceived: boolean; // "(received 2025)" → banked, routes to securedTotal
	isTBD: boolean; // no numeric amount (TBD / Large / Fellowship support / Micro-only)
	isEquity: boolean; // 37 Angels — excluded from all grant sums
	isMicro: boolean; // "micro" / "Micro" flag (discretionary extra)
}

export interface GrantDeadline {
	raw: string;
	date: string | null; // ISO "YYYY-MM-DD" when a concrete leading date exists
	cadence: Cadence;
	note: string | null; // parenthetical / window / recheck text preserved verbatim
	isPassed: boolean; // literal "(passed)" marker — clock-independent
}

export interface Grant {
	id: string; // slug of the full "Funder / Program" cell (unique)
	funder: string;
	program: string | null; // text after first " - " in the cell, else null
	type: GrantType;
	amount: GrantAmount;
	deadline: GrantDeadline;
	requires501c3: Requires501c3;
	requires501c3Raw: string; // raw kept so a future 4-bucket chart can recover "Likely"/"fiscal sponsor"
	fit: string;
	status: GrantStatus;
	statusLabel: string; // human label kept ("Active funder", "Not eligible (yet)")
	nextAction: string | null; // "--" → null
	link: string; // validated http(s) URL
}
