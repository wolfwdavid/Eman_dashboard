// commands.ts - PURE voice command grammar for the dashboard assistant.
// No browser globals and no store imports: it runs in node (vitest)
// and during prerender. `parse(raw, ctx)` turns a transcript into an Intent.
//
// Precedence (first hit wins; this order prevents "open ford" / "show open
// grants" / "show recurring grants" collisions):
//   1. pending follow-up   ("the second one", "neither")   - only when ctx.pending is set
//   2. system phrases      (reset, close, panels, facts)   - anchored whole-phrase matches
//   3. filter vocabulary   (show|only|... <closed set>)    - closed sets only
//   4. navigate            (open|show|go to <funder>)      - fuzzy funder matcher
//   5. chat                (everything else, original text)
//
// To teach the assistant a new spoken phrase, add it to one of the exported
// tables below (see HOW-TO-UPDATE.md). Tables map normalized phrases (lowercase,
// no punctuation) to dashboard values.
import type { Grant } from '../data/types';

export type PendingOption = { id: string; label: string };
export type Ctx = { grants: Grant[]; pending?: PendingOption[] };
export type Intent =
	| { kind: 'filter'; axis: 'status' | 'gate' | 'type'; value: string; label: string }
	| { kind: 'reset' }
	| { kind: 'open-grant'; id: string; label: string }
	| { kind: 'did-you-mean'; options: PendingOption[] } // 2 or 3 options, never more
	| { kind: 'panel'; name: 'templates' | 'share' }
	| { kind: 'close' }
	| { kind: 'fact'; fact: 'next-deadlines' | 'secured' }
	| { kind: 'cancel-pending' }
	| { kind: 'chat'; text: string };

// ---------------------------------------------------------------------------
// Closed vocabularies
// ---------------------------------------------------------------------------

/** Allowed values per filter axis (mirrors filter.ts / FilterBar.svelte). */
export const FILTER_VALUES = {
	status: [
		'all',
		'active',
		'in-progress',
		'applied',
		'recurring',
		'to-research',
		'not-eligible-yet',
		'not-eligible',
		'declined'
	],
	gate: ['all', 'open', 'gated', 'unknown'],
	type: ['all', 'Grant', 'Fellowship', 'Investment']
} as const;

export const STATUS_SYNONYMS: Record<string, string> = {
	recurring: 'recurring',
	active: 'active',
	'in progress': 'in-progress',
	applied: 'applied',
	'to research': 'to-research',
	research: 'to-research',
	declined: 'declined',
	'not eligible yet': 'not-eligible-yet',
	'not yet eligible': 'not-eligible-yet',
	'not eligible': 'not-eligible',
	ineligible: 'not-eligible'
};

export const GATE_SYNONYMS: Record<string, string> = {
	open: 'open',
	'no 501c3': 'open',
	'no 501c3 required': 'open',
	gated: 'gated',
	'needs 501c3': 'gated',
	'requires 501c3': 'gated',
	'501c3 required': 'gated',
	unknown: 'unknown'
};

export const TYPE_SYNONYMS: Record<string, string> = {
	grants: 'Grant',
	grant: 'Grant',
	fellowships: 'Fellowship',
	fellowship: 'Fellowship',
	investments: 'Investment',
	investment: 'Investment'
};

export const RESET_PHRASES: string[] = [
	'reset',
	'reset filters',
	'clear filters',
	'clear all',
	'clear',
	'show all',
	'show all grants',
	'show all funders',
	'show everything',
	'everything'
];

export const CLOSE_PHRASES: string[] = [
	'close',
	'close that',
	'close this',
	'close panel',
	'go back',
	'dismiss'
];

export const PANEL_PHRASES: Record<string, 'templates' | 'share'> = {
	'open templates': 'templates',
	templates: 'templates',
	'show templates': 'templates',
	share: 'share',
	'open share': 'share',
	'show share': 'share',
	'open qr': 'share',
	'show qr': 'share',
	qr: 'share'
};

