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

/**
 * Open the chat toggle. The toggle is prerendered, so a click that lands before Svelte
 * hydrates is silently lost and the panel never opens (the cause of the intermittent
 * "voice settings" timeout after a reload). Retry the click until the panel is there.
 */
export async function clickChatToggle(page: Page) {
	await expect(async () => {
		if ((await page.locator('.chat-panel').count()) === 0) {
			await page.getByTitle('Chat with DID assistant').click();
		}
		await expect(page.locator('.chat-panel')).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 15_000 });
}

export async function openChat(page: Page) {
	await page.goto('/Eman_dashboard/');
	await clickChatToggle(page);
}

/**
 * Replace SpeechRecognition with a controllable fake. __interim / __say drive the
 * active recognizer; __srStarted counts start() calls. Seeds the browser-path privacy
 * notice as seen unless noticeSeen is false.
 * deferStart: the engine does not report "start" until __srStart() (an open permission
 * prompt). throwOnStart: start() throws. __srEnd() ends the session with no final result.
 */
export async function installFakeSR(
	page: Page,
	opts: { noticeSeen?: boolean; deferStart?: boolean; throwOnStart?: boolean } = {}
) {
	const noticeSeen = opts.noticeSeen ?? true;
	const deferStart = opts.deferStart ?? false;
	const throwOnStart = opts.throwOnStart ?? false;
	await page.addInitScript(({ seen, defer, throws }: { seen: boolean; defer: boolean; throws: boolean }) => {
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
			onstart: any = null;
			onaudiostart: any = null;
			start() {
				if (throws) throw new Error('InvalidStateError');
				FakeSR.last = this;
				w.__srStarted++;
				if (!defer) this.onstart?.();
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
		w.__srStart = () => FakeSR.last?.onstart?.();
		w.__srEnd = () => FakeSR.last?.onend?.();
	}, { seen: noticeSeen, defer: deferStart, throws: throwOnStart });
}

/**
 * Remove SpeechRecognition and install a fake getUserMedia + MediaRecorder so the
 * server path runs. Seeds did.voice.notice.server (and the browser key) unless
 * noticeSeen is false. window.__tracksStopped counts track.stop() calls.
 * throwOnStart: MediaRecorder.start() throws. deferStop: stop() does not fire onstop
 * until __recFinishStop() (the gap between a stop request and the recorder's onstop).
 */
export async function installFakeRecorder(
	page: Page,
	opts: { noticeSeen?: boolean; keepSR?: boolean; throwOnStart?: boolean; deferStop?: boolean } = {}
) {
	const noticeSeen = opts.noticeSeen ?? true;
	const keepSR = opts.keepSR ?? false;
	const throwOnStart = opts.throwOnStart ?? false;
	const deferStop = opts.deferStop ?? false;
	await page.addInitScript(
		({ seen, keep, throws, defer }: { seen: boolean; keep: boolean; throws: boolean; defer: boolean }) => {
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
					if (throws) throw new Error('NotSupportedError');
					w.__recStarted++;
					this.state = 'recording';
				}
				stop() {
					this.state = 'inactive';
					this.ondataavailable?.({ data: new Blob(['fake-audio'], { type: this.mimeType }) });
					if (defer) w.__recFinishStop = () => this.onstop?.();
					else setTimeout(() => this.onstop?.(), 0);
				}
			}
			w.MediaRecorder = FakeMR;
		},
		{ seen: noticeSeen, keep: keepSR, throws: throwOnStart, defer: deferStop }
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

	test('voice silence: a slow permission prompt is not silence', async ({ page }) => {
		await page.clock.install();
		await installFakeSR(page, { deferStart: true });
		await stubNetwork(page);
		await openChat(page);
		const mic = micButton(page);
		await mic.click();
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		// The recognizer has not started yet (prompt open): 8 s must not count as silence.
		await page.clock.fastForward(12_000);
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('#voice-status')).toContainText('Listening…');
		await expect(page.locator('#voice-status')).not.toContainText("I didn't catch that.");

		await page.evaluate(() => (window as any).__srStart());
		await page.clock.fastForward(8500);
		await expect(page.locator('#voice-status')).toContainText("I didn't catch that.");
		await expect(mic).toHaveAttribute('aria-pressed', 'false');
	});

	test('voice end: interim words are used when the recognizer ends without a final', async ({ page }) => {
		await installFakeSR(page);
		await stubNetwork(page);
		await openChat(page);
		const mic = micButton(page);
		await mic.click();
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await page.evaluate(() => (window as any).__interim('show recurring grants'));
		await expect(page.locator('#voice-status')).toContainText('show recurring grants');
		await page.evaluate(() => (window as any).__srEnd());
		await expect(mic).toHaveAttribute('aria-pressed', 'false');
		await expect(mic).toHaveAttribute('data-state', 'idle');
		await expect(page.locator('.chat-msg.user', { hasText: 'show recurring grants' })).toBeVisible();
		await expect(page.locator('.chip', { hasText: 'Recurring' })).toHaveClass(/active/);
		await expect(page.locator('#voice-status')).toHaveCount(0);
	});

	test('voice start failure: a throwing recognizer leaves the mic usable', async ({ page }) => {
		await installFakeSR(page, { throwOnStart: true });
		await stubNetwork(page);
		await openChat(page);
		const mic = micButton(page);
		await mic.click();
		await expect(page.locator('.chat-msg.bot', { hasText: COPY.errOther })).toHaveCount(1);
		await expect(mic).toHaveAttribute('data-state', 'error');
		await expect(mic).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('#voice-status')).toHaveCount(0);
		// Not stuck: the next press tries again.
		await mic.click();
		await expect(page.locator('.chat-msg.bot', { hasText: COPY.errOther })).toHaveCount(2);
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

	test('server fallback: a throwing recorder releases the mic and reports the failure', async ({ page }) => {
		await installFakeRecorder(page, { throwOnStart: true });
		await stubNetwork(page);
		await openChat(page);
		const mic = micButton(page);
		await mic.click();
		await expect(page.locator('.chat-msg.bot', { hasText: COPY.errOther })).toHaveCount(1);
		await expect(mic).toHaveAttribute('data-state', 'error');
		await expect(mic).toHaveAttribute('aria-pressed', 'false');
		await expect(page.locator('#voice-status')).toHaveCount(0);
		expect(await page.evaluate(() => (window as any).__tracksStopped)).toBeGreaterThanOrEqual(1);
	});

	test('server fallback: auto-stop plus a mic press uploads the clip once', async ({ page }) => {
		await page.clock.install();
		await installFakeRecorder(page, { deferStop: true });
		await stubNetwork(page);
		let uploads = 0;
		await page.route('http://127.0.0.1:8080/chat/transcribe', (route) => {
			uploads++;
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				headers: { 'access-control-allow-origin': '*' },
				body: JSON.stringify({ text: 'show recurring grants' })
			});
		});
		await openChat(page);
		const mic = micButton(page);
		await mic.click();
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		expect(await page.evaluate(() => (window as any).__recStarted)).toBe(1);
		// The 18 s cap asks the recorder to stop; its onstop has not fired yet.
		await page.clock.fastForward(18_500);
		await expect
			.poll(() => page.evaluate(() => typeof (window as any).__recFinishStop))
			.toBe('function');
		// A press in that gap must not produce a second upload of the same clip.
		await mic.click();
		await page.evaluate(() => (window as any).__recFinishStop());
		await expect(page.locator('.chip', { hasText: 'Recurring' })).toHaveClass(/active/);
		await expect(mic).toHaveAttribute('data-state', 'idle');
		await page.waitForTimeout(300);
		expect(uploads).toBe(1);
		await expect(page.locator('.chat-msg.user', { hasText: 'show recurring grants' })).toHaveCount(1);
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
		await clickChatToggle(page);
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

	/** localStorage access throws, as in Safari with cookies blocked or a sandboxed iframe. */
	const blockStorage = (page: Page) =>
		page.addInitScript(() => {
			Object.defineProperty(window, 'localStorage', {
				configurable: true,
				get() {
					throw new DOMException('The operation is insecure.', 'SecurityError');
				}
			});
		});

	test('voice notice: Use the server instead holds without localStorage', async ({ page }) => {
		await installFakeSR(page, { noticeSeen: false });
		await installFakeRecorder(page, { noticeSeen: false, keepSR: true });
		await blockStorage(page);
		await stubNetwork(page);
		await openChat(page);
		const mic = micButton(page);
		await mic.click();
		await expect(page.locator('.voice-notice')).toContainText(COPY.noticeBrowser);
		await page.getByRole('button', { name: COPY.noticeUseServer }).click();
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		// The audio must go to the server recorder, never to the browser recognizer.
		expect(await win(page, '__recStarted')).toBe(1);
		expect(await win(page, '__srStarted')).toBe(0);
		await expect(page.locator('#voice-status')).toContainText(COPY.hintServer);

		// The choice lasts for the page load: the next press is the server again, no notice.
		await page.keyboard.press('Escape');
		await expect(mic).toHaveAttribute('aria-pressed', 'false');
		await mic.click();
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('.voice-notice')).toHaveCount(0);
		expect(await win(page, '__recStarted')).toBe(2);
		expect(await win(page, '__srStarted')).toBe(0);
	});

	test('voice settings: the server checkbox holds without localStorage', async ({ page }) => {
		await installFakeSR(page, { noticeSeen: false });
		await installFakeRecorder(page, { noticeSeen: false, keepSR: true });
		await blockStorage(page);
		await stubNetwork(page);
		await openChat(page);
		await page.getByRole('button', { name: 'Voice settings' }).click();
		const box = page.getByRole('checkbox', { name: 'Use server speech recognition' });
		await box.check();
		await expect(box).toBeChecked();
		const mic = micButton(page);
		await mic.click();
		// The first-use notice is the server one, and starting records for the server.
		await expect(page.locator('.voice-notice')).toContainText(COPY.noticeServer);
		await page.getByRole('button', { name: COPY.noticeStart }).click();
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		expect(await win(page, '__recStarted')).toBe(1);
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
		await clickChatToggle(page);
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
		await clickChatToggle(page);
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

// ---------------------------------------------------------------- spoken replies

/** Replace speechSynthesis with a recorder. __spoken, __cancels and __order describe what happened. */
export async function installFakeSpeech(page: Page, opts: { speaking?: boolean } = {}) {
	await page.addInitScript((speaking: boolean) => {
		const w = window as any;
		w.__spoken = [];
		w.__cancels = 0;
		w.__order = [];
		w.__speaking = speaking;
		class FakeUtterance {
			lang = '';
			voice: unknown = undefined;
			constructor(public text: string) {}
		}
		const synth = {
			speak(u: any) {
				w.__spoken.push(u.text);
				w.__order.push('speak');
			},
			cancel() {
				w.__cancels++;
				w.__order.push('cancel');
			},
			get speaking() {
				return !!w.__speaking;
			},
			getVoices: () => []
		};
		Object.defineProperty(w, 'speechSynthesis', { value: synth, configurable: true });
		w.SpeechSynthesisUtterance = FakeUtterance;
	}, opts.speaking ?? false);
}

const speakerButton = (page: Page) => page.getByRole('button', { name: 'Spoken replies' });
const spokenList = (page: Page): Promise<string[]> => page.evaluate(() => (window as any).__spoken);
const cancelCount = (page: Page): Promise<number> => page.evaluate(() => (window as any).__cancels);
const lsKey = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

async function speakerOn(page: Page) {
	await speakerButton(page).click();
	await expect(speakerButton(page)).toHaveAttribute('aria-pressed', 'true');
}

async function stubReply(page: Page, reply: string) {
	await page.route('http://127.0.0.1:8080/chat/j1', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			headers: { 'access-control-allow-origin': '*' },
			body: JSON.stringify({ status: 'done', reply })
		})
	);
}

