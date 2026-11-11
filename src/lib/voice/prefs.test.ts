import { describe, it, expect } from 'vitest';
import { PREF_KEYS, getPref, setPref, getBool, setBool } from './prefs';

function fakeStorage(): Storage {
	const m = new Map<string, string>();
	return {
		getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
		setItem: (k: string, v: string) => void m.set(k, v),
		removeItem: (k: string) => void m.delete(k),
		clear: () => m.clear(),
		key: () => null,
		get length() {
			return m.size;
		}
	} as Storage;
}

const throwing = {
	getItem() {
		throw new Error('denied');
	},
	setItem() {
		throw new Error('denied');
	}
} as unknown as Storage;

describe('prefs', () => {
	it('has the exact key names', () => {
		expect(PREF_KEYS).toEqual({
			spokenReplies: 'did.voice.spokenReplies',
			forceServer: 'did.voice.forceServer',
			noticeBrowser: 'did.voice.notice.browser',
			noticeServer: 'did.voice.notice.server'
		});
	});

	it('round-trips strings and booleans', () => {
		const s = fakeStorage();
		setPref('a', 'x', s);
		expect(getPref('a', s)).toBe('x');
		setBool('b', true, s);
		expect(s.getItem('b')).toBe('1');
		expect(getBool('b', s)).toBe(true);
		setBool('b', false, s);
		expect(s.getItem('b')).toBe('0');
		expect(getBool('b', s)).toBe(false);
	});

	it('getBool is true only for "1"', () => {
		const s = fakeStorage();
		for (const v of ['true', 'yes', '', '2', ' 1']) {
			s.setItem('k', v);
			expect(getBool('k', s)).toBe(false);
		}
	});

	it('degrades without throwing when storage throws', () => {
		expect(getPref('k', throwing)).toBeNull();
		expect(getBool('k', throwing)).toBe(false);
		expect(() => setPref('k', 'v', throwing)).not.toThrow();
		expect(() => setBool('k', true, throwing)).not.toThrow();
	});

	it('degrades in node with no localStorage and with null storage', () => {
		expect(getPref('k')).toBeNull();
		expect(getBool('k')).toBe(false);
		expect(() => setPref('k', 'v')).not.toThrow();
		expect(getPref('k', null)).toBeNull();
	});
});
