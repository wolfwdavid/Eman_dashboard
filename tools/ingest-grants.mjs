#!/usr/bin/env node
/**
 * ingest-grants.mjs — CSV → typed grants.generated.json ingest tool (DATA-01).
 *
 * Reads data/grants.csv (papaparse tokenizing), applies the amount/deadline/
 * status/501c3/slug normalizers, validates EVERY record against the zod
 * GrantSchema, and only then emits src/lib/data/grants.generated.json. If any
 * row is malformed the tool prints all issues and exits 1 BEFORE writing, so a
 * bad run can never clobber the good committed JSON.
 *
 * Env overrides (so 02-04's build-gate test can point at the bad fixture
 * without touching the real dataset):
 *   GRANTS_CSV  — source CSV path        (default: data/grants.csv)
 *   GRANTS_OUT  — output JSON path        (default: src/lib/data/grants.generated.json)
 *
 * Mirrors the tools/verify-build.mjs style: node:fs, clear PASS/FAIL, process.exit.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import Papa from 'papaparse';
import { parseAmount } from './normalize/amount.mjs';
import { parseDeadline } from './normalize/deadline.mjs';
import { parseStatus, parse501c3 } from './normalize/status.mjs';
import { slug } from './normalize/slug.mjs';
import { GrantSchema } from './schema.mjs';

const CSV_PATH = process.env.GRANTS_CSV ?? 'data/grants.csv';
const OUT_PATH = process.env.GRANTS_OUT ?? 'src/lib/data/grants.generated.json';
const EXPECTED_ROWS = 28;

const fail = (msg) => {
	console.error(`FAIL  ${msg}`);
	process.exit(1);
};

console.log(`ingest-grants: reading ${CSV_PATH}\n`);

if (!existsSync(CSV_PATH)) fail(`CSV not found: ${CSV_PATH}`);

// Read UTF-8 and strip a leading BOM (U+FEFF) — otherwise the first header key
// becomes "﻿Funder / Program" and every first-column lookup returns undefined.
let text = readFileSync(CSV_PATH, 'utf8');
text = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

const parsed = Papa.parse(text, {
	header: true,
	skipEmptyLines: 'greedy', // drops the trailing empty/whitespace row
	transformHeader: (h) => h.trim()
});

if (parsed.errors?.length) {
	for (const e of parsed.errors) console.error(`  papaparse: ${e.type} @row ${e.row}: ${e.message}`);
	fail('papaparse reported structural errors');
}

const rows = parsed.data;
if (rows.length !== EXPECTED_ROWS) {
	fail(`expected exactly ${EXPECTED_ROWS} rows, got ${rows.length} (ghost row / shredded columns?)`);
}

// --- field helpers ---------------------------------------------------------
const clean = (v) => {
	const s = (v ?? '').trim();
	return s === '' || s === '--' ? null : s;
};

const mapType = (raw) => {
	const s = (raw ?? '').trim();
	if (s === 'Investment (not grant)') return 'Investment';
	return s; // 'Grant' | 'Grant/Fellowship' pass through; zod enum validates the rest
};

// --- normalize every row ---------------------------------------------------
const records = [];
const validationFailures = [];

rows.forEach((row, i) => {
	const cell = (row['Funder / Program'] ?? '').trim();
	// Split on the FIRST ' - ' → funder / program (no ' - ' → program null).
	const dash = cell.indexOf(' - ');
	const funder = dash === -1 ? cell : cell.slice(0, dash).trim();
	const program = dash === -1 ? null : cell.slice(dash + 3).trim() || null;

	const { status, statusLabel } = parseStatus(row['Status']);
	const { requires501c3, requires501c3Raw } = parse501c3(row['501(c)(3) Required']);

	const record = {
		id: slug(cell),
		funder,
		program,
		type: mapType(row['Type']),
		amount: parseAmount(row['Amount']),
		deadline: parseDeadline(row['Deadline']),
		requires501c3,
		requires501c3Raw,
		fit: (row['Fit / Eligibility'] ?? '').trim(),
		status,
		statusLabel,
		nextAction: clean(row['Next Action']),
		link: (row['Link'] ?? '').trim()
	};

	const result = GrantSchema.safeParse(record);
	if (!result.success) {
		validationFailures.push({ i, funder, issues: result.error.issues });
	}
	records.push(record);
});

// --- fail BEFORE writing if any record is invalid --------------------------
if (validationFailures.length) {
	console.error(`\n${validationFailures.length} record(s) failed schema validation:\n`);
	for (const f of validationFailures) {
		console.error(`  row ${f.i} — ${f.funder}`);
		for (const issue of f.issues) {
			console.error(`    • ${issue.path.join('.') || '(root)'}: ${issue.message}`);
		}
	}
	fail('schema validation failed — JSON NOT written');
}

// --- unique-id assertion ---------------------------------------------------
const ids = records.map((r) => r.id);
const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
if (dupes.length) fail(`duplicate id(s): ${[...new Set(dupes)].join(', ')}`);

// --- emit ------------------------------------------------------------------
mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(records, null, '\t') + '\n', 'utf8');

console.log(`PASS  ${records.length} rows parsed`);
console.log(`PASS  ${new Set(ids).size} unique ids`);
console.log(`PASS  all records schema-valid`);
console.log(`PASS  wrote ${OUT_PATH}`);
console.log('\ningest-grants: PASSED');
process.exit(0);
