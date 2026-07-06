// Tests for the pure display formatters (DETL-02). Every branch returns the
// human-readable text PLUS the preserved `.raw`. Day-count is clock-injected
// (Pitfall 4) so "in N days" is deterministic. Keyed to real records where a
// real record exercises the branch; synthetic GrantAmount only where no real
// row hits a branch (min&&max-without-avg, max-only-without-avg).
import { describe, it, expect } from 'vitest';
import { grants } from '$lib/data';
import type { GrantAmount } from './types';
import { formatAmount, formatDeadline, gateBadge } from './format';

const g = (id: string) => grants.find((x) => x.id === id)!;
const amt = (over: Partial<GrantAmount>): GrantAmount => ({
	raw: 'x',
	min: null,
	max: null,
	avg: null,
	isReceived: false,
	isTBD: false,
	isEquity: false,
	isMicro: false,
	...over
});

describe('formatAmount — all branches, raw always preserved', () => {
	it('isReceived → "Secured $20,000" gold', () => {
		const a = g('ny-community-trust').amount;
		const r = formatAmount(a);
		expect(r).toMatchObject({ text: 'Secured $20,000', tone: 'gold' });
		expect(r.raw).toBe(a.raw);
	});
	it('isEquity → "Equity investment" muted', () => {
		const a = g('37-angels').amount;
		const r = formatAmount(a);
		expect(r).toMatchObject({ text: 'Equity investment', tone: 'muted' });
		expect(r.raw).toBe(a.raw);
	});
	it('isTBD → "Amount TBD" muted', () => {
		const a = g('tgr-foundation').amount;
		const r = formatAmount(a);
		expect(r).toMatchObject({ text: 'Amount TBD', tone: 'muted' });
		expect(r.raw).toBe(a.raw);
	});
	it('avg branch → "avg $10,000" hi', () => {
		const a = g('harry-s-black-allon-fuller-fund-bank-of-america').amount;
		const r = formatAmount(a);
		expect(r).toMatchObject({ text: 'avg $10,000', tone: 'hi' });
		expect(r.raw).toBe(a.raw);
	});
	it('min && max (avg null) → "$min–$max" hi', () => {
		const a = amt({ raw: '$5,000-$35,000 (2-year)', min: 5000, max: 35000 });
		const r = formatAmount(a);
		expect(r).toMatchObject({ text: '$5,000–$35,000', tone: 'hi', raw: a.raw });
	});
	it('min only → "$100,000+" hi', () => {
		const a = g('ford-foundation-nyc-good-neighbor-committee').amount;
		const r = formatAmount(a);
		expect(r).toMatchObject({ text: '$100,000+', tone: 'hi' });
		expect(r.raw).toBe(a.raw);
	});
	it('max only → "up to $10,000" hi', () => {
		const a = amt({ raw: 'Up to $10,000', max: 10000 });
		const r = formatAmount(a);
		expect(r).toMatchObject({ text: 'up to $10,000', tone: 'hi', raw: a.raw });
	});
});

describe('formatDeadline — clock-injected day count + cadence branches', () => {
	it('isPassed → "Passed" tone declined', () => {
		const d = g('hey-helen-grant').deadline;
		const r = formatDeadline(d, Date.UTC(2026, 0, 1));
		expect(r).toMatchObject({ text: 'Passed', tone: 'declined', raw: d.raw });
	});
	it('one-time future <30d → "in 20 days" urgent', () => {
		const d = g('harry-s-black-allon-fuller-fund-bank-of-america').deadline; // 2026-06-30
		const r = formatDeadline(d, Date.UTC(2026, 5, 10)); // 2026-06-10
		expect(r).toMatchObject({ text: 'in 20 days', tone: 'urgent', raw: d.raw });
	});
	it('one-time future ≤90d → "in 60 days" in-progress', () => {
		const d = g('harry-s-black-allon-fuller-fund-bank-of-america').deadline; // 2026-06-30
		const r = formatDeadline(d, Date.UTC(2026, 4, 1)); // 2026-05-01
		expect(r).toMatchObject({ text: 'in 60 days', tone: 'in-progress', raw: d.raw });
	});
	it('one-time future >90d → tone hi', () => {
		const d = g('harry-s-black-allon-fuller-fund-bank-of-america').deadline; // 2026-06-30
		const r = formatDeadline(d, Date.UTC(2026, 0, 1)); // 2026-01-01
		expect(r.tone).toBe('hi');
		expect(r.text).toMatch(/^in \d+ days$/);
	});
	it('rolling with note → "Rolling · monthly"', () => {
		const d = g('the-awesome-foundation-disability-chapter').deadline;
		expect(formatDeadline(d, 0)).toMatchObject({ text: 'Rolling · monthly', raw: d.raw });
	});
	it('rolling without note → "Rolling"', () => {
		const d = g('w-k-kellogg-foundation').deadline;
		expect(formatDeadline(d, 0).text).toBe('Rolling');
	});
	it('annual → "Annual"', () => {
		const d = g('echoing-green-fellowship').deadline;
		expect(formatDeadline(d, 0).text).toBe('Annual');
	});
	it('invitation → "Invitation only"', () => {
		const d = g('third-wave-fund-disability-frontlines-fund').deadline;
		expect(formatDeadline(d, 0).text).toBe('Invitation only');
	});
	it('unknown with note → note text', () => {
		const d = g('ford-foundation-nyc-good-neighbor-committee').deadline;
		expect(formatDeadline(d, 0).text).toBe(d.note);
	});
	it('unknown without note → "Timing TBD"', () => {
		const d = g('tgr-foundation').deadline;
		expect(formatDeadline(d, 0).text).toBe('Timing TBD');
	});
});

describe('gateBadge', () => {
	it("'no' → Open now, no sponsor hint", () => {
		expect(gateBadge('no', 'No')).toMatchObject({ label: 'Open now', tone: 'open', sponsorHint: false });
	});
	it("'yes' + fiscal sponsor raw → Gated with sponsor hint", () => {
		expect(gateBadge('yes', 'Yes - or fiscal sponsor')).toMatchObject({
			label: 'Gated (501c3)',
			tone: 'gated',
			sponsorHint: true
		});
	});
	it("'yes' without fiscal sponsor → Gated, no hint", () => {
		expect(gateBadge('yes', 'Yes (required)')).toMatchObject({ tone: 'gated', sponsorHint: false });
	});
	it("'unknown' → Gate unknown", () => {
		expect(gateBadge('unknown', 'Unknown')).toMatchObject({ label: 'Gate unknown', tone: 'unknown' });
	});
});
