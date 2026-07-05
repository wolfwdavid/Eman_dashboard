import { describe, it, expect } from 'vitest';
import type { GrantStatus } from '../data/types';
import {
	statusHue,
	activation,
	secured,
	urgent,
	path,
	beamCore,
	beamTip,
	bg,
	bgGlow
} from './tokens';

// The exhaustive GrantStatus universe the maps must cover (mirrors src/lib/data/types.ts).
const STATUSES: GrantStatus[] = [
	'active',
	'in-progress',
	'to-research',
	'recurring',
	'applied',
	'declined',
	'not-eligible',
	'not-eligible-yet'
];

describe('crystarium tokens — status hues', () => {
	it('maps every GrantStatus to a defined numeric hue', () => {
		for (const s of STATUSES) {
			expect(statusHue[s]).toBeTypeOf('number');
		}
		expect(Object.keys(statusHue)).toHaveLength(8);
	});

	it('mirrors the EXACT UI-SPEC status hexes as numeric literals', () => {
		expect(statusHue.active).toBe(0xffc24b);
		expect(statusHue['in-progress']).toBe(0x33e1ff);
		expect(statusHue.applied).toBe(0xa98bff);
		expect(statusHue.recurring).toBe(0x4be39b);
		expect(statusHue['to-research']).toBe(0x5b84c4);
		expect(statusHue['not-eligible-yet']).toBe(0xb0894e);
		expect(statusHue['not-eligible']).toBe(0x565d75);
		expect(statusHue.declined).toBe(0x8a5560);
	});
});

describe('crystarium tokens — activation levels', () => {
	it('maps every GrantStatus to a defined emissiveIntensity base', () => {
		for (const s of STATUSES) {
			expect(activation[s]).toBeTypeOf('number');
		}
		expect(Object.keys(activation)).toHaveLength(8);
	});

	it('matches the EXACT UI-SPEC activation table', () => {
		expect(activation.active).toBe(1.0);
		expect(activation.applied).toBe(0.6);
		expect(activation['in-progress']).toBe(0.4);
		expect(activation.recurring).toBe(0.2);
		expect(activation['to-research']).toBe(0.15);
		expect(activation['not-eligible-yet']).toBe(0.12);
		expect(activation['not-eligible']).toBe(0.06);
		expect(activation.declined).toBe(0.06);
	});
});

describe('crystarium tokens — signal & path accents', () => {
	it('secured gold equals the active status hue', () => {
		expect(secured).toBe(0xffc24b);
		expect(secured).toBe(statusHue.active);
	});

	it('mirrors the EXACT UI-SPEC signal/path hexes', () => {
		expect(urgent).toBe(0xff5a3c);
		expect(path).toBe(0x6fa8ff);
		expect(beamCore).toBe(0xffc24b);
		expect(beamTip).toBe(0x7fe9ff);
		expect(bg).toBe(0x05060d);
		expect(bgGlow).toBe(0x0a0e1a);
	});
});
