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
		// Intentionally pinned: when the Template column in data/grants.csv gains
		// more links, update this list on purpose alongside the CSV edit.
		expect(grantsWithTemplates(grants).map((g) => g.id)).toEqual([
			'the-awesome-foundation-disability-chapter'
		]);
	});
});
