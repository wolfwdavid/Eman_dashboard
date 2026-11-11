// Voice preferences: SSR-safe localStorage wrapper. Storage is resolved inside
// each call so importing this module during prerender never touches a browser
// global; every access is guarded because private mode can throw.

export const PREF_KEYS = {
	spokenReplies: 'did.voice.spokenReplies',
	forceServer: 'did.voice.forceServer',
	noticeBrowser: 'did.voice.notice.browser',
	noticeServer: 'did.voice.notice.server'
} as const;

function resolve(storage?: Storage | null): Storage | null {
	if (storage !== undefined) return storage;
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

export function getPref(key: string, storage?: Storage | null): string | null {
	try {
		const s = resolve(storage);
		return s ? s.getItem(key) : null;
	} catch {
		return null;
	}
}

export function setPref(key: string, value: string, storage?: Storage | null): void {
	try {
		const s = resolve(storage);
		if (s) s.setItem(key, value);
	} catch {
		/* private mode / quota: degrade to defaults */
	}
}

/** Only the exact string '1' is true; anything else is false. */
export function getBool(key: string, storage?: Storage | null): boolean {
	return getPref(key, storage) === '1';
}

export function setBool(key: string, value: boolean, storage?: Storage | null): void {
	setPref(key, value ? '1' : '0', storage);
}
