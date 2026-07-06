<script lang="ts">
	// Pipeline Overview (PIPE-01..05 host) — a bottom-center glass drawer that is
	// COLLAPSED BY DEFAULT so the Crystarium stays the hero. Collapsed shows the
	// handle (`▲ PIPELINE OVERVIEW`) + the always-visible FilterBar. Expanding
	// slides up a 2×2 grid of the four LayerChart charts.
	//
	// `open` is LOCAL component state (not the shared `ui`) — the handle toggles it.
	// Motion honours the inherited discipline: translateY/opacity only, 240ms
	// enter / 180ms exit (exit faster than enter).
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import FilterBar from './FilterBar.svelte';
	import StatusChart from './charts/StatusChart.svelte';
	import SecuredVsPotential from './charts/SecuredVsPotential.svelte';
	import DeadlineTimeline from './charts/DeadlineTimeline.svelte';
	import GateSplit from './charts/GateSplit.svelte';

	let open = $state(false);
</script>

<section class="drawer" class:open>
	{#if open}
		<div
			class="charts"
			in:slide={{ duration: 240, axis: 'y', easing: cubicOut }}
			out:slide={{ duration: 180, axis: 'y', easing: cubicOut }}
		>
			<div class="grid">
				<StatusChart />
				<SecuredVsPotential />
				<DeadlineTimeline />
				<GateSplit />
			</div>
		</div>
	{/if}

	<header class="head">
		<button type="button" class="handle" onclick={() => (open = !open)} aria-expanded={open}>
			<span class="chev">{open ? '▼' : '▲'}</span>
			PIPELINE OVERVIEW
		</button>
		<FilterBar />
	</header>
</section>

<style>
	.drawer {
		position: fixed;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 20;
		width: min(920px, calc(100vw - 48px));
		display: flex;
		flex-direction: column;
		padding: 16px 20px;
		border-radius: 14px;
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		pointer-events: auto;
	}

	.charts {
		overflow: hidden;
		margin-bottom: 16px;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 32px;
		padding-bottom: 8px;
		/* Cap the expanded charts so the drawer never eclipses the SceneTitle /
		   scene behind it (04-05 note 3). Scroll inside the cap; the slide stays
		   on the outer .charts (overflow:hidden) so the reveal is untouched. */
		max-height: 60vh;
		overflow-y: auto;
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.handle {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: 0.02em;
		color: var(--text-hi);
		transition: color 120ms ease;
	}

	.handle:hover {
		color: var(--secured-gold);
	}

	.chev {
		font-size: 14px;
		color: var(--text-lo);
	}

	@media (max-width: 640px) {
		.drawer {
			bottom: 16px;
			width: calc(100vw - 32px);
			padding: 12px 14px;
		}

		.grid {
			grid-template-columns: 1fr;
			gap: 24px;
		}
	}
</style>
