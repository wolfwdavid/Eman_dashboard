import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * GitHub Pages serves this project from a subpath
 * (https://wolfwdavid.github.io/Eman_dashboard/).
 * The CI workflow sets BASE_PATH so every internal link/asset resolves.
 * Locally BASE_PATH is empty, so dev/preview run at the root.
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html', // SPA fallback so unknown paths resolve on Pages (DPLY-02)
			precompress: false,
			strict: true
		}),
		paths: {
			base: process.env.BASE_PATH ?? '', // '' locally, '/Eman_dashboard' in CI
			relative: false // emit absolute base-prefixed asset URLs (/Eman_dashboard/_app/…) — grep-verifiable, no ambiguity vs. relative './_app/'
		},
		prerender: {
			handleHttpError: 'fail',
			handleMissingId: 'fail'
		}
	}
};

export default config;
