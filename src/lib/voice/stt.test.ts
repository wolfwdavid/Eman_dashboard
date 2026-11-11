import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	getSpeechRecognition,
	canRecord,
	isSecureContextSafe,
	listen,
	pickMimeType,
	startRecording,
	transcribeBlob
} from './stt';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

class FakeSR {
	static last: FakeSR;
	continuous = true;
	interimResults = false;
	maxAlternatives = 0;
	lang = '';
	started = 0;
	stopped = 0;
	aborted = 0;
	onresult: ((e: any) => void) | null = null;
	onerror: ((e: any) => void) | null = null;
	onend: (() => void) | null = null;
	constructor() {
		FakeSR.last = this;
	}
	start() {
		this.started++;
	}
	stop() {
		this.stopped++;
	}
	abort() {
		this.aborted++;
	}
	emitResults(parts: { t: string; final: boolean }[]) {
		const results = parts.map((p) => Object.assign([{ transcript: p.t }], { isFinal: p.final }));
		this.onresult?.({ results });
	}
}

function mkListen(extra: Record<string, unknown> = {}) {
	const cb = { onInterim: vi.fn(), onFinal: vi.fn(), onFail: vi.fn() };
	const h = listen({ ...cb, ...extra } as any, { SR: FakeSR as any });
	return { cb, h, sr: FakeSR.last };
}

describe('capability probes', () => {
	it('getSpeechRecognition is null in node, finds webkit prefix', () => {
		expect(getSpeechRecognition()).toBeNull();
		class W {}
		expect(getSpeechRecognition({ webkitSpeechRecognition: W })).toBe(W);
		class S {}
		expect(getSpeechRecognition({ SpeechRecognition: S, webkitSpeechRecognition: W })).toBe(S);
		expect(getSpeechRecognition({})).toBeNull();
	});
	it('canRecord', () => {
		expect(canRecord()).toBe(false);
		expect(canRecord({}, { mediaDevices: { getUserMedia() {} } })).toBe(false);
		expect(canRecord({ MediaRecorder: class {} }, { mediaDevices: { getUserMedia() {} } })).toBe(true);
		expect(canRecord({ MediaRecorder: class {} }, {})).toBe(false);
	});
	it('isSecureContextSafe', () => {
		expect(isSecureContextSafe()).toBe(false);
		expect(isSecureContextSafe({ isSecureContext: true })).toBe(true);
		expect(isSecureContextSafe({ isSecureContext: false, location: { hostname: 'localhost' } })).toBe(true);
		expect(isSecureContextSafe({ location: { hostname: '127.0.0.1' } })).toBe(true);
		expect(isSecureContextSafe({ isSecureContext: false, location: { hostname: 'example.com' } })).toBe(false);
	});
});

