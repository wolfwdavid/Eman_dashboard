// Validation of the assistant API address published in chat-config.json.
// PURE: no browser globals beyond the standard URL class (available in node too).
//
// The address decides where typed questions and microphone recordings are sent, and
// it arrives as remote JSON. Only an encrypted origin, or this machine, is accepted.

const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1']);

/**
 * Returns the address to use as the API base (no trailing slash, no query or fragment),
 * or null when it must not be used: anything that is not `https:`, or `http:` for
 * `localhost` / `127.0.0.1`.
 */
export function safeApiUrl(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	let u: URL;
	try {
		u = new URL(raw.trim());
	} catch {
		return null;
	}
	if (!u.hostname || u.username || u.password) return null;
	const ok = u.protocol === 'https:' || (u.protocol === 'http:' && LOCAL_HOSTS.has(u.hostname));
	if (!ok) return null;
	return u.origin + u.pathname.replace(/\/+$/, '');
}