test.describe('spoken replies', () => {
	test('spoken replies: default off, toggle persists', async ({ page }) => {
		await installFakeSpeech(page);
		await stubNetwork(page);
		await openChat(page);
		await expect(speakerButton(page)).toHaveAttribute('aria-pressed', 'false');
		await speakerButton(page).click();
		await expect(speakerButton(page)).toHaveAttribute('aria-pressed', 'true');
		expect(await spokenList(page)).toContain('Spoken replies on.');
		expect(await lsKey(page, 'did.voice.spokenReplies')).toBe('1');

		await page.reload();
		await clickChatToggle(page);
		await expect(speakerButton(page)).toHaveAttribute('aria-pressed', 'true');

		const cancelsBefore = await cancelCount(page);
		const spokenBefore = (await spokenList(page)).length;
		await speakerButton(page).click();
		await expect(speakerButton(page)).toHaveAttribute('aria-pressed', 'false');
		expect(await cancelCount(page)).toBeGreaterThan(cancelsBefore);
		expect(await lsKey(page, 'did.voice.spokenReplies')).toBe('0');
		expect((await spokenList(page)).length).toBe(spokenBefore);
	});

	test('spoken replies: confirmations and replies are spoken', async ({ page }) => {
		await installFakeSR(page);
		await installFakeSpeech(page);
		await stubNetwork(page);
		await openChat(page);
		await speakerOn(page);

		await speak(page, 'show recurring grants');
		await expect(page.locator('.chat-msg.command')).toContainText('recurring grants');
		let spoken = await spokenList(page);
		expect(spoken.some((t) => t.startsWith('Showing'))).toBe(true);
		const order: string[] = await page.evaluate(() => (window as any).__order);
		order.forEach((e, i) => {
			if (e === 'speak' && order[i - 1] !== 'speak') expect(order[i - 1]).toBe('cancel');
		});
		expect(spoken.some((t) => t.includes('show recurring grants'))).toBe(false);

		await speak(page, 'reset');
		await speak(page, 'show gated');
		await expect(page.locator('.chat-msg.command').last()).toContainText('501(c)(3)');
		spoken = await spokenList(page);
		expect(spoken.some((t) => t.includes('five oh one C three'))).toBe(true);
		expect(spoken.some((t) => t.includes('501'))).toBe(false);

		const q = 'which grants are due soon for disability organisations';
		await speak(page, q);
		await expect.poll(async () => (await spokenList(page)).includes(COPY.asking)).toBe(true);
		await expect
			.poll(async () => (await spokenList(page)).includes('Hello from the assistant'), { timeout: 10_000 })
			.toBe(true);
		spoken = await spokenList(page);
		expect(spoken.some((t) => t.includes(q))).toBe(false);
		expect(spoken.some((t) => t.includes("Hi! I'm the DID grant assistant"))).toBe(false);
	});

	test('spoken replies: long reply is truncated', async ({ page }) => {
		await installFakeSpeech(page);
		await stubNetwork(page);
		await stubReply(page, 'word '.repeat(160).trim());
		await openChat(page);
		await speakerOn(page);
		await page.getByPlaceholder('Ask about grants...').fill('a long one');
		await page.getByPlaceholder('Ask about grants...').press('Enter');
		await expect(page.getByRole('status')).toContainText('Assistant: word', { timeout: 10_000 });
		await expect
			.poll(async () => (await spokenList(page)).at(-1) ?? '', { timeout: 5000 })
			.toContain('The rest is in the chat.');
		const spoken = await spokenList(page);
		const askIdx = spoken.indexOf(COPY.asking);
		const reply = spoken.slice(askIdx + 1).join(' ');
		expect(reply.endsWith('The rest is in the chat.')).toBe(true);
		expect(reply.length).toBeLessThanOrEqual(600 + 1 + 'The rest is in the chat.'.length);
	});

	test('spoken replies: not spoken while chat is closed', async ({ page }) => {
		await installFakeSpeech(page);
		await stubNetwork(page);
		await openChat(page);
		await speakerOn(page);
		await page.getByPlaceholder('Ask about grants...').fill('hello there');
		await page.getByPlaceholder('Ask about grants...').press('Enter');
		await page.getByRole('button', { name: 'Close chat' }).click();
		await expect(page.locator('.chat-panel')).toHaveCount(0);
		await expect(page.getByRole('status')).toContainText('Assistant: Hello from the assistant', {
			timeout: 10_000
		});
		expect((await spokenList(page)).some((t) => t.includes('Hello from the assistant'))).toBe(false);
	});

	test('spoken replies: Escape stops speech', async ({ page }) => {
		await installFakeSpeech(page);
		await stubNetwork(page);
		await openChat(page);
		await speakerOn(page);
		await page.evaluate(() => ((window as any).__speaking = true));
		const before = await cancelCount(page);
		await page.getByPlaceholder('Ask about grants...').focus();
		await page.keyboard.press('Escape');
		expect(await cancelCount(page)).toBeGreaterThan(before);
		await expect(speakerButton(page)).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('.chat-panel')).toBeVisible();
	});

	test('spoken replies: mic start cancels speech', async ({ page }) => {
		await installFakeSR(page);
		await installFakeSpeech(page);
		await stubNetwork(page);
		await openChat(page);
		await speakerOn(page);
		const before = await cancelCount(page);
		await micButton(page).click();
		await expect(micButton(page)).toHaveAttribute('aria-pressed', 'true');
		expect(await cancelCount(page)).toBeGreaterThan(before);
	});

	test('spoken replies: a reply arriving during a capture is not spoken into the mic', async ({ page }) => {
		await installFakeSR(page);
		await installFakeSpeech(page);
		await stubNetwork(page);
		await openChat(page);
		await speakerOn(page);
		await page.getByPlaceholder('Ask about grants...').fill('hello there');
		await page.getByPlaceholder('Ask about grants...').press('Enter');
		await expect(page.locator('.chat-msg.typing')).toBeVisible();

		// Open the mic while the question is still pending; an interim result stops the silence timer.
		const mic = micButton(page);
		await mic.click();
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await page.evaluate(() => (window as any).__interim('show'));

		await expect(page.locator('.chat-msg.bot', { hasText: 'Hello from the assistant' })).toBeVisible({
			timeout: 10_000
		});
		await expect(page.getByRole('status')).toContainText('Assistant: Hello from the assistant');
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		expect((await spokenList(page)).some((t) => t.includes('Hello from the assistant'))).toBe(false);

		// Turning spoken replies on mid-capture stays silent too.
		const before = (await spokenList(page)).length;
		await speakerButton(page).click();
		await speakerButton(page).click();
		await expect(speakerButton(page)).toHaveAttribute('aria-pressed', 'true');
		expect((await spokenList(page)).length).toBe(before);

		// Not queued either: after the capture ends only the new confirmation is spoken.
		await page.evaluate(() => (window as any).__say('show recurring grants'));
		await expect.poll(async () => (await spokenList(page)).some((t) => t.startsWith('Showing'))).toBe(true);
		expect((await spokenList(page)).some((t) => t.includes('Hello from the assistant'))).toBe(false);
	});

	test('spoken replies: toggle absent without speechSynthesis', async ({ page }) => {
		await page.addInitScript(() => {
			Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
		});
		await stubNetwork(page);
		await openChat(page);
		await expect(micButton(page)).toBeVisible();
		await expect(speakerButton(page)).toHaveCount(0);
	});
});