export const FACT_PHRASES: Record<string, 'next-deadlines' | 'secured'> = {
	'whats due next': 'next-deadlines',
	'what is due next': 'next-deadlines',
	'whats due': 'next-deadlines',
	'what is due': 'next-deadlines',
	'next deadline': 'next-deadlines',
	'next deadlines': 'next-deadlines',
	'upcoming deadlines': 'next-deadlines',
	'how much is secured': 'secured',
	'how much have we secured': 'secured',
	'how much is secured so far': 'secured',
	'secured total': 'secured',
	'how much money': 'secured'
};

/** Spoken ordinals for follow-ups. -1 means "the last option". */
export const ORDINALS: Record<string, number> = {
	first: 0,
	'1st': 0,
	one: 0,
	'1': 0,
	second: 1,
	'2nd': 1,
	two: 1,
	'2': 1,
	third: 2,
	'3rd': 2,
	three: 2,
	'3': 2,
	last: -1
};

export const CANCEL_PHRASES: string[] = [
	'neither',
	'none',
	'none of these',
	'none of them',
	'cancel',
	'never mind',
	'nevermind'
];

const FILTER_VERBS = ['filter by', 'filter', 'show', 'only', 'just', 'display'];
const FILTER_NOISE = new Set(['grants', 'funders', 'ones', 'only']);

const STATUS_LABELS: Record<string, string> = {
	active: 'Active',
	'in-progress': 'In progress',
	applied: 'Applied',
	recurring: 'Recurring',
	'to-research': 'To research',
	'not-eligible-yet': 'Not eligible yet',
	'not-eligible': 'Not eligible',
	declined: 'Declined'
};
const GATE_LABELS: Record<string, string> = { open: 'Open', gated: 'Gated', unknown: 'Unknown' };
const TYPE_LABELS: Record<string, string> = {
	Grant: 'Grants',
	Fellowship: 'Fellowships',
	Investment: 'Investments'
};

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

const LEADING_POLITE = /^(?:(?:please|hey|okay|ok|can you|could you|would you)\s+)+/;

