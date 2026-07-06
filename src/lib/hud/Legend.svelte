<script lang="ts">
	// Bottom-left glass legend (03-UI-SPEC §HUD Layout 3). 8 status-hue rows in
	// funnel order. Swatch colours are driven from a status→CSS-var map (the DOM
	// twin of tokens.statusHue) — NO raw hex in the template. Plain Svelte,
	// prerenders, no Three import.
	//
	// MOB-01: on ≤768px the always-on panel is replaced by a "◆ Legend" toggle chip
	// (bottom-left); tapping opens the same panel as a compact popover. Desktop
	// (>768px) keeps the panel always-visible and pointer-events:none (pixel-identical).
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

	// Mobile popover open state (local UI — no runes-bridge coupling). Ignored on
	// desktop where the toggle is display:none and the panel is always shown.
	let open = $state(false);
</script>

<div class="legend-root" class:open>
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

	<!-- Mobile-only toggle chip (bottom-left). Hidden on desktop. -->
	<button type="button" class="legend-toggle" onclick={() => (open = !open)} aria-expanded={open}>
		<span class="diamond" aria-hidden="true">◆</span> Legend
	</button>
</div>

<style>
	.legend-root {
		position: fixed;
		bottom: 24px;
		left: 24px;
		z-index: 10;
		display: flex;
		flex-direction: column;
		pointer-events: none;
	}

	.panel {
		padding: 16px 20px;
		border-radius: 14px;
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
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

	/* Mobile toggle chip — hidden on desktop (panel is always-on there). */
	.legend-toggle {
		display: none;
	}

	/* ── Mobile (MOB-01): collapse to a toggle chip + popover ─────────────── */
	@media (max-width: 768px) {
		.legend-root {
			/* Sit in a tier just ABOVE the slim collapsed drawer bar (bottom control
			   row) so the two never overlap. Popover expands above the chip. */
			bottom: 88px;
			left: 12px;
			flex-direction: column-reverse;
			align-items: flex-start;
			gap: 8px;
		}

		/* Panel becomes a popover — hidden until the chip is tapped. */
		.panel {
			display: none;
			padding: 12px 14px;
			pointer-events: auto;
		}
		.legend-root.open .panel {
			display: block;
		}

		.legend-toggle {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			min-height: 44px;
			padding: 0 16px;
			border-radius: 999px;
			background: var(--surface-glass);
			border: 1px solid var(--surface-glass-border);
			backdrop-filter: blur(16px);
			-webkit-backdrop-filter: blur(16px);
			pointer-events: auto;
			cursor: pointer;
			font-family: var(--font-display);
			font-size: 14px;
			font-weight: 600;
			letter-spacing: 0.06em;
			color: var(--text-hi);
			transition:
				color 120ms ease,
				border-color 120ms ease;
		}
		.legend-root.open .legend-toggle {
			color: var(--secured-gold);
			border-color: var(--secured-gold);
		}
		.diamond {
			color: var(--text-lo);
			font-size: 12px;
		}
		.legend-root.open .diamond {
			color: var(--secured-gold);
		}
	}
</style>
