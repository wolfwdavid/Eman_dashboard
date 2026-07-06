// Browser-only canvas-texture helpers for the Crystarium backdrop + node-halo layers
// (VIS-01 / VIS-02). Builds soft radial-gradient sprite textures at runtime — NO image
// assets, NO new deps. `document`/`<canvas>` are touched here, so this module is ONLY
// ever imported by the browser-gated scene components (Nebula, Starfield, CrystalNode
// halo) reached through the dynamically-imported Canvas — it must NEVER enter the SSR
// graph.

import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * A soft radial-gradient sprite texture: bright-ish center → transparent rim. Used for
 * additive nebula billboards, node halos, and the star point-sprite. Cheap to build once
 * and reuse across many sprites (pass the same texture to every instance of a kind).
 *
 * @param {object} [opts]
 * @param {number} [opts.size]     canvas px (power of two)
 * @param {string} [opts.inner]    center colour (any CSS colour)
 * @param {string} [opts.mid]      optional mid-stop colour
 * @param {number} [opts.stopMid]  mid-stop position 0..1
 * @param {string} [opts.outer]    rim colour (normally fully transparent)
 * @returns {CanvasTexture}
 */
export function radialSprite({
	size = 128,
	inner = 'rgba(255,255,255,1)',
	mid = undefined,
	stopMid = 0.5,
	outer = 'rgba(255,255,255,0)'
} = {}) {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('radialSprite: 2D canvas context unavailable');
	const r = size / 2;
	const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
	grad.addColorStop(0, inner);
	if (mid) grad.addColorStop(stopMid, mid);
	grad.addColorStop(1, outer);
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, size, size);
	const tex = new CanvasTexture(canvas);
	tex.colorSpace = SRGBColorSpace;
	tex.needsUpdate = true;
	return tex;
}
