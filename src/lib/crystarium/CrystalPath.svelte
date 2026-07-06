<script lang="ts">
	// One connecting edge (CRYS-06). Renders an emissive, additive-blended tube
	// between two node positions, styled by `edge.kind`:
	//   spine  — progression funnel links (tokens.path, low alpha, gentle flow toward core)
	//   family — same-funder bridges (tokens.path, thinner + fainter, NO directional flow)
	//   beam   — fiscal-sponsor BEAM: thickest, gold→cyan vertex gradient
	//            (tokens.beamCore → tokens.beamTip) with a bright travelling pulse core→target.
	// Colours come from tokens.ts only (no raw hex). Only ever reached through the
	// dynamically-imported Canvas, so a direct `three` import stays out of the SSR graph.
	//
	// Endpoints/kind are fixed for a given edge (the layout is deterministic), so the
	// geometry is built ONCE in a closure `build()` — props are captured there, keeping
	// the component-instance scope free of non-reactive prop reads.
	import { T, useTask } from '@threlte/core';
	import { QuadraticBezierCurve3, Vector3, TubeGeometry, BufferAttribute, Color, AdditiveBlending } from 'three';
	import { intro } from './intro.svelte.js';
	import * as tokens from './tokens';

	let {
		edge,
		from,
		to,
		dim = false
	}: { edge: { kind: string }; from: any; to: any; dim?: boolean } = $props();

	function build() {
		// VIS-03: a gently-ARCED filament of light (not a straight conduit) — the midpoint
		// is lifted along the dome normal (up + a touch outward) so links bow over the dome.
		const fromV = new Vector3(from.x, from.y, from.z);
		const toV = new Vector3(to.x, to.y, to.z);
		const mid = fromV.clone().add(toV).multiplyScalar(0.5);
		const dist = fromV.distanceTo(toV);
		mid.y += 0.35 + dist * 0.14; // lift up along the dome normal
		const outward = Math.hypot(mid.x, mid.z);
		if (outward > 1e-4) {
			const k = (dist * 0.06) / outward; // bow slightly outward from the origin too
			mid.x += mid.x * k;
			mid.z += mid.z * k;
		}
		const curve = new QuadraticBezierCurve3(fromV, mid, toV);
		const kind = edge.kind;
		const isBeam = kind === 'beam';
		const isFamily = kind === 'family';

		// VIS-03 dimensions — VERY thin filaments (beam a hair thicker/brighter = signature).
		const radius = isBeam ? 0.045 : isFamily ? 0.022 : 0.03;
		const tubularSegments = isBeam ? 64 : 32; // arcs need more segments for a smooth bow
		const radialSegments = isBeam ? 8 : 6;
		const opacity = isBeam ? 0.4 : isFamily ? 0.15 : 0.22;

		// Beam only: build a gold→cyan vertex-coloured tube (gradient core→tip).
		let beamGeometry: any = undefined;
		if (isBeam) {
			const g = new TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
			const count = g.attributes.position.count;
			const colors = new Float32Array(count * 3);
			const core = new Color(tokens.beamCore);
			const tip = new Color(tokens.beamTip);
			const stride = radialSegments + 1; // TubeGeometry emits (radialSegments+1) verts per ring
			const tmp = new Color();
			for (let i = 0; i < count; i++) {
				const u = Math.floor(i / stride) / tubularSegments; // 0 at core → 1 at target
				tmp.copy(core).lerp(tip, u);
				colors[i * 3] = tmp.r;
				colors[i * 3 + 1] = tmp.g;
				colors[i * 3 + 2] = tmp.b;
			}
			g.setAttribute('color', new BufferAttribute(colors, 3));
			beamGeometry = g;
		}

		// Travelling flow pulse: beam charges bright core→target; spine has a faint drift.
		// Family edges express relatedness (not progression) → no directional flow.
		const hasFlow = !isFamily;
		return {
			curve,
			isBeam,
			isFamily,
			radius,
			tubularSegments,
			radialSegments,
			opacity,
			beamGeometry,
			hasFlow,
			flowSpeed: isBeam ? 0.4 : 0.16,
			flowColor: isBeam ? tokens.beamTip : tokens.path,
			// Thin tubes → boost the travelling-pulse multiplier so the flow stays visible.
			flowRadius: isBeam ? radius * 2.6 : radius * 2.4
		};
	}
	const cfg = build();

	// AEST-01 draw-in: paths trace in AFTER the nodes — gate opacity on the TAIL of the
	// wavefront (p 0.6→1) so tubes/flow fade in once most crystals are lit. Once settled
	// (intro.done) this is a hard 1 → the steady scene is identical to today. Uniform/
	// opacity only — geometry, kinds and flow-pulse math are untouched.
	const pathReveal = $derived(
		intro.done ? 1 : Math.max(0, Math.min(1, (intro.revealProgress - 0.6) / 0.4))
	);

	// Phase-4 filter-dim: an edge fades when EITHER endpoint is filtered out
	// (uniform/opacity only — geometry is untouched, so the layout never shifts).
	const tubeOpacity = $derived((dim ? cfg.opacity * 0.25 : cfg.opacity) * pathReveal);
	const flowOpacity = $derived((cfg.isBeam ? 0.85 : 0.45) * (dim ? 0.25 : 1) * pathReveal);

	let flowMesh: any = $state();
	let t = 0;
	if (cfg.hasFlow) {
		useTask((delta) => {
			t = (t + delta * cfg.flowSpeed) % 1;
			if (flowMesh) {
				const p = cfg.curve.getPointAt(t);
				flowMesh.position.set(p.x, p.y, p.z);
			}
		});
	}
</script>

{#if cfg.isBeam}
	<T.Mesh geometry={cfg.beamGeometry}>
		<T.MeshBasicMaterial
			vertexColors
			transparent
			opacity={tubeOpacity}
			blending={AdditiveBlending}
			depthWrite={false}
			toneMapped={false}
		/>
	</T.Mesh>
{:else}
	<T.Mesh>
		<T.TubeGeometry args={[cfg.curve, cfg.tubularSegments, cfg.radius, cfg.radialSegments, false]} />
		<T.MeshBasicMaterial
			color={tokens.path}
			transparent
			opacity={tubeOpacity}
			blending={AdditiveBlending}
			depthWrite={false}
			toneMapped={false}
		/>
	</T.Mesh>
{/if}

{#if cfg.hasFlow}
	<T.Mesh bind:ref={flowMesh}>
		<T.SphereGeometry args={[cfg.flowRadius, 10, 10]} />
		<T.MeshBasicMaterial
			color={cfg.flowColor}
			transparent
			opacity={flowOpacity}
			blending={AdditiveBlending}
			depthWrite={false}
			toneMapped={false}
		/>
	</T.Mesh>
{/if}
