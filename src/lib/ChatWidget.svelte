<script>
	import { ui } from '$lib/state/crystarium.svelte.js';
	import { grants } from '$lib/data';
	import { dashboard } from '$lib/voice/dashboard.svelte.js';
	import { createActions } from '$lib/voice/actions';
	import { createRouter, isEmptyUtterance, capTranscript } from '$lib/voice/router';
	import { COPY, assistantLive } from '$lib/voice/copy';
	import { speak, cancelSpeech, isSpeaking, ttsAvailable } from '$lib/voice/tts';
	import { onMount, untrack, tick } from 'svelte';
	import {
		listen,
		startRecording,
		transcribeBlob,
		getSpeechRecognition,
		canRecord,
		isSecureContextSafe
	} from '$lib/voice/stt';
	import { getBool, setBool, PREF_KEYS } from '$lib/voice/prefs';

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

	// Spoken replies (D-04). Read from storage in onMount; the synth is touched only in handlers.
	let spoken = $state(false);
	let canSpeak = $state(false);

	/**
	 * The one gate for speech output. Speaks only when spoken replies are on and the chat
	 * is open, except for the confirmation of the command that just collapsed the chat.
	 */
	function say(/** @type {string} */ text, { allowClosed = false } = {}) {
		if (!spoken || !canSpeak) return;
		if (!open && !allowClosed) return;
		speak(text);
	}

	function toggleSpoken() {
		spoken = !spoken;
		setBool(PREF_KEYS.spokenReplies, spoken);
		// Turning on speaks inside the click handler, which unlocks Safari/iOS speech.
		if (spoken) speak(COPY.spokenOn);
		else cancelSpeech();
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
		say(COPY.asking);
		/** @param {string} t */
		const failBubble = (t) => {
			messages = messages.filter(m => m.from !== 'typing');
			pushBot(t);
			announce(t);
			say(t);
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
							say(String(job.reply ?? ''));
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
		// A typed message discards any capture in progress, silently.
		cancelCapture();
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
			say(r.spoken);
			return;
		}
		const o = r.pendingOutcome;
		if (o.kind === 'chosen') resolveChoices(o.id);
		else if (o.kind !== 'none') resolveChoices('none');
		if (r.type === 'command') {
			pushBot(r.text, { kind: 'command' });
			announce(r.live);
			// After a collapse the chat is closed: the confirmation is the one allowed exception.
			const collapsed = collapseRule(r.opened);
			say(r.spoken, { allowClosed: collapsed });
		} else if (r.type === 'busy') {
			pushBot(r.text);
			announce(r.live);
			say(r.text);
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
		const collapsed = collapseRule(res.opened);
		say(res.spoken, { allowClosed: collapsed });
		if (!collapsed) focusMic();
	}

	function cancelChoices(/** @type {any} */ msg) {
		if (msg.resolved !== undefined) return;
		msg.resolved = 'none';
		pending = undefined;
		const res = actions.run({ kind: 'cancel-pending' });
		pushBot(res.text, { kind: 'command' });
		announce(res.text);
		say(res.spoken);
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

	// ---------------------------------------------------------------- mic
	/** @type {'idle'|'listening'|'processing'|'error'|'blocked'|'unavailable'} */
	let micState = $state('idle');
	/** @type {null|'listening'|'processing'|'didnt'} */
	let statusKind = $state(null);
	let interim = $state('');
	let elapsed = $state(0);
	let mounted = $state(false);
	let statusServer = $state(false);
	/** @type {HTMLSpanElement | undefined} */
	let interimEl = $state();
	let sessionServer = false;
	let unavailableShown = false;
	let hasSR = $state(false);
	let hasRec = $state(false);
	// Voice settings strip and first-use privacy notice (D-16).
	let settingsOpen = $state(false);
	let forceServer = $state(false);
	/** @type {null | 'browser' | 'server'} */
	let noticeVisible = $state(null);
	/** Dismissal remembered for this page load when localStorage is unavailable. */
	const noticeSeenSession = { browser: false, server: false };
	/** @type {HTMLButtonElement | undefined} */
	let noticeStartEl = $state();
	/** @type {HTMLButtonElement | undefined} */
	let settingsBtnEl = $state();
	/**
	 * Current capture: browser recognizer or server recorder. Null when idle.
	 * @type {null | { kind: 'sr', h: { stop(): void, abort(): void } } | { kind: 'rec', rec: any, ac: AbortController, cancelled: boolean, stopRequested: boolean, uploading: boolean }}
	 */
	let capture = null;

	// Reads the in-memory choice, never storage: when localStorage is unavailable the write
	// is dropped, and the user who chose the server must still get the server.
	const useServerPath = () => hasRec && (forceServer || sessionServer || !hasSR);

	const MIC_TITLES = {
		idle: COPY.micTitleIdle,
		listening: COPY.micTitleListening,
		processing: COPY.micTitleProcessing,
		error: COPY.micTitleError,
		blocked: COPY.micTitleBlocked,
		unavailable: COPY.micTitleUnavailable
	};

	/** @param {number} s */
	function fmtTime(s) {
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}

	/** Silent cancel: stops the recognizer/recorder/upload, never announces or posts a bubble. */
	function cancelCapture() {
		const c = capture;
		capture = null;
		if (c) {
			if (c.kind === 'sr') c.h.abort();
			else {
				c.cancelled = true;
				c.ac.abort();
				c.rec?.cancel();
			}
		}
		statusKind = null;
		interim = '';
		elapsed = 0;
		if (micState === 'listening' || micState === 'processing' || micState === 'error') micState = 'idle';
	}

	/** @param {string} text */
	function failBubbleMic(text) {
		pushBot(text);
		announce(text);
		say(text);
	}

	function showDidnt() {
		capture = null;
		micState = 'idle';
		interim = '';
		statusKind = 'didnt';
		announce(COPY.didntCatchLive);
		say(`${COPY.didntCatchLead} ${COPY.didntCatchHint}`);
	}

	/** @param {string} t */
	function onTranscript(t) {
		capture = null;
		micState = 'idle';
		statusKind = null;
		interim = '';
		if (isEmptyUtterance(t)) showDidnt();
		else handleUtterance(t);
	}

	/** @param {string} code */
	function onSrFail(code) {
		capture = null;
		statusKind = null;
		interim = '';
		micState = 'idle';
		switch (code) {
			case 'no-speech':
				showDidnt();
				break;
			case 'aborted':
				break;
			case 'not-allowed':
				micState = 'blocked';
				failBubbleMic(COPY.errBlocked);
				break;
			case 'service-not-allowed':
				sessionServer = true;
				failBubbleMic(COPY.errServiceNotAllowed);
				break;
			case 'network':
				sessionServer = true;
				failBubbleMic(COPY.errNetwork);
				break;
			case 'audio-capture':
				micState = 'error';
				failBubbleMic(COPY.errNoMic);
				break;
			default:
				micState = 'error';
				failBubbleMic(COPY.errOther);
		}
	}

	function startBrowser() {
		micState = 'listening';
		statusKind = 'listening';
		statusServer = false;
		interim = '';
		// start() runs synchronously inside the click handler (user-gesture rule).
		const h = listen({ onInterim: (t) => (interim = t), onFinal: onTranscript, onFail: onSrFail });
		// listen() may already have failed synchronously (no recognizer): keep that outcome.
		if (micState === 'listening') capture = { kind: 'sr', h };
	}

	function startServer() {
		micState = 'listening';
		statusKind = 'listening';
		statusServer = true;
		interim = '';
		elapsed = 0;
		/** @type {any} */
		const cap = { kind: 'rec', rec: null, ac: new AbortController(), cancelled: false, stopRequested: false, uploading: false };
		capture = cap;
		/** @param {'not-allowed' | 'audio-capture' | 'other'} code */
		const onError = (code) => {
			if (capture !== cap) return;
			capture = null;
			statusKind = null;
			if (code === 'not-allowed') { micState = 'blocked'; failBubbleMic(COPY.errBlocked); }
			else if (code === 'audio-capture') { micState = 'error'; failBubbleMic(COPY.errNoMic); }
			else { micState = 'error'; failBubbleMic(COPY.errOther); }
		};
		// getUserMedia() is called synchronously by startRecording (user-gesture rule).
		startRecording({
			maxMs: 18000,
			onTick: (s) => { if (capture === cap) elapsed = s; },
			onAutoStop: (blob) => { if (capture === cap) upload(cap, blob); },
			onError
		}).then((rec) => {
			if (!rec) return;
			cap.rec = rec;
			if (cap.cancelled) rec.cancel();
			else if (cap.stopRequested) finishRecording(cap);
		}).catch(() => {
			// Anything unexpected while starting: release the mic and never stay in "listening".
			cap.rec?.cancel();
			onError('other');
		});
	}

	/** @param {any} cap */
	function finishRecording(cap) {
		if (capture !== cap || !cap.rec) return;
		micState = 'processing';
		statusKind = 'processing';
		cap.rec.stop().then((/** @type {Blob} */ blob) => {
			if (capture === cap) upload(cap, blob);
		});
	}

	/** @param {any} cap @param {Blob} blob */
	async function upload(cap, blob) {
		// One upload per capture: the 18 s auto-stop and a mic press in the gap before the
		// recorder's onstop both arrive here with the same clip.
		if (cap.uploading) return;
		cap.uploading = true;
		micState = 'processing';
		statusKind = 'processing';
		interim = '';
		const res = await transcribeBlob(BASE, blob, { timeoutMs: 20000, signal: cap.ac.signal });
		if (capture !== cap || cap.cancelled) return; // cancelled: no transcript, no announcement
		capture = null;
		statusKind = null;
		if (res.ok) {
			micState = 'idle';
			if (isEmptyUtterance(res.text)) showDidnt();
			else handleUtterance(res.text);
			return;
		}
		micState = 'error';
		const map = {
			'rate-limited': COPY.errRateLimited,
			'too-large': COPY.errTooLong,
			unsupported: COPY.errUnsupportedFormat,
			unreachable: COPY.errTranscribeUnreachable
		};
		failBubbleMic(map[res.reason]);
	}

	function onMic() {
		if (micState === 'processing') return;
		if (micState === 'unavailable') {
			if (!unavailableShown) {
				unavailableShown = true;
				failBubbleMic(COPY.errUnavailable);
			}
			return;
		}
		if (micState === 'listening') {
			const c = capture;
			if (c?.kind === 'sr') c.h.stop();
			else if (c) {
				c.stopRequested = true;
				finishRecording(c);
			}
			return;
		}
		const path = useServerPath() ? 'server' : 'browser';
		const key = path === 'server' ? PREF_KEYS.noticeServer : PREF_KEYS.noticeBrowser;
		if (!getBool(key) && !noticeSeenSession[path]) {
			// First press on this path: tell the user where the audio goes BEFORE capturing.
			cancelSpeech();
			statusKind = null;
			settingsOpen = false;
			noticeVisible = path;
			tick().then(() => noticeStartEl?.focus());
			return;
		}
		startCapture();
	}

	/** Synchronous (keeps the user gesture for getUserMedia / recognition.start). */
	function startCapture() {
		cancelSpeech();
		statusKind = null;
		if (useServerPath()) startServer();
		else startBrowser();
	}

	function acceptAndStart() {
		const path = noticeVisible ?? (useServerPath() ? 'server' : 'browser');
		setBool(path === 'server' ? PREF_KEYS.noticeServer : PREF_KEYS.noticeBrowser, true);
		noticeSeenSession[path] = true;
		noticeVisible = null;
		startCapture();
		focusMic();
	}

	function useServerAndStart() {
		forceServer = true;
		setBool(PREF_KEYS.forceServer, true);
		setBool(PREF_KEYS.noticeBrowser, true);
		setBool(PREF_KEYS.noticeServer, true);
		noticeSeenSession.browser = true;
		noticeSeenSession.server = true;
		noticeVisible = null;
		startCapture();
		focusMic();
	}

	function onForceServerChange(/** @type {Event & { currentTarget: HTMLInputElement }} */ e) {
		forceServer = e.currentTarget.checked;
		setBool(PREF_KEYS.forceServer, forceServer);
	}

	/**
	 * Escape handling on the panel. Ordered rules, first match wins. Later plans append in
	 * this order: (2) speech being read aloud, (3) privacy notice, (4) settings strip.
	 * Escape never closes the chat.
	 * @type {(() => boolean)[]}
	 */
	const escapeRules = [
		// (1) listening or processing: cancel and discard, silently.
		() => {
			if (micState !== 'listening' && micState !== 'processing') return false;
			cancelCapture();
			return true;
		},
		// (2) speech being read aloud: stop it; the toggle stays on.
		() => {
			if (!spoken || !isSpeaking()) return false;
			cancelSpeech();
			return true;
		},
		// (3) privacy notice: hide without remembering; focus returns to the mic.
		() => {
			if (!noticeVisible) return false;
			noticeVisible = null;
			focusMic();
			return true;
		},
		// (4) settings strip: close and return focus to the settings button.
		() => {
			if (!settingsOpen) return false;
			settingsOpen = false;
			settingsBtnEl?.focus();
			return true;
		}
	];

	/** @param {KeyboardEvent} e */
	function onPanelKeydown(e) {
		if (e.key !== 'Escape') return;
		for (const rule of escapeRules) {
			if (rule()) {
				e.stopPropagation();
				e.preventDefault();
				return;
			}
		}
	}

	function onInputTyping() {
		if (statusKind === 'didnt') statusKind = null;
	}

	onMount(() => {
		hasSR = !!getSpeechRecognition();
		hasRec = canRecord();
		const secure = isSecureContextSafe();
		micState = secure && (hasSR || hasRec) ? 'idle' : 'unavailable';
		forceServer = getBool(PREF_KEYS.forceServer);
		spoken = getBool(PREF_KEYS.spokenReplies);
		canSpeak = ttsAvailable();
		mounted = true;
		const onVis = () => { if (document.hidden) cancelCapture(); };
		document.addEventListener('visibilitychange', onVis);
		return () => {
			document.removeEventListener('visibilitychange', onVis);
			cancelCapture();
		};
	});

	// Closing the chat discards any capture and re-arms the once-per-open unavailable bubble.
	$effect(() => {
		if (!open) {
			untrack(() => {
				cancelCapture();
				noticeVisible = null;
				settingsOpen = false;
				unavailableShown = false;
			});
		}
	});

	// Keep the interim text scrolled to its end as it grows.
	$effect(() => {
		interim;
		if (interimEl) interimEl.scrollTop = interimEl.scrollHeight;
	});
</script>

{#snippet micIcon(/** @type {string} */ s)}
	<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		{#if s === 'listening'}
			<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />
		{:else if s === 'processing'}
			<path class="mic-arc" d="M12 4a8 8 0 1 0 8 8" />
			<g class="mic-dots"><circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" /></g>
		{:else}
			<rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" />
			{#if s === 'error'}<path d="M20 4v5" /><path d="M20 12.5v.01" />{/if}
			{#if s === 'blocked' || s === 'unavailable'}<path d="M4 4l16 16" />{/if}
		{/if}
	</svg>
{/snippet}

<button bind:this={toggleEl} class="chat-toggle" class:detail-open={ui.selected !== null} onclick={toggleChat} title="Chat with DID assistant">
	&#128172;
</button>
<div class="chat-live" role="status" aria-live="polite" aria-atomic="true">{liveText}</div>

{#if open}
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="chat-panel" class:detail-open={ui.selected !== null} role="dialog" aria-label="Chat with DID Grant Assistant" tabindex="-1" onkeydown={onPanelKeydown}>
	<div class="chat-head">
		<span class="chat-title">DID Grant Assistant</span>
		<div class="chat-head-actions">
			{#if mounted && canSpeak}
				<button type="button" class="chat-speaker" aria-label="Spoken replies"
					aria-pressed={spoken} title={spoken ? 'Spoken replies: on' : 'Spoken replies: off'}
					onclick={toggleSpoken}>
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M4 9v6h4l5 4V5L8 9H4z" />
						{#if spoken}<path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" />{:else}<path d="M17 9.5l4 5" /><path d="M21 9.5l-4 5" />{/if}
					</svg>
				</button>
			{/if}
			{#if micState !== 'unavailable'}
				<button type="button" class="chat-settings" aria-label="Voice settings"
					aria-expanded={settingsOpen} aria-controls="voice-settings" title="Voice settings"
					bind:this={settingsBtnEl} onclick={() => (settingsOpen = !settingsOpen)}>
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10" /><path d="M18 7h2" /><path d="M4 17h2" /><path d="M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
				</button>
			{/if}
			<button onclick={closeChat} aria-label="Close chat">&times;</button>
		</div>
	</div>
	{#if settingsOpen}
		<div id="voice-settings" class="voice-settings">
			<label class="vs-row">
				<input type="checkbox" checked={!hasSR || forceServer} disabled={!hasSR} onchange={onForceServerChange} />
				<span>Use server speech recognition</span>
			</label>
			<p class="vs-help">{hasSR ? COPY.settingsHelpBrowser : COPY.settingsHelpNoBrowser}</p>
			<p class="vs-help">{COPY.settingsHelpScreenReader}</p>
		</div>
	{/if}
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
	{#if noticeVisible}
		<div class="voice-notice" role="group" aria-labelledby="voice-notice-text">
			<p id="voice-notice-text">{noticeVisible === 'server' ? COPY.noticeServer : COPY.noticeBrowser}</p>
			<div class="vn-actions">
				<button type="button" class="vn-primary" aria-describedby="voice-notice-text" bind:this={noticeStartEl} onclick={acceptAndStart}>{COPY.noticeStart}</button>
				{#if noticeVisible === 'browser' && hasRec}
					<button type="button" class="vn-secondary" onclick={useServerAndStart}>{COPY.noticeUseServer}</button>
				{/if}
			</div>
		</div>
	{:else if statusKind}
		<div id="voice-status" class="voice-status">
			<strong class="lead">{statusKind === 'listening' ? COPY.listeningLead : statusKind === 'processing' ? COPY.transcribingLead : COPY.didntCatchLead}</strong>
			{#if statusKind === 'listening'}
				<span class="interim" bind:this={interimEl}>{interim || (statusServer ? COPY.hintServer : COPY.hintBrowser)}</span>
				{#if statusServer}<span class="timer">{fmtTime(elapsed)}</span>{/if}
			{:else if statusKind === 'didnt'}
				<span class="interim">{COPY.didntCatchHint}</span>
			{/if}
		</div>
	{/if}
	<div class="chat-input-row">
		<input
			type="text"
			placeholder="Ask about grants..."
			autocomplete="off"
			bind:this={inputEl}
			bind:value={inputVal}
			onkeydown={onKey}
			oninput={onInputTyping}
		/>
		{#if mounted}
			<button
				type="button"
				class="chat-mic"
				data-state={micState}
				aria-label="Voice input"
				aria-pressed={micState === 'listening'}
				aria-disabled={micState === 'processing' ? 'true' : undefined}
				aria-describedby={statusKind ? 'voice-status' : undefined}
				title={MIC_TITLES[micState]}
				bind:this={micEl}
				onclick={onMic}
			>{@render micIcon(micState)}</button>
		{/if}
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
	.chat-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.chat-head-actions { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
	/* Scoped to the new header buttons; the close button keeps its look. */
	.chat-head .chat-settings, .chat-head .chat-speaker {
		width: 32px; height: 32px; border-radius: 8px; padding: 0;
		background: none; border: none; color: var(--cw-on-brand);
		display: flex; align-items: center; justify-content: center; cursor: pointer;
	}
	.chat-head .chat-settings:focus-visible, .chat-head .chat-speaker:focus-visible { outline: 2px solid var(--cw-on-brand); outline-offset: 2px; }
	.chat-head .chat-settings[aria-expanded='true'], .chat-head .chat-speaker[aria-pressed='true'] {
		background: color-mix(in srgb, var(--cw-on-brand) 18%, transparent); opacity: 1;
	}

	/* Voice settings strip (UI-SPEC section 5) */
	.voice-settings {
		padding: 8px 16px; border-bottom: 1px solid var(--cw-border); background: var(--cw-sunken);
		color: var(--cw-text); display: flex; flex-direction: column; gap: 8px;
	}
	.vs-row { display: flex; align-items: center; gap: 8px; font-size: .88rem; cursor: pointer; }
	.vs-row input { width: 16px; height: 16px; margin: 0; accent-color: var(--cw-accent); }
	.vs-help { font-size: .75rem; line-height: 1.5; color: var(--cw-muted); margin: 0; }

	/* First-use privacy notice (UI-SPEC section 6) */
	.voice-notice {
		padding: 8px 16px; border-top: 1px solid var(--cw-border); background: var(--cw-sunken);
		color: var(--cw-text); font-size: .88rem; line-height: 1.45;
	}
	.voice-notice p { margin: 0 0 8px; }
	.vn-actions { display: flex; flex-wrap: wrap; gap: 8px; }
	.vn-primary, .vn-secondary {
		min-height: 32px; padding: 4px 16px; border-radius: 16px; font: inherit; cursor: pointer;
	}
	.vn-primary {
		border: 1px solid var(--cw-accent); background: var(--cw-accent);
		color: var(--cw-on-brand); font-weight: 600;
	}
	.vn-secondary {
		border: 1px solid var(--cw-border); background: transparent; color: var(--cw-text); font-weight: 400;
	}
	.vn-primary:focus-visible, .vn-secondary:focus-visible { outline: 2px solid var(--cw-accent); outline-offset: 2px; }

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

	/* Mic button (UI-SPEC section 1) */
	.chat-input-row input { min-width: 0; }
	.chat-mic {
		width: 44px; height: 44px; min-width: 44px; border-radius: 50%;
		margin-left: 8px; padding: 0; display: flex; align-items: center; justify-content: center;
		flex-shrink: 0; cursor: pointer;
		background: var(--cw-sunken); border: 1px solid var(--cw-border); color: var(--cw-icon);
		transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
	}
	.chat-mic:hover { border-color: var(--cw-accent); }
	.chat-mic:focus-visible { outline: 2px solid var(--cw-accent); outline-offset: 2px; }
	.chat-mic[data-state='listening'] {
		background: var(--cw-accent); border-color: var(--cw-accent); color: var(--cw-on-brand);
		animation: mic-pulse 1.4s ease-out infinite;
	}
	.chat-mic[data-state='listening']:focus-visible { outline-color: var(--cw-icon); }
	.chat-mic[data-state='processing'] { color: var(--cw-accent); cursor: default; }
	.chat-mic[data-state='processing'] .mic-arc { transform-origin: 12px 12px; animation: mic-spin 0.9s linear infinite; }
	.chat-mic .mic-dots { display: none; }
	.chat-mic[data-state='error'], .chat-mic[data-state='blocked'] {
		border: 1px dashed var(--cw-muted); color: var(--cw-muted);
	}
	.chat-mic[data-state='unavailable'] {
		border: 1px dashed var(--cw-border); color: var(--cw-muted); opacity: .6;
	}
	@keyframes mic-pulse {
		0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--cw-accent) 45%, transparent); }
		100% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--cw-accent) 0%, transparent); }
	}
	@keyframes mic-spin { to { transform: rotate(360deg); } }
	@media (prefers-reduced-motion: reduce) {
		.chat-mic[data-state='listening'] {
			animation: none;
			box-shadow: 0 0 0 4px color-mix(in srgb, var(--cw-accent) 35%, transparent);
		}
		.chat-mic[data-state='processing'] .mic-arc { animation: none; display: none; }
		.chat-mic[data-state='processing'] .mic-dots { display: inline; }
		.chat-mic { transition: none; }
	}

	/* Status strip (UI-SPEC section 2). Not a live region. */
	.voice-status {
		padding: 8px 16px; border-top: 1px solid var(--cw-border); background: var(--cw-surface);
		font-size: .88rem; line-height: 1.45; color: var(--cw-text);
	}
	.voice-status .lead { font-weight: 600; margin-right: 8px; color: var(--cw-text); }
	.voice-status .interim {
		font-style: italic; color: var(--cw-muted);
		display: inline-block; max-height: 4.35em; overflow-y: auto; vertical-align: top;
	}
	.voice-status .timer {
		float: right; font-size: .75rem; font-variant-numeric: tabular-nums; color: var(--cw-muted);
	}

	.chat-send {
		background: #14467a; color: #fff; border: none; border-radius: 50%;
		width: 36px; height: 36px; margin-left: 6px; cursor: pointer;
		font-size: 1rem; display: flex; align-items: center; justify-content: center;
	}
	.chat-send:disabled { opacity: .5; cursor: default; }

	/* Touch targets and short viewports (UI-SPEC section 8). Desktop is untouched. */
	@media (max-width: 768px) {
		.chat-panel { max-height: calc(100dvh - 104px); }
		.chat-messages { min-height: 120px; }
		.chat-head { padding: 4px 8px 4px 16px; }
		.chat-head .chat-speaker, .chat-head .chat-settings, .chat-head-actions > button {
			width: 44px; height: 44px;
		}
		.chat-head-actions > button[aria-label='Close chat'] { min-width: 44px; min-height: 44px; }
		.chat-send { width: 44px; height: 44px; }
		.vn-primary, .vn-secondary { min-height: 44px; }
		.vs-row { min-height: 44px; }
		.voice-status .interim { max-height: 2.9em; }
	}
	@media (max-height: 560px) {
		.chat-messages { min-height: 0; }
	}
</style>
