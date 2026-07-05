<script lang="ts">
	// The signature glow (CRYS-08). A postprocessing EffectComposer takes over
	// rendering from Threlte's auto-render and applies luminance-thresholded bloom so
	// ONLY bright emissive cores/rims/beam glow — the dim steel-blue to-research
	// frontier and the void stay crisp (03-UI-SPEC §Bloom/Glow, threshold 0.6).
	//
	// This is the single render authority: it renders in the `renderStage` with
	// `autoInvalidate:false`, and takes over via `autoRender.set(false)` (the Canvas
	// is already `autoRender={false}` from 03-03). Its companion `ssr.noExternal:
	// ['postprocessing']` in vite.config.ts keeps prerender resolving the ESM.
	import { useThrelte, useTask } from '@threlte/core';
	import { EffectComposer, EffectPass, RenderPass, BloomEffect, KernelSize } from 'postprocessing';
	import { onDestroy } from 'svelte';

	const { scene, renderer, camera, size, renderStage, autoRender } = useThrelte();
	const composer = new EffectComposer(renderer);

	const setup = (cam: any) => {
		composer.removeAllPasses();
		composer.addPass(new RenderPass(scene, cam));
		composer.addPass(
			new EffectPass(
				cam,
				new BloomEffect({
					intensity: 1.0, // UI-SPEC 0.8–1.2 — glow without haze
					luminanceThreshold: 0.6, // UI-SPEC 0.55–0.65 — only bright cores/rims/beam bloom
					luminanceSmoothing: 0.2,
					radius: 0.5, // UI-SPEC 0.4–0.6 soft crystalline halo
					mipmapBlur: true, // half-res — mobile-GPU budget
					kernelSize: KernelSize.MEDIUM
				})
			)
		);
	};

	$effect(() => setup($camera));
	$effect(() => composer.setSize($size.width, $size.height));

	// Take over rendering from Threlte's auto-render, restoring on unmount.
	$effect(() => {
		const b = autoRender.current;
		autoRender.set(false);
		return () => autoRender.set(b);
	});

	useTask((delta) => composer.render(delta), { stage: renderStage, autoInvalidate: false });

	onDestroy(() => composer.dispose());
</script>
