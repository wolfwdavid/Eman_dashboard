import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['tools/**/*.test.mjs', 'src/lib/data/**/*.test.ts']
	}
});
