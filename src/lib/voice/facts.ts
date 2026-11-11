// facts.ts - PURE selectors and phrases for voice "facts" commands.
// The clock is always injected (`now`); nothing here reads the real time, so
// output is deterministic and testable. Reads only public dashboard data.
import type { Grant } from '../data/types';
import { securedTotal, potentialTotal } from '../data/aggregates';

// Same exclusions as aggregates.ts NON_POTENTIAL_STATUSES: these rows are not live deadlines.
const NOT_LIVE = new Set<Grant['status']>(['declined', 'not-eligible', 'not-eligible-yet']);

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

const pad = (n: number) => String(n).padStart(2, '0');

// Private twin of the HUD formatter: '$' + en-US thousands separators, no cents.
const usd = (n: number): string => '$' + n.toLocaleString('en-US');

/** 'YYYY-MM-DD' -> 'December 3, 2026' by string split (no Date parsing, no UTC shift). */
export function formatLongDate(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Upcoming live deadlines: date >= today (local), not passed, eligible status; soonest first. */
export function nextDeadlines(grants: Grant[], now: Date, n = 3): Grant[] {
	const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	return grants
		.filter(
			(g) =>
				g.deadline.date !== null &&
				!g.deadline.isPassed &&
				g.deadline.date >= today &&
				!NOT_LIVE.has(g.status)
		)
		.sort((a, b) => {
			const da = a.deadline.date as string;
			const db = b.deadline.date as string;
			if (da !== db) return da < db ? -1 : 1;
			return a.funder < b.funder ? -1 : a.funder > b.funder ? 1 : 0;
		})
		.slice(0, n);
}

export function nextDeadlinesText(grants: Grant[], now: Date): string {
	const rows = nextDeadlines(grants, now);
	if (rows.length === 0) return 'No dated deadlines are coming up.';
	const parts = rows.map((g) => `${g.funder}, ${formatLongDate(g.deadline.date as string)}`);
	if (rows.length === 1) return `Next deadline: ${parts[0]}.`;
	return `Next deadlines: ${parts.join('; ')}.`;
}

export function securedText(grants: Grant[]): string {
	return `${usd(securedTotal(grants))} secured so far, out of ${usd(potentialTotal(grants))} potential.`;
}
