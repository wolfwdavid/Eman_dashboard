// deadline.mjs — pure parseDeadline(raw) → GrantDeadline struct (DATA-03).
// Turns every messy Deadline cell in data/grants.csv into a typed struct.
// CRITICAL: never hand a whole cell to the Date constructor — non-ISO strings
// like "2026-06-30 (decision by Oct 31)" produce Invalid Date and make every
// row read as maximally urgent. Extract a LEADING ISO date via regex first,
// then classify the remainder. isPassed is the literal "(passed)" marker only
// (clock-independent → deterministic tests). Pure and importable.

/** @typedef {import('../../src/lib/data/types').GrantDeadline} GrantDeadline */
/** @typedef {import('../../src/lib/data/types').Cadence} Cadence */

/**
 * @param {string} raw
 * @returns {GrantDeadline}
 */
export function parseDeadline(raw) {
	const s = (raw ?? '').trim();
	if (!s || s === '--') {
		return { raw: s, date: null, cadence: 'unknown', note: null, isPassed: false };
	}

	// Leading ISO date only — regex, never Date(). Bare years / "Oct 31" etc. don't match.
	const dateMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
	const date = dateMatch ? dateMatch[1] : null;

	// First parenthetical content, if any.
	const paren = s.match(/\(([^)]*)\)/)?.[1] ?? null;

	// Exact "(passed)" at end of string — only Hey Helen. "(2026 cycle passed)" does NOT match.
	const isPassed = /\(passed\)$/.test(s);

	/** @type {Cadence} */
	let cadence;
	if (isPassed) cadence = 'passed';
	else if (date) cadence = 'one-time';
	else if (/rolling|ongoing/i.test(s)) cadence = 'rolling';
	else if (/annual/i.test(s)) cadence = 'annual';
	else if (/invitation/i.test(s)) cadence = 'invitation';
	else cadence = 'unknown';

	let note;
	if (date || cadence === 'passed' || cadence === 'rolling') {
		// Concrete-date rows and rolling rows carry the parenthetical text (or null).
		note = paren;
	} else if (cadence === 'annual') {
		// "Annual relationship" → "relationship"; bare "Annual" → null.
		const rest = s.replace(/annual/i, '').trim();
		note = rest.length ? rest : null;
	} else if (cadence === 'invitation') {
		// "Invitation only" → no descriptive note.
		note = null;
	} else {
		// unknown cadence: descriptive strings preserve the whole raw; bare "TBD" → null.
		note = s === 'TBD' ? null : s;
	}

	return { raw: s, date, cadence, note, isPassed };
}
