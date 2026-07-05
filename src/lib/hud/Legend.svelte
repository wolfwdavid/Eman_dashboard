<script lang="ts">
	// Bottom-left glass legend (03-UI-SPEC §HUD Layout 3). 8 status-hue rows in
	// funnel order. Swatch colours are driven from a status→CSS-var map (the DOM
	// twin of tokens.statusHue) — NO raw hex in the template. Plain Svelte,
	// prerenders, no Three import.
	const rows: { label: string; token: string }[] = [
		{ label: 'Active', token: '--status-active' },
		{ label: 'In progress', token: '--status-in-progress' },
		{ label: 'Applied', token: '--status-applied' },
		{ label: 'Recurring', token: '--status-recurring' },
		{ label: 'To research', token: '--status-to-research' },
		{ label: 'Not eligible (yet)', token: '--status-not-eligible-yet' },
		{ label: 'Not eligible', token: '--status-not-eligible' },
		{ label: 'Declined', token: '--status-declined' }
	];
</script>

<div class="panel">
	<p class="caption">STATUS</p>
	<ul class="rows">
		{#each rows as row (row.token)}
			<li class="row">
				<span class="swatch" style="background: var({row.token});"></span>
				<span class="label">{row.label}</span>
			</li>
		{/each}
	</ul>
</div>

<style>
	.panel {
		position: fixed;
		bottom: 24px;
		left: 24px;
		z-index: 10;
		padding: 16px 20px;
		border-radius: 14px;
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		pointer-events: none;
	}

	.caption {
		margin: 0 0 8px;
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.5;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-lo);
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.swatch {
		width: 12px;
		height: 12px;
		flex: 0 0 12px;
		/* Faceted-crystal chip: a soft diamond, not a flat square. */
		border-radius: 2px;
		transform: rotate(45deg);
		box-shadow: 0 0 6px color-mix(in srgb, currentColor 0%, transparent);
	}

	.label {
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-hi);
	}

	@media (max-width: 640px) {
		.panel {
			bottom: 16px;
			left: 16px;
			padding: 12px 14px;
		}
	}
</style>
