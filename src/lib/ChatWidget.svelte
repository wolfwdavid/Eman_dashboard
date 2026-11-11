<script>
	import { ui } from '$lib/state/crystarium.svelte.js';
	import { grants } from '$lib/data';
	import { dashboard } from '$lib/voice/dashboard.svelte.js';
	import { createActions } from '$lib/voice/actions';
	import { createRouter, isEmptyUtterance, capTranscript } from '$lib/voice/router';
	import { COPY, assistantLive } from '$lib/voice/copy';
	import { cancelSpeech } from '$lib/voice/tts';

	// The clock is read only here, at event time.
	const actions = createActions(dashboard, { grants, now: () => new Date() });
	const router = createRouter(actions, { grants });

	let open = $state(false);
	let busy = $state(false);
	let inputVal = $state('');
	let liveText = $state('');
	/** @type {{ id: string, label: string }[] | undefined} */
	let pending = $state(undefined);
	let nextId = 1;
	/**
	 * @type {{ id: number, from: string, text: string, kind?: string, options?: { id: string, label: string }[], resolved?: string }[]}
	 */
	let messages = $state([
		{ id: 0, text: "Hi! I'm the DID grant assistant. Ask me about grants, deadlines, scores, or applications.", from: 'bot' }
	]);
	/** @type {HTMLDivElement | undefined} */
	let messagesEl;
	/** @type {HTMLButtonElement | undefined} */
	let toggleEl = $state();
	/** @type {HTMLButtonElement | undefined} */
	let micEl = $state();
	/** @type {HTMLInputElement | undefined} */
	let inputEl = $state();

	const LOCAL = 'http://127.0.0.1:8080';
	let BASE = LOCAL;

	// Discover API: try localhost, fall back to tunnel URL from GitHub.
	async function loadConfig() {
		try {
			const r = await fetch(LOCAL + '/chat-config.json', { signal: AbortSignal.timeout(2000) });
			if (!r.ok) throw new Error();
		} catch {
			try {
				const r2 = await fetch('https://raw.githubusercontent.com/wolfwdavid/Eman_dashboard/main/agent/dashboard/chat-config.json?_=' + Date.now());
				if (r2.ok) { const c = await r2.json(); if (c.api_url) BASE = c.api_url; }
			} catch {}
		}
	}
	loadConfig();

	function scrollDown() {
		if (messagesEl) { const el = messagesEl; setTimeout(() => el.scrollTop = el.scrollHeight, 50); }
	}

	/** Replace (never append) the single live region text; re-announces identical text. */
	function announce(/** @type {string} */ text) {
		liveText = '';
		setTimeout(() => { liveText = text; }, 50);
	}

	function pushUser(/** @type {string} */ text) {
		messages = [...messages, { id: nextId++, text, from: 'user' }];
		scrollDown();
	}

	function pushBot(/** @type {string} */ text, /** @type {object} */ extra = {}) {
		messages = [...messages, { id: nextId++, text, from: 'bot', ...extra }];
		scrollDown();
	}

	/** Resolve the live choices bubble (if any) and clear pending. */
	function resolveChoices(/** @type {string} */ value) {
		for (const m of messages) {
			if (m.kind === 'choices' && m.resolved === undefined) m.resolved = value;
		}
		pending = undefined;
	}

	async function askAssistant(/** @type {string} */ text) {
		busy = true;
		messages = [...messages, { id: nextId++, text: COPY.asking, from: 'typing' }];
		scrollDown();
		/** @param {string} t */
		const failBubble = (t) => {
			messages = messages.filter(m => m.from !== 'typing');
			pushBot(t);
			announce(t);
		};
		try {
			const r = await fetch(BASE + '/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text })
			});
			const submit = await r.json();
			if (!submit.job_id) {
				failBubble(submit.reply || submit.error || 'No response.');
			} else {
				for (let i = 0; i < 120; i++) {
					await new Promise(ok => setTimeout(ok, 3000));
					try {
						const pr = await fetch(BASE + '/chat/' + submit.job_id);
						const job = await pr.json();
						if (job.status === 'done') {
							messages = messages.filter(m => m.from !== 'typing');
							pushBot(job.reply);
							announce(assistantLive(String(job.reply ?? '')));
							break;
						}
						if (job.status === 'error') {
							failBubble(job.reply || 'Something went wrong.');
							break;
						}
					} catch {}
				}
				// Timeout fallback
				if (messages.some(m => m.from === 'typing')) {
					failBubble('Timed out waiting for a reply.');
				}
			}
		} catch {
			failBubble('Could not reach the assistant. Is the bot running?');
		}
		busy = false;
		scrollDown();
	}

	// Typed path: straight to /chat, no command parsing.
	function send() {
		const text = inputVal.trim();
		if (!text || busy) return;
		inputVal = '';
		pushUser(text);
		resolveChoices('none');
		announce(COPY.asking);
		askAssistant(text);
	}

	function focusMic() {
		(micEl ?? inputEl)?.focus();
	}

	function collapseChat() {
		open = false;
		cancelSpeech();
		toggleEl?.focus();
	}

	/** One primary surface (UI-SPEC 3d). matchMedia is evaluated at event time. */
	function collapseRule(/** @type {string | null} */ opened) {
		if (!opened) return false;
		const mobile = window.matchMedia('(max-width: 768px)').matches;
		const collapse = mobile ? ['detail', 'templates', 'share'].includes(opened) : opened === 'share';
		if (collapse) collapseChat();
		return collapse;
	}

	/** A final transcript from the mic (wired in a later plan). Never touches inputVal. */
	function handleUtterance(/** @type {string} */ rawTranscript) {
		if (isEmptyUtterance(rawTranscript)) return;
		const text = capTranscript(rawTranscript);
		pushUser(text);
		const r = router.route(text, { pending, busy });
		if (r.type === 'choices') {
			resolveChoices('none');
			pushBot(r.text, { kind: 'choices', options: r.options, resolved: undefined });
			pending = r.options;
			announce(r.live);
			return;
		}
		const o = r.pendingOutcome;
		if (o.kind === 'chosen') resolveChoices(o.id);
		else if (o.kind !== 'none') resolveChoices('none');
		if (r.type === 'command') {
			pushBot(r.text, { kind: 'command' });
			announce(r.live);
			collapseRule(r.opened);
		} else if (r.type === 'busy') {
			pushBot(r.text);
			announce(r.live);
		} else {
			announce(r.live);
			askAssistant(r.text);
		}
	}

	function choose(/** @type {any} */ msg, /** @type {{ id: string, label: string }} */ option) {
		if (msg.resolved !== undefined) return;
		msg.resolved = option.id;
		pending = undefined;
		const res = actions.run({ kind: 'open-grant', id: option.id, label: option.label });
		pushBot(res.text, { kind: 'command' });
		announce(res.text);
		if (!collapseRule(res.opened)) focusMic();
	}

	function cancelChoices(/** @type {any} */ msg) {
		if (msg.resolved !== undefined) return;
		msg.resolved = 'none';
		pending = undefined;
		const res = actions.run({ kind: 'cancel-pending' });
		pushBot(res.text, { kind: 'command' });
		announce(res.text);
		focusMic();
	}

	function toggleChat() {
		if (open) cancelSpeech();
		open = !open;
	}

	function closeChat() {
		cancelSpeech();
		open = false;
	}

	/** @param {KeyboardEvent} e */
	function onKey(e) { if (e.key === 'Enter') send(); }
	// handleUtterance() is called by the mic wiring added in the next plan.
