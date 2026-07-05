// Numeric-hex mirror of the UI-SPEC `--status-*` / signal CSS tokens, consumed by
// Three.js materials (`emissive`/`color`) and the legend. Token discipline (design
// authority): Three materials NEVER carry a raw hex literal — they import from here.
// Source of truth: .planning/phases/03-3d-crystarium-scene/03-UI-SPEC.md §Color System
// + §Crystal Node Visual activation table. Keep in lock-step with the `@theme` CSS block.

import type { GrantStatus } from '../data/types';

/** Status → emissive/legend hue (exact UI-SPEC hex as a numeric literal). Exhaustive over GrantStatus. */
export const statusHue: Record<GrantStatus, number> = {
	active: 0xffc24b, // secured gold — the ONE warm node (= secured)
	'in-progress': 0x33e1ff, // bright crystal cyan — energized, near-cash
	applied: 0xa98bff, // amethyst violet — submitted, awaiting verdict
	recurring: 0x4be39b, // emerald — renewable/looping
	'to-research': 0x5b84c4, // muted steel blue — dim outer frontier
	'not-eligible-yet': 0xb0894e, // desaturated bronze — gated, unlock later
	'not-eligible': 0x565d75, // cold ash grey — dead, no path
	declined: 0x8a5560 // ash-rust — burnt-out ember (never urgent)
};

/** Status → base `emissiveIntensity` activation level (UI-SPEC). Exhaustive over GrantStatus. */
export const activation: Record<GrantStatus, number> = {
	active: 1.0, // fully crystallized master (+ inner point light)
	applied: 0.6, // bright, suspended
	'in-progress': 0.4, // half-lit, energized
	recurring: 0.2, // steady breathing loop base (0.20 → 0.40)
	'to-research': 0.15, // dim, unformed frontier
	'not-eligible-yet': 0.12, // lockable-later (+ bronze halo)
	'not-eligible': 0.06, // near-dark, dead
	declined: 0.06 // burnt-out ember (+ cracked normal)
};

export const secured = 0xffc24b; // gold — secured node core + $20,000 figure ONLY (=== statusHue.active)
export const urgent = 0xff5a3c; // deadline pulse additive ONLY
export const path = 0x6fa8ff; // progression spine + funder-family edges
export const beamCore = 0xffc24b; // fiscal-sponsor beam anchor at NYCT core
export const beamTip = 0x7fe9ff; // beam terminus gradient tip
export const bg = 0x05060d; // deepest scene void (canvas clear color)
export const bgGlow = 0x0a0e1a; // radial vignette / dome floor tint
