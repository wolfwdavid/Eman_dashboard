<script lang="ts">
	// Assembles the Crystarium: the GSAP CameraRig, lights, all connecting paths
	// (spine + Ford/BofA families + the fiscal-sponsor beam), all 28 crystal nodes
	// from the pure layout module, and the SelectiveBloom composer (Effects) — which
	// is now the single render authority (the 03-03 temporary render task is removed).
	//
	// interactivity() is called ONCE here (high in the tree) so every CrystalNode's
	// pointer handlers raycast correctly (03-RESEARCH Code Example 2).
	import { T, useThrelte } from '@threlte/core';
	import { interactivity } from '@threlte/extras';
	import { computeLayout } from './layout.js';
	import { grants } from '$lib/data';
	import { matchesFilter } from '$lib/data/filter';
	import { ui } from '$lib/state/crystarium.svelte.js';
	import * as tokens from './tokens';
	import CrystalNode from './CrystalNode.svelte';
	import CrystalPath from './CrystalPath.svelte';
	import CameraRig from './CameraRig.svelte';
	import Effects from './Effects.svelte';

	interactivity();

	// Pure, deterministic scene inputs (no three, no clock, no RNG).
	const { nodes, edges } = computeLayout(grants);
	// Match each positioned node back to its grant record + resolve edge endpoints by id.
	const grantById = new Map(grants.map((g) => [g.id, g]));
	const nodeById = new Map(nodes.map((n) => [n.id, n]));

	const { renderer } = useThrelte();

	// Near-black indigo void (03-UI-SPEC --bg). Set the WebGL clear colour.
	$effect(() => {
		renderer.setClearColor(tokens.bg, 1);
	});
</script>

<!-- Auto-orbit + GSAP focus-on-select camera (replaces the 03-03 temp camera). -->
<CameraRig />

<!-- SelectiveBloom composer — the single render authority (autoRender=false + renderStage). -->
<Effects />

<!-- Emissive-driven scene: crystals are their own light; keep ambient/key low. -->
<T.AmbientLight intensity={0.25} color={0x2a3a66} />
<T.DirectionalLight position={[8, 16, 10]} intensity={0.4} color={0xbcd2ff} />
<!-- Inner core glow near the secured master crystal at the origin. -->
<T.PointLight position={[0, 1.5, 0]} intensity={6} distance={14} color={tokens.secured} />

<T.Group>
	<!-- Connecting paths: spine + Ford/BofA family bridges + fiscal-sponsor beam. -->
	{#each edges as edge (edge.from + '->' + edge.to + ':' + edge.kind)}
		{@const from = nodeById.get(edge.from)}
		{@const to = nodeById.get(edge.to)}
		{@const fromGrant = grantById.get(edge.from)}
		{@const toGrant = grantById.get(edge.to)}
		{#if from && to}
			<!-- An edge dims (Phase-4) when EITHER endpoint is filtered out. -->
			<CrystalPath
				{edge}
				{from}
				{to}
				dim={!(
					fromGrant &&
					toGrant &&
					matchesFilter(fromGrant, ui.filter) &&
					matchesFilter(toGrant, ui.filter)
				)}
			/>
		{/if}
	{/each}

	<!-- 28 crystal nodes. -->
	{#each nodes as node (node.id)}
		{@const grant = grantById.get(node.id)}
		{#if grant}
			<CrystalNode {grant} {node} />
		{/if}
	{/each}
</T.Group>
