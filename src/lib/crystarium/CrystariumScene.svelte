<script lang="ts">
	// Assembles the Crystarium: lights + a temporary camera + all 28 crystal
	// nodes from the pure layout module. Paths (CrystalPath), the GSAP CameraRig,
	// and the SelectiveBloom composer (Effects) land in 03-04 — placeholders below.
	//
	// interactivity() is called ONCE here (high in the tree) so every CrystalNode's
	// pointer handlers raycast correctly (03-RESEARCH Code Example 2).
	import { T, useThrelte, useTask } from '@threlte/core';
	import { interactivity } from '@threlte/extras';
	import { computeLayout } from './layout.js';
	import { grants } from '$lib/data';
	import * as tokens from './tokens';
	import CrystalNode from './CrystalNode.svelte';

	interactivity();

	// Pure, deterministic scene inputs (no three, no clock, no RNG).
	const { nodes } = computeLayout(grants);
	// Match each positioned node back to its grant record by id.
	const grantById = new Map(grants.map((g) => [g.id, g]));

	const { renderer, scene, camera, renderStage } = useThrelte();

	// Near-black indigo void (03-UI-SPEC --bg). Set the WebGL clear colour.
	$effect(() => {
		renderer.setClearColor(tokens.bg, 1);
	});

	// Gentle idle auto-orbit of the whole grid so the 28 crystals read from many
	// angles (the GSAP CameraRig + OrbitControls autoRotate arrive in 03-04).
	let grid = $state<any>(undefined);
	useTask((delta) => {
		if (grid) grid.rotation.y += delta * 0.12;
	});

	// TEMPORARY render authority for 03-03: the Canvas is `autoRender={false}`
	// (reserved for the 03-04 bloom composer), so nothing would draw without a
	// render task. This renders the scene straight to screen every frame; REMOVE
	// it in 03-04 when Effects.svelte's EffectComposer becomes the render authority.
	useTask(
		() => {
			const cam = camera.current;
			if (cam) renderer.render(scene, cam);
		},
		{ stage: renderStage, autoInvalidate: false }
	);
</script>

<!-- Temporary framing camera (replaced by CameraRig in 03-04). -->
<T.PerspectiveCamera makeDefault position={[0, 14, 34]} fov={45} />

<!-- Emissive-driven scene: crystals are their own light; keep ambient/key low. -->
<T.AmbientLight intensity={0.25} color={0x2a3a66} />
<T.DirectionalLight position={[8, 16, 10]} intensity={0.4} color={0xbcd2ff} />
<!-- Inner core glow near the secured master crystal at the origin. -->
<T.PointLight position={[0, 1.5, 0]} intensity={6} distance={14} color={tokens.secured} />

<T.Group bind:ref={grid}>
	{#each nodes as node (node.id)}
		{@const grant = grantById.get(node.id)}
		{#if grant}
			<CrystalNode {grant} {node} />
		{/if}
	{/each}

	<!-- 03-04 placeholders (do NOT build here):
	     CrystalPath — spine + Ford/BofA families + fiscal-sponsor beam from the core
	     CameraRig   — OrbitControls autoRotate + GSAP focus-on-select
	     Effects     — postprocessing SelectiveBloom (becomes the render authority) -->
</T.Group>