/** Lowercase, speech-recognition quirks folded, punctuation removed, whitespace collapsed. */
export function normalize(raw: string): string {
	let s = raw.toLowerCase();
	s = s.replace(/’|‘/g, "'");
	s = s.replace(/&/g, ' and ');
	// 501(c)(3), "501 c 3", "five oh one c three" -> 501c3
	s = s.replace(/five\s+oh\s+one\s+c\s+(?:3|three)/g, '501c3');
	s = s.replace(/501\s*\(?\s*c\s*\)?\s*\(?\s*(?:3|three)(?:\s*\))?/g, '501c3');
	s = s.replace(/['.$]/g, '');
	s = s.replace(/[^a-z0-9]+/g, ' ');
	s = s.trim().replace(/\s+/g, ' ');
	let prev: string;
	do {
		prev = s;
		s = s.replace(LEADING_POLITE, '');
	} while (s !== prev);
	return s.trim();
}

const tokens = (s: string): string[] => (s ? s.split(' ') : []);

// ---------------------------------------------------------------------------
// Step 1: pending follow-ups
// ---------------------------------------------------------------------------

function resolveOrdinal(norm: string, pending: PendingOption[]): PendingOption | null {
	let s = norm;
	s = s.replace(/^the\s+/, '');
	s = s.replace(/^number\s+/, '');
	if (s.includes(' ')) s = s.replace(/\s+(?:one|please)$/, '');
	if (!(s in ORDINALS)) return null;
	const idx = ORDINALS[s];
	const opt = idx === -1 ? pending[pending.length - 1] : pending[idx];
	return opt ?? null;
}

// ---------------------------------------------------------------------------
// Step 3: filters
// ---------------------------------------------------------------------------

function lookupFilter(rem: string): Intent | null {
	const hit = (axis: 'status' | 'gate' | 'type', table: Record<string, string>, labels: Record<string, string>) => {
		const value = table[rem];
		if (value === undefined) return null;
		if (!(FILTER_VALUES[axis] as readonly string[]).includes(value)) return null;
		return { kind: 'filter', axis, value, label: labels[value] ?? value } as Intent;
	};
	return (
		hit('status', STATUS_SYNONYMS, STATUS_LABELS) ??
		hit('gate', GATE_SYNONYMS, GATE_LABELS) ??
		hit('type', TYPE_SYNONYMS, TYPE_LABELS)
	);
}

function parseFilter(norm: string): Intent | null {
	let rem: string | null = null;
	for (const verb of FILTER_VERBS) {
		if (norm.startsWith(verb + ' ')) {
			rem = norm.slice(verb.length + 1);
			break;
		}
	}
	if (rem === null) return null;
	rem = rem.replace(/^(?:me|only|just)\s+/, '');
	// Exact phrase first (longest wins because the tables are whole-phrase), then
	// strip up to two trailing noise words ("recurring grants", "active funders").
	let candidate = rem;
	for (let i = 0; i < 3; i++) {
		const hit = lookupFilter(candidate);
		if (hit) return hit;
		const t = tokens(candidate);
		if (t.length > 1 && FILTER_NOISE.has(t[t.length - 1])) {
			candidate = t.slice(0, -1).join(' ');
		} else break;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Step 4: navigate (matcher added below)
// ---------------------------------------------------------------------------

// Matcher tuning constants. Tune against commands.test.ts, then leave alone.
export const HIGH = 0.82; // confident single match
export const LOW = 0.55; // below this the speech is not a funder name at all
export const MARGIN = 0.08; // best must beat the runner-up by this much to open directly

/** Spoken variants -> canonical phrase (applied to the normalized navigate remainder). */
export const FUNDER_ALIASES: Record<string, string> = {
	's n f': 'snf',
	't 7': 't7',
	'thirty seven': '37',
	'w k kellogg': 'kellogg',
	'ben and jerry': 'ben and jerrys',
	'mackenzie scott': 'yield giving',
	'c e k': 'cek',
	't g r': 'tgr'
};

const NAV_VERBS = ['take me to', 'go to', 'open', 'show', 'select', 'find'];
const QUESTION_WORDS = new Set(['how', 'what', 'why', 'when', 'can', 'do', 'does', 'is', 'are', 'tell']);
const MAX_NAV_TOKENS = 6;
const GENERIC = new Set([
	'the',
	'foundation',
	'fund',
	'grant',
	'grants',
	'charitable',
	'inc',
	'program',
	'initiative',
	'of',
	'for',
	'a',
	'and'
]);

/** Label shown for a grant in "Did you mean" lists: funder, or "funder: program" for multi-row funders. */
export function optionLabel(grant: Grant, grants: Grant[]): string {
	const rows = grants.filter((g) => g.funder === grant.funder).length;
	return rows > 1 && grant.program ? `${grant.funder}: ${grant.program}` : grant.funder;
}

function lev(a: string, b: string): number {
	const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		let diag = prev[0];
		prev[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const tmp = prev[j];
			prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
			diag = tmp;
		}
	}
	return prev[b.length];
}

const phon = (t: string): string =>
	t.charAt(0) + t.slice(1).replace(/[aeiou]/g, '').replace(/(.)\1+/g, '$1');

/** Token similarity in [0,1]: exact, prefix, close edit distance, or same consonant skeleton. */
function sim(a: string, b: string): number {
	if (a === b) return 1;
	const m = Math.min(a.length, b.length);
	if (m >= 3 && (a.startsWith(b) || b.startsWith(a))) return 0.92;
	if (m >= 4) {
		const r = 1 - lev(a, b) / Math.max(a.length, b.length);
		if (r >= 0.75) return r;
		const pa = phon(a);
		if (pa.length >= 3 && pa === phon(b)) return 0.8;
	}
	return 0;
}

/** Merge adjacent tokens of `a` that together match a single token of `b` ("third wave" ~ "thirdwave"). */
function mergeJoins(a: string[], b: string[]): string[] {
	const out: string[] = [];
	for (let i = 0; i < a.length; i++) {
		if (i + 1 < a.length) {
			const joined = a[i] + a[i + 1];
			if (b.some((t) => t.length >= 5 && sim(joined, t) >= 0.9)) {
				out.push(joined);
				i++;
				continue;
			}
		}
		out.push(a[i]);
	}
	return out;
}

type Entry = { g: Grant; sets: string[][]; funderSet: string[]; progTokens: string[] };
type Index = { entries: Entry[]; df: Map<string, number>; n: number };

const INDEX = new WeakMap<Grant[], Index>();

function uniq(a: string[]): string[] {
	return [...new Set(a)];
}

function buildIndex(grants: Grant[]): Index {
	const df = new Map<string, number>();
	const entries: Entry[] = grants.map((g) => {
		const parens = [...g.funder.matchAll(/\(([^)]*)\)/g)].map((m) => tokens(normalize(m[1])));
		const base = tokens(normalize(g.funder.replace(/\([^)]*\)/g, ' ')));
		const funderSet = uniq(tokens(normalize(g.funder)));
		const prog = uniq(tokens(normalize(g.program ?? '')));
		const sets = [
			uniq([...funderSet, ...prog]),
			funderSet,
			uniq(base),
			...parens.map(uniq),
			prog
		].filter((s) => s.length > 0);
		const progTokens = prog.filter((t) => !GENERIC.has(t) && !funderSet.includes(t));
		for (const t of new Set(sets[0])) df.set(t, (df.get(t) ?? 0) + 1);
		return { g, sets, funderSet, progTokens };
	});
	return { entries, df, n: grants.length };
}

function getIndex(grants: Grant[]): Index {
	let idx = INDEX.get(grants);
	if (!idx) {
		idx = buildIndex(grants);
		INDEX.set(grants, idx);
	}
	return idx;
}

const idf = (ix: Index, t: string): number => Math.log((ix.n + 1) / ((ix.df.get(t) ?? 0) + 1)) + 1;
// Generic words and bare initials carry little identifying weight.
const weight = (ix: Index, t: string): number =>
	idf(ix, t) * (GENERIC.has(t) || (t.length <= 2 && !/\d/.test(t)) ? 0.2 : 1);

/** Weighted fraction of `from` tokens that find a match in `to`. */
function coverage(ix: Index, from: string[], to: string[]): number {
	let num = 0;
	let den = 0;
	for (const f of from) {
		const w = weight(ix, f);
		den += w;
		let best = 0;
		for (const t of to) best = Math.max(best, sim(f, t));
		num += w * best;
	}
	return den === 0 ? 0 : num / den;
}

function scoreSet(ix: Index, q: string[], c: string[]): number {
	const q2 = mergeJoins(q, c);
	const c2 = mergeJoins(c, q);
	return 0.7 * coverage(ix, q2, c2) + 0.3 * coverage(ix, c2, q2);
}

type Match =
	| { kind: 'open'; rows: Grant[] }
	| { kind: 'ambiguous'; rows: Grant[] }
	| { kind: 'none' };

function aliasify(norm: string): string {
	let s = norm;
	const keys = Object.keys(FUNDER_ALIASES).sort((a, b) => b.length - a.length);
	for (const k of keys) {
		s = s.replace(new RegExp(`(?:^| )${k}(?= |$)`, 'g'), (m) => (m.startsWith(' ') ? ' ' : '') + FUNDER_ALIASES[k]);
	}
	return s;
}

/** Fuzzy-match a normalized funder phrase against the pool (default: every grant). */
function matchFunder(phrase: string, grants: Grant[], poolIds?: Set<string>): Match {
	// Within a small pending pool the options were already offered, so a clear winner is enough.
	const openAt = poolIds ? LOW : HIGH;
	const ix = getIndex(grants);
	const q = tokens(aliasify(phrase)).filter((t, i) => !(i === 0 && (t === 'the' || t === 'a')));
	if (q.length === 0 || q.every((t) => GENERIC.has(t))) return { kind: 'none' };
	const pool = poolIds ? ix.entries.filter((e) => poolIds.has(e.g.id)) : ix.entries;
	const scored = pool
		.map((e) => ({ e, score: Math.max(...e.sets.map((s) => scoreSet(ix, q, s))) }))
		.sort((a, b) => b.score - a.score);
	const best = scored[0];
	if (!best || best.score < LOW) return { kind: 'none' };

	// Same-funder family: the query names the funder but no program -> always ask.
	const family = scored.filter((s) => s.e.g.funder === best.e.g.funder);
	if (family.length > 1) {
		const progHit = best.e.progTokens.some((pt) => q.some((qt) => sim(qt, pt) >= 0.75));
		const funderCover = coverage(ix, q, best.e.funderSet);
		if (!progHit && funderCover >= 0.9) {
			return { kind: 'ambiguous', rows: family.slice(0, 3).map((s) => s.e.g) };
		}
	}

	const second = scored.find((s) => s.e !== best.e)?.score ?? 0;
	if (best.score >= openAt && best.score - second >= MARGIN) return { kind: 'open', rows: [best.e.g] };

	// Ambiguous or merely plausible: offer the closest 2 or 3 rows.
	let near = scored.filter((s) => s.score >= LOW && s.score >= best.score - 0.25).slice(0, 3);
	if (near.length < 2) near = scored.slice(0, 2);
	if (near.length < 2) return { kind: 'none' };
	return { kind: 'ambiguous', rows: near.map((s) => s.e.g) };
}

/** Strip a navigate verb; returns the remainder tokens' phrase or null when no verb. */
function navigateRemainder(norm: string): string | null {
	for (const v of NAV_VERBS) {
		if (norm.startsWith(v + ' ')) {
			return norm
				.slice(v.length + 1)
				.replace(/^(?:me|us)\s+/, '')
				.trim();
		}
	}
	return null;
}

function parseNavigate(norm: string, ctx: Ctx): Intent | null {
	const rem = navigateRemainder(norm);
	if (rem === null || rem === '') return null;
	const t = tokens(rem);
	if (t.length > MAX_NAV_TOKENS || QUESTION_WORDS.has(t[0])) return null;
	const m = matchFunder(rem, ctx.grants);
	if (m.kind === 'open') {
		const g = m.rows[0];
		return { kind: 'open-grant', id: g.id, label: optionLabel(g, ctx.grants) };
	}
	if (m.kind === 'ambiguous') {
		return {
			kind: 'did-you-mean',
			options: m.rows.map((g) => ({ id: g.id, label: optionLabel(g, ctx.grants) }))
		};
	}
	return null;
}

/** "the justfilms one" while options are pending: re-match restricted to those options. */
function rematchPending(norm: string, ctx: Ctx): Intent | null {
	let rem = navigateRemainder(norm) ?? norm;
	rem = rem.replace(/^the\s+/, '').replace(/\s+one$/, '');
	if (!rem || tokens(rem).length > 4) return null;
	const ids = new Set((ctx.pending ?? []).map((p) => p.id));
	const m = matchFunder(rem, ctx.grants, ids);
	if (m.kind !== 'open') return null;
	const g = m.rows[0];
	const label = ctx.pending?.find((p) => p.id === g.id)?.label ?? optionLabel(g, ctx.grants);
	return { kind: 'open-grant', id: g.id, label };
}

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

export function parse(raw: string, ctx: Ctx): Intent {
	const text = raw.trim();
	const norm = normalize(text);
	if (!norm) return { kind: 'chat', text };

	// 1. pending follow-up
	if (ctx.pending && ctx.pending.length > 0) {
		if (CANCEL_PHRASES.includes(norm)) return { kind: 'cancel-pending' };
		const opt = resolveOrdinal(norm, ctx.pending);
		if (opt) return { kind: 'open-grant', id: opt.id, label: opt.label };
		const re = rematchPending(norm, ctx);
		if (re) return re;
	}

	// 2. system phrases
	if (RESET_PHRASES.includes(norm)) return { kind: 'reset' };
	if (CLOSE_PHRASES.includes(norm)) return { kind: 'close' };
	if (norm in PANEL_PHRASES) return { kind: 'panel', name: PANEL_PHRASES[norm] };
	if (norm in FACT_PHRASES) return { kind: 'fact', fact: FACT_PHRASES[norm] };

	// 3. filters
	const filter = parseFilter(norm);
	if (filter) return filter;

	// 4. navigate
	const nav = parseNavigate(norm, ctx);
	if (nav) return nav;

	// 5. chat
	return { kind: 'chat', text };
}
