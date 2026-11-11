// Speech-to-text: Web Speech recognizer wrapper, MediaRecorder helper and the
// /chat/transcribe client. No browser global is touched at module level; all
// access happens inside functions via injected deps or globalThis (prerender-safe).
// User-gesture rule: listen() calls start() and startRecording() calls
// getUserMedia() synchronously, before any await.

export type SttFailCode =
	| 'no-speech'
	| 'aborted'
	| 'not-allowed'
	| 'service-not-allowed'
	| 'network'
	| 'audio-capture'
	| 'language-not-supported'
	| 'other';

const PASSTHROUGH: ReadonlySet<string> = new Set([
	'no-speech',
	'aborted',
	'not-allowed',
	'service-not-allowed',
	'network',
	'audio-capture',
	'language-not-supported'
]);

function globalWin(): any {
	return typeof window !== 'undefined' ? window : undefined;
}

export function getSpeechRecognition(win?: any): (new () => any) | null {
	const w = win ?? globalWin();
	if (!w) return null;
	return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canRecord(win?: any, nav?: any): boolean {
	const w = win ?? globalWin();
	const n = nav ?? (typeof navigator !== 'undefined' ? navigator : undefined);
	return !!(w && w.MediaRecorder && n && n.mediaDevices && n.mediaDevices.getUserMedia);
}

export function isSecureContextSafe(win?: any): boolean {
	const w = win ?? globalWin();
	if (!w) return false;
	if (w.isSecureContext === true) return true;
	const host = w.location?.hostname;
	return host === 'localhost' || host === '127.0.0.1';
}

// ---------------------------------------------------------------- listen

type ListenOpts = {
	onInterim(t: string): void;
	onFinal(t: string): void;
	onFail(code: SttFailCode): void;
	silenceMs?: number;
	lang?: string;
};
type ListenDeps = {
	SR?: new () => any;
	setTimeout?: typeof setTimeout;
	clearTimeout?: typeof clearTimeout;
};

export function listen(opts: ListenOpts, deps: ListenDeps = {}): { stop(): void; abort(): void } {
	const SR = deps.SR ?? getSpeechRecognition();
	const st = deps.setTimeout ?? globalThis.setTimeout.bind(globalThis);
	const ct = deps.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);
	if (!SR) {
		opts.onFail('other');
		return { stop() {}, abort() {} };
	}

	const r = new SR();
	let settled = false;
	let gotResult = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const clearTimer = () => {
		if (timer !== undefined) {
			ct(timer);
			timer = undefined;
		}
	};
	// Single settle point: the first caller wins, the timer is always cleared.
	const settle = (fn: () => void) => {
		if (settled) return;
		settled = true;
		clearTimer();
		fn();
	};
	const tryAbort = () => {
		try {
			r.abort();
		} catch {
			/* engine already stopped */
		}
	};

	r.continuous = false;
	r.interimResults = true;
	r.maxAlternatives = 1;
	r.lang = opts.lang ?? 'en-US';

	r.onresult = (ev: any) => {
		if (settled) return;
		gotResult = true;
		clearTimer();
		const results = Array.from(ev.results as ArrayLike<any>);
		const text = results.map((x: any) => x[0]?.transcript ?? '').join('').trim();
		const last: any = results[results.length - 1];
		if (last && last.isFinal) settle(() => opts.onFinal(text));
		else opts.onInterim(text);
	};
	r.onerror = (ev: any) => {
		const raw = String(ev?.error ?? '');
		const code: SttFailCode = PASSTHROUGH.has(raw) ? (raw as SttFailCode) : 'other';
		settle(() => opts.onFail(code));
	};
	r.onend = () => {
		if (!gotResult) settle(() => opts.onFail('no-speech'));
		else settle(() => {});
	};

	r.start();
	timer = st(
		() => {
			timer = undefined;
			settle(() => opts.onFail('no-speech'));
			tryAbort();
		},
		opts.silenceMs ?? 8000
	);

	return {
		stop() {
			if (settled) return;
			try {
				r.stop();
			} catch {
				/* ignore */
			}
		},
		abort() {
			settled = true;
			clearTimer();
			tryAbort();
		}
	};
}

// ---------------------------------------------------------------- recording

const MIME_ORDER = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

export function pickMimeType(MR?: { isTypeSupported(t: string): boolean }): string | '' {
	const m = MR ?? (globalThis as any).MediaRecorder;
	if (!m || typeof m.isTypeSupported !== 'function') return '';
	for (const t of MIME_ORDER) {
		try {
			if (m.isTypeSupported(t)) return t;
		} catch {
			/* try next */
		}
	}
	return '';
}

export type Recording = { stop(): Promise<Blob>; cancel(): void; mimeType: string };

