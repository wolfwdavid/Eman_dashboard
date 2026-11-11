import { expect, test, type Page } from '@playwright/test';
import { COPY } from '../src/lib/voice/copy';

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

/**
 * Replace SpeechRecognition with a controllable fake. __interim / __say drive the
 * active recognizer; __srStarted counts start() calls. Seeds the browser-path privacy
 * notice as seen unless noticeSeen is false.
 */
export async function installFakeSR(page: Page, opts: { noticeSeen?: boolean } = {}) {
	const noticeSeen = opts.noticeSeen ?? true;
	await page.addInitScript((seen: boolean) => {
		const w = window as any;
		if (seen) {
			localStorage.setItem('did.voice.notice.browser', '1');
			localStorage.setItem('did.voice.notice.server', '1');
		}
		w.__srStarted = 0;
		class FakeSR {
			static last: FakeSR | null = null;
			continuous = false;
			interimResults = false;
			lang = '';
			maxAlternatives = 1;
			onresult: any = null;
			onerror: any = null;
			onend: any = null;
			start() {
				FakeSR.last = this;
				w.__srStarted++;
			}
			stop() {
				setTimeout(() => this.onend?.(), 0);
			}
			abort() {
				setTimeout(() => this.onend?.(), 0);
			}
		}
		const result = (text: string, isFinal: boolean) => {
			const r: any = [{ transcript: text }];
			r.isFinal = isFinal;
			return { results: [r] };
		};
		w.SpeechRecognition = FakeSR;
		w.webkitSpeechRecognition = FakeSR;
		w.__interim = (t: string) => FakeSR.last?.onresult?.(result(t, false));
		w.__say = (t: string) => {
			FakeSR.last?.onresult?.(result(t, true));
			setTimeout(() => FakeSR.last?.onend?.(), 0);
		};
	}, noticeSeen);
}

/**
 * Remove SpeechRecognition and install a fake getUserMedia + MediaRecorder so the
 * server path runs. Seeds did.voice.notice.server (and the browser key) unless
 * noticeSeen is false. window.__tracksStopped counts track.stop() calls.
 */
export async function installFakeRecorder(
	page: Page,
	opts: { noticeSeen?: boolean; keepSR?: boolean } = {}
) {
	const noticeSeen = opts.noticeSeen ?? true;
	const keepSR = opts.keepSR ?? false;
	await page.addInitScript(
		({ seen, keep }: { seen: boolean; keep: boolean }) => {
			const w = window as any;
			if (seen) {
				localStorage.setItem('did.voice.notice.server', '1');
				localStorage.setItem('did.voice.notice.browser', '1');
			}
			if (!keep) {
				delete w.SpeechRecognition;
				delete w.webkitSpeechRecognition;
			}
			w.__tracksStopped = 0;
			w.__recStarted = 0;
			const getUserMedia = async () => ({
				getTracks: () => [{ stop: () => w.__tracksStopped++ }]
			});
			Object.defineProperty(navigator, 'mediaDevices', {
				value: { getUserMedia },
				configurable: true
			});
			class FakeMR {
				static isTypeSupported = () => true;
				mimeType = 'audio/webm;codecs=opus';
				state = 'inactive';
				ondataavailable: any = null;
				onstop: any = null;
				start() {
					w.__recStarted++;
					this.state = 'recording';
				}
				stop() {
					this.state = 'inactive';
					this.ondataavailable?.({ data: new Blob(['fake-audio'], { type: this.mimeType }) });
					setTimeout(() => this.onstop?.(), 0);
				}
			}
			w.MediaRecorder = FakeMR;
		},
		{ seen: noticeSeen, keep: keepSR }
	);
}

const micButton = (page: Page) => page.getByRole('button', { name: /voice input/i });