describe('listen', () => {
	it('configures the engine and starts synchronously', () => {
		const { sr } = mkListen({ lang: 'en-GB' });
		expect(sr.started).toBe(1);
		expect(sr.continuous).toBe(false);
		expect(sr.interimResults).toBe(true);
		expect(sr.maxAlternatives).toBe(1);
		expect(sr.lang).toBe('en-GB');
		expect(mkListen().sr.lang).toBe('en-US');
	});

	it('joins ALL results for interim and delivers a trimmed final once', () => {
		const { cb, sr } = mkListen();
		sr.emitResults([
			{ t: 'show ', final: true },
			{ t: 'recurring', final: false }
		]);
		expect(cb.onInterim).toHaveBeenCalledWith('show recurring');
		expect(cb.onFinal).not.toHaveBeenCalled();
		sr.emitResults([{ t: '  show recurring grants ', final: true }]);
		expect(cb.onFinal).toHaveBeenCalledTimes(1);
		expect(cb.onFinal).toHaveBeenCalledWith('show recurring grants');
		sr.onend?.();
		expect(cb.onFail).not.toHaveBeenCalled();
	});

	it('settles exactly once: silence timer, then engine error and end', () => {
		const { cb, sr } = mkListen();
		vi.advanceTimersByTime(7999);
		expect(cb.onFail).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(cb.onFail).toHaveBeenCalledTimes(1);
		expect(cb.onFail).toHaveBeenCalledWith('no-speech');
		expect(sr.aborted).toBe(1);
		sr.onerror?.({ error: 'aborted' });
		sr.onerror?.({ error: 'no-speech' });
		sr.onend?.();
		expect(cb.onFail).toHaveBeenCalledTimes(1);
	});

	it('honours a custom silenceMs', () => {
		const { cb } = mkListen({ silenceMs: 1000 });
		vi.advanceTimersByTime(1000);
		expect(cb.onFail).toHaveBeenCalledWith('no-speech');
	});

	it('first result clears the silence timer', () => {
		const { cb, sr } = mkListen();
		sr.emitResults([{ t: 'hi', final: false }]);
		vi.advanceTimersByTime(20000);
		expect(cb.onFail).not.toHaveBeenCalled();
	});

	it('end with no result is a single no-speech failure', () => {
		const { cb, sr } = mkListen();
		sr.onend?.();
		sr.onend?.();
		vi.advanceTimersByTime(20000);
		expect(cb.onFail).toHaveBeenCalledTimes(1);
		expect(cb.onFail).toHaveBeenCalledWith('no-speech');
	});

	it('maps engine errors, unknown to other', () => {
		for (const code of [
			'no-speech',
			'aborted',
			'not-allowed',
			'service-not-allowed',
			'network',
			'audio-capture',
			'language-not-supported'
		]) {
			const { cb, sr } = mkListen();
			sr.onerror?.({ error: code });
			expect(cb.onFail).toHaveBeenCalledWith(code);
		}
		const { cb, sr } = mkListen();
		sr.onerror?.({ error: 'bad-grammar' });
		expect(cb.onFail).toHaveBeenCalledWith('other');
	});

	it('abort() settles silently', () => {
		const { cb, h, sr } = mkListen();
		h.abort();
		sr.onerror?.({ error: 'aborted' });
		sr.onend?.();
		sr.emitResults([{ t: 'late', final: true }]);
		vi.advanceTimersByTime(20000);
		expect(cb.onFail).not.toHaveBeenCalled();
		expect(cb.onFinal).not.toHaveBeenCalled();
		expect(cb.onInterim).not.toHaveBeenCalled();
		expect(sr.aborted).toBe(1);
	});

	it('stop() asks the engine to stop and the pending final still arrives', () => {
		const { cb, h, sr } = mkListen();
		h.stop();
		expect(sr.stopped).toBe(1);
		sr.emitResults([{ t: 'open ford', final: true }]);
		sr.onend?.();
		expect(cb.onFinal).toHaveBeenCalledWith('open ford');
		expect(cb.onFail).not.toHaveBeenCalled();
	});
});

describe('pickMimeType', () => {
	const mr = (ok: string[]) => ({ isTypeSupported: (t: string) => ok.includes(t) });
	it('follows the preference order', () => {
		expect(pickMimeType(mr(['audio/mp4', 'audio/webm', 'audio/webm;codecs=opus']))).toBe(
			'audio/webm;codecs=opus'
		);
		expect(pickMimeType(mr(['audio/mp4', 'audio/webm']))).toBe('audio/webm');
		expect(pickMimeType(mr(['audio/mp4', 'audio/ogg;codecs=opus']))).toBe('audio/ogg;codecs=opus');
		expect(pickMimeType(mr(['audio/mp4']))).toBe('audio/mp4');
		expect(pickMimeType(mr([]))).toBe('');
	});
});

