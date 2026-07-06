<script lang="ts">
	// Top-right glass pipeline chip (03-UI-SPEC §HUD Layout 2). Two stacked
	// figures with tabular numerals so the readout never shifts. SECURED is the
	// scarce gold (secured node + this figure are the ONLY gold in the HUD);
	// POTENTIAL is cool-white. Plain Svelte — prerenders, no Three import.
	//
	// Figures are passed in from +page.svelte (secured=20000 / potential=296500,
	// both verified against grants.generated.json in Phase 2).
	//
	// `ui` is the plain runes bridge (no Three import) — safe to read in this
	// prerendered chip. While a node is selected the right-edge DetailPanel (z-30)
	// slides in over this z-10 readout, so we fade/slide it out of the collision
	// (SSR sees selected:null → readout renders visible for first paint).
	import { ui } from '$lib/state/crystarium.svelte.js';
	let { secured = 20000, potential = 296500 }: { secured?: number; potential?: number } = $props();
</script>

<div class="panel" class:hidden={ui.selected !== null}>
	<div class="figure">
		<span class="caption">SECURED</span>
		<span class="value gold">${secured.toLocaleString()}</span>
	</div>
	<div class="figure">
		<span class="caption">POTENTIAL</span>
		<span class="value">${potential.toLocaleString()}</span>
	</div>
	<p class="footnote">avg/midpoint · live pipeline</p>
</div>

<style>
	.panel {
		position: fixed;
		top: 24px;
		right: 24px;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 16px 20px;
		border-radius: 14px;
		text-align: right;
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		pointer-events: none;
		/* Motion discipline: opacity/transform only (~180ms) so the readout slides
		   toward its edge + fades while the detail rail owns the right column. */
		transition:
			opacity 180ms ease,
			transform 180ms ease;
	}

	.panel.hidden {
		opacity: 0;
		transform: translateX(12px);
		pointer-events: none;
	}

	.figure {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.caption {
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.5;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-lo);
	}

	.value {
		font-family: var(--font-display);
		font-size: 32px;
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: 0.02em;
		color: var(--text-hi);
		font-variant-numeric: tabular-nums;
	}

	.value.gold {
		color: var(--secured-gold);
	}

	.footnote {
		margin: 2px 0 0;
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-lo);
	}

	/* Mobile re-flow (MOB-01): a slim top-right strip that clears the compact
	   title on the left — the two figures stay stacked but tighten, footnote drops.
	   Desktop (>768px) is untouched. */
	@media (max-width: 768px) {
		.panel {
			top: 12px;
			right: 12px;
			padding: 8px 12px;
			gap: 4px;
			max-width: 36vw;
		}
		.caption {
			font-size: 9px;
			letter-spacing: 0.08em;
		}
		.value {
			font-size: 16px;
		}
		.footnote {
			display: none;
		}
	}
</style>
