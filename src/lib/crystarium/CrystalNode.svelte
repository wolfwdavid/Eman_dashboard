<script lang="ts">
	// One funder crystal (CRYS-03/04/05/08), restyled for VIS-02 as a 3-layer luminous ORB
	// (was a single matte icosahedron). Encodings are PRESERVED EXACTLY — hue = statusHue,
	// scale ∝ amount ordering, the clock-free `node.pulse` deadline set, the activation
	// ladder from tokens.ts, hover/select modulation, filter dim + raycast-guard, and the
	// AEST-01 awakening reveal. Only the VISUAL surface changed:
	//   1. CORE   — small emissive sphere, white-lifted status hue at HIGH intensity. This
	//               is what the bloom pass catches (dim statuses → dim cores; TBD → dimmest).
	//   2. SHELL  — a TIGHT translucent faceted crystal skin (~1.3× the core; additive
	//               backside → fresnel-ish rim), the hit target, status-hue tinted. Detail
	//               ≥2 so the silhouette stays ROUND — low-detail icosahedra at viewing
	//               distance read as flat 2D hexagon plates (screenshot-gate iteration 1).
	//   3. HALO   — soft additive radial sprite (~3.5× node scale), status-hued, very soft.
	// A parent group applies a global NODE_SCALE compression so the crystals read as orbs
	// floating in the void. One useTask drives everything via material properties + scalars
	// (NO per-frame allocation, Pitfall F). Raycast stays on the shell only (core/halo are
	// raycast-disabled) so pointer behaviour is byte-identical to before.
	import { T, useTask } from '@threlte/core';
	import { Color, BackSide, AdditiveBlending } from 'three';
	import { statusHue, activation, urgent } from './tokens';
	import { select, hover, ui } from '$lib/state/crystarium.svelte.js';
	import { intro } from './intro.svelte.js';
	import { matchesFilter } from '$lib/data/filter';
	import { radialSprite } from './gradients.js';
	import type { Grant } from '$lib/data/types';

	// `revealRank` ∈ [0,1] (0 = rim, ignites first; 1 = origin master, lands last) —
	// this node's slot in the AEST-01 awakening wavefront (computed once in the Scene).
	let { grant, node, revealRank = 0 }: { grant: Grant; node: any; revealRank?: number } =
		$props();

	// Status → emissive hue + base activation (immutable per node; the numeric-hex SoT).
	const hue = $derived(statusHue[grant.status]);
	const baseIntensity = $derived(activation[grant.status]);
	// TBD "raw ore" crystals read rougher/less-formed; quantified crystals are glassy.
	const roughness = $derived(grant.amount.isTBD ? 0.5 : 0.25);
	// Shell facet density — detail ≥2 keeps the crystal facets but rounds the SILHOUETTE
	// (detail 0/1 read as flat hexagon plates from the constellation distance). The active
	// master crystal gets the densest cluster.
	const detail = $derived(grant.status === 'active' ? 3 : 2);
	// Phase-4 three-axis filter (status/gate/type). Reactive: non-matching nodes
	// DIM (emissive ×0.15 + opacity fade) and are raycast-guarded in the handlers.
	const matches = $derived(matchesFilter(grant, ui.filter));

	// ── VIS-02 tuning constants ─────────────────────────────────────────────────────
	// Global compression so nodes read as small orbs in a vast space (~50% of v1.0).
	const NODE_SCALE = 0.5;
	const CORE_RADIUS = 0.42; // small emissive core
	const CORE_GAIN = 2.3; // lifts the ladder so bright cores bloom hard (post-threshold)
	const SHELL_RADIUS = 0.55; // tight crystal skin ≈ 1.3× the core (was 1.0 — read as a plate)
	const SHELL_OPACITY = 0.11; // barely-there additive rim (was 0.26 — too plate-like)
	const HALO_SCALE = 3.45; // soft halo (≈+15% vs iteration 0 to compensate the smaller shell)
	// TBD grains read as unformed ore: near-no halo (dimmest presence).
	const haloBase = $derived(
		(grant.amount.isTBD ? 0.28 : 1) * Math.min(0.7, baseIntensity * 0.7 + 0.08)
	);

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

	// Preallocated colours (no per-frame allocation). `baseColor` = status hue; `coreBase`
	// = the white-lifted core hue (blooms white-hot but tinted); both seeded on first tick.
	const urgentColor = new Color(urgent);
	const dimColor = new Color(0x565d75); // ash — sibling desaturate target
	const whiteColor = new Color(0xffffff);
	const baseColor = new Color();
	const coreBase = new Color();

	// Soft round halo texture (white → transparent; tinted per node via material.color).
	const haloTex = radialSprite({
		size: 128,
		inner: 'rgba(255,255,255,0.9)',
		mid: 'rgba(255,255,255,0.32)',
		stopMid: 0.4,
		outer: 'rgba(255,255,255,0)'
	});
	const noRaycast = () => {}; // core/halo never intercept pointer events (shell is the target)

	let coreMaterial: any = $state();
	let shellMaterial: any = $state();
	let halo: any = $state();
	let group: any = $state();

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
		if (!coreMaterial) return;
		if (!seeded) {
			baseColor.set(statusHue[grant.status]);
			coreBase.copy(baseColor).lerp(whiteColor, 0.5); // white-lifted core hue
			if (coreMaterial) coreMaterial.color.copy(coreBase);
			curIntensity = baseIntensity;
			curScale = node.scale;
			seeded = true;
		}
		elapsed += delta;
		burstT += delta;

		// AEST-01 awakening: a windowed ramp keyed to this node's rank turns the shared
		// wavefront into a rim→center stagger — rank 0 (rim) fully lit at p≈0.35, rank 1
		// (the gold origin master) not lit until p≈0.65 and landing LAST exactly at p=1.
		// Once settled (intro.done) reveal is a hard 1 → the steady scene is unchanged.
		// Scalar-only, no allocation (Pitfall F).
		const REVEAL_WINDOW = 0.35;
		let reveal = 1;
		if (!intro.done) {
			reveal = (intro.revealProgress - revealRank * (1 - REVEAL_WINDOW)) / REVEAL_WINDOW;
			reveal = reveal < 0 ? 0 : reveal > 1 ? 1 : reveal;
		}

		const isSelected = ui.selected === grant.id;
		const isHovered = ui.hovered === grant.id;
		const someoneSelected = ui.selected !== null;
		const dimmed = someoneSelected && !isSelected;
		// Activation burst (AEST-01): eased snap-and-settle over ~300ms — (1-u)² spends
		// less time high than a linear decay, so the flash reads as a crystal igniting.
		const bu = burstT / 0.3;
		const burst = bu < 1 ? (1 - bu) * (1 - bu) : 0;

		// Filter-dim (Phase-4): a node excluded by ui.filter fades out — emissive
		// ×0.15 and opacity fade — but is NEVER removed (layout/funnel stays stable).
		const filteredOut = !matches;

		// Smoothed "state" intensity (base + dim + hover + select burst + filter-dim).
		let stateTarget = baseIntensity;
		if (dimmed) stateTarget *= 0.35;
		if (isHovered) stateTarget += 0.2;
		if (isSelected) stateTarget += 1.0 * burst; // activation flash spike (bloom core)
		if (filteredOut) stateTarget *= 0.15; // filter fade dominates
		const k = Math.min(1, delta * 10);
		curIntensity += (stateTarget - curIntensity) * k;

		// Smooth opacity toward the filter target (~200ms via the same k), gated on the
		// awakening reveal so the crystal fades in with its ignition.
		const targetOpacity = filteredOut ? 0.3 : 1;
		curOpacity += (targetOpacity - curOpacity) * k;

		// Instantaneous deadline pulse on top — ONLY the clock-free pulse set, and never on
		// a filtered-out node (a dimmed crystal should read as inert). Drives BOTH the core
		// intensity AND (below) the halo scale — the two visible pulse channels.
		let finalIntensity = curIntensity;
		let pulseOsc = 0;
		if (node.pulse && !dimmed && matches) {
			pulseOsc = 0.5 + 0.5 * Math.sin(elapsed * band.freq * TAU);
			finalIntensity += band.amp * pulseOsc;
			coreMaterial.emissive.copy(coreBase).lerp(urgentColor, 0.2 + 0.6 * pulseOsc);
		} else {
			coreMaterial.emissive.copy(coreBase);
			if (dimmed) coreMaterial.emissive.lerp(dimColor, 0.3); // slight desaturate of siblings
		}
		// Core emissive gated by the awakening reveal, then lifted by CORE_GAIN so the
		// bright cores bloom hard while dim/TBD cores stay under the threshold.
		coreMaterial.emissiveIntensity = finalIntensity * reveal * CORE_GAIN;

		// Shell: translucent status-hued crystal — opacity tracks filter fade + reveal.
		if (shellMaterial) {
			shellMaterial.opacity = SHELL_OPACITY * curOpacity * reveal;
		}

		// Halo: soft additive glow — opacity tracks status strength × state, scale breathes
		// on pulse nodes and swells slightly on hover/select.
		if (halo) {
			let haloOpacity = haloBase * curOpacity * reveal;
			if (dimmed) haloOpacity *= 0.4;
			if (isHovered) haloOpacity *= 1.25;
			if (isSelected) haloOpacity *= 1 + 0.6 * burst;
			halo.material.opacity = haloOpacity;
			let haloScale = HALO_SCALE;
			if (node.pulse && !dimmed && matches) haloScale *= 1 + 0.18 * pulseOsc;
			if (isSelected) haloScale *= 1 + 0.25 * burst;
			halo.scale.set(haloScale, haloScale, 1);
		}

		// Hover lift + activation scale pop (transform-only), smoothed. Applied to the whole
		// orb group, then compressed by NODE_SCALE and gated by the awakening reveal.
		let scaleTarget = node.scale;
		if (isHovered) scaleTarget *= 1.08;
		if (isSelected) scaleTarget *= 1 + 0.18 * burst; // activation pop
		const liftTarget = isHovered ? 0.4 : 0;
		curScale += (scaleTarget - curScale) * k;
		curLift += (liftTarget - curLift) * k;
		if (group) {
			group.scale.setScalar(curScale * NODE_SCALE * reveal);
			group.position.set(node.x, node.y + curLift, node.z);
		}
	});
