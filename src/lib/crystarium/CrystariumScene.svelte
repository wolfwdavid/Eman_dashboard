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
	import { onMount, onDestroy } from 'svelte';
	import { computeLayout } from './layout.js';
	import { grants } from '$lib/data';
	import { matchesFilter } from '$lib/data/filter';
	import { ui, deselect } from '$lib/state/crystarium.svelte.js';
	import { startIntro, skipIntro } from './intro.svelte.js';
	import * as tokens from './tokens';
	import CrystalNode from './CrystalNode.svelte';
	import CrystalPath from './CrystalPath.svelte';
	import CameraRig from './CameraRig.svelte';
	import Effects from './Effects.svelte';
	import Starfield from './Starfield.svelte';
	import Nebula from './Nebula.svelte';

	interactivity();

	// Pure, deterministic scene inputs (no three, no clock, no RNG).
	const { nodes, edges } = computeLayout(grants);
	// Match each positioned node back to its grant record + resolve edge endpoints by id.
	const grantById = new Map(grants.map((g) => [g.id, g]));
	const nodeById = new Map(nodes.map((n) => [n.id, n]));

	// Per-node AWAKENING rank (AEST-01): rim→center reveal order, deterministic and
	// pure (no clock, no per-frame work). Sort by radial distance from the origin
	// DESCENDING so rank 0 = farthest rim (ignites first) and rank 1 = the gold master
	// crystal at the origin (lands LAST). Nodes read this against intro.revealProgress.
	const rankById = (() => {
		const ordered = [...nodes].sort(
			(a, b) => (b.x * b.x + b.z * b.z) - (a.x * a.x + a.z * a.z)
		);
		const n = ordered.length;
		const m = new Map();
		ordered.forEach((node, i) => m.set(node.id, n > 1 ? i / (n - 1) : 0));
		return m;
	})();

	const { renderer } = useThrelte();

	// Near-black indigo void (03-UI-SPEC --bg). Set the WebGL clear colour.
	$effect(() => {
		renderer.setClearColor(tokens.bg, 1);
	});

	// Kick off the awakening on mount; ANY pointer input anywhere snaps the scene to
	// its settled steady state (interruptible, one-shot). The listener is removed on
	// destroy in case it never fired.
	onMount(() => {
		startIntro();
		window.addEventListener('pointerdown', skipIntro, { once: true });
	});
	onDestroy(() => {
		if (typeof window !== 'undefined') window.removeEventListener('pointerdown', skipIntro);
	});
</script>

<!-- Auto-orbit + GSAP focus-on-select camera (replaces the 03-03 temp camera). -->
<CameraRig />

<!-- SelectiveBloom composer — the single render authority (autoRender=false + renderStage). -->
<Effects />

<!-- VIS-01 cosmic backdrop: FogExp2 for depth falloff toward the rim (nodes/paths soften
     into the indigo void), a fine starfield, and soft additive nebula clouds. The backdrop
     layers are dim/additive and kept below the bloom threshold so only node cores bloom. -->
<T.FogExp2 attach="fog" args={[tokens.bgGlow, 0.011]} />
<Nebula />
<Starfield />

<!-- Emissive-driven scene: crystals are their own light; keep ambient/key low. -->
<T.AmbientLight intensity={0.25} color={0x2a3a66} />
<T.DirectionalLight position={[8, 16, 10]} intensity={0.4} color={0xbcd2ff} />
<!-- Inner core glow near the secured master crystal at the origin. -->
<T.PointLight position={[0, 1.5, 0]} intensity={6} distance={14} color={tokens.secured} />

<!--
	Background-click deselect (04-04, DETL close affordance). This top-level Group
	has NO geometry, so the raycaster never intersects it — it is therefore never in
	`initialHits`, and @threlte/extras interactivity (9.21.0) fires `pointermissed`
	on it for EVERY click. `pointermissed` runs BEFORE the click dispatch loop, so an
	empty-space click → deselect() (nothing re-selects), while a crystal click →
	transient deselect() then the node's onclick select() in the same event (net
	select). No DOM catch layer — the canvas raycast stays fully live.
-->
<T.Group onpointermissed={() => deselect()}>
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
			<CrystalNode {grant} {node} revealRank={rankById.get(node.id) ?? 0} />
		{/if}
	{/each}
</T.Group>
