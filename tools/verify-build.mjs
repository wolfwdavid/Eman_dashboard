#!/usr/bin/env node
/**
 * verify-build.mjs — custom GitHub Pages build-output verifier (DPLY-01 / DPLY-02).
 *
 * Asserts, against the `build/` directory, that the static site is Pages-safe:
 *   1. build/index.html exists              (prerendered landing — DPLY-01)
 *   2. build/404.html exists                (SPA fallback           — DPLY-02)
 *   3. build/.nojekyll exists               (Jekyll guard           — DPLY-02)
 *   4. ZERO root-absolute /_app/ references (base applied           — DPLY-02)
 *   5. >=1 /Eman_dashboard/_app/ reference  (BASE_PATH applied       — DPLY-02)
 *   6. index.html renders the title text "Eman_dashboard" as real
 *      element content in <title>/<h1> — NOT merely inside asset URLs
 *      (DPLY-01 real content, not an empty shell). Goes green once the
 *      landing shell (Plan 01-02) ships; expected to FAIL on the scaffold.
 *
 * MUST build with `BASE_PATH=/Eman_dashboard` first, or checks 5/6 give a false read.
 * Exits 1 on ANY failure, 0 when all pass.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUILD = 'build';
let failed = false;
const check = (ok, label) => {
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
	if (!ok) failed = true;
};

const walk = (dir, exts) => {
	const out = [];
	for (const e of readdirSync(dir)) {
		const p = join(dir, e);
		if (statSync(p).isDirectory()) out.push(...walk(p, exts));
		else if (exts.some((x) => p.endsWith(x))) out.push(p);
	}
	return out;
};

console.log('verify-build: asserting GitHub Pages base-path safety of build/\n');

check(existsSync(join(BUILD, 'index.html')), 'build/index.html exists (prerendered landing)');
check(existsSync(join(BUILD, '404.html')), 'build/404.html exists (SPA fallback)');
check(existsSync(join(BUILD, '.nojekyll')), 'build/.nojekyll exists (Jekyll guard)');

const files = existsSync(BUILD) ? walk(BUILD, ['.html', '.css', '.js']) : [];

// A root-absolute /_app/ reference means base was NOT applied → guaranteed Pages 404.
const rootAbs = /(href|src)="\/_app\/|url\(\/_app\//;
const offenders = files.filter((f) => rootAbs.test(readFileSync(f, 'utf8')));
check(offenders.length === 0, `zero root-absolute /_app/ refs (offenders: ${offenders.join(', ') || 'none'})`);

// At least one base-prefixed asset URL proves BASE_PATH=/Eman_dashboard was applied at build time.
const based = files.some((f) => readFileSync(f, 'utf8').includes('/Eman_dashboard/_app/'));
check(based, 'at least one /Eman_dashboard/_app/ ref (BASE_PATH applied)');

// Title text must render as real element content (<title>/<h1>), not just appear inside asset URLs.
const idx = existsSync(join(BUILD, 'index.html')) ? readFileSync(join(BUILD, 'index.html'), 'utf8') : '';
const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(idx)?.[1] ?? '';
const h1Tag = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(idx)?.[1] ?? '';
const titleText = `${titleTag} ${h1Tag}`;
check(
	titleText.includes('Eman_dashboard'),
	'index.html renders title text "Eman_dashboard" in <title>/<h1> (real content, not asset URLs)'
);

console.log(failed ? '\nverify-build: FAILED' : '\nverify-build: PASSED');
process.exit(failed ? 1 : 0);
