import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: `http://localhost:${PORT}`
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	// Serve the prebuilt static site. Build with BASE_PATH=/Eman_dashboard first so the
	// served path matches production (/Eman_dashboard/). CI runs build → preview → test.
	webServer: {
		command: `pnpm exec vite preview --port ${PORT} --strictPort`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000
	}
});
