<script lang="ts">
	// The scene camera (CRYS-07). Idle: OrbitControls slow auto-orbit around the dome.
	// On selection: GSAP springs the camera to frame `ui.cameraFocus` (~600ms enter,
	// power3.out) and disables auto-orbit; on deselect it eases back to the overview
	// (~250ms — exit faster than enter) and re-enables auto-orbit. Tweens are always
	// killed before a new one starts so rapid selections never stack. gsap is imported
	// client-only (this component only ever mounts inside the browser-gated Canvas).
	import { T, useThrelte, useTask } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { onDestroy, onMount } from 'svelte';
	import gsap from 'gsap';
	import { ui } from '$lib/state/crystarium.svelte.js';
	import { intro } from './intro.svelte.js';
	import { computeLayout } from './layout.js';
	import { grants } from '$lib/data';

	const { invalidate } = useThrelte();

	// Pure node positions (same deterministic layout the Scene renders).
	const { nodes } = computeLayout(grants);
	const nodeById = new Map(nodes.map((n) => [n.id, n]));

	// VIS-05 composition: pulled back slightly with a gentle downward angle so the grid
	// reads as a floating constellation against the void (fog softens the rim nodes).
	const DEFAULT_POS = { x: 0, y: 16, z: 38 };
	const DEFAULT_TARGET = { x: 0, y: 0, z: 0 };
	// AEST-01 awakening vantage: higher/farther than the idle overview — the camera
	// starts here (no auto-orbit) and eases in to DEFAULT_POS as the crystals ignite.
	const INTRO_POS = { x: 0, y: 28, z: 58 };

	// MOB-04 portrait framing: on a tall/narrow viewport the constellation would
	// overflow the sides, so pull the camera back proportionally to the aspect.
	// 1 on landscape; ~1.48 on a 390×844 phone (capped at 1.6). Recomputed on resize
	// / orientation change. `scaled()` applies it along the view vector (y+z).
	let frame = $state(1);
	function computeFrame(): number {
		if (typeof window === 'undefined') return 1;
		const aspect = window.innerWidth / Math.max(1, window.innerHeight);
		return aspect < 1 ? Math.min(1.6, 1 + (1 - aspect) * 0.9) : 1;
	}
	function scaled(p: { x: number; y: number; z: number }) {
		return { x: p.x, y: p.y * frame, z: p.z * frame };
	}

	let controls: any = $state();
	let tween: gsap.core.Timeline | undefined;

	// Awakening bookkeeping: `introStarted` latches once the reveal tween begins;
	// `introSettled` latches once the camera has reached the idle overview (via the
	// tween completing OR a mid-intro skip snapping it there).
	let introStarted = false;
	let introSettled = false;

	// Ease in to frame a node: dolly to an offset vantage + look-at the node (~600ms).
	function focus(nodeId: string) {
		const n = nodeById.get(nodeId);
		if (!n || !controls) return;
		tween?.kill();
		controls.autoRotate = false;
		tween = gsap
			.timeline({ onUpdate: invalidate })
			.to(controls.object.position, { x: n.x + 8, y: n.y + 6, z: n.z + 8, duration: 0.6, ease: 'power3.out' }, 0)
			.to(controls.target, { x: n.x, y: n.y, z: n.z, duration: 0.6, ease: 'power3.out' }, 0);
	}

	// Release to overview (~250ms) then hand back to auto-orbit.
	function resetView() {
		if (!controls) return;
		tween?.kill();
		tween = gsap
			.timeline({
				onUpdate: invalidate,
				onComplete: () => {
					if (controls) controls.autoRotate = true;
				}
			})
			.to(controls.object.position, { ...scaled(DEFAULT_POS), duration: 0.25, ease: 'power3.out' }, 0)
			.to(controls.target, { ...DEFAULT_TARGET, duration: 0.25, ease: 'power3.out' }, 0);
	}

	// AEST-01 camera reveal: ease from the pulled-back INTRO_POS into the idle overview
	// (~1.6s), then hand off to auto-orbit. Shares the `tween` handle so onDestroy and
	// the skip path both cover it. Scalar tween only — no per-frame allocation.
	function runIntroCamera() {
		if (!controls) return;
		tween?.kill();
		controls.autoRotate = false;
		const intro0 = scaled(INTRO_POS);
		const def = scaled(DEFAULT_POS);
		controls.object.position.set(intro0.x, intro0.y, intro0.z);
		controls.target.set(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);
		tween = gsap
			.timeline({
				onUpdate: invalidate,
				onComplete: () => {
					introSettled = true;
					if (controls) controls.autoRotate = true; // hand off to idle orbit
				}
			})
			.to(controls.object.position, { ...def, duration: 1.6, ease: 'power2.out' }, 0)
			.to(controls.target, { ...DEFAULT_TARGET, duration: 1.6, ease: 'power2.out' }, 0);
	}

	// Snap straight to the idle overview (skip path / already-settled remount).
	function settleCamera() {
		tween?.kill();
		tween = undefined;
		if (controls) {
			const def = scaled(DEFAULT_POS);
			controls.object.position.set(def.x, def.y, def.z);
			controls.target.set(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);
			controls.autoRotate = true;
		}
		introSettled = true;
		invalidate();
	}

	// Drive the intro camera off the shared intro state. Children mount before parents,
	// so on first run intro.active may still be false (the Scene's onMount hasn't called
	// startIntro yet) — we simply wait for it to flip. A remount where the intro already
	// ran (intro.done) skips straight to the overview so the camera never sticks at INTRO_POS.
	$effect(() => {
		if (!controls || introStarted || introSettled) return;
		if (intro.active) {
			introStarted = true;
			runIntroCamera();
		} else if (intro.done) {
			settleCamera();
		}
	});

	// Interrupt: a mid-intro pointerdown fires skipIntro() (intro.active → false). If the
	// camera reveal was running but hasn't settled, snap it to the idle overview now.
	$effect(() => {
		if (!controls) return;
		if (introStarted && !intro.active && !introSettled) settleCamera();
	});

	// React to the runes bridge: a selection frames it, a deselect returns to overview.
	// GUARDED during the intro so resetView() doesn't fight the reveal tween on mount.
	$effect(() => {
		if (intro.active) return;
		if (ui.cameraFocus) focus(ui.cameraFocus);
		else resetView();
	});

	// OrbitControls damping + autoRotate need a per-frame update.
	useTask(() => controls?.update());

	// MOB-04: track viewport aspect. On resize/orientation change, recompute the
	// pull-back factor; if the camera is idle (settled, no active focus/tween), gently
	// re-dolly to the new framed overview so a rotate never leaves the grid clipped.
	onMount(() => {
		frame = computeFrame();
		const onResize = () => {
			const next = computeFrame();
			if (next === frame) return;
			frame = next;
			const idle = introSettled && !ui.cameraFocus && !(tween && tween.isActive());
			if (idle && controls) {
				const def = scaled(DEFAULT_POS);
				controls.object.position.set(def.x, def.y, def.z);
				controls.update?.();
				invalidate();
			}
		};
		window.addEventListener('resize', onResize);
		window.addEventListener('orientationchange', onResize);
		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('orientationchange', onResize);
		};
	});

	onDestroy(() => tween?.kill());
</script>

<!-- Starts pulled back at INTRO_POS with auto-orbit OFF; the reveal tween eases it in
     to the overview and hands off to auto-orbit on complete (or on a skip). -->
<T.PerspectiveCamera makeDefault position={[0, 28, 58]} fov={45}>
	<OrbitControls
		bind:ref={controls}
		enableDamping
		autoRotate={false}
		autoRotateSpeed={0.4}
		target={[0, 0, 0]}
	/>
</T.PerspectiveCamera>
