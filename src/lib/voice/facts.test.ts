// Tests for the pure voice facts selectors. The clock is always injected.
import { describe, it, expect } from 'vitest';
import { grants } from '$lib/data';
import type { Grant } from '$lib/data/types';
import { securedTotal, potentialTotal } from '$lib/data/aggregates';
import { nextDeadlines, nextDeadlinesText, securedText, formatLongDate } from './facts';

const NOW = new Date(2026, 10, 10); // Nov 10 2026, local

function g(over: Partial<Grant> & { date?: string | null; isPassed?: boolean }): Grant {
	const { date = null, isPassed = false, ...rest } = over;
	return {
		id: rest.id ?? 'x',
		funder: rest.funder ?? 'X',
		program: null,
		type: 'Grant',
		amount: {
			raw: '',
			min: null,
			max: null,
			avg: null,
			isReceived: false,
			isTBD: true,
			isEquity: false,
			isMicro: false
		},
		deadline: { raw: '', date, cadence: 'annual', note: null, isPassed },
		requires501c3: 'no',
		requires501c3Raw: 'No',
		fit: '',
		status: 'to-research',
		statusLabel: '',
		nextAction: null,
		link: 'https://example.org',
		template: null,
		...rest
	} as Grant;
}

describe('formatLongDate', () => {
	it('formats without Date parsing', () => {
		expect(formatLongDate('2026-12-03')).toBe('December 3, 2026');
		expect(formatLongDate('2027-02-18')).toBe('February 18, 2027');
		expect(formatLongDate('2026-01-01')).toBe('January 1, 2026');
	});
});

describe('nextDeadlines', () => {
	it('includes today and excludes yesterday even when isPassed is false', () => {
		const rows = [
			g({ id: 'a', funder: 'A', date: '2026-11-10' }),
			g({ id: 'b', funder: 'B', date: '2026-11-09' })
		];
		expect(nextDeadlines(rows, NOW).map((r) => r.id)).toEqual(['a']);
	});

	it('excludes isPassed, null dates and disqualifying statuses', () => {
		const rows = [
			g({ id: 'p', date: '2027-01-01', isPassed: true }),
			g({ id: 'n', date: null }),
			g({ id: 'd', date: '2027-01-01', status: 'declined' }),
			g({ id: 'ne', date: '2027-01-01', status: 'not-eligible' }),
			g({ id: 'ney', date: '2027-01-01', status: 'not-eligible-yet' }),
			g({ id: 'ok', date: '2027-01-01' })
		];
		expect(nextDeadlines(rows, NOW).map((r) => r.id)).toEqual(['ok']);
	});

	it('sorts by date then funder and caps at n', () => {
		const rows = [
			g({ id: '3', funder: 'C', date: '2027-03-01' }),
			g({ id: '2b', funder: 'B', date: '2027-02-01' }),
			g({ id: '2a', funder: 'A', date: '2027-02-01' }),
			g({ id: '1', funder: 'Z', date: '2026-12-01' })
		];
		expect(nextDeadlines(rows, NOW).map((r) => r.id)).toEqual(['1', '2a', '2b']);
		expect(nextDeadlines(rows, NOW, 2)).toHaveLength(2);
	});

	it('real dataset on Nov 10 2026: North Star Fund then Ben & Jerrys', () => {
		const out = nextDeadlines(grants, NOW);
		expect(out.map((r) => r.id)).toEqual([
			'north-star-fund-nyc-organizing-grants',
			'ben-jerry-s-foundation-jerry-greenfield-grassroots-organizing'
		]);
	});

	it('does not depend on the real clock', () => {
		expect(nextDeadlines(grants, new Date(2030, 0, 1))).toEqual([]);
	});
});

describe('nextDeadlinesText', () => {
	it('phrases 0, 1, 2 and 3 rows', () => {
		expect(nextDeadlinesText([], NOW)).toBe('No dated deadlines are coming up.');
		const one = [g({ funder: 'A', date: '2026-12-03' })];
		expect(nextDeadlinesText(one, NOW)).toBe('Next deadline: A, December 3, 2026.');
		const two = [...one, g({ funder: 'B', date: '2027-02-18' })];
		expect(nextDeadlinesText(two, NOW)).toBe(
			'Next deadlines: A, December 3, 2026; B, February 18, 2027.'
		);
		const three = [...two, g({ funder: 'C', date: '2027-03-01' })];
		expect(nextDeadlinesText(three, NOW)).toBe(
			'Next deadlines: A, December 3, 2026; B, February 18, 2027; C, March 1, 2027.'
		);
	});

	it('real dataset phrasing', () => {
		expect(nextDeadlinesText(grants, NOW)).toBe(
			"Next deadlines: North Star Fund, December 3, 2026; Ben & Jerry's Foundation, February 18, 2027."
		);
	});
});

describe('securedText', () => {
	it('matches the HUD aggregates for the real dataset', () => {
		// $296,500 was the potential total when the plan was written; the dataset has since
		// grown to 491,500. Pin to the aggregates so the text can never drift from the HUD.
		expect(securedTotal(grants)).toBe(20000);
		expect(potentialTotal(grants)).toBe(491500);
		expect(securedText(grants)).toBe('$20,000 secured so far, out of $491,500 potential.');
	});

	it('formats other values with thousands separators and no cents', () => {
		const rows = [
			g({
				amount: {
					raw: '',
					min: 1234567,
					max: 1234567,
					avg: 1234567,
					isReceived: true,
					isTBD: false,
					isEquity: false,
					isMicro: false
				}
			})
		];
		expect(securedText(rows)).toBe('$1,234,567 secured so far, out of $0 potential.');
	});
});
