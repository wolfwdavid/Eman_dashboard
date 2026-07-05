// status.mjs — pure parseStatus(raw) + parse501c3(raw) normalizers (DATA-04).
// Turns the raw Status and 501(c)(3) Required cells in data/grants.csv into the
// canonical enums, keeping the human-readable label / raw string for later charts.
// Pure and importable: no fs, no side effects.

/** @typedef {import('../../src/lib/data/types').GrantStatus} GrantStatus */
/** @typedef {import('../../src/lib/data/types').Requires501c3} Requires501c3 */

// Exact 8-entry map: raw Status string → { status enum, human label }.
// The ONLY source of truth for status; an unmapped string must fail the build
// (never silently default to a fallback enum — that would hide a CSV typo /
// column shift). Keyed on the trimmed raw string so lookup is order-independent
// AND immune to the 'Not eligible' substring stealing 'Not eligible (yet)'.
const STATUS_MAP = {
	'Active funder': 'active',
	'In progress': 'in-progress',
	'To research': 'to-research',
	Recurring: 'recurring',
	Applied: 'applied',
	Declined: 'declined',
	'Not eligible (yet)': 'not-eligible-yet',
	'Not eligible': 'not-eligible'
};

/**
 * Map a raw Status cell to the fixed enum + preserved human label.
 * @param {string} raw
 * @returns {{ status: GrantStatus, statusLabel: string }}
 * @throws if the string is not one of the 8 known Status values.
 */
export function parseStatus(raw) {
	const label = (raw ?? '').trim();
	const status = STATUS_MAP[label];
	if (!status) {
		throw new Error(
			`parseStatus: unmapped Status ${JSON.stringify(raw)} — expected one of ${Object.keys(STATUS_MAP)
				.map((k) => JSON.stringify(k))
				.join(', ')}`
		);
	}
	return { status, statusLabel: label };
}

/**
 * Map a raw 501(c)(3) Required cell to the locked tri-state, preserving the raw.
 * Rules (checked in order):
 *   /^no\b/i                                    → 'no'
 *   /^yes\b/i | contains '(required)' | 'or fiscal sponsor' → 'yes'
 *   /^likely/i                                  → 'yes' (conservative — treat likely-gated as gated)
 *   /^unknown/i | empty                         → 'unknown'
 * requires501c3Raw always preserves the original string so a future 4-bucket
 * chart (No / Yes / Likely / Unknown) can recover the distinction.
 * @param {string} raw
 * @returns {{ requires501c3: Requires501c3, requires501c3Raw: string }}
 */
export function parse501c3(raw) {
	const requires501c3Raw = raw ?? '';
	const s = requires501c3Raw.trim();

	/** @type {Requires501c3} */
	let requires501c3;
	if (!s) requires501c3 = 'unknown';
	else if (/^no\b/i.test(s)) requires501c3 = 'no';
	else if (/^yes\b/i.test(s) || /\(required\)/i.test(s) || /or fiscal sponsor/i.test(s))
		requires501c3 = 'yes';
	else if (/^likely/i.test(s)) requires501c3 = 'yes';
	else requires501c3 = 'unknown';

	return { requires501c3, requires501c3Raw };
}
