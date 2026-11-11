import { expect, test, type Page } from '@playwright/test';

// Shared helpers for the voice specs (extended by later plans).

/**
 * Stub every network dependency of the chat widget. Route order matters: the most
 * recently registered route wins, so the generic abort goes first.
 * Returns the JSON bodies POSTed to /chat.
 */
export async function stubNetwork(page: Page) {
	const posted: string[] = [];
	await page.route('http://127.0.0.1:8080/**', (route) => route.abort());
	await page.route('https://raw.githubusercontent.com/**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ api_url: 'http://127.0.0.1:8080' })
		})
	);
	await page.route('http://127.0.0.1:8080/chat', (route) => {
		if (route.request().method() !== 'POST') return route.abort();
		posted.push(route.request().postData() ?? '');
		return route.fulfill({
			status: 202,
			contentType: 'application/json',
			headers: { 'access-control-allow-origin': '*' },
			body: JSON.stringify({ job_id: 'j1' })
		});
	});
	await page.route('http://127.0.0.1:8080/chat/j1', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			headers: { 'access-control-allow-origin': '*' },
			body: JSON.stringify({ status: 'done', reply: 'Hello from the assistant' })
		})
	);
	return { posted };
}

export async function openChat(page: Page) {
	await page.goto('/Eman_dashboard/');
	await page.getByTitle('Chat with DID assistant').click();
}

test.describe('voice', () => {
	test('typed question goes to /chat unchanged and is announced', async ({ page }) => {
		const net = await stubNetwork(page);
		await openChat(page);
		await page.getByPlaceholder('Ask about grants...').fill('which grants are due soon');
		await page.getByPlaceholder('Ask about grants...').press('Enter');

		await expect(page.locator('.chat-msg.user', { hasText: 'which grants are due soon' })).toBeVisible();
		await expect(page.locator('.chat-msg.typing')).toHaveText(
			'Asking the assistant, this can take a minute…'
		);
		await expect(page.getByRole('status')).toContainText('Asking the assistant');
		expect(net.posted).toEqual([JSON.stringify({ message: 'which grants are due soon' })]);

		await expect(page.getByRole('status')).toContainText('Assistant: Hello from the assistant', {
			timeout: 10_000
		});
		await expect(page.locator('.chat-msg.bot', { hasText: 'Hello from the assistant' })).toBeVisible();
	});

	test('live region is a single persistent role=status outside the chat panel', async ({ page }) => {
		await stubNetwork(page);
		await page.goto('/Eman_dashboard/');
		await expect(page.getByRole('status')).toHaveCount(1);
		await expect(page.locator('.chat-panel')).toHaveCount(0);
	});
});