test.describe('voice layout', () => {
	test('voice mobile: collapse rule and sizes', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 800 });
		await installFakeSR(page);
		await installFakeSpeech(page);
		await stubNetwork(page);
		await openChat(page);
		await speakerOn(page);
		await speak(page, 'open templates');
		await expect(page.locator('.chat-panel')).toHaveCount(0);
		await expect(page.locator('.chat-toggle')).toBeFocused();
		await expect(page.getByRole('button', { name: /^TEMPLATES/ })).toHaveAttribute('aria-expanded', 'true');
		const spoken = await spokenList(page);
		expect(spoken.length).toBe(2);
		const order: string[] = await page.evaluate(() => (window as any).__order);
		expect(order.at(-1)).toBe('speak');

		await clickChatToggle(page);
		await expect(page.locator('.chat-msg.command')).toHaveCount(1);

		for (const loc of [
			micButton(page),
			speakerButton(page),
			page.getByRole('button', { name: 'Voice settings' }),
			page.getByRole('button', { name: 'Close chat' }),
			page.locator('.chat-send')
		]) {
			const box = await loc.boundingBox();
			expect(box).not.toBeNull();
			expect(box!.width).toBeGreaterThanOrEqual(44);
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}

		await page.setViewportSize({ width: 320, height: 568 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		await expect(page.locator('.chat-panel')).toBeVisible();
	});

	test('voice desktop: detail keeps chat open', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await installFakeSR(page);
		await stubNetwork(page);
		await openChat(page);
		await speak(page, 'open north star');
		await expect(page.locator('h2.funder')).toContainText('North Star');
		await expect(page.locator('.chat-panel')).toBeVisible();
		await speak(page, 'share');
		await expect(page.locator('.chat-panel')).toHaveCount(0);
		await expect(page.locator('.chat-toggle')).toBeFocused();
	});

	test('voice reduced motion: animation off, speech on', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await installFakeSR(page);
		await installFakeSpeech(page);
		await stubNetwork(page);
		await openChat(page);
		await speakerOn(page);
		await micButton(page).click();
		await expect(micButton(page)).toHaveAttribute('aria-pressed', 'true');
		const anim = await page.locator('.chat-mic').evaluate((el) => getComputedStyle(el).animationName);
		expect(anim).toBe('none');
		await page.evaluate(() => (window as any).__say('show recurring grants'));
		await expect.poll(async () => (await spokenList(page)).some((t) => t.startsWith('Showing'))).toBe(true);
	});
});

