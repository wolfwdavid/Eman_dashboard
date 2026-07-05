import { describe, it, expect } from 'vitest';
import { parseStatus, parse501c3 } from './status.mjs';
import { slug } from './slug.mjs';

// parseStatus — one case per literal Status string in the real 28-row data/grants.csv.
// The 8 raw strings map 1:1 to the fixed enum + a preserved human label.
const statusCases = [
	{ raw: 'Active funder', status: 'active', statusLabel: 'Active funder' },
	{ raw: 'In progress', status: 'in-progress', statusLabel: 'In progress' },
	{ raw: 'To research', status: 'to-research', statusLabel: 'To research' },
	{ raw: 'Recurring', status: 'recurring', statusLabel: 'Recurring' },
	{ raw: 'Applied', status: 'applied', statusLabel: 'Applied' },
	{ raw: 'Declined', status: 'declined', statusLabel: 'Declined' },
	{ raw: 'Not eligible', status: 'not-eligible', statusLabel: 'Not eligible' },
	{ raw: 'Not eligible (yet)', status: 'not-eligible-yet', statusLabel: 'Not eligible (yet)' }
];

describe('parseStatus — every literal CSV status string', () => {
	for (const c of statusCases) {
		it(`maps ${JSON.stringify(c.raw)} → ${c.status}`, () => {
			const r = parseStatus(c.raw);
			expect(r.status).toBe(c.status);
			expect(r.statusLabel).toBe(c.statusLabel);
		});
	}
});

describe('parseStatus — substring-order + throw-on-unmapped', () => {
	it("matches 'Not eligible (yet)' BEFORE 'Not eligible' (substring order)", () => {
		// The dangerous regression: a naive contains-check for 'Not eligible' would
		// steal the '(yet)' row. Assert the more-specific match wins.
		expect(parseStatus('Not eligible (yet)').status).toBe('not-eligible-yet');
		expect(parseStatus('Not eligible').status).toBe('not-eligible');
	});

	it('throws on an unmapped status (never defaults to a fallback enum)', () => {
		expect(() => parseStatus('Bogus')).toThrow();
	});

	it('throws on empty / whitespace status', () => {
		expect(() => parseStatus('')).toThrow();
	});
});

// parse501c3 — string → tri-state ('yes' | 'no' | 'unknown'), raw always preserved.
const c3Cases = [
	{ raw: 'No - they are 501(c)(3); potential fiscal sponsor', requires501c3: 'no' },
	{ raw: 'No', requires501c3: 'no' },
	{ raw: 'No (intermediary funder)', requires501c3: 'no' },
	{ raw: 'Yes - or fiscal sponsor', requires501c3: 'yes' },
	{ raw: 'Yes (required)', requires501c3: 'yes' },
	{ raw: 'Likely yes', requires501c3: 'yes' },
	{ raw: 'Unknown', requires501c3: 'unknown' }
];

describe('parse501c3 — every literal CSV 501(c)(3) string → tri-state', () => {
	for (const c of c3Cases) {
		it(`maps ${JSON.stringify(c.raw)} → ${c.requires501c3}`, () => {
			const r = parse501c3(c.raw);
			expect(r.requires501c3).toBe(c.requires501c3);
			expect(r.requires501c3Raw).toBe(c.raw);
		});
	}

	it("'Likely yes' is conservatively 'yes' AND preserves the raw for a future 4-bucket chart", () => {
		const r = parse501c3('Likely yes');
		expect(r.requires501c3).toBe('yes');
		expect(r.requires501c3Raw).toBe('Likely yes');
	});

	it('empty / missing → unknown', () => {
		expect(parse501c3('').requires501c3).toBe('unknown');
		expect(parse501c3(null).requires501c3).toBe('unknown');
	});
});

// slug — stable id from the full "Funder / Program" cell.
describe('slug — stable url-safe id from a funder cell', () => {
	it('slugs a long "Funder - Program" cell', () => {
		expect(slug('Ford Foundation - JustFilms Documentary Production')).toBe(
			'ford-foundation-justfilms-documentary-production'
		);
	});

	it('keeps digits and collapses spaces', () => {
		expect(slug('37 Angels')).toBe('37-angels');
	});
});
