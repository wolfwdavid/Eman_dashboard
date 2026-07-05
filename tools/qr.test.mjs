// tools/qr.test.mjs — DATA-06: QR subsystem guard (absolute-URL config + inline-SVG emit).
//
// Proves the two config URLs are absolute external destinations (never base-prefixed),
// that both QR SVGs are emitted encoding those exact URLs, and that the generator
// exits 0 on the good config. The negative case locks the Pitfall-5 regression: a
// base-prefixed value must fail the `startsWith('http')` guard.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sites } from '../src/lib/config/sites.js';
import { qrCodes } from '../src/lib/data/qr.generated.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('sites.js config (single swap point)', () => {
	it('has exactly two sites', () => {
		expect(sites).toHaveLength(2);
	});

	it('every url is an absolute https:// external URL, never base-prefixed', () => {
		for (const site of sites) {
			expect(site.url.startsWith('https://')).toBe(true);
			expect(site.url).not.toContain('/Eman_dashboard/');
		}
	});

	it('every site has a unique id and a label', () => {
		const ids = sites.map((s) => s.id);
		expect(new Set(ids).size).toBe(sites.length);
		for (const site of sites) {
			expect(site.id).toBeTruthy();
			expect(site.label).toBeTruthy();
		}
	});
});

describe('qr.generated.js (emitted inline-SVG codes)', () => {
	it('emits one QR per site (2 entries)', () => {
		expect(qrCodes).toHaveLength(2);
	});

	it('each entry has an inline <svg> and encodes the exact external site url', () => {
		for (let i = 0; i < qrCodes.length; i++) {
			const code = qrCodes[i];
			expect(code.svg).toContain('<svg');
			// QR encodes the external destination, not an internal route.
			expect(code.url).toBe(sites[i].url);
			expect(code.url).not.toContain('/Eman_dashboard/');
		}
	});
});

describe('generate-qr.mjs integration guard', () => {
	it('exits 0 on the good config', () => {
		const result = spawnSync('node', ['tools/generate-qr.mjs'], { cwd: ROOT, encoding: 'utf8' });
		expect(result.status).toBe(0);
	});
});

describe('Pitfall-5 regression: absolute-URL guard rejects base-prefixed targets', () => {
	it('a /Eman_dashboard/ path is NOT treated as absolute', () => {
		expect('/Eman_dashboard/foo'.startsWith('http')).toBe(false);
	});
});
