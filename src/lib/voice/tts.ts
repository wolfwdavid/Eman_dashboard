// Text-to-speech helpers. Browser globals are resolved lazily inside functions so
// the module imports cleanly during prerender and in node tests.
import { truncateReply } from './copy';

type Synth = {
	cancel(): void;
	speak(u: unknown): void;
	speaking?: boolean;
};
type TtsDeps = { synth?: Synth | null; Utterance?: new (text: string) => any };

function resolveSynth(deps?: TtsDeps): Synth | null {
	if (deps && 'synth' in deps) return deps.synth ?? null;
	return (globalThis as any).speechSynthesis ?? null;
}

function resolveUtterance(deps?: TtsDeps): (new (text: string) => any) | null {
	return deps?.Utterance ?? (globalThis as any).SpeechSynthesisUtterance ?? null;
}

export function ttsAvailable(win?: any): boolean {
	const w = win ?? (typeof window !== 'undefined' ? window : undefined);
	return !!(w && w.speechSynthesis);
}

/** Make text suitable for a speech engine. */
export function toSpeech(text: string): string {
	return text
		.replace(/501\s*\(c\)\s*\(3\)|501c3/gi, 'five oh one C three')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/https?:\/\/\S+/gi, '')
		.replace(/[*#`]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Split into sentence-bounded chunks of at most `max` characters. */
export function chunkSpeech(text: string, max = 200): string[] {
	const clean = text.trim();
	if (!clean) return [];
	const sentences = clean.match(/[^.!?]+[.!?]*\s*/g) ?? [clean];
	const out: string[] = [];
	let cur = '';
	const flush = () => {
		if (cur.trim()) out.push(cur.trim());
		cur = '';
	};
	for (const raw of sentences) {
		let s = raw.trim();
		if (!s) continue;
		while (s.length > max) {
			let cut = s.lastIndexOf(' ', max);
			if (cut <= 0) cut = max;
			flush();
			out.push(s.slice(0, cut).trim());
			s = s.slice(cut).trim();
		}
		if (!s) continue;
		if (cur && (cur + ' ' + s).length > max) flush();
		cur = cur ? cur + ' ' + s : s;
	}
	flush();
	return out;
}

export function cancelSpeech(deps?: TtsDeps): void {
	try {
		resolveSynth(deps)?.cancel();
	} catch {
		/* ignore */
	}
}

export function isSpeaking(deps?: TtsDeps): boolean {
	try {
		return !!resolveSynth(deps)?.speaking;
	} catch {
		return false;
	}
}

export function speak(text: string, deps?: TtsDeps): void {
	if (!text) return;
	const synth = resolveSynth(deps);
	const Utt = resolveUtterance(deps);
	if (!synth || !Utt) return;
	const chunks = chunkSpeech(toSpeech(truncateReply(text)));
	if (!chunks.length) return;
	synth.cancel();
	for (const c of chunks) {
		const u = new Utt(c);
		u.lang = 'en-US';
		synth.speak(u);
	}
}
