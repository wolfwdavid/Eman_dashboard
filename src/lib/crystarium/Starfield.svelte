<script lang="ts">
	// VIS-01 backdrop — a fine starfield of ~1200 tiny points on a large spherical shell
	// far behind/around the grid, drifting very slowly. Deliberately kept DIM (below the
	// bloom luminanceThreshold) so the stars never bloom — only the node cores do. Built
	// ONCE (geometry + one point-sprite texture) and rotated via a single scalar in useTask
	// (no per-frame allocation). Browser-only (imports the canvas-texture util) — only ever
	// reached through the dynamically-imported Canvas.
	import { T, useTask } from '@threlte/core';
	import { BufferGeometry, BufferAttribute, Points } from 'three';
	import { radialSprite } from './gradients.js';

	const COUNT = 1200;
	const RADIUS_MIN = 60;
	const RADIUS_MAX = 150;

	// Seeded LCG so the field is stable across reloads (backdrop only — no data purity
	// concern; avoids Math.random churn and keeps the look deterministic).
	let seed = 0x9e3779b9 >>> 0;
	const rand = () => {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		return seed / 4294967296;
	};

	const geometry = new BufferGeometry();
	const positions = new Float32Array(COUNT * 3);
	for (let i = 0; i < COUNT; i++) {
		// Uniform on a spherical shell, flattened a touch vertically for a galactic feel.
		const u = rand() * 2 - 1;
		const theta = rand() * Math.PI * 2;
		const r = RADIUS_MIN + rand() * (RADIUS_MAX - RADIUS_MIN);
		const s = Math.sqrt(1 - u * u);
		positions[i * 3] = r * s * Math.cos(theta);
		positions[i * 3 + 1] = r * u * 0.65;
		positions[i * 3 + 2] = r * s * Math.sin(theta);
	}
	geometry.setAttribute('position', new BufferAttribute(positions, 3));

	// Round, soft point sprite (no hard square pixels).
	const starTex = radialSprite({ size: 64, inner: 'rgba(255,255,255,1)', outer: 'rgba(255,255,255,0)' });

	let points: Points | undefined = $state();
	useTask((delta) => {
		if (points) points.rotation.y += delta * 0.005; // very slow drift
	});
</script>

<!-- Dim blue-white points; NormalBlending + capped opacity keeps every star pixel under
     the bloom threshold (they must not feed bloom). fog off so distant stars don't wash
     into the fog colour. depthWrite off so they never occlude the grid. -->
<T.Points bind:ref={points} {geometry} frustumCulled={false}>
	<T.PointsMaterial
		map={starTex}
		size={0.7}
		sizeAttenuation
		color={0x93a6cc}
		transparent
		opacity={0.5}
		depthWrite={false}
		toneMapped={false}
		fog={false}
	/>
</T.Points>
