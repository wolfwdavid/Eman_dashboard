<script lang="ts">
	// Filter bar (PIPE-05) — three axes that write the structured `ui.filter` via
	// the runes bridge. ALWAYS visible (even when the Pipeline drawer is collapsed)
	// so segmenting the grid is one click. Active state is read straight back from
	// `ui.filter.*`, and a zero-match combo surfaces an empty-state hint + reset.
	//
	// Status counts come from the tested `countByStatus` selector (never literals);
	// swatch fills use the exact hyphenated `--status-*` tokens (no raw hex), 1:1
	// with the Legend and the Chart-A bars.
	import { ui, setFilter, resetFilters } from '$lib/state/crystarium.svelte.js';
	import { countByStatus } from '$lib/data/aggregates';
	import { matchesFilter } from '$lib/data/filter';
	import { grants } from '$lib/data';

	const counts = countByStatus(grants);

	// Legend funnel order + human labels (matches Legend.svelte).
	const statuses: { key: string; label: string }[] = [
		{ key: 'active', label: 'Active' },
		{ key: 'in-progress', label: 'In progress' },
		{ key: 'applied', label: 'Applied' },
		{ key: 'recurring', label: 'Recurring' },
		{ key: 'to-research', label: 'To research' },
		{ key: 'not-eligible-yet', label: 'Not eligible (yet)' },
		{ key: 'not-eligible', label: 'Not eligible' },
		{ key: 'declined', label: 'Declined' }
	];

	const gateOptions: { value: string; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'open', label: 'Open' },
		{ value: 'gated', label: 'Gated' },
		{ value: 'unknown', label: 'Unknown' }
	];
	const typeOptions: { value: string; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'Grant', label: 'Grant' },
		{ value: 'Fellowship', label: 'Fellowship' },
		{ value: 'Investment', label: 'Investment' }
	];

	// Reactive: does the active combination match nothing?
	const noMatch = $derived(grants.filter((g) => matchesFilter(g, ui.filter)).length === 0);
</script>

<div class="filterbar">
	<!-- Status axis — chip row (single-isolate) -->
	<div class="axis">
		<span class="axis-label">STATUS</span>
		<div class="chips">
			<button
				type="button"
				class="chip"
				class:active={ui.filter.status === 'all'}
				onclick={() => setFilter('status', 'all')}
			>
				All
			</button>
			{#each statuses as s (s.key)}
				<button
					type="button"
					class="chip hue"
					class:active={ui.filter.status === s.key}
					style="--hue: var(--status-{s.key});"
					onclick={() => setFilter('status', s.key)}
				>
					<span class="swatch"></span>
					<span class="chip-label">{s.label}</span>
					<span class="count">{counts[s.key] ?? 0}</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- 501(c)(3) gate axis — segmented control -->
	<div class="axis">
		<span class="axis-label">501(C)(3)</span>
		<div class="segment">
			{#each gateOptions as o (o.value)}
				<button
					type="button"
					class="seg"
					class:active={ui.filter.gate === o.value}
					onclick={() => setFilter('gate', o.value)}
				>
					{o.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Type axis — segmented control -->
	<div class="axis">
		<span class="axis-label">TYPE</span>
		<div class="segment">
			{#each typeOptions as o (o.value)}
				<button
					type="button"
					class="seg"
					class:active={ui.filter.type === o.value}
					onclick={() => setFilter('type', o.value)}
				>
					{o.label}
				</button>
			{/each}
		</div>
	</div>

	<button type="button" class="reset" onclick={() => resetFilters()}>Reset</button>

	{#if noMatch}
		<p class="empty">
			No funders match these filters.
			<button type="button" class="reset inline" onclick={() => resetFilters()}>
				Reset filters
			</button>
		</p>
	{/if}
</div>

<style>
	.filterbar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 16px;
		width: 100%;
	}

	.axis {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.axis-label {
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.5;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-lo);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid var(--surface-glass-border);
		background: transparent;
		cursor: pointer;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-lo);
		font-variant-numeric: tabular-nums;
		/* Motion discipline: colour/opacity only, 120ms (no transform). */
		transition:
			background-color 120ms ease,
			border-color 120ms ease,
			color 120ms ease,
			opacity 120ms ease;
	}

	.chip .swatch {
		width: 12px;
		height: 12px;
		flex: 0 0 12px;
		border-radius: 2px;
		transform: rotate(45deg);
		background: var(--hue);
	}

	.chip .count {
		color: var(--text-lo);
		font-size: 12px;
	}

	.chip:hover {
		color: var(--text-hi);
	}

	/* Active: filled with the status hue tint + hue border + high-contrast text. */
	.chip.hue.active {
		background: color-mix(in srgb, var(--hue) 35%, transparent);
		border-color: var(--hue);
		color: var(--text-hi);
	}

	.chip.hue.active .count {
		color: var(--text-hi);
	}

	.chip.active:not(.hue) {
		background: color-mix(in srgb, var(--text-hi) 14%, transparent);
		border-color: var(--text-hi);
		color: var(--text-hi);
	}

	.segment {
		display: inline-flex;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--surface-glass-border);
	}

	.seg {
		padding: 6px 12px;
		border: none;
		border-right: 1px solid var(--surface-glass-border);
		background: transparent;
		cursor: pointer;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-lo);
		transition:
			background-color 120ms ease,
			color 120ms ease;
	}

	.seg:last-child {
		border-right: none;
	}

	.seg:hover {
		color: var(--text-hi);
	}

	.seg.active {
		background: color-mix(in srgb, var(--path) 28%, transparent);
		color: var(--text-hi);
	}

	.reset {
		align-self: center;
		padding: 6px 14px;
		border-radius: 10px;
		border: 1px solid var(--surface-glass-border);
		background: transparent;
		cursor: pointer;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-lo);
		transition:
			color 120ms ease,
			border-color 120ms ease;
	}

	.reset:hover {
		color: var(--text-hi);
		border-color: var(--text-hi);
	}

	.empty {
		flex: 1 0 100%;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 12px;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-hi);
	}

	.reset.inline {
		padding: 4px 10px;
		color: var(--urgent);
		border-color: var(--urgent);
	}

	.reset.inline:hover {
		color: var(--text-hi);
	}
</style>
