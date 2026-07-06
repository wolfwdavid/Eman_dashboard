// format.ts — PURE display helpers for the Detail Panel (DETL-02). Each returns
// human-readable text PLUS the preserved `.raw` string (shown as subtext). The
// deadline day-count takes an injectable `now` so "in N days" is deterministic
// in tests (Pitfall 4). No side effects; rule tables copied from 04-UI-SPEC.
import type { GrantAmount, GrantDeadline, Requires501c3 } from './types';

const usd = (n: number): string => '$' + n.toLocaleString('en-US');

/**
 * True when a formatted value's preserved `.raw` string carries no extra
 * information over the human-readable `.text` (they are identical modulo
 * surrounding whitespace). Lets the Detail Panel drop a duplicate subtext line
 * (DETL-02) instead of rendering the same string twice. Pure, no side effects —
 * generic over deadline and amount subtext.
 */
export const rawRedundant = (text: string, raw: string): boolean => text.trim() === raw.trim();

/** Human-readable amount + tone + preserved raw. Branch order is significant. */
export function formatAmount(a: GrantAmount): { text: string; tone: 'gold' | 'muted' | 'hi'; raw: string } {
	const raw = a.raw;
	if (a.isReceived) return { text: `Secured ${usd(a.avg ?? a.min ?? 0)}`, tone: 'gold', raw };
	if (a.isEquity) return { text: 'Equity investment', tone: 'muted', raw };
	if (a.isTBD) return { text: 'Amount TBD', tone: 'muted', raw };
	if (a.avg != null) return { text: `avg ${usd(a.avg)}`, tone: 'hi', raw };
	if (a.min != null && a.max != null) return { text: `${usd(a.min)}–${usd(a.max)}`, tone: 'hi', raw };
	if (a.min != null) return { text: `${usd(a.min)}+`, tone: 'hi', raw };
	if (a.max != null) return { text: `up to ${usd(a.max)}`, tone: 'hi', raw };
	return { text: raw, tone: 'muted', raw };
}

const DAY = 86_400_000;

/** Human-readable deadline + tone + preserved raw. `now` injectable for tests. */
export function formatDeadline(
	d: GrantDeadline,
	now = Date.now()
): { text: string; tone: string; raw: string } {
	const raw = d.raw;
	if (d.isPassed) return { text: 'Passed', tone: 'declined', raw };
	if (d.cadence === 'one-time' && d.date) {
		const days = Math.ceil((new Date(d.date).getTime() - now) / DAY);
		const tone = days < 30 ? 'urgent' : days <= 90 ? 'in-progress' : 'hi';
		return { text: `in ${days} days`, tone, raw };
	}
	if (d.cadence === 'rolling') return { text: d.note ? `Rolling · ${d.note}` : 'Rolling', tone: 'lo', raw };
	if (d.cadence === 'annual') return { text: 'Annual', tone: 'lo', raw };
	if (d.cadence === 'invitation') return { text: 'Invitation only', tone: 'lo', raw };
	return { text: d.note ?? 'Timing TBD', tone: 'lo', raw };
}

/** 501(c)(3) gate badge label + tone + fiscal-sponsor hint flag. */
export function gateBadge(
	requires501c3: Requires501c3,
	requires501c3Raw: string
): { label: string; tone: 'open' | 'gated' | 'unknown'; sponsorHint: boolean } {
	if (requires501c3 === 'no') return { label: 'Open now', tone: 'open', sponsorHint: false };
	if (requires501c3 === 'yes')
		return {
			label: 'Gated (501c3)',
			tone: 'gated',
			sponsorHint: /fiscal sponsor/i.test(requires501c3Raw)
		};
	return { label: 'Gate unknown', tone: 'unknown', sponsorHint: false };
}
