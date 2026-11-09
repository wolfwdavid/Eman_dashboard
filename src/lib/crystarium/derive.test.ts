// CRYS-05 / CRYS-06 — unit assertions for the data-DERIVED sets: deadline pulse,
// fiscal-sponsor beam, funder-family bridges, and the progression spine. These counts
// (beam=7, pulse=4, family=3) are the project's differentiator and MUST come from data,
// re-pinned 2026-11-09 after 12 rows were added;
// not hardcoded — so every assertion below is checked against the real 40-record dataset.
import { describe, it, expect } from 'vitest';
import { computeLayout } from './layout.js';
import grants from '../data/grants.generated.json';
import type { Grant } from '../data/types';

const GRANTS = grants as unknown as Grant[];
const layout = computeLayout(GRANTS);
const nodeById = (id: string) => layout.nodes.find((n) => n.id === id)!;
const edgesOf = (kind: string) => layout.edges.filter((e) => e.kind === kind);

const BEAM_IDS = [
	'harry-s-black-allon-fuller-fund-bank-of-america',
	'ford-foundation-justfilms-documentary-production',
	'ford-foundation-nyc-good-neighbor-committee',
	'ben-jerry-s-foundation-jerry-greenfield-grassroots-organizing',
	'new-york-women-s-foundation-early-investment-grants', // re-pinned 2026-11-09 after 12 rows were added
	'north-star-fund-nyc-organizing-grants', // re-pinned 2026-11-09 after 12 rows were added
	'borealis-philanthropy-just-futures-initiative' // re-pinned 2026-11-09 after 12 rows were added
];
const PULSE_IDS = [
	'harry-s-black-allon-fuller-fund-bank-of-america',
	'ford-foundation-justfilms-documentary-production',
	'ben-jerry-s-foundation-jerry-greenfield-grassroots-organizing',
	'north-star-fund-nyc-organizing-grants' // re-pinned 2026-11-09 after 12 rows were added
];

describe('fiscal-sponsor beam (CRYS-06)', () => {
	const beams = edgesOf('beam');

	it('emits exactly 7 beams (raw string, NOT the tri-state which would give 17)', () => {
		expect(beams).toHaveLength(7); // re-pinned 2026-11-09 after 12 rows were added
		// Guard the corrected derivation: the tri-state `requires501c3 === 'yes'` folds in
		// "Likely yes" + "Yes (required)" and wrongly yields 17. The raw value gives 7.
		const triStateCount = GRANTS.filter((g) => g.requires501c3 === 'yes').length;
		expect(triStateCount).toBe(17); // re-pinned 2026-11-09 after 12 rows were added
		const rawCount = GRANTS.filter((g) => g.requires501c3Raw === 'Yes - or fiscal sponsor').length;
		expect(rawCount).toBe(7); // re-pinned 2026-11-09 after 12 rows were added
	});

	it('every beam is sourced from the center core', () => {
		for (const e of beams) expect(e.from).toBe('ny-community-trust');
	});

	it('targets exactly the 7 fiscal-sponsor ids', () => {
		expect(new Set(beams.map((e) => e.to))).toEqual(new Set(BEAM_IDS));
	});

	it('flags beamTarget === true on exactly those 7 nodes', () => {
		const flagged = layout.nodes.filter((n) => n.beamTarget).map((n) => n.id);
		expect(new Set(flagged)).toEqual(new Set(BEAM_IDS));
		for (const id of BEAM_IDS) expect(nodeById(id).beamTarget).toBe(true);
	});
});

describe('deadline pulse (CRYS-05) — clock-free set', () => {
	it('flags pulse === true on exactly 4 nodes', () => {
		const pulsing = layout.nodes.filter((n) => n.pulse).map((n) => n.id);
		expect(pulsing).toHaveLength(4); // re-pinned 2026-11-09 after 12 rows were added
		expect(new Set(pulsing)).toEqual(new Set(PULSE_IDS));
	});

	it('never pulses passed / rolling / declined / ineligible nodes (hey-helen excluded)', () => {
		expect(nodeById('hey-helen-grant').pulse).toBe(false); // passed + declined ember
		const NEVER = new Set(['declined', 'not-eligible', 'not-eligible-yet']);
		for (const n of layout.nodes) {
			if (n.pulse) continue;
			// no assertion needed on non-pulsing beyond the invariants below
		}
		for (const g of GRANTS) {
			const disqualified =
				g.deadline.cadence !== 'one-time' || g.deadline.isPassed || NEVER.has(g.status);
			if (disqualified) expect(nodeById(g.id).pulse).toBe(false);
		}
	});
});

describe('funder-family bridges (CRYS-06)', () => {
	const fam = edgesOf('family');

	it('emits exactly 3 family edges (Ford pair + BofA family of 3 (chained → 2 edges))', () => {
		expect(fam).toHaveLength(3); // re-pinned 2026-11-09 after 12 rows were added
	});

	it('includes the Ford pair', () => {
		const hasFord = fam.some(
			(e) =>
				(e.from === 'ford-foundation-justfilms-documentary-production' &&
					e.to === 'ford-foundation-nyc-good-neighbor-committee') ||
				(e.to === 'ford-foundation-justfilms-documentary-production' &&
					e.from === 'ford-foundation-nyc-good-neighbor-committee')
		);
		expect(hasFord).toBe(true);
	});

	it('includes the BofA pair (funder strings differ → substring match)', () => {
		const hasBofa = fam.some(
			(e) =>
				(e.from === 'harry-s-black-allon-fuller-fund-bank-of-america' &&
					e.to === 'bank-of-america-charitable-foundation') ||
				(e.to === 'harry-s-black-allon-fuller-fund-bank-of-america' &&
					e.from === 'bank-of-america-charitable-foundation')
		);
		expect(hasBofa).toBe(true);
	});

	it('includes the BofA Charitable Foundation ↔ Neighborhood Builders link (third BofA row)', () => {
		const hasNb = fam.some(
			(e) =>
				(e.from === 'bank-of-america-charitable-foundation' &&
					e.to === 'bank-of-america-neighborhood-builders') ||
				(e.to === 'bank-of-america-charitable-foundation' &&
					e.from === 'bank-of-america-neighborhood-builders')
		);
		expect(hasNb).toBe(true); // re-pinned 2026-11-09 after 12 rows were added
	});
});

describe('progression spine (CRYS-06)', () => {
	const spine = edgesOf('spine');
	const ids = new Set(layout.nodes.map((n) => n.id));

	it('emits at least one spine edge', () => {
		expect(spine.length).toBeGreaterThan(0);
	});

	it('every spine endpoint resolves to an existing node', () => {
		for (const e of spine) {
			expect(ids.has(e.from), `from ${e.from}`).toBe(true);
			expect(ids.has(e.to), `to ${e.to}`).toBe(true);
		}
	});

	it('every edge endpoint (all kinds) resolves to an existing node', () => {
		for (const e of layout.edges) {
			expect(ids.has(e.from)).toBe(true);
			expect(ids.has(e.to)).toBe(true);
		}
	});
});
