<script lang="ts">
	// Chart B — Secured vs. potential (PIPE-02). Two bars sized by the tested
	// `securedTotal` (banked → gold) and `potentialTotal` (live-pipeline estimate
	// → cool white) selectors — never hardcoded. The exact figures are also
	// direct-labelled in a dedicated value row below the plot so the copywriting
	// ($20,000 gold / $296,500 cool) is guaranteed, tabular, and correctly toned
	// regardless of the in-bar label format.
	import { BarChart } from 'layerchart';
	import { securedTotal, potentialTotal } from '$lib/data/aggregates';
	import { grants } from '$lib/data';

	const secured = securedTotal(grants); // → 20000
	const potential = potentialTotal(grants); // → 296500
	const data = [
		{ k: 'Secured', v: secured },
		{ k: 'Potential', v: potential }
	];
	const usd = (n: number) => '$' + n.toLocaleString('en-US');
</script>

<figure class="chart">
	<figcaption class="title">SECURED vs POTENTIAL</figcaption>
	<div class="plot">
		<BarChart
			{data}
			x="k"
			y="v"
			c="k"
			cDomain={['Secured', 'Potential']}
			cRange={['var(--secured-gold)', 'var(--chart-potential)']}
			height={200}
			props={{ grid: { stroke: 'var(--grid-line)' } }}
		/>
	</div>
	<div class="figures">
		<span class="figure gold">{usd(secured)}<small>secured</small></span>
		<span class="figure cool">{usd(potential)}<small>potential</small></span>
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
		font-family: var(--font-body);
		font-variant-numeric: tabular-nums;
		font-size: 12px;
		color: var(--text-lo);
	}

	.figures {
		display: flex;
		justify-content: space-around;
		gap: 16px;
	}

	.figure {
		display: flex;
		flex-direction: column;
		align-items: center;
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 600;
		line-height: 1.2;
		font-variant-numeric: tabular-nums;
	}

	.figure.gold {
		color: var(--secured-gold);
	}

	.figure.cool {
		color: var(--chart-potential);
	}

	.figure small {
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 400;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-lo);
	}
</style>
