<script lang="ts">
	// Chart A — Status distribution (PIPE-01). Horizontal bar, one bar per status
	// in funnel order, each filled with its own `--status-*` token (1:1 with the
	// Legend). Counts come from the tested `countByStatus` selector — NEVER a
	// literal — so the chart can never drift from the dataset (Σ28). LayerChart is
	// SVG → prerender-safe; marks paint after hydration (drawer is collapsed by
	// default), which is fine.
	import { BarChart } from 'layerchart';
	import { countByStatus } from '$lib/data/aggregates';
	import { grants } from '$lib/data';

	// Funnel order: dim frontier → resolved outcomes. EXACT hyphenated enum keys
	// (typos here yield a transparent bar — see 04-RESEARCH Pitfall 3).
	const order = [
		'to-research',
		'in-progress',
		'recurring',
		'not-eligible-yet',
		'active',
		'applied',
		'declined',
		'not-eligible'
	];
	const counts = countByStatus(grants);
	const data = order.map((s) => ({ status: s, count: counts[s] ?? 0 }));
	// Per-bar hue via CSS var (no raw hex) — cDomain pins the mapping so each
	// status always gets its own token regardless of data order.
	const cRange = order.map((s) => `var(--status-${s})`);
</script>

<figure class="chart">
	<figcaption class="title">STATUS</figcaption>
	<div class="plot">
		<BarChart
			{data}
			x="count"
			y="status"
			orientation="horizontal"
			c="status"
			cDomain={order}
			{cRange}
			labels
			legend={false}
			height={220}
			props={{ grid: { stroke: 'var(--grid-line)' } }}
		/>
	</div>
</figure>

<style>
	.chart {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.title {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: 0.02em;
		color: var(--text-hi);
	}

	.plot {
		width: 100%;
		/* Tabular figures + Inter for axis/label text inside the SVG. */
		font-family: var(--font-body);
		font-variant-numeric: tabular-nums;
		font-size: 12px;
		color: var(--text-lo);
	}
</style>
