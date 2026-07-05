// validate.test.mjs — DATA-05 build-gate proof.
//
// Two layers of assurance that malformed grant data can never reach production:
//   UNIT       — the zod GrantSchema (tools/schema.mjs) rejects a bad enum, a bad
//                URL, and a bad tri-state, and accepts a fully-valid record; on any
//                failure result.error.issues is a non-empty array (zod v4 shape).
//   INTEGRATION — spawning the real ingest tool (tools/ingest-grants.mjs) against the
//                28-row data/__fixtures__/grants.bad.csv exits non-zero (the gate
//                fires), while a run against the real data/grants.csv exits 0. The bad
//                run writes to a throwaway GRANTS_OUT so the committed JSON is never
//                touched (ingest also validates BEFORE writing, so nothing is emitted
//                on failure anyway — belt and suspenders).
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GrantSchema } from './schema.mjs';

// A minimal, fully-valid Grant record — every case below mutates ONE field of a
// fresh clone so a rejection can only be attributed to that single bad field.
const valid = {
	id: 'sample-funder',
	funder: 'Sample Funder',
	program: null,
	type: 'Grant',
	amount: {
		raw: '$20,000',
		min: 20000,
		max: 20000,
		avg: 20000,
		isReceived: false,
		isTBD: false,
		isEquity: false,
		isMicro: false
	},
	deadline: {
		raw: '2026-06-30',
		date: '2026-06-30',
		cadence: 'one-time',
		note: null,
		isPassed: false
	},
	requires501c3: 'no',
	requires501c3Raw: 'No',
	fit: 'Strong fit for accessibility programs',
	status: 'in-progress',
	statusLabel: 'In progress',
	nextAction: 'Assemble attachments and apply',
	link: 'https://example.org/grant'
};

describe('GrantSchema unit rejections (DATA-05)', () => {
	it('accepts a fully-valid record', () => {
		expect(GrantSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects a bad status enum', () => {
		const result = GrantSchema.safeParse({ ...valid, status: 'bogus' });
		expect(result.success).toBe(false);
		expect(Array.isArray(result.error.issues)).toBe(true);
		expect(result.error.issues.length).toBeGreaterThan(0);
	});

	it('rejects a non-URL link', () => {
		const result = GrantSchema.safeParse({ ...valid, link: 'not-a-url' });
		expect(result.success).toBe(false);
		expect(result.error.issues.length).toBeGreaterThan(0);
	});

	it('rejects a bad requires501c3 tri-state', () => {
		const result = GrantSchema.safeParse({ ...valid, requires501c3: 'maybe' });
		expect(result.success).toBe(false);
		expect(result.error.issues.length).toBeGreaterThan(0);
	});

	it('rejects an empty id', () => {
		const result = GrantSchema.safeParse({ ...valid, id: '' });
		expect(result.success).toBe(false);
		expect(result.error.issues.length).toBeGreaterThan(0);
	});
});

describe('ingest build-gate integration (DATA-05)', () => {
	it('exits non-zero on the malformed bad-CSV fixture (bad data aborts the build)', () => {
		const throwaway = join(tmpdir(), `grants.badrun.${process.pid}.json`);
		const run = spawnSync('node', ['tools/ingest-grants.mjs'], {
			env: {
				...process.env,
				GRANTS_CSV: 'data/__fixtures__/grants.bad.csv',
				GRANTS_OUT: throwaway
			},
			encoding: 'utf8'
		});
		expect(run.status).not.toBe(0);
	});

	it('exits 0 on the real data/grants.csv (good data passes the gate)', () => {
		const run = spawnSync('node', ['tools/ingest-grants.mjs'], {
			env: { ...process.env },
			encoding: 'utf8'
		});
		expect(run.status).toBe(0);
	});
});