/** Press the mic, then deliver a final transcript through the fake recognizer. */
export async function speak(page: Page, text: string) {
	await micButton(page).click();
	await expect(micButton(page)).toHaveAttribute('aria-pressed', 'true');
	await page.evaluate((t) => (window as any).__say(t), text);
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

	test('voice commands: show recurring grants', async ({ page }) => {
		await installFakeSR(page);
		await stubNetwork(page);
		await openChat(page);
		const mic = micButton(page);
		await mic.click();
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('#voice-status')).toContainText('Listening…');
		await page.evaluate(() => (window as any).__interim('show recur'));
		await expect(page.locator('#voice-status')).toContainText('show recur');
		await expect(page.getByRole('status')).not.toContainText('show recur');

		await page.evaluate(() => (window as any).__say('show recurring grants'));
		const user = page.locator('.chat-msg.user', { hasText: 'show recurring grants' });
		await expect(user).toBeVisible();
		const cmd = page.locator('.chat-msg.command');
		await expect(cmd).toContainText('recurring grants');
		const order = await page.locator('.chat-messages > *').evaluateAll((els) => ({
			user: els.findIndex((e) => e.classList.contains('user')),
			cmd: els.findIndex((e) => e.classList.contains('command'))
		}));
		expect(order.user).toBeGreaterThan(-1);
		expect(order.user).toBeLessThan(order.cmd);
		await expect(page.locator('.chip', { hasText: 'Recurring' })).toHaveClass(/active/);
		await expect(page.getByRole('status')).toContainText('You said: show recurring grants.');
		await expect(mic).toHaveAttribute('aria-pressed', 'false');
	});

	test('voice commands: open north star', async ({ page }) => {
		await installFakeSR(page);
		await stubNetwork(page);
		await openChat(page);
		await speak(page, 'open north star');
		await expect(page.locator('h2.funder')).toContainText('North Star');
	});

	test('voice commands: templates, reset, close', async ({ page }) => {
		await installFakeSR(page);
		await stubNetwork(page);
		await openChat(page);
		const toggle = page.getByRole('button', { name: /^TEMPLATES/ });
		await speak(page, 'open templates');
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(page.locator('.chat-panel')).toBeVisible();
		await speak(page, 'close');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await speak(page, 'show recurring grants');
		await expect(page.locator('.chip', { hasText: 'Recurring' })).toHaveClass(/active/);
		await speak(page, 'reset');
		await expect(page.locator('.chip', { hasText: /^\s*All\s*$/ })).toHaveClass(/active/);
	});

	test('voice commands: did you mean', async ({ page }) => {
		await installFakeSR(page);
		await stubNetwork(page);
		await openChat(page);
		await speak(page, 'open ford');
		const choices = page.locator('.chat-msg.choices');
		await expect(choices.locator('.dym-choice')).toHaveCount(2);
		await expect(choices.locator('.dym-none')).toHaveCount(1);
		await speak(page, 'the second one');
		await expect(choices.locator('.dym-choice').first()).toBeDisabled();
		await expect(choices.locator('.dym-choice').nth(1)).toBeDisabled();
		await expect(page.locator('.chat-msg.command').last()).toContainText(/^\s*Opening/);
	});

	test('question: spoken question goes to /chat unchanged', async ({ page }) => {
		await installFakeSR(page);
		const net = await stubNetwork(page);
		await openChat(page);
		const q = 'which grants are due soon for disability organisations';
		await speak(page, q);
		await expect(page.locator('.chat-msg.user', { hasText: q })).toBeVisible();
		await expect(page.locator('.chat-msg.typing')).toHaveText(COPY.asking);
		await expect(page.getByRole('status')).toContainText('You said:');
		await expect(page.getByRole('status')).toContainText('Asking the assistant');
		expect(net.posted).toEqual([JSON.stringify({ message: q })]);
	});

	test('voice silence: I didn\'t catch that', async ({ page }) => {
		await page.clock.install();
		await installFakeSR(page);
		await stubNetwork(page);
		await openChat(page);
		const mic = micButton(page);
		const bubbles = await page.locator('.chat-msg').count();
		await mic.click();
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await page.clock.fastForward(8500);
		const strip = page.locator('#voice-status');
		await expect(strip).toContainText("I didn't catch that.");
		await expect(strip).toContainText('Press the mic to try again.');
		await expect(mic).toHaveAttribute('aria-pressed', 'false');
		await page.clock.fastForward(500);
		const live = (await page.getByRole('status').textContent()) ?? '';
		expect(live.split("I didn't catch that.").length - 1).toBe(1);
		await expect(page.locator('.chat-msg')).toHaveCount(bubbles);
	});

	test('voice cancel: Escape and typing', async ({ page }) => {
		await installFakeSR(page);
		const net = await stubNetwork(page);
		await openChat(page);
		const mic = micButton(page);
		const bubbles = await page.locator('.chat-msg').count();
		await mic.click();
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Escape');
		await expect(mic).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('.voice-status')).toHaveCount(0);
		await expect(page.locator('.chat-msg')).toHaveCount(bubbles);
		await expect(page.getByRole('status')).toHaveText('');

		await mic.click();
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		const input = page.getByPlaceholder('Ask about grants...');
		await input.fill('typed question');
		await input.press('Enter');
		await expect(mic).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('.chat-msg.user', { hasText: 'typed question' })).toBeVisible();
		expect(net.posted).toEqual([JSON.stringify({ message: 'typed question' })]);
	});

	test('server fallback: records and posts audio', async ({ page }) => {
		await installFakeRecorder(page);
		await stubNetwork(page);
		let contentType = '';
		await page.route('http://127.0.0.1:8080/chat/transcribe', (route) => {
			contentType = route.request().headers()['content-type'] ?? '';
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				headers: { 'access-control-allow-origin': '*' },
				body: JSON.stringify({ text: 'open templates' })
			});
		});
		await openChat(page);
		const mic = micButton(page);
		await mic.click();
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('#voice-status')).toContainText(/\d:\d\d/);
		await expect(page.locator('#voice-status')).toContainText("Press the mic again when you're done.");
		const req = page.waitForRequest('http://127.0.0.1:8080/chat/transcribe');
		await mic.click();
		await req;
		await expect(page.getByRole('button', { name: /^TEMPLATES/ })).toHaveAttribute('aria-expanded', 'true');
		expect(contentType.startsWith('audio/')).toBe(true);
		expect(await page.evaluate(() => (window as any).__tracksStopped)).toBeGreaterThanOrEqual(1);
	});

	test.describe('server fallback: error messages', () => {
		const cases: [number, string][] = [
			[429, COPY.errRateLimited],
			[413, COPY.errTooLong],
			[415, COPY.errUnsupportedFormat],
			[503, COPY.errTranscribeUnreachable]
		];
		for (const [status, text] of cases) {
			test(`server fallback: status ${status}`, async ({ page }) => {
				await installFakeRecorder(page);
				await stubNetwork(page);
				await page.route('http://127.0.0.1:8080/chat/transcribe', (route) =>
					route.fulfill({
						status,
						headers: { 'access-control-allow-origin': '*' },
						contentType: 'application/json',
						body: '{}'
					})
				);
				await openChat(page);
				const mic = micButton(page);
				await mic.click();
				await expect(mic).toHaveAttribute('aria-pressed', 'true');
				await mic.click();
				await expect(page.locator('.chat-msg.bot', { hasText: text })).toBeVisible();
				await expect(mic).toHaveAttribute('data-state', 'error');
			});
		}

		test('server fallback: empty text shows I didn\'t catch that', async ({ page }) => {
			await installFakeRecorder(page);
			await stubNetwork(page);
			await page.route('http://127.0.0.1:8080/chat/transcribe', (route) =>
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					headers: { 'access-control-allow-origin': '*' },
					body: JSON.stringify({ text: '' })
				})
			);
			await openChat(page);
			const mic = micButton(page);
			await mic.click();
			await expect(mic).toHaveAttribute('aria-pressed', 'true');
			await mic.click();
			await expect(page.locator('#voice-status')).toContainText("I didn't catch that.");
		});
	});

	test('voice mic: unavailable', async ({ page }) => {
		await page.addInitScript(() => {
			const w = window as any;
			delete w.SpeechRecognition;
			delete w.webkitSpeechRecognition;
			delete w.MediaRecorder;
		});
		await stubNetwork(page);
		await openChat(page);
		const mic = micButton(page);
		await expect(mic).toHaveAttribute('data-state', 'unavailable');
		await mic.click();
		await mic.click();
		await expect(page.locator('.chat-msg.bot', { hasText: COPY.errUnavailable })).toHaveCount(1);
	});

	const ls = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
	const win = (page: Page, name: string) => page.evaluate((n) => (window as any)[n], name);

	test('voice notice: first press shows the browser notice and does not start', async ({ page }) => {
		await installFakeSR(page, { noticeSeen: false });
		await stubNetwork(page);
		await openChat(page);
		const mic = micButton(page);
		await mic.click();
		const notice = page.locator('.voice-notice');
		await expect(notice).toBeVisible();
		await expect(notice).toContainText(COPY.noticeBrowser);
		expect(await win(page, '__srStarted')).toBe(0);
		await expect(page.getByRole('button', { name: COPY.noticeStart })).toBeFocused();
		await expect(page.locator('#voice-status')).toHaveCount(0);

		await page.getByRole('button', { name: COPY.noticeStart }).click();
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		expect(await win(page, '__srStarted')).toBe(1);
		expect(await ls(page, 'did.voice.notice.browser')).toBe('1');
		await expect(notice).toHaveCount(0);

		await page.reload();
		await page.getByTitle('Chat with DID assistant').click();
		await micButton(page).click();
		await expect(page.locator('.voice-notice')).toHaveCount(0);
		await expect(micButton(page)).toHaveAttribute('aria-pressed', 'true');
		expect(await win(page, '__srStarted')).toBe(1);
	});

	test('voice notice: Use the server instead', async ({ page }) => {
		await installFakeSR(page, { noticeSeen: false });
		await installFakeRecorder(page, { noticeSeen: false, keepSR: true });
		await stubNetwork(page);
		await openChat(page);
		await micButton(page).click();
		await page.getByRole('button', { name: COPY.noticeUseServer }).click();
		await expect(micButton(page)).toHaveAttribute('aria-pressed', 'true');
		expect(await ls(page, 'did.voice.forceServer')).toBe('1');
		expect(await ls(page, 'did.voice.notice.browser')).toBe('1');
		expect(await ls(page, 'did.voice.notice.server')).toBe('1');
		expect(await win(page, '__recStarted')).toBeGreaterThanOrEqual(1);
		expect(await win(page, '__srStarted')).toBe(0);
	});

	test('voice notice: Escape hides without remembering', async ({ page }) => {
		await installFakeSR(page, { noticeSeen: false });
		await stubNetwork(page);
		await openChat(page);
		const mic = micButton(page);
		await mic.click();
		await expect(page.locator('.voice-notice')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('.voice-notice')).toHaveCount(0);
		await expect(mic).toBeFocused();
		expect(await ls(page, 'did.voice.notice.browser')).toBeNull();
		expect(await win(page, '__srStarted')).toBe(0);
		await mic.click();
		await expect(page.locator('.voice-notice')).toBeVisible();

		await page.getByRole('button', { name: 'Close chat' }).click();
		await page.getByTitle('Chat with DID assistant').click();
		await expect(page.locator('.voice-notice')).toHaveCount(0);
		expect(await ls(page, 'did.voice.notice.browser')).toBeNull();
	});

	test('voice notice: server variant', async ({ page }) => {
		await installFakeRecorder(page, { noticeSeen: false });
		await stubNetwork(page);
		await openChat(page);
		await micButton(page).click();
		const notice = page.locator('.voice-notice');
		await expect(notice).toContainText(COPY.noticeServer);
		await expect(notice.getByRole('button')).toHaveCount(1);
		await expect(notice.getByRole('button', { name: COPY.noticeStart })).toBeVisible();
		expect(await win(page, '__recStarted')).toBe(0);
	});

	test('voice settings: force server speech recognition', async ({ page }) => {
		await installFakeSR(page);
		await installFakeRecorder(page, { keepSR: true });
		await stubNetwork(page);
		await openChat(page);
		const btn = page.getByRole('button', { name: 'Voice settings' });
		await btn.click();
		await expect(btn).toHaveAttribute('aria-expanded', 'true');
		const strip = page.locator('#voice-settings');
		await expect(strip).toBeVisible();
		await expect(strip).toContainText(COPY.settingsHelpBrowser);
		await strip.getByRole('checkbox', { name: 'Use server speech recognition' }).check();
		expect(await ls(page, 'did.voice.forceServer')).toBe('1');

		await page.reload();
		await page.getByTitle('Chat with DID assistant').click();
		await page.getByRole('button', { name: 'Voice settings' }).click();
		const box = page.getByRole('checkbox', { name: 'Use server speech recognition' });
		await expect(box).toBeChecked();
		await micButton(page).click();
		await expect(micButton(page)).toHaveAttribute('aria-pressed', 'true');
		expect(await win(page, '__recStarted')).toBeGreaterThanOrEqual(1);
		expect(await win(page, '__srStarted')).toBe(0);

		// Escape first cancels the active capture; the next one closes the strip.
		await box.focus();
		await page.keyboard.press('Escape');
		await expect(micButton(page)).toHaveAttribute('aria-pressed', 'false');
		await box.focus();
		await page.keyboard.press('Escape');
		await expect(page.locator('#voice-settings')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Voice settings' })).toBeFocused();
	});

	test('voice settings: no browser recognition', async ({ page }) => {
		await installFakeRecorder(page);
		await stubNetwork(page);
		await openChat(page);
		await page.getByRole('button', { name: 'Voice settings' }).click();
		const strip = page.locator('#voice-settings');
		const box = strip.getByRole('checkbox');
		await expect(box).toBeChecked();
		await expect(box).toBeDisabled();
		await expect(strip).toContainText(COPY.settingsHelpNoBrowser);
		await expect(strip).toContainText(COPY.settingsHelpScreenReader);
	});

	test('voice settings: not rendered when unavailable', async ({ page }) => {
		await page.addInitScript(() => {
			const w = window as any;
			delete w.SpeechRecognition;
			delete w.webkitSpeechRecognition;
			delete w.MediaRecorder;
		});
		await stubNetwork(page);
		await openChat(page);
		await expect(micButton(page)).toHaveAttribute('data-state', 'unavailable');
		await expect(page.getByRole('button', { name: 'Voice settings' })).toHaveCount(0);
	});
});