// ---------------------------------------------------------------- keyboard and a11y

type Focused = { tag: string; cls: string; label: string; text: string; placeholder: string };

const winVal = (page: Page, name: string) => page.evaluate((n) => (window as any)[n], name);

const describeFocus = (page: Page): Promise<Focused> =>
	page.evaluate(() => {
		const el = document.activeElement as HTMLElement | null;
		return {
			tag: el?.tagName.toLowerCase() ?? '',
			cls: el?.className && typeof el.className === 'string' ? el.className : '',
			label: el?.getAttribute('aria-label') ?? '',
			text: (el?.textContent ?? '').replace(/\s+/g, ' ').trim(),
			placeholder: el?.getAttribute('placeholder') ?? ''
		};
	});

/**
 * Press Tab (or Shift+Tab) until the focused element matches, within a bounded number of
 * presses. Returns every element visited so callers can assert order.
 */
async function tabUntil(
	page: Page,
	match: (f: Focused) => boolean,
	what: string,
	opts: { max?: number; shift?: boolean } = {}
): Promise<Focused[]> {
	const max = opts.max ?? 60;
	const visited: Focused[] = [];
	for (let i = 0; i < max; i++) {
		const f = await describeFocus(page);
		visited.push(f);
		if (match(f)) return visited;
		await page.keyboard.press(opts.shift ? 'Shift+Tab' : 'Tab');
	}
	throw new Error(`keyboard: never reached ${what} within ${max} Tab presses`);
}

