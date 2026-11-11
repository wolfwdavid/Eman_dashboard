import { expect, test } from '@playwright/test';

// Parity regression for D-22: the TEMPLATES and SHARE panels now share a module
// store (so voice can drive them); the on-screen controls must behave as before.
test.describe('TEMPLATES and SHARE panel controls', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/Eman_dashboard/');
	});

	test('TEMPLATES toggle flips aria-expanded and Escape closes it', async ({ page }) => {
		const toggle = page.getByRole('button', { name: /^TEMPLATES/ });
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await page.keyboard.press('Escape');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	});

	test('SHARE toggle flips aria-expanded', async ({ page }) => {
		const toggle = page.getByRole('button', { name: /^SHARE/ });
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	});
});
