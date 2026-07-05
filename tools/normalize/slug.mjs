// slug.mjs — pure slug(cell) → stable, url-safe id (DATA-01 support).
// Derives a Grant `id` from the FULL "Funder / Program" cell so the two Ford
// rows (and any shared-funder rows) get distinct, inspectable ids.
// Pure and importable: no fs, no side effects.

/**
 * Lowercase, NFKD-normalize, collapse every non-alphanumeric run to a single
 * dash, then trim leading/trailing dashes.
 *   'Ford Foundation - JustFilms Documentary Production'
 *     → 'ford-foundation-justfilms-documentary-production'
 *   '37 Angels' → '37-angels'
 * @param {string} cell
 * @returns {string}
 */
export function slug(cell) {
	return (cell ?? '')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
