<script>
	let open = $state(false);
	let busy = $state(false);
	let inputVal = $state('');
	let messages = $state([
		{ text: "Hi! I'm the DID grant assistant. Ask me about grants, deadlines, scores, or applications.", from: 'bot' }
	]);
	/** @type {HTMLDivElement | undefined} */
	let messagesEl;

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

	async function send() {
		const text = inputVal.trim();
		if (!text || busy) return;
		messages = [...messages, { text, from: 'user' }];
		inputVal = '';
		busy = true;
		messages = [...messages, { text: 'Thinking...', from: 'typing' }];
		scrollDown();
		try {
			const r = await fetch(BASE + '/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text })
			});
			const submit = await r.json();
			if (!submit.job_id) {
				messages = messages.filter(m => m.from !== 'typing');
				messages = [...messages, { text: submit.reply || submit.error || 'No response.', from: 'bot' }];
			} else {
				for (let i = 0; i < 120; i++) {
					await new Promise(ok => setTimeout(ok, 3000));
					try {
						const pr = await fetch(BASE + '/chat/' + submit.job_id);
						const job = await pr.json();
						if (job.status === 'done') {
							messages = messages.filter(m => m.from !== 'typing');
							messages = [...messages, { text: job.reply, from: 'bot' }];
							break;
						}
						if (job.status === 'error') {
							messages = messages.filter(m => m.from !== 'typing');
							messages = [...messages, { text: job.reply || 'Something went wrong.', from: 'bot' }];
							break;
						}
					} catch {}
				}
				// Timeout fallback
				if (messages.some(m => m.from === 'typing')) {
					messages = messages.filter(m => m.from !== 'typing');
					messages = [...messages, { text: 'Timed out waiting for a reply.', from: 'bot' }];
				}
			}
		} catch {
			messages = messages.filter(m => m.from !== 'typing');
			messages = [...messages, { text: 'Could not reach the assistant. Is the bot running?', from: 'bot' }];
		}
		busy = false;
		scrollDown();
	}

	/** @param {KeyboardEvent} e */
	function onKey(e) { if (e.key === 'Enter') send(); }
</script>

<button class="chat-toggle" onclick={() => open = !open} title="Chat with DID assistant">
	&#128172;
</button>

{#if open}
<div class="chat-panel" role="dialog" aria-label="Chat with DID Grant Assistant">
	<div class="chat-head">
		<span>DID Grant Assistant</span>
		<button onclick={() => open = false} aria-label="Close chat">&times;</button>
	</div>
	<div class="chat-messages" bind:this={messagesEl}>
		{#each messages as msg}
			<div class="chat-msg {msg.from}" class:typing={msg.from === 'typing'}>
				{msg.text}
			</div>
		{/each}
	</div>
	<div class="chat-input-row">
		<input
			type="text"
			placeholder="Ask about grants..."
			autocomplete="off"
			bind:value={inputVal}
			onkeydown={onKey}
		/>
		<button class="chat-send" onclick={send} disabled={busy} title="Send">&#10148;</button>
	</div>
</div>
{/if}

<style>
	.chat-toggle {
		position: fixed; bottom: 24px; right: 24px;
		width: 56px; height: 56px; border-radius: 50%;
		background: #14467a; color: #fff; border: none; cursor: pointer;
		font-size: 1.6rem; box-shadow: 0 4px 14px rgba(0,0,0,.25);
		z-index: 10000; display: flex; align-items: center; justify-content: center;
		transition: transform .2s;
	}
	.chat-toggle:hover { transform: scale(1.08); }

	.chat-panel {
		position: fixed; bottom: 90px; right: 24px;
		width: 380px; max-height: 520px;
		background: #fff; border: 1px solid #dde5ee; border-radius: 14px;
		box-shadow: 0 8px 30px rgba(0,0,0,.18); z-index: 10000;
		display: flex; flex-direction: column; overflow: hidden;
	}
	@media (prefers-color-scheme: dark) {
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

	.chat-input-row {
		display: flex; border-top: 1px solid #dde5ee; padding: 8px;
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
