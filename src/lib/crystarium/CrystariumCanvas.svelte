<script lang="ts">
	// The browser-guarded <Canvas> host. This file is ONLY ever reached via a
	// dynamic import() behind `{#if browser && mounted}` in +page.svelte, so
	// `three`/WebGL never enter the SSR/prerender graph (CRYS-01, Pitfall A) and
	// also code-split out of first paint.
	//
	//   autoRender={false} — the 03-04 bloom composer will be the render authority
	//                        (a temporary render task in CrystariumScene draws now).
	//   dpr={[1, 2]}       — clamp pixel ratio ≤2 (bloom cost scales with pixels, Pitfall F).
	//   renderMode="always"— the grid idle-orbits continuously.
	import { Canvas } from '@threlte/core';
	import CrystariumScene from './CrystariumScene.svelte';

	// MOB-04: cap the device pixel ratio lower on phones/tablets (coarse pointer or
	// ≤768px) — bloom + postprocessing cost scales with pixels, so ≤1.5 keeps
	// mid-range mobile GPUs smooth. Desktop keeps the ≤2 clamp. This component is
	// browser-only (dynamic-imported behind browser&&mounted), so window is safe.
	const isMobile =
		typeof window !== 'undefined' &&
		!!(
			window.matchMedia?.('(max-width: 768px)').matches ||
			window.matchMedia?.('(pointer: coarse)').matches
		);
	const dpr: [number, number] = isMobile ? [1, 1.5] : [1, 2];
</script>

<div class="canvas-layer">
	<Canvas autoRender={false} {dpr} renderMode="always">
		<CrystariumScene />
	</Canvas>
</div>

<style>
	/* Full-viewport, fixed BEHIND the glass HUD (HUD panels sit at z-index 10). */
	.canvas-layer {
		position: fixed;
		inset: 0;
		z-index: 0;
	}

	/* MOB-03: let one-finger drag / pinch drive OrbitControls instead of the browser
	   treating it as a page scroll/zoom gesture. Scoped to the canvas only. */
	.canvas-layer :global(canvas) {
		touch-action: none;
	}
</style>
