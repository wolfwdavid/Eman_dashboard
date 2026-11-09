// Tests for grantsWithTemplates — the pure helper behind the TEMPLATES HUD list.
// It keeps only grants whose proposal template / draft URL is filled in (the
// Template column of data/grants.csv), sorted funder → program, without
// mutating its input. Fixtures spread a real grant so they stay type-correct.
import { describe, it, expect } from 'vitest';
import { grants, type Grant } from '$lib/data';
import { grantsWithTemplates } from './templates';

const mk = (id: string, funder: string, program: string | null, template: string | null): Grant => ({
	...grants[0],
	id,
	funder,
	program,
	template
});

describe('grantsWithTemplates', () => {
	it('drops null, empty and whitespace-only templates', () => {
		const list = [
			mk('a', 'A', null, null),
			mk('b', 'B', null, ''),
			mk('c', 'C', null, '   ')
		];
		expect(grantsWithTemplates(list)).toEqual([]);
	});

	it('keeps grants with a URL template', () => {
		const list = [mk('a', 'A', null, null), mk('b', 'B', null, 'https://example.com/doc')];
		expect(grantsWithTemplates(list).map((g) => g.id)).toEqual(['b']);
	});

	it('sorts by funder, then program (null treated as empty)', () => {
		const list = [
			mk('zeta', 'Zeta Fund', null, 'https://z'),
			mk('alpha-b', 'Alpha Trust', 'B Program', 'https://ab'),
			mk('alpha-a', 'Alpha Trust', 'A Program', 'https://aa'),
			mk('alpha-none', 'Alpha Trust', null, 'https://an')
		];
		expect(grantsWithTemplates(list).map((g) => g.id)).toEqual([
			'alpha-none',
			'alpha-a',
			'alpha-b',
			'zeta'
		]);
	});

	it('returns [] for empty input', () => {
		expect(grantsWithTemplates([])).toEqual([]);
	});

	it('does not mutate the input array', () => {
		const list = [
			mk('zeta', 'Zeta Fund', null, 'https://z'),
			mk('alpha', 'Alpha Trust', null, 'https://a')
		];
		const before = list.map((g) => g.id);
		grantsWithTemplates(list);
		expect(list.map((g) => g.id)).toEqual(before);
	});

	it('real dataset: exactly the Awesome Foundation Disability Chapter has a template', () => {
		// Intentionally pinned: every tracker row has a proposal template Doc (2026-11-09).
		// When rows are added to data/grants.csv, add their ids here alongside the CSV edit.
		expect(grantsWithTemplates(grants).map((g) => g.id)).toEqual([
			'37-angels',
			'bank-of-america-charitable-foundation',
			'ben-jerry-s-foundation-jerry-greenfield-grassroots-organizing',
			'borealis-philanthropy-dif-joy-grants',
			'brava-thrive-grant',
			'echoing-green-fellowship',
			'ford-foundation-justfilms-documentary-production',
			'ford-foundation-nyc-good-neighbor-committee',
			'giving-joy-grants',
			'harry-s-black-allon-fuller-fund-bank-of-america',
			'hey-helen-grant',
			'just-thrive-justworks-x-the-well-work',
			'matriarch-digital-media-our-greatness-grant',
			'milbank-foundation',
			'ny-community-trust',
			'nyc-commission-on-human-rights-community-project-grants',
			'nyc-office-for-prevention-of-hate-crimes-community-project-youth-ambassador',
			'stavros-niarchos-foundation-snf',
			'td-bank-funding-opportunities',
			'tgr-foundation',
			'the-awesome-foundation-disability-chapter',
			'the-cek-foundation',
			'third-wave-fund-disability-frontlines-fund',
			'tisch-art-fund',
			'truist-foundation',
			'w-k-kellogg-foundation',
			'wells-fargo-versaic',
			'yield-giving-mackenzie-scott'
		]);
	});
});
