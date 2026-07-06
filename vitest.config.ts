import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	// Resolve SvelteKit's `$lib` alias so pure data tests can import the barrel
	// (`$lib/data`) exactly as the app does — bare vitest has no SvelteKit plugin.
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		environment: 'node',
		include: [
			'tools/**/*.test.mjs',
			'src/lib/data/**/*.test.ts',
			'src/lib/crystarium/**/*.test.{js,ts}'
		]
	}
});
