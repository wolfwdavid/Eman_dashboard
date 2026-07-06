<script lang="ts">
	// Chart C — Deadline timeline (PIPE-03). A ScatterChart over the four grants
	// that carry a concrete `deadline.date`, ordered by urgency (date ascending).
	// ScatterChart auto-selects a time scale when `x` yields Date objects.
	//
	// Markers are coloured by an URGENCY bucket (deterministic cDomain/cRange, no
	// raw hex): passed → ash (`--status-declined`), <30d → `--urgent`, ≤90d →
	// `--status-in-progress`, else the cool progression `--path`. This makes the
	// "<30d = urgent, passed = ash" contract legible without a fragile bespoke
	// overlay (the gold ring overlay was an explicit nice-to-have, deferred).
	// The many rolling/annual/invitation grants have no x-position, so they are
	// summarised in a caption row beneath rather than invented onto the axis.
	import { ScatterChart } from 'layerchart';
	import { grants } from '$lib/data';

	const DAY = 86_400_000;
	const now = Date.now();

	type Bucket = 'passed' | 'urgent' | 'soon' | 'upcoming';
	function urgency(dateMs: number, isPassed: boolean): Bucket {
		if (isPassed || dateMs < now) return 'passed';
		const days = Math.ceil((dateMs - now) / DAY);
		if (days < 30) return 'urgent';
		if (days <= 90) return 'soon';
		return 'upcoming';
	}

	const dated = grants
		.filter((g) => g.deadline.date)
		.map((g) => {
			const date = new Date(g.deadline.date as string);
			return {
				date,
				funder: g.funder,
				status: g.status,
				bucket: urgency(+date, g.deadline.isPassed)
			};
		})
		.sort((a, b) => +a.date - +b.date);

	// Fixed urgency legend so colour never drifts with data order.
	const bucketOrder: Bucket[] = ['passed', 'urgent', 'soon', 'upcoming'];
	const cRange = [
		'var(--status-declined)',
		'var(--urgent)',
		'var(--status-in-progress)',
		'var(--path)'
	];

	// Non-dated cadences — counted, not positioned (no honest x for them).
	const cadence = grants.reduce<Record<string, number>>((o, g) => {
		if (!g.deadline.date) o[g.deadline.cadence] = (o[g.deadline.cadence] ?? 0) + 1;
		return o;
	}, {});
	const cadenceRow = ['rolling', 'annual', 'invitation']
		.filter((c) => cadence[c])
		.map((c) => `${c[0].toUpperCase()}${c.slice(1)} ${cadence[c]}`);
</script>

<figure class="chart">
	<figcaption class="title">DEADLINES</figcaption>
	<div class="plot">
		<ScatterChart
			data={dated}
			x="date"
			y="funder"
			c="bucket"
			cDomain={bucketOrder}
			{cRange}
			height={220}
			props={{ xAxis: { format: 'day' }, grid: { stroke: 'var(--grid-line)' } }}
		/>
	</div>
	{#if cadenceRow.length}
		<p class="cadence">No fixed date · {cadenceRow.join(' · ')}</p>
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

	.cadence {
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
</style>
