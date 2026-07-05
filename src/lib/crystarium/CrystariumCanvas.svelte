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
</script>

<div class="canvas-layer">
	<Canvas autoRender={false} dpr={[1, 2]} renderMode="always">
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
</style>