</script>

<button bind:this={toggleEl} class="chat-toggle" class:detail-open={ui.selected !== null} onclick={toggleChat} title="Chat with DID assistant">
	&#128172;
</button>
<div class="chat-live" role="status" aria-live="polite" aria-atomic="true">{liveText}</div>

{#if open}
<div class="chat-panel" class:detail-open={ui.selected !== null} role="dialog" aria-label="Chat with DID Grant Assistant">
	<div class="chat-head">
		<span>DID Grant Assistant</span>
		<button onclick={closeChat} aria-label="Close chat">&times;</button>
	</div>
	<div class="chat-messages" bind:this={messagesEl}>
		{#each messages as msg (msg.id)}
			{#if msg.kind === 'choices'}
				<div class="chat-msg bot choices" role="group" aria-labelledby="dym-{msg.id}">
					<p id="dym-{msg.id}" class="dym-title">{msg.text}</p>
					<ol class="dym-list">
						{#each msg.options ?? [] as o, i}
							<li>
								<button type="button" class="dym-choice" class:chosen={msg.resolved === o.id}
									class:dimmed={msg.resolved !== undefined && msg.resolved !== o.id}
									disabled={msg.resolved !== undefined} onclick={() => choose(msg, o)}>
									<span class="dym-num" aria-hidden="true">{#if msg.resolved === o.id}<svg class="dym-check" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{:else}{i + 1}{/if}</span>
									<span class="dym-label">{o.label}</span>
								</button>
							</li>
						{/each}
					</ol>
					<button type="button" class="dym-none" disabled={msg.resolved !== undefined} onclick={() => cancelChoices(msg)}>None of these</button>
					{#if msg.resolved === undefined}
						<p class="dym-hint">Pick one, or press the mic and say “the first one”.</p>
					{/if}
				</div>
			{:else if msg.kind === 'command'}
				<div class="chat-msg bot command">
					<svg class="cmd-glyph" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{msg.text}
				</div>
			{:else}
				<div class="chat-msg {msg.from}" class:typing={msg.from === 'typing'}>
					{msg.text}
				</div>
			{/if}
		{/each}
	</div>
	<div class="chat-input-row">
		<input
			type="text"
			placeholder="Ask about grants..."
			autocomplete="off"
			bind:this={inputEl}
			bind:value={inputVal}
			onkeydown={onKey}
		/>
		<button class="chat-send" onclick={send} disabled={busy} title="Send">&#10148;</button>
	</div>
</div>
{/if}

<style>
	.chat-live {
		position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
		overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;
	}

	.chat-toggle {
		position: fixed; bottom: 24px; right: 24px;
		width: 56px; height: 56px; border-radius: 50%;
		background: #14467a; color: #fff; border: none; cursor: pointer;
		font-size: 1.6rem; box-shadow: 0 4px 14px rgba(0,0,0,.25);
		z-index: 10000; display: flex; align-items: center; justify-content: center;
		transition: transform .2s, right 220ms cubic-bezier(.2, .8, .2, 1);
	}
	.chat-toggle:hover { transform: scale(1.08); }
	/* Desktop: sit beside the SHARE (QR) button instead of on top of it.
	   right = 24px (QR widget offset) + 109px (SHARE button width) + 12px gap.
	   Mobile (<=768px) keeps right: 24px; the QR widget already moves above the bubble there.
	   While a grant is selected, the bubble and panel slide left by the detail panel width. */
	@media (min-width: 769px) {
		.chat-toggle { right: 145px; }
		.chat-toggle.detail-open { right: calc(145px + var(--detail-panel-w)); }
		.chat-panel.detail-open { right: calc(24px + var(--detail-panel-w)); max-width: calc(100vw - var(--detail-panel-w) - 48px); }
	}
	@media (prefers-reduced-motion: reduce) {
		.chat-toggle, .chat-panel { transition: none; }
	}

	.chat-panel {
		/* Widget palette aliases (08-UI-SPEC Color). Light values; dark overrides below. */
		--cw-brand: #14467a;
		--cw-accent: #1f6fb2;
		--cw-surface: #fff;
		--cw-sunken: #f5f7fa;
		--cw-border: #dde5ee;
		--cw-text: #10233a;
		--cw-muted: #5b6b7d;
		--cw-icon: #14467a;
		--cw-on-brand: #fff;
		position: fixed; bottom: 90px; right: 24px;
		width: 380px; max-height: 520px;
		background: #fff; border: 1px solid #dde5ee; border-radius: 14px;
		box-shadow: 0 8px 30px rgba(0,0,0,.18); z-index: 10000;
		display: flex; flex-direction: column; overflow: hidden;
		transition: right 220ms cubic-bezier(.2, .8, .2, 1);
	}
	@media (prefers-color-scheme: dark) {
		.chat-panel {
			--cw-surface: #152233;
			--cw-sunken: #0d1520;
			--cw-border: #26364a;
			--cw-text: #e8eef5;
			--cw-muted: var(--text-lo);
			--cw-icon: #e8eef5;
		}
		.chat-panel { background: #152233; border-color: #26364a; }
		.chat-msg.bot { background: #0d1520; color: #e8eef5; border-color: #26364a; }
		.chat-input-row input { background: #0d1520; color: #e8eef5; border-color: #26364a; }
	}
	@media (max-width: 440px) { .chat-panel { width: calc(100vw - 20px); right: 10px; bottom: 80px; } }

	.chat-head {
		background: #14467a; color: #fff; padding: 14px 16px;
		font-weight: 600; font-size: .95rem;
		display: flex; justify-content: space-between; align-items: center;
	}
	.chat-head button {
		background: none; border: none; color: #fff;
		font-size: 1.2rem; cursor: pointer; opacity: .8;
	}
	.chat-head button:hover { opacity: 1; }

	.chat-messages {
		flex: 1; overflow-y: auto; padding: 14px;
		display: flex; flex-direction: column; gap: 10px;
		min-height: 280px; max-height: 380px;
	}

	.chat-msg {
		max-width: 85%; padding: 10px 14px; border-radius: 14px;
		font-size: .88rem; line-height: 1.45;
		word-wrap: break-word; white-space: pre-wrap;
	}
	.chat-msg.user {
		align-self: flex-end; background: #1f6fb2; color: #fff;
		border-bottom-right-radius: 4px;
	}
	.chat-msg.bot {
		align-self: flex-start; background: #f5f7fa; color: #10233a;
		border: 1px solid #dde5ee; border-bottom-left-radius: 4px;
	}
	.chat-msg.typing {
		align-self: flex-start; font-style: italic; color: #5b6b7d;
		border: 1px dashed #dde5ee; background: #f5f7fa;
		border-bottom-left-radius: 4px;
	}

	/* Command confirmation bubble */
	.cmd-glyph {
		color: var(--cw-accent); vertical-align: -3px; margin-right: 4px;
	}

	/* "Did you mean" choices bubble */
	.chat-msg.choices { max-width: 100%; align-self: stretch; white-space: normal; }
	.dym-title { font-size: inherit; font-weight: 400; margin: 0 0 8px; }
	.dym-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
	.dym-choice {
		width: 100%; min-height: 44px; padding: 8px 16px;
		display: flex; align-items: center; gap: 8px; text-align: left;
		border-radius: 16px; border: 1px solid var(--cw-border);
		background: var(--cw-surface); color: var(--cw-text);
		font: inherit; cursor: pointer;
	}
	.dym-choice:hover:not(:disabled), .dym-choice:focus-visible { border-color: var(--cw-accent); }
	.dym-choice:focus-visible, .dym-none:focus-visible { outline: 2px solid var(--cw-accent); outline-offset: 2px; }
	.dym-choice:disabled { cursor: default; }
	.dym-choice.chosen { border-color: var(--cw-accent); }
	.dym-choice.dimmed { opacity: .55; }
	.dym-num {
		width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
		background: var(--cw-accent); color: var(--cw-on-brand);
		font-size: .75rem; font-weight: 600;
		display: flex; align-items: center; justify-content: center;
	}
	.dym-label { overflow-wrap: anywhere; }
	.dym-none {
		min-height: 44px; padding: 8px 16px; background: none; border: none;
		color: var(--cw-muted); text-decoration: underline; font: inherit; cursor: pointer;
	}
	.dym-none:disabled { cursor: default; opacity: .55; }
	.dym-hint { font-size: .75rem; line-height: 1.5; color: var(--cw-muted); margin: 4px 0 0; }

	.chat-input-row {
		display: flex; align-items: center; border-top: 1px solid #dde5ee; padding: 8px;
	}
	.chat-input-row input {
		flex: 1; border: 1px solid #dde5ee; border-radius: 20px;
		padding: 8px 14px; font-size: .88rem;
		background: #f5f7fa; color: #10233a; outline: none; font-family: inherit;
	}
	.chat-input-row input:focus { border-color: #1f6fb2; }

	.chat-send {
		background: #14467a; color: #fff; border: none; border-radius: 50%;
		width: 36px; height: 36px; margin-left: 6px; cursor: pointer;
		font-size: 1rem; display: flex; align-items: center; justify-content: center;
	}
	.chat-send:disabled { opacity: .5; cursor: default; }
</style>