describe('startRecording', () => {
	function rig(opts: { rejectWith?: string; supported?: string[] } = {}) {
		const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
		const stream = { getTracks: () => tracks };
		const getUserMedia = vi.fn(() =>
			opts.rejectWith
				? Promise.reject(Object.assign(new Error('x'), { name: opts.rejectWith }))
				: Promise.resolve(stream)
		);
		let rec: any;
		class FakeMR {
			static isTypeSupported = (t: string) => (opts.supported ?? ['audio/webm']).includes(t);
			state = 'inactive';
			mimeType: string;
			ondataavailable: ((e: any) => void) | null = null;
			onstop: (() => void) | null = null;
			ctorOpts: any;
			constructor(
				public stream: any,
				o: any
			) {
				this.ctorOpts = o;
				this.mimeType = o?.mimeType ?? '';
				rec = this;
			}
			start() {
				this.state = 'recording';
			}
			stop() {
				this.state = 'inactive';
				this.ondataavailable?.({ data: new Blob(['abc']) });
				this.onstop?.();
			}
		}
		const deps = { mediaDevices: { getUserMedia }, MediaRecorder: FakeMR };
		return { deps, getUserMedia, tracks, rec: () => rec };
	}

	it('calls getUserMedia synchronously and builds a typed blob on stop', async () => {
		const { deps, getUserMedia, tracks, rec } = rig();
		const onError = vi.fn();
		const p = startRecording({ onError }, deps);
		expect(getUserMedia).toHaveBeenCalledTimes(1);
		expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
		const r = await p;
		expect(r).not.toBeNull();
		expect(r!.mimeType).toBe('audio/webm');
		expect(rec().ctorOpts).toEqual({ audioBitsPerSecond: 32000, mimeType: 'audio/webm' });
		const blob = await r!.stop();
		expect(blob.type).toBe('audio/webm');
		expect(blob.size).toBe(3);
		for (const t of tracks) expect(t.stop).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
	});

	it('omits mimeType when none is supported', async () => {
		const { deps, rec } = rig({ supported: [] });
		await startRecording({ onError: vi.fn() }, deps);
		expect(rec().ctorOpts).toEqual({ audioBitsPerSecond: 32000 });
	});

	it('ticks each second and auto-stops at maxMs with tracks released', async () => {
		const { deps, tracks } = rig();
		const onTick = vi.fn();
		const onAutoStop = vi.fn();
		await startRecording({ onTick, onAutoStop, onError: vi.fn(), maxMs: 3000 }, deps);
		vi.advanceTimersByTime(2000);
		expect(onTick.mock.calls.map((c) => c[0])).toEqual([1, 2]);
		expect(onAutoStop).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1000);
		expect(onAutoStop).toHaveBeenCalledTimes(1);
		expect(onAutoStop.mock.calls[0][0].type).toBe('audio/webm');
		for (const t of tracks) expect(t.stop).toHaveBeenCalled();
		const ticks = onTick.mock.calls.length;
		vi.advanceTimersByTime(5000);
		expect(onTick.mock.calls.length).toBe(ticks);
	});

	it('defaults the cap to 18 s', async () => {
		const { deps } = rig();
		const onAutoStop = vi.fn();
		await startRecording({ onAutoStop, onError: vi.fn() }, deps);
		await vi.advanceTimersByTimeAsync(17999);
		expect(onAutoStop).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(onAutoStop).toHaveBeenCalledTimes(1);
	});

	it('cancel() discards chunks silently and stops tracks', async () => {
		const { deps, tracks } = rig();
		const onAutoStop = vi.fn();
		const r = await startRecording({ onAutoStop, onError: vi.fn() }, deps);
		r!.cancel();
		for (const t of tracks) expect(t.stop).toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(30000);
		expect(onAutoStop).not.toHaveBeenCalled();
		const blob = await r!.stop();
		expect(blob.size).toBe(0);
	});

	it('maps getUserMedia rejections', async () => {
		for (const [name, code] of [
			['NotAllowedError', 'not-allowed'],
			['SecurityError', 'not-allowed'],
			['NotFoundError', 'audio-capture'],
			['AbortError', 'other']
		] as const) {
			const { deps } = rig({ rejectWith: name });
			const onError = vi.fn();
			expect(await startRecording({ onError }, deps)).toBeNull();
			expect(onError).toHaveBeenCalledWith(code);
		}
	});

	it('reports other when the APIs are missing', async () => {
		const onError = vi.fn();
		expect(await startRecording({ onError }, { mediaDevices: undefined, MediaRecorder: undefined })).toBeNull();
		expect(onError).toHaveBeenCalledWith('other');
	});
});

