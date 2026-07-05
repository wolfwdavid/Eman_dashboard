<script lang="ts">
	// One funder crystal (CRYS-03/04). A faceted emissive shard whose HUE reads
	// its status and whose SCALE reads its funding amount (both precomputed by the
	// pure layout module + tokens.ts). Hover/click raise events into the runes
	// bridge — this is where the Crystarium becomes interactive.
	//
	// Fresnel rim, deadline pulse, and hover/select bloom emphasis are 03-04;
	// the material stays simple-but-tokenised here (no raw hex).
	import { T } from '@threlte/core';
	import { statusHue, activation } from './tokens';
	import { select, hover } from '$lib/state/crystarium.svelte.js';
	import type { Grant } from '$lib/data/types';

	let { grant, node }: { grant: Grant; node: any } = $props();

	// Status → emissive hue + activation level (the numeric-hex source of truth).
	const hue = $derived(statusHue[grant.status]);
	const intensity = $derived(activation[grant.status]);
	// TBD "raw ore" crystals read rougher/less-formed; quantified crystals are glassy.
	const roughness = $derived(grant.amount.isTBD ? 0.5 : 0.25);
	// The active master crystal gets a denser multi-shard facet cluster.
	const detail = $derived(grant.status === 'active' ? 1 : 0);
</script>

<T.Mesh
	position={[node.x, node.y, node.z]}
	scale={node.scale}
	onpointerenter={(e) => {
		e.stopPropagation();
		hover(grant.id);
	}}
	onpointerleave={() => hover(null)}
	onclick={(e) => {
		e.stopPropagation();
		select(grant.id);
	}}
>
	<T.IcosahedronGeometry args={[1, detail]} />
	<T.MeshStandardMaterial
		color={hue}
		emissive={hue}
		emissiveIntensity={intensity}
		{roughness}
		metalness={0}
		flatShading
	/>
</T.Mesh>