const hasClass = (f: Focused, c: string) => f.cls.split(/\s+/).includes(c);
const isToggle = (f: Focused) => hasClass(f, 'chat-toggle');
const isMic = (f: Focused) => f.label === 'Voice input';
const isInput = (f: Focused) => f.placeholder === 'Ask about grants...';
const isSend = (f: Focused) => hasClass(f, 'chat-send');

/**
 * Open the chat with the keyboard only. Enter is retried until hydration has attached the
 * handler (a keypress on the prerendered button before hydration is lost).
 */
async function openChatByKeyboard(page: Page) {
	await page.goto('/Eman_dashboard/');
	await tabUntil(page, isToggle, 'the chat toggle');
	await expect(async () => {
		if ((await page.locator('.chat-panel').count()) === 0) await page.keyboard.press('Enter');
		await expect(page.locator('.chat-panel')).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 15_000 });
}

test.describe('voice keyboard', () => {
	test('keyboard: full flow without a pointer', async ({ page }) => {
		await installFakeSR(page);
		await stubNetwork(page);
		await openChatByKeyboard(page);

		// DOM order inside the chat: text input, then mic, then Send.
		const visited = await tabUntil(page, isMic, 'the voice input button');
		if (!visited.some(isInput)) {
			// The chat moved focus past the input on open; step back to confirm it precedes the mic.
			await page.keyboard.press('Shift+Tab');
			expect(isInput(await describeFocus(page))).toBe(true);
			await page.keyboard.press('Tab');
		}
		await page.keyboard.press('Tab');
		expect(isSend(await describeFocus(page))).toBe(true);
		await page.keyboard.press('Shift+Tab');
		expect(isMic(await describeFocus(page))).toBe(true);

		const mic = micButton(page);
		await page.keyboard.press('Space');
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await page.evaluate(() => (window as any).__say('open ford'));
		const choices = page.locator('.chat-msg.choices');
		await expect(choices).toBeVisible();

		await tabUntil(page, (f) => hasClass(f, 'dym-choice'), 'the first did-you-mean choice', {
			shift: true,
			max: 20
		});
		await page.keyboard.press('Enter');
		await expect(choices.locator('.dym-choice').first()).toBeDisabled();
		await expect(choices.locator('.dym-choice').nth(1)).toBeDisabled();
		await expect(page.locator('.chat-msg.command').last()).toContainText(/^\s*Opening/);
		await expect(mic).toBeFocused();
		expect((await describeFocus(page)).label).toBe('Voice input');

		await page.keyboard.press('Enter');
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await page.evaluate(() => (window as any).__say('show recurring grants'));
		await expect(page.locator('.chip', { hasText: 'Recurring' })).toHaveClass(/active/);

		await expect(mic).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(mic).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Escape');
		await expect(mic).toHaveAttribute('aria-pressed', 'false');
	});

	test('keyboard: existing controls still work', async ({ page }) => {
		await installFakeSR(page);
		await stubNetwork(page);
		await page.goto('/Eman_dashboard/');

		const templates = page.getByRole('button', { name: /^TEMPLATES/ });
		await tabUntil(page, (f) => f.text.startsWith('TEMPLATES'), 'the TEMPLATES toggle');
		await expect(async () => {
			await page.keyboard.press('Enter');
			await expect(templates).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
		}).toPass({ timeout: 15_000 });
		await page.keyboard.press('Escape');
		await expect(templates).toHaveAttribute('aria-expanded', 'false');

		const share = page.getByRole('button', { name: /^SHARE/ });
		await tabUntil(page, (f) => f.text.startsWith('SHARE'), 'the SHARE toggle');
		await page.keyboard.press('Enter');
		await expect(share).toHaveAttribute('aria-expanded', 'true');
		await page.keyboard.press('Space');
		await expect(share).toHaveAttribute('aria-expanded', 'false');

		const recurring = page.locator('.chip', { hasText: 'Recurring' });
		await tabUntil(page, (f) => f.text.includes('Recurring'), 'the Recurring chip', { shift: true });
		await page.keyboard.press('Enter');
		await expect(recurring).toHaveClass(/active/);
		// Space activates too: reset to All with Space on the All chip, then back on Recurring.
		const all = page.locator('.chip', { hasText: /^\s*All\s*$/ });
		await tabUntil(page, (f) => f.text === 'All', 'the All chip', { shift: true });
		await page.keyboard.press('Space');
		await expect(all).toHaveClass(/active/);
	});

	test('keyboard: mic button semantics', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await installFakeSR(page);
		await stubNetwork(page);
		await openChat(page);
		const mic = micButton(page);
		expect(await mic.evaluate((el) => el.tagName)).toBe('BUTTON');
		const box = await mic.boundingBox();
		expect(box!.width).toBeGreaterThanOrEqual(44);
		expect(box!.height).toBeGreaterThanOrEqual(44);
		await expect(mic).toHaveAttribute('aria-pressed', 'false');

		for (const key of ['Space', 'Enter']) {
			await mic.focus();
			await page.keyboard.press(key);
			await expect(mic).toHaveAttribute('aria-pressed', 'true');
			await page.keyboard.press('Escape');
			await expect(mic).toHaveAttribute('aria-pressed', 'false');
		}
		expect(await winVal(page, '__srStarted')).toBe(2);
	});
});