describe('transcribeBlob', () => {
	const blob = new Blob(['audio'], { type: 'audio/webm;codecs=opus' });
	const resp = (status: number, body?: unknown, badJson = false) =>
		({
			status,
			ok: status >= 200 && status < 300,
			json: async () => {
				if (badJson) throw new Error('bad json');
				return body;
			}
		}) as unknown as Response;

	it('posts the blob with its type verbatim as Content-Type', async () => {
		const fetchImpl = vi.fn(async () => resp(200, { text: 'x' }));
		const r = await transcribeBlob('http://h:1', blob, { fetchImpl: fetchImpl as any });
		expect(r).toEqual({ ok: true, text: 'x' });
		const [url, init] = fetchImpl.mock.calls[0] as any;
		expect(url).toBe('http://h:1/chat/transcribe');
		expect(init.method).toBe('POST');
		expect(init.headers['Content-Type']).toBe('audio/webm;codecs=opus');
		expect(init.body).toBe(blob);
	});

	it('accepts an empty transcript', async () => {
		const r = await transcribeBlob('b', blob, { fetchImpl: (async () => resp(200, { text: '' })) as any });
		expect(r).toEqual({ ok: true, text: '' });
	});

	it('maps statuses 429, 413, 415, 503, 500', async () => {
		const run = (s: number) =>
			transcribeBlob('b', blob, { fetchImpl: (async () => resp(s, {})) as any });
		expect(await run(429)).toEqual({ ok: false, reason: 'rate-limited' });
		expect(await run(413)).toEqual({ ok: false, reason: 'too-large' });
		expect(await run(415)).toEqual({ ok: false, reason: 'unsupported' });
		expect(await run(503)).toEqual({ ok: false, reason: 'unreachable' });
		expect(await run(500)).toEqual({ ok: false, reason: 'unreachable' });
	});

	it('network error and invalid JSON are unreachable', async () => {
		const net = await transcribeBlob('b', blob, {
			fetchImpl: (async () => {
				throw new TypeError('network');
			}) as any
		});
		expect(net).toEqual({ ok: false, reason: 'unreachable' });
		const bad = await transcribeBlob('b', blob, { fetchImpl: (async () => resp(200, null, true)) as any });
		expect(bad).toEqual({ ok: false, reason: 'unreachable' });
		const shape = await transcribeBlob('b', blob, { fetchImpl: (async () => resp(200, { nope: 1 })) as any });
		expect(shape).toEqual({ ok: false, reason: 'unreachable' });
	});

	it('times out to unreachable and aborts the request', async () => {
		let signal: AbortSignal | undefined;
		const fetchImpl = vi.fn(
			(_u: string, init: any) =>
				new Promise<Response>((_res, rej) => {
					signal = init.signal;
					init.signal.addEventListener('abort', () => rej(new Error('aborted')));
				})
		);
		const p = transcribeBlob('b', blob, { fetchImpl: fetchImpl as any, timeoutMs: 20000 });
		await vi.advanceTimersByTimeAsync(19999);
		let settled = false;
		void p.then(() => (settled = true));
		await Promise.resolve();
		expect(settled).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(await p).toEqual({ ok: false, reason: 'unreachable' });
		expect(signal!.aborted).toBe(true);
	});
});
