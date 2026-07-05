import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// postprocessing is ESM that SvelteKit externalizes for SSR and then fails to
	// resolve during prerender — noExternal keeps it in the bundle (Phase 3 Pitfall B).
	ssr: { noExternal: ['postprocessing'] }
});
