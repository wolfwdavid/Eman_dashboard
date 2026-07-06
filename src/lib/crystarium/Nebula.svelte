<script lang="ts">
	// VIS-01 backdrop — a few very large, soft, additive nebula clouds (violet / deep cyan
	// / magenta / indigo) far behind and around the grid. Radial-gradient CanvasTextures
	// (no image assets, no new deps), LOW opacity so they only lift the void's value a
	// little and stay well under the bloom threshold — never crisp shapes, never bloom.
	// Textures built ONCE and reused. Browser-only — only ever reached through the
	// dynamically-imported Canvas.
	import { T } from '@threlte/core';
	import { AdditiveBlending } from 'three';
	import { radialSprite } from './gradients.js';

	type Cloud = { pos: [number, number, number]; scale: number; color: string; opacity: number };

	// Deep, desaturated cosmic tints (kept dim so additive stacking stays sub-threshold).
	const CLOUDS: Cloud[] = [
		{ pos: [-30, 8, -44], scale: 64, color: 'rgba(96,72,168,1)', opacity: 0.11 }, // violet
		{ pos: [34, -6, -38], scale: 58, color: 'rgba(46,120,150,1)', opacity: 0.09 }, // deep cyan
		{ pos: [10, 20, -50], scale: 72, color: 'rgba(150,58,118,1)', opacity: 0.06 }, // magenta
		{ pos: [-16, -14, -34], scale: 50, color: 'rgba(70,62,142,1)', opacity: 0.08 } // indigo
	];

	// One soft radial texture per cloud (center colour → transparent rim).
	const textures = CLOUDS.map((c) =>
		radialSprite({ size: 256, inner: c.color, mid: c.color.replace(',1)', ',0.5)'), stopMid: 0.45, outer: 'rgba(0,0,0,0)' })
	);
</script>

{#each CLOUDS as c, i}
	<T.Sprite position={c.pos} scale={[c.scale, c.scale, 1]}>
		<T.SpriteMaterial
			map={textures[i]}
			transparent
			opacity={c.opacity}
			blending={AdditiveBlending}
			depthWrite={false}
			toneMapped={false}
			fog={false}
		/>
	</T.Sprite>
{/each}