type RecordOpts = {
	maxMs?: number;
	onTick?(seconds: number): void;
	onAutoStop?(blob: Blob): void;
	onError(code: 'not-allowed' | 'audio-capture' | 'other'): void;
};

export async function startRecording(opts: RecordOpts, deps: any = {}): Promise<Recording | null> {
	const md =
		deps.mediaDevices ?? (typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined);
	const MR = deps.MediaRecorder ?? (globalThis as any).MediaRecorder;
	const st = deps.setTimeout ?? globalThis.setTimeout.bind(globalThis);
	const ct = deps.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);
	const si = deps.setInterval ?? globalThis.setInterval.bind(globalThis);
	const ci = deps.clearInterval ?? globalThis.clearInterval.bind(globalThis);
	if (!md || !md.getUserMedia || !MR) {
		opts.onError('other');
		return null;
	}

	let stream: any;
	try {
		// First action, synchronously in this call: keeps the user gesture.
		stream = await md.getUserMedia({ audio: true });
	} catch (e: any) {
		const name = e?.name;
		if (name === 'NotAllowedError' || name === 'SecurityError') opts.onError('not-allowed');
		else if (name === 'NotFoundError') opts.onError('audio-capture');
		else opts.onError('other');
		return null;
	}

	const stopTracks = () => {
		try {
			for (const t of stream.getTracks()) t.stop();
		} catch {
			/* ignore */
		}
	};

	let recorder: any;
	const mime = pickMimeType(MR);
	try {
		const recOpts: any = { audioBitsPerSecond: 32000 };
		if (mime) recOpts.mimeType = mime;
		recorder = new MR(stream, recOpts);
	} catch {
		stopTracks();
		opts.onError('other');
		return null;
	}

	const chunks: Blob[] = [];
	let cancelled = false;
	let finished = false;
	let tickTimer: any;
	let capTimer: any;
	let resolveBlob!: (b: Blob) => void;
	const blobPromise = new Promise<Blob>((res) => (resolveBlob = res));
	const mimeType: string = recorder.mimeType || mime || 'audio/webm';

	const clearTimers = () => {
		if (tickTimer !== undefined) ci(tickTimer);
		if (capTimer !== undefined) ct(capTimer);
		tickTimer = capTimer = undefined;
	};

	recorder.ondataavailable = (ev: any) => {
		if (!cancelled && ev?.data && ev.data.size !== 0) chunks.push(ev.data);
	};
	recorder.onstop = () => {
		clearTimers();
		stopTracks();
		resolveBlob(new Blob(cancelled ? [] : chunks, { type: mimeType }));
	};

	const finish = () => {
		if (!finished) {
			finished = true;
			clearTimers();
			try {
				if (recorder.state !== 'inactive') recorder.stop();
				else recorder.onstop?.();
			} catch {
				stopTracks();
				resolveBlob(new Blob(chunks, { type: mimeType }));
			}
		}
		return blobPromise;
	};

	let seconds = 0;
	recorder.start();
	if (opts.onTick) {
		tickTimer = si(() => {
			seconds += 1;
			opts.onTick?.(seconds);
		}, 1000);
	}
	capTimer = st(() => {
		capTimer = undefined;
		void finish().then((b) => {
			if (!cancelled) opts.onAutoStop?.(b);
		});
	}, opts.maxMs ?? 18000);

	return {
		mimeType,
		stop: () => finish(),
		cancel() {
			cancelled = true;
			chunks.length = 0;
			finish();
			stopTracks();
		}
	};
}

// ---------------------------------------------------------------- transcribe

export type TranscribeResult =
	| { ok: true; text: string }
	| { ok: false; reason: 'rate-limited' | 'too-large' | 'unsupported' | 'unreachable' };

export async function transcribeBlob(
	base: string,
	blob: Blob,
	opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<TranscribeResult> {
	const f = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
	const timeoutMs = opts.timeoutMs ?? 20000;
	const ac = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<'timeout'>((res) => {
		timer = setTimeout(() => {
			ac.abort();
			res('timeout');
		}, timeoutMs);
	});
	const unreachable: TranscribeResult = { ok: false, reason: 'unreachable' };
	try {
		const req = f(`${base}/chat/transcribe`, {
			method: 'POST',
			headers: { 'Content-Type': blob.type },
			body: blob,
			signal: ac.signal
		});
		// Swallow a late rejection after the timeout won the race.
		req.catch(() => {});
		const res = await Promise.race([req, timeout]);
		if (res === 'timeout') return unreachable;
		if (res.status === 429) return { ok: false, reason: 'rate-limited' };
		if (res.status === 413) return { ok: false, reason: 'too-large' };
		if (res.status === 415) return { ok: false, reason: 'unsupported' };
		if (!res.ok) return unreachable;
		const data = await res.json();
		if (!data || typeof data.text !== 'string') return unreachable;
		return { ok: true, text: data.text };
	} catch {
		return unreachable;
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
