// Client-only "awakening" intro controller (AEST-01) — a runes singleton mirroring
// crystarium.svelte.js. A module-level `$state` (not context) is deliberate: the
// Canvas is conditionally mounted behind `{#if browser && mounted}`, and a plain
// module import survives mount/unmount cleanly.
//
// The whole intro is driven by ONE tweened scalar — `intro.revealProgress` 0→1, a
// rising "wavefront". Nodes read it against their own revealRank to ignite rim→center
// (gold master crystal at the origin lands LAST); paths fade in on its tail; the
// camera eases from a pulled-back reveal into the idle orbit. `active` is true while
// running; `done` latches true once settled — in the done state every consumer's
// reveal factor is a hard 1, so the steady scene is byte-identical to pre-intro.
//
// gsap is imported here, but this module is ONLY ever imported by the browser-gated
// scene components (dynamic-imported CrystariumCanvas), so gsap never enters the SSR
// graph. NEVER import this from an SSR path.
import gsap from 'gsap';

/**
 * @typedef {Object} IntroState
 * @property {number} revealProgress  0→1 rising wavefront the nodes/paths read
 * @property {boolean} active         true while the intro timeline is running
 * @property {boolean} done           latches true once the scene has settled
 */

/** @type {IntroState} */
export const intro = $state({
	revealProgress: 0,
	active: false,
	done: false
});

// Node materialization ~1.9s; path draw-in + camera settle overlap inside it, so the
// total awakening stays within the ≤2.5s budget.
const REVEAL_DURATION = 1.9;

/** @type {gsap.core.Tween | undefined} */
let tl;

/**
 * Begin the awakening. Idempotent — a no-op if the intro already ran or is running,
 * so a remount never replays it (steady state must not re-animate).
 */
export function startIntro() {
	if (intro.active || intro.done) return;
	intro.active = true;
	intro.done = false;
	intro.revealProgress = 0;
	tl?.kill();
	tl = gsap.to(intro, {
		revealProgress: 1,
		duration: REVEAL_DURATION,
		ease: 'power2.out',
		onComplete: () => {
			intro.active = false;
			intro.done = true;
		}
	});
}

/**
 * Interrupt: snap straight to the settled steady state. No-op unless the intro is
 * actively running (so a stray pointerdown after settle does nothing).
 */
export function skipIntro() {
	if (!intro.active) return;
	tl?.kill();
	tl = undefined;
	intro.revealProgress = 1;
	intro.active = false;
	intro.done = true;
}
