import { describe, it, expect } from 'vitest';
import { ttsAvailable, toSpeech, chunkSpeech, speak, cancelSpeech, isSpeaking } from './tts';

function fakes() {
	const calls: string[] = [];
	const utts: any[] = [];
	const synth = {
		cancel: () => void calls.push('cancel'),
		speak: (u: any) => {
			calls.push('speak');
			utts.push(u);
		}
	};
	class Utterance {
		lang = '';
		voice: unknown = undefined;
		constructor(public text: string) {}
	}
	return { calls, utts, deps: { synth, Utterance } };
}

describe('toSpeech', () => {
	it('reads 501(c)(3) aloud', () => {
		expect(toSpeech('Needs 501(c)(3) status')).toBe('Needs five oh one C three status');
		expect(toSpeech('a 501c3 org')).toBe('a five oh one C three org');
	});
	it('strips markdown and urls', () => {
		expect(toSpeech('See [the site](https://x.org/a) now')).toBe('See the site now');
		expect(toSpeech('Go to https://example.com/page today')).toBe('Go to today');
		expect(toSpeech('**bold** # head `code`')).toBe('bold head code');
		expect(toSpeech('a \n\n  b')).toBe('a b');
	});
});

describe('chunkSpeech', () => {
	it('returns [] for empty', () => {
		expect(chunkSpeech('')).toEqual([]);
		expect(chunkSpeech('   ')).toEqual([]);
	});
	it('keeps chunks within max on sentence boundaries', () => {
		const text = Array.from({ length: 10 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
		const chunks = chunkSpeech(text, 60);
		expect(chunks.length).toBeGreaterThan(1);
		for (const c of chunks) expect(c.length).toBeLessThanOrEqual(60);
		expect(chunks.join(' ')).toBe(text);
	});
	it('splits an over-long sentence at the last space', () => {
		const long = Array.from({ length: 60 }, () => 'word').join(' ');
		const chunks = chunkSpeech(long, 50);
		for (const c of chunks) expect(c.length).toBeLessThanOrEqual(50);
		expect(chunks.join(' ')).toBe(long);
	});
});

describe('speak / cancelSpeech', () => {
	it('cancels first, then speaks each chunk with lang and no voice', () => {
		const { calls, utts, deps } = fakes();
		const text = Array.from({ length: 12 }, (_, i) => `This is sentence ${i} of the reply.`).join(' ');
		speak(text, deps);
		expect(calls[0]).toBe('cancel');
		expect(calls.filter((c) => c === 'cancel')).toHaveLength(1);
		expect(calls.filter((c) => c === 'speak').length).toBe(utts.length);
		expect(utts.length).toBeGreaterThan(1);
		for (const u of utts) {
			expect(u.lang).toBe('en-US');
			expect(u.voice).toBeUndefined();
			expect(u.text.length).toBeLessThanOrEqual(200);
		}
	});
	it('cleans and truncates the spoken text', () => {
		const { utts, deps } = fakes();
		speak('x '.repeat(400) + '501(c)(3)', deps);
		const all = utts.map((u) => u.text).join(' ');
		expect(all).toContain('The rest is in the chat.');
		const { utts: u2, deps: d2 } = fakes();
		speak('Needs 501(c)(3).', d2);
		expect(u2[0].text).toBe('Needs five oh one C three.');
	});
	it('does nothing for empty text or missing synth', () => {
		const { calls, deps } = fakes();
		speak('', deps);
		expect(calls).toEqual([]);
		expect(() => speak('hi', { synth: null })).not.toThrow();
	});
	it('cancelSpeech cancels, and is safe with no synth', () => {
		const { calls, deps } = fakes();
		cancelSpeech(deps);
		expect(calls).toEqual(['cancel']);
		expect(() => cancelSpeech({ synth: null })).not.toThrow();
		expect(() => cancelSpeech()).not.toThrow();
	});
});

describe('ttsAvailable', () => {
	it('is true only with speechSynthesis', () => {
		expect(ttsAvailable({ speechSynthesis: {} })).toBe(true);
		expect(ttsAvailable({})).toBe(false);
		expect(ttsAvailable()).toBe(false);
	});
});

describe('isSpeaking', () => {
	it('is true when the synth reports speaking', () => {
		const synth = { cancel() {}, speak() {}, speaking: true };
		expect(isSpeaking({ synth })).toBe(true);
	});
	it('is false when idle or when there is no synth', () => {
		const synth = { cancel() {}, speak() {}, speaking: false };
		expect(isSpeaking({ synth })).toBe(false);
		expect(isSpeaking({ synth: null })).toBe(false);
	});
});
