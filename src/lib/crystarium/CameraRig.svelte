<script lang="ts">
	// The scene camera (CRYS-07). Idle: OrbitControls slow auto-orbit around the dome.
	// On selection: GSAP springs the camera to frame `ui.cameraFocus` (~600ms enter,
	// power3.out) and disables auto-orbit; on deselect it eases back to the overview
	// (~250ms — exit faster than enter) and re-enables auto-orbit. Tweens are always
	// killed before a new one starts so rapid selections never stack. gsap is imported
	// client-only (this component only ever mounts inside the browser-gated Canvas).
	import { T, useThrelte, useTask } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { onDestroy } from 'svelte';
	import gsap from 'gsap';
	import { ui } from '$lib/state/crystarium.svelte.js';
	import { computeLayout } from './layout.js';
	import { grants } from '$lib/data';

	const { invalidate } = useThrelte();

	// Pure node positions (same deterministic layout the Scene renders).
	const { nodes } = computeLayout(grants);
	const nodeById = new Map(nodes.map((n) => [n.id, n]));

	const DEFAULT_POS = { x: 0, y: 14, z: 34 };
	const DEFAULT_TARGET = { x: 0, y: 0, z: 0 };

	let controls: any = $state();
	let tween: gsap.core.Timeline | undefined;

	// Ease in to frame a node: dolly to an offset vantage + look-at the node (~600ms).
	function focus(nodeId: string) {
		const n = nodeById.get(nodeId);
		if (!n || !controls) return;
		tween?.kill();
		controls.autoRotate = false;
		tween = gsap
			.timeline({ onUpdate: invalidate })
			.to(controls.object.position, { x: n.x + 8, y: n.y + 6, z: n.z + 8, duration: 0.6, ease: 'power3.out' }, 0)
			.to(controls.target, { x: n.x, y: n.y, z: n.z, duration: 0.6, ease: 'power3.out' }, 0);
	}

	// Release to overview (~250ms) then hand back to auto-orbit.
	function resetView() {
		if (!controls) return;
		tween?.kill();
		tween = gsap
			.timeline({
				onUpdate: invalidate,
				onComplete: () => {
					if (controls) controls.autoRotate = true;
				}
			})
			.to(controls.object.position, { ...DEFAULT_POS, duration: 0.25, ease: 'power3.out' }, 0)
			.to(controls.target, { ...DEFAULT_TARGET, duration: 0.25, ease: 'power3.out' }, 0);
	}

	// React to the runes bridge: a selection frames it, a deselect returns to overview.
	$effect(() => {
		if (ui.cameraFocus) focus(ui.cameraFocus);
		else resetView();
	});

	// OrbitControls damping + autoRotate need a per-frame update.
	useTask(() => controls?.update());

	onDestroy(() => tween?.kill());
</script>

<T.PerspectiveCamera makeDefault position={[0, 14, 34]} fov={45}>
	<OrbitControls
		bind:ref={controls}
		enableDamping
		autoRotate
		autoRotateSpeed={0.4}
		target={[0, 0, 0]}
	/>
</T.PerspectiveCamera>