test.describe('voice a11y', () => {
	test('voice a11y: prerendered HTML', async ({ page, browser, baseURL }) => {
		const html = await (await page.request.get('/Eman_dashboard/')).text();
		expect(html.match(/role="status"/g) ?? []).toHaveLength(1);
		for (const marker of ['chat-mic', 'chat-speaker', 'chat-settings', 'voice-status']) {
			expect(html, marker).not.toContain(marker);
		}
		expect(html).toMatch(/(?:href|src)="[^"]*\/Eman_dashboard\/_app\//);

		const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL });
		try {
			const noJs = await ctx.newPage();
			const res = await noJs.goto('/Eman_dashboard/');
			expect(res?.status()).toBe(200);
			await expect(noJs.getByRole('status')).toHaveCount(1);
		} finally {
			await ctx.close();
		}
	});

	test('voice a11y: live region content rules', async ({ page }) => {
		await installFakeSR(page);
		await stubNetwork(page);
		await openChat(page);
		await speak(page, 'show recurring grants');
		const region = page.getByRole('status');
		await expect(region).toHaveText(/^\s*You said:/);

		await micButton(page).click();
		await expect(micButton(page)).toHaveAttribute('aria-pressed', 'true');
		await page.evaluate(() => (window as any).__interim('open the pipel'));
		await expect(page.locator('#voice-status')).toContainText('open the pipel');
		await expect(region).not.toContainText('open the pipel');
		const status = page.locator('#voice-status');
		expect(await status.getAttribute('aria-live')).toBeNull();
		expect(await status.getAttribute('role')).toBeNull();
	});
});
