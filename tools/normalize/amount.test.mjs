import { describe, it, expect } from 'vitest';
import { parseAmount } from './amount.mjs';

// One case per literal Amount string in the real 28-row data/grants.csv.
// Fields not shown in the rule table default to false; unshown numbers are null.
// Every case asserts min/max/avg AND all four flags explicitly.
const cases = [
	{
		raw: '$20,000 (received 2025)',
		min: 20000, max: 20000, avg: 20000,
		isReceived: true, isTBD: false, isEquity: false, isMicro: false
	},
	{
		raw: '$5,000-$20,000 (avg $10,000)',
		min: 5000, max: 20000, avg: 10000,
		isReceived: false, isTBD: false, isEquity: false, isMicro: false
	},
	{
		raw: '~$50,000-$200,000',
		min: 50000, max: 200000, avg: 125000,
		isReceived: false, isTBD: false, isEquity: false, isMicro: false
	},
	{
		raw: '$100,000+',
		min: 100000, max: null, avg: null,
		isReceived: false, isTBD: false, isEquity: false, isMicro: false
	},
	{
		raw: 'Up to $30,000 (avg $20,000)',
		min: null, max: 30000, avg: 20000,
		isReceived: false, isTBD: false, isEquity: false, isMicro: false
	},
	{
		raw: '$5,000-$35,000 (2-year)',
		min: 5000, max: 35000, avg: 20000,
		isReceived: false, isTBD: false, isEquity: false, isMicro: false
	},
	{
		raw: '$1,000',
		min: 1000, max: 1000, avg: 1000,
		isReceived: false, isTBD: false, isEquity: false, isMicro: false
	},
	{
		raw: 'Micro (amount TBD)',
		min: null, max: null, avg: null,
		isReceived: false, isTBD: true, isEquity: false, isMicro: true
	},
	{
		raw: '$500 (micro)',
		min: 500, max: 500, avg: 500,
		isReceived: false, isTBD: false, isEquity: false, isMicro: true
	},
	{
		raw: 'Up to $10,000 (community); $1,000/youth project',
		min: null, max: 10000, avg: 10000,
		isReceived: false, isTBD: false, isEquity: false, isMicro: false
	},
	{
		raw: 'Up to $10,000',
		min: null, max: 10000, avg: 10000,
		isReceived: false, isTBD: false, isEquity: false, isMicro: false
	},
	{
		raw: '$2,000-$6,000',
		min: 2000, max: 6000, avg: 4000,
		isReceived: false, isTBD: false, isEquity: false, isMicro: false
	},
	{
		raw: 'TBD (includes AI access)',
		min: null, max: null, avg: null,
		isReceived: false, isTBD: true, isEquity: false, isMicro: false
	},
	{
		raw: '$10,000',
		min: 10000, max: 10000, avg: 10000,
		isReceived: false, isTBD: false, isEquity: false, isMicro: false
	},
	{
		raw: 'Fellowship support',
		min: null, max: null, avg: null,
		isReceived: false, isTBD: true, isEquity: false, isMicro: false
	},
	{
		raw: 'TBD',
		min: null, max: null, avg: null,
		isReceived: false, isTBD: true, isEquity: false, isMicro: false
	},
	{
		raw: 'Large',
		min: null, max: null, avg: null,
		isReceived: false, isTBD: true, isEquity: false, isMicro: false
	},
	{
		raw: 'Equity investment',
		min: null, max: null, avg: null,
		isReceived: false, isTBD: true, isEquity: true, isMicro: false
	}
];

describe('parseAmount — every literal CSV amount string', () => {
	for (const c of cases) {
		it(`parses ${JSON.stringify(c.raw)}`, () => {
			const a = parseAmount(c.raw);
			expect(a.raw).toBe(c.raw);
			expect(a.min).toBe(c.min);
			expect(a.max).toBe(c.max);
			expect(a.avg).toBe(c.avg);
			expect(a.isReceived).toBe(c.isReceived);
			expect(a.isTBD).toBe(c.isTBD);
			expect(a.isEquity).toBe(c.isEquity);
			expect(a.isMicro).toBe(c.isMicro);
		});
	}
});

describe('parseAmount — coerce-to-0 anti-regression (never 0 for missing)', () => {
	for (const raw of ['TBD', 'Large', 'Equity investment', 'Fellowship support', 'Micro (amount TBD)']) {
		it(`${JSON.stringify(raw)} → numbers null, never 0`, () => {
			const a = parseAmount(raw);
			expect(a.min).toBeNull();
			expect(a.max).toBeNull();
			expect(a.avg).toBeNull();
			expect(a.min).not.toBe(0);
			expect(a.max).not.toBe(0);
			expect(a.avg).not.toBe(0);
			expect(a.isTBD).toBe(true);
		});
	}
});
