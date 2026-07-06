<script lang="ts">
	// One funder crystal (CRYS-03/04/05/08). A faceted emissive shard whose HUE reads
	// its status and whose SCALE reads its funding amount (both precomputed by the pure
	// layout module + tokens.ts). One useTask modulates the material's emissiveIntensity
	// (a property, NOT per-frame object churn — Pitfall F) for three overlaid signals:
	//   • deadline pulse — ONLY on the 3 `node.pulse` nodes (clock-free set from 03-02);
	//     additive `--urgent` coral, amplitude/frequency by deadline proximity band.
	//   • hover (secondary) — +Y lift, scale ×1.08, emissive +0.2.
	//   • select (primary, one at a time) — activation burst (flash + scale pop ~300ms)
	//     and, for every OTHER node, dim emissiveIntensity ×0.35 + slight desaturate.
	// Pointer handlers raise hover/select into the runes bridge.
	import { T, useTask } from '@threlte/core';
	import { Color } from 'three';
	import { statusHue, activation, urgent } from './tokens';
	import { select, hover, ui } from '$lib/state/crystarium.svelte.js';
	import { matchesFilter } from '$lib/data/filter';
	import type { Grant } from '$lib/data/types';

	let { grant, node }: { grant: Grant; node: any } = $props();

	// Status → emissive hue + base activation (immutable per node; the numeric-hex SoT).
	const hue = $derived(statusHue[grant.status]);
	const baseIntensity = $derived(activation[grant.status]);
	// TBD "raw ore" crystals read rougher/less-formed; quantified crystals are glassy.
	const roughness = $derived(grant.amount.isTBD ? 0.5 : 0.25);
	// The active master crystal gets a denser multi-shard facet cluster.
	const detail = $derived(grant.status === 'active' ? 1 : 0);
	// Phase-4 three-axis filter (status/gate/type). Reactive: non-matching nodes
	// DIM (emissive ×0.15 + opacity →0.3) and are raycast-guarded in the handlers.
	const matches = $derived(matchesFilter(grant, ui.filter));

	// Cosmetic deadline-proximity band (a live Date read is allowed HERE for amplitude
	// ONLY — never for pulse membership, which is the clock-free `node.pulse` set).
	const DAY = 86400000;
	function pulseBand() {
		const iso = grant.deadline.date;
		let days = Infinity;
		if (iso) days = (new Date(iso).getTime() - Date.now()) / DAY;
		if (days < 30) return { amp: 0.4, freq: 0.8 }; // near — fast, strong
		if (days <= 90) return { amp: 0.25, freq: 0.5 }; // approaching
		return { amp: 0.1, freq: 0.3 }; // far — gentle steady
	}
	const band = pulseBand();

	// Colours that don't depend on props can be built up-front; the status base colour
	// is seeded on the first task tick (inside the closure) with the rest of the state.
	const urgentColor = new Color(urgent);
	const dimColor = new Color(0x565d75); // ash — sibling desaturate target
	const baseColor = new Color();

	let material: any = $state();
	let mesh: any = $state();

	// Animation state (seeded on first tick, then smoothed toward per-frame targets).
	let seeded = false;
	let elapsed = 0;
	let burstT = 999; // seconds since this node was last selected (>0.3 → burst done)
	let curIntensity = 0;
	let curScale = 1;
	let curLift = 0;
	let curOpacity = 1; // smoothed toward 1 (matching) or 0.3 (filtered-out)

	const TAU = Math.PI * 2;

	// One-shot activation burst trigger on becoming the selected node.
	$effect(() => {
		if (ui.selected === grant.id) burstT = 0;
	});

	useTask((delta) => {
		if (!material) return;
		if (!seeded) {
			baseColor.set(statusHue[grant.status]);
			curIntensity = baseIntensity;
			curScale = node.scale;
			seeded = true;
		}
		elapsed += delta;
		burstT += delta;

		const isSelected = ui.selected === grant.id;
		const isHovered = ui.hovered === grant.id;
		const someoneSelected = ui.selected !== null;
		const dimmed = someoneSelected && !isSelected;
		const burst = burstT < 0.3 ? 1 - burstT / 0.3 : 0; // linear decay over ~300ms

		// Filter-dim (Phase-4): a node excluded by ui.filter fades out — emissive
		// ×0.15 and opacity →0.3 — but is NEVER removed (layout/funnel stays stable).
		const filteredOut = !matches;

		// Smoothed "state" intensity (base + dim + hover + select burst + filter-dim).
		let stateTarget = baseIntensity;
		if (dimmed) stateTarget *= 0.35;
		if (isHovered) stateTarget += 0.2;
		if (isSelected) stateTarget += 0.9 * burst; // activation flash spike
		if (filteredOut) stateTarget *= 0.15; // filter fade dominates
		const k = Math.min(1, delta * 10);
		curIntensity += (stateTarget - curIntensity) * k;

		// Smooth mesh opacity toward the filter target (~200ms via the same k).
		const targetOpacity = filteredOut ? 0.3 : 1;
		curOpacity += (targetOpacity - curOpacity) * k;
		material.transparent = true;
		material.opacity = curOpacity;

		// Instantaneous deadline pulse on top — ONLY the clock-free pulse set, and
		// never on a filtered-out node (a dimmed crystal should read as inert).
		let finalIntensity = curIntensity;
		if (node.pulse && !dimmed && matches) {
			const osc = band.amp * (0.5 + 0.5 * Math.sin(elapsed * band.freq * TAU));
			finalIntensity += osc;
			material.emissive.copy(baseColor).lerp(urgentColor, 0.2 + 0.6 * (osc / band.amp));
		} else {
			material.emissive.copy(baseColor);
			if (dimmed) material.emissive.lerp(dimColor, 0.3); // slight desaturate of siblings
		}
		material.emissiveIntensity = finalIntensity;

		// Hover lift + scale pop (transform-only), smoothed.
		let scaleTarget = node.scale;
		if (isHovered) scaleTarget *= 1.08;
		if (isSelected) scaleTarget *= 1 + 0.15 * burst;
		const liftTarget = isHovered ? 0.4 : 0;
		curScale += (scaleTarget - curScale) * k;
		curLift += (liftTarget - curLift) * k;
		if (mesh) {
			mesh.scale.setScalar(curScale);
			mesh.position.set(node.x, node.y + curLift, node.z);
		}
	});
</script>

<T.Mesh
	bind:ref={mesh}
	position={[node.x, node.y, node.z]}
	scale={node.scale}
	onpointerenter={(e) => {
		if (!matches) return; // raycast-guard: filtered-out nodes are inert
		e.stopPropagation();
		hover(grant.id);
	}}
	onpointerleave={() => matches && hover(null)}
	onclick={(e) => {
		if (!matches) return; // raycast-guard: filtered-out nodes cannot be selected
		e.stopPropagation();
		select(grant.id);
	}}
>
	<T.IcosahedronGeometry args={[1, detail]} />
	<T.MeshStandardMaterial
		bind:ref={material}
		color={hue}
		emissive={hue}
		emissiveIntensity={baseIntensity}
		{roughness}
		metalness={0}
		transparent
		flatShading
	/>
</T.Mesh>
