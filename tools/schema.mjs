// schema.mjs — zod v4 mirror of the canonical Grant type (src/lib/data/types.ts).
// Single source of truth for record shape at validation time; consumed by the
// ingest build-gate in Plan 02-04. zod 4 API: top-level z.url() (NOT z.string().url()),
// errors on result.error.issues.
import { z } from 'zod';

export const GrantAmountSchema = z.object({
	raw: z.string(),
	min: z.number().nullable(),
	max: z.number().nullable(),
	avg: z.number().nullable(),
	isReceived: z.boolean(),
	isTBD: z.boolean(),
	isEquity: z.boolean(),
	isMicro: z.boolean()
});

export const GrantDeadlineSchema = z.object({
	raw: z.string(),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable(),
	cadence: z.enum(['rolling', 'annual', 'invitation', 'one-time', 'passed', 'unknown']),
	note: z.string().nullable(),
	isPassed: z.boolean()
});

export const GrantSchema = z.object({
	id: z.string().min(1),
	funder: z.string().min(1),
	program: z.string().nullable(),
	type: z.enum(['Grant', 'Grant/Fellowship', 'Investment']),
	amount: GrantAmountSchema,
	deadline: GrantDeadlineSchema,
	requires501c3: z.enum(['yes', 'no', 'unknown']),
	requires501c3Raw: z.string(),
	fit: z.string(),
	status: z.enum([
		'active',
		'in-progress',
		'to-research',
		'recurring',
		'applied',
		'declined',
		'not-eligible',
		'not-eligible-yet'
	]),
	statusLabel: z.string(),
	nextAction: z.string().nullable(),
	link: z.url()
});
