import { describe, it, expect } from 'vitest';
import { safeApiUrl } from './apiUrl';

describe('safeApiUrl', () => {
	it.each([
		['https://did-agent.example.org', 'https://did-agent.example.org'],
		['https://abc-def.trycloudflare.com/', 'https://abc-def.trycloudflare.com'],
		['  https://host.example/api/  ', 'https://host.example/api'],
		['https://host.example:8443', 'https://host.example:8443'],
		['HTTPS://Host.Example', 'https://host.example'],
		['http://127.0.0.1:8080', 'http://127.0.0.1:8080'],
		['http://localhost:8080/', 'http://localhost:8080'],
		['https://localhost:8443', 'https://localhost:8443']
	])('accepts %s', (raw, out) => {
		expect(safeApiUrl(raw)).toBe(out);
	});

	it('drops any query string or fragment', () => {
		expect(safeApiUrl('https://host.example/api?x=1#y')).toBe('https://host.example/api');
	});

	it.each([
		'http://example.org',
		'http://192.168.1.10:8080',
		'http://127.0.0.1.evil.example',
		'http://localhost.evil.example',
		'ws://127.0.0.1:8080',
		'wss://host.example',
		'ftp://host.example',
		'javascript:alert(1)',
		'data:text/plain,hi',
		'file:///etc/passwd',
		'//host.example',
		'host.example',
		'/chat',
		'https://user:pass@host.example',
		'https://',
		''
	])('rejects %s', (raw) => {
		expect(safeApiUrl(raw)).toBeNull();
	});

	it.each([undefined, null, 42, {}, ['https://host.example'], true])('rejects non-string %s', (raw) => {
		expect(safeApiUrl(raw)).toBeNull();
	});
});
