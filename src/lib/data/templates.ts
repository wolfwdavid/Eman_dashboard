// Pure helper for the TEMPLATES HUD list — grants whose proposal template /
// draft URL is filled in the Template column of data/grants.csv; data-driven so
// the list grows with the CSV.
import type { Grant } from './types';

export function grantsWithTemplates(list: Grant[]): Grant[] {
	// `filter` returns a new array, so the sort never mutates the input.
	return list
		.filter((g) => typeof g.template === 'string' && g.template.trim() !== '')
		.sort(
			(a, b) =>
				a.funder.localeCompare(b.funder) || (a.program ?? '').localeCompare(b.program ?? '')
		);
}
