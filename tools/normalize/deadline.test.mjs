import { describe, it, expect } from 'vitest';
import { parseDeadline } from './deadline.mjs';

// One case per literal Deadline string in the real 28-row data/grants.csv.
// Exact { date, cadence, note, isPassed }; raw is the echoed trimmed input.
const cases = [
	{ raw: 'Annual relationship', date: null, cadence: 'annual', note: 'relationship', isPassed: false },
	{ raw: '2026-06-30 (decision by Oct 31)', date: '2026-06-30', cadence: 'one-time', note: 'decision by Oct 31', isPassed: false },
	{ raw: '2026-09-01', date: '2026-09-01', cadence: 'one-time', note: null, isPassed: false },
	{ raw: 'Check 2026 cycle (awards Dec-Feb)', date: null, cadence: 'unknown', note: 'Check 2026 cycle (awards Dec-Feb)', isPassed: false },
	{ raw: '2027-02-18 (2026 cycle passed)', date: '2027-02-18', cadence: 'one-time', note: '2026 cycle passed', isPassed: false },
	{ raw: 'Invitation only', date: null, cadence: 'invitation', note: null, isPassed: false },
	{ raw: 'Rolling (monthly)', date: null, cadence: 'rolling', note: 'monthly', isPassed: false },
	{ raw: 'Rolling (monthly review)', date: null, cadence: 'rolling', note: 'monthly review', isPassed: false },
	{ raw: 'Cycle open (2026)', date: null, cadence: 'unknown', note: 'Cycle open (2026)', isPassed: false },
	{ raw: 'Opens ~Oct 31-Nov 30; awards Dec', date: null, cadence: 'unknown', note: 'Opens ~Oct 31-Nov 30; awards Dec', isPassed: false },
	{ raw: 'Opens ~Oct 2026', date: null, cadence: 'unknown', note: 'Opens ~Oct 2026', isPassed: false },
	{ raw: 'Ongoing (recheck 2026-03-01)', date: null, cadence: 'rolling', note: 'recheck 2026-03-01', isPassed: false },
	{ raw: 'Reapply Jan 2026', date: null, cadence: 'unknown', note: 'Reapply Jan 2026', isPassed: false },
	{ raw: '2025-12-30 (passed)', date: '2025-12-30', cadence: 'passed', note: 'passed', isPassed: true },
	{ raw: 'Annual', date: null, cadence: 'annual', note: null, isPassed: false },
	{ raw: 'TBD', date: null, cadence: 'unknown', note: null, isPassed: false },
	{ raw: 'Rolling', date: null, cadence: 'rolling', note: null, isPassed: false },
	{ raw: 'Open calls', date: null, cadence: 'unknown', note: 'Open calls', isPassed: false },
	{ raw: '2025 cycle (recheck)', date: null, cadence: 'unknown', note: '2025 cycle (recheck)', isPassed: false },
	{ raw: '--', date: null, cadence: 'unknown', note: null, isPassed: false }
];

describe('parseDeadline — every literal CSV deadline string', () => {
	for (const c of cases) {
		it(`parses ${JSON.stringify(c.raw)}`, () => {
			const d = parseDeadline(c.raw);
			expect(d.raw).toBe(c.raw);
			expect(d.date).toBe(c.date);
			expect(d.cadence).toBe(c.cadence);
			expect(d.note).toBe(c.note);
			expect(d.isPassed).toBe(c.isPassed);
		});
	}
});

describe('parseDeadline — isPassed is the exact "(passed)" marker only (Open Q1)', () => {
	it('"2025-12-30 (passed)" is the ONLY isPassed:true', () => {
		const d = parseDeadline('2025-12-30 (passed)');
		expect(d.isPassed).toBe(true);
		expect(d.date).toBe('2025-12-30');
		expect(d.cadence).toBe('passed');
	});
	it('"2027-02-18 (2026 cycle passed)" is NOT isPassed (note says cycle, not the marker)', () => {
		const d = parseDeadline('2027-02-18 (2026 cycle passed)');
		expect(d.isPassed).toBe(false);
		expect(d.date).toBe('2027-02-18');
	});
	it('exactly one literal string across the CSV yields isPassed:true', () => {
		const passedCount = cases.filter((c) => parseDeadline(c.raw).isPassed).length;
		expect(passedCount).toBe(1);
	});
});
