<script lang="ts">
	// Chart D — 501(c)(3) split (PIPE-04). A single horizontal 100%-stacked bar of
	// three series — Open now / Gated / Unknown — sized by the tested `by501c3`
	// selector ({ no, yes, unknown }, Σ28), never hardcoded. Segment fills are the
	// declared gate-alias tokens (`--gate-*`, aliases of existing hues — no new
	// palette, no raw hex).
	//
	// The 5 fiscal-sponsor-eligible funders live inside the Gated segment; the
	// Phase-3 gold beam-tick overlay was an explicit nice-to-have and is surfaced
	// here as a caption note rather than a bespoke SVG mark (kept deterministic).
	import { BarChart } from 'layerchart';
	import { by501c3 } from '$lib/data/aggregates';
	import { grants } from '$lib/data';

	const c = by501c3(grants); // { no: 12, yes: 8, unknown: 8 }
	const data = [{ label: '501(c)(3)', open: c.no ?? 0, gated: c.yes ?? 0, unknown: c.unknown ?? 0 }];

	// Count fiscal-sponsor-eligible rows inside the Gated segment (raw text carries
	// the "fiscal sponsor" hint) — surfaced as a caption, echoing the P3 beam.
	const sponsorEligible = grants.filter((g) =>
		/fiscal sponsor/i.test(g.requires501c3Raw)
	).length;
</script>

<figure class="chart">
	<figcaption class="title">501(C)(3) GATE</figcaption>
	<div class="plot">
		<BarChart
			{data}
			y="label"
			orientation="horizontal"
			seriesLayout="stack"
			series={[
				{ key: 'open', label: 'Open now', color: 'var(--gate-open)' },
				{ key: 'gated', label: 'Gated', color: 'var(--gate-gated)' },
				{ key: 'unknown', label: 'Unknown', color: 'var(--gate-unknown)' }
			]}
			legend
			labels
			height={120}
			props={{ grid: { stroke: 'var(--grid-line)' } }}
		/>
	</div>
	{#if sponsorEligible}
		<p class="sponsor">
			<span class="tick"></span>{sponsorEligible} fiscal-sponsor-eligible within Gated
		</p>
	{/if}
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

	.sponsor {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.5;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-lo);
		font-variant-numeric: tabular-nums;
	}

	.tick {
		width: 3px;
		height: 12px;
		flex: 0 0 3px;
		border-radius: 1px;
		background: var(--secured-gold);
		box-shadow: 0 0 6px var(--secured-gold);
	}
</style>
