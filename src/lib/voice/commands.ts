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

// NAVIGATE_PLACEHOLDER

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
	}

	// 2. system phrases
	if (RESET_PHRASES.includes(norm)) return { kind: 'reset' };
	if (CLOSE_PHRASES.includes(norm)) return { kind: 'close' };
	if (norm in PANEL_PHRASES) return { kind: 'panel', name: PANEL_PHRASES[norm] };
	if (norm in FACT_PHRASES) return { kind: 'fact', fact: FACT_PHRASES[norm] };

	// 3. filters
	const filter = parseFilter(norm);
	if (filter) return filter;

	// 4. navigate (not yet implemented: falls through to chat)

	// 5. chat
	return { kind: 'chat', text };
}