</script>

<T.Group bind:ref={group} position={[node.x, node.y, node.z]} scale={node.scale * NODE_SCALE}>
	<!-- SHELL — the hit target: a tight faceted crystal skin ~1.3× the core, exactly
	     centered on it (both sit at this group's origin). Additive backside blending
	     gives a fresnel-ish rim AND guarantees the rim is tinted by the status hue
	     (plain transparent blending washed toward pale over the void). -->
	<T.Mesh
		onpointerenter={(e: any) => {
			if (!matches) return; // raycast-guard: filtered-out nodes are inert
			e.stopPropagation();
			hover(grant.id);
		}}
		onpointerleave={() => matches && hover(null)}
		onclick={(e: any) => {
			if (!matches) return; // raycast-guard: filtered-out nodes cannot be selected
			e.stopPropagation();
			select(grant.id);
		}}
	>
		<T.IcosahedronGeometry args={[SHELL_RADIUS, detail]} />
		<T.MeshBasicMaterial
			bind:ref={shellMaterial}
			color={hue}
			transparent
			opacity={SHELL_OPACITY}
			side={BackSide}
			blending={AdditiveBlending}
			depthWrite={false}
			toneMapped={false}
		/>
	</T.Mesh>

	<!-- CORE — small white-hot emissive sphere; the layer the bloom pass catches. -->
	<T.Mesh raycast={noRaycast}>
		<T.SphereGeometry args={[CORE_RADIUS, 20, 20]} />
		<T.MeshStandardMaterial
			bind:ref={coreMaterial}
			color={hue}
			emissive={hue}
			emissiveIntensity={baseIntensity * CORE_GAIN}
			{roughness}
			metalness={0}
			toneMapped={false}
		/>
	</T.Mesh>

	<!-- HALO — soft additive status-hued glow, ~3.5× (breathes on pulse nodes). -->
	<T.Sprite bind:ref={halo} raycast={noRaycast} scale={[HALO_SCALE, HALO_SCALE, 1]}>
		<T.SpriteMaterial
			map={haloTex}
			color={hue}
			transparent
			opacity={haloBase}
			blending={AdditiveBlending}
			depthWrite={false}
			toneMapped={false}
			fog={false}
		/>
	</T.Sprite>
</T.Group>
