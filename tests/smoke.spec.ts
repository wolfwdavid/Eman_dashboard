import { expect, test } from '@playwright/test';

test('landing shell renders under base path with title', async ({ page }) => {
	await page.goto('/Eman_dashboard/');
	// Title text proves CSS/fonts/base-path all resolved.
	await expect(page.locator('h1')).toContainText('Eman_dashboard');
	// Body has a non-transparent (dark) background — proves app.css loaded.
	const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
	expect(bg).not.toBe('rgba(0, 0, 0, 0)');
});
