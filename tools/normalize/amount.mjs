// amount.mjs — pure parseAmount(raw) → GrantAmount struct (DATA-02).
// Turns every messy Amount cell in data/grants.csv into a typed struct.
// CRITICAL: a missing number is `null`, NEVER 0 — coercing TBD/qualitative
// amounts to 0 silently corrupts the "secured vs. potential" headline totals.
// Pure and importable: no fs, no side effects.

/** @typedef {import('../../src/lib/data/types').GrantAmount} GrantAmount */

const NUM = (s) => Number(s.replace(/,/g, ''));

/**
 * @param {string} raw
 * @returns {GrantAmount}
 */
export function parseAmount(raw) {
	const s = (raw ?? '').trim();

	const isReceived = /\(received/i.test(s);
	const isMicro = /micro/i.test(s);
	const isEquity = /equity/i.test(s);

	// Extract every "$<digits>" figure (strip $ and commas). A leading "~" or
	// trailing "+" are matched separately; bare years like "2025" have no "$"
	// so they are never captured as amounts.
	const tokens = [...s.matchAll(/\$\s?([\d,]+)/g)].map((m) => NUM(m[1]));

	// Zero numeric figures → qualitative / TBD. All numbers null, isTBD=true.
	if (tokens.length === 0) {
		return { raw: s, min: null, max: null, avg: null, isReceived, isTBD: true, isEquity, isMicro };
	}

	const avgMatch = s.match(/avg\s*\$\s?([\d,]+)/i);
	const explicitAvg = avgMatch ? NUM(avgMatch[1]) : null;

	const isUpTo = /up to/i.test(s);
	const isPlus = /\+/.test(s);

	let min = null;
	let max = null;
	let avg = null;

	if (isUpTo) {
		// "Up to $X" → max-only. Take the figure right after "Up to" as the max;
		// ignore any trailing figures (e.g. "; $1,000/youth project").
		const upTo = s.match(/up to\s*\$\s?([\d,]+)/i);
		max = upTo ? NUM(upTo[1]) : tokens[0];
		min = null;
		avg = explicitAvg != null ? explicitAvg : max;
	} else if (isPlus) {
		// "$X+" → open-ended: min only, no upper estimate.
		min = tokens[0];
		max = null;
		avg = null;
	} else if (tokens.length >= 2) {
		// Range "A-B" → min=A, max=B; explicit "(avg $X)" overrides the midpoint.
		min = tokens[0];
		max = tokens[1];
		avg = explicitAvg != null ? explicitAvg : Math.round((min + max) / 2);
	} else {
		// Single figure → min=max=avg.
		min = max = avg = tokens[0];
	}

	return { raw: s, min, max, avg, isReceived, isTBD: false, isEquity, isMicro };
}
