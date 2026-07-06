<script lang="ts">
	// Minimal non-WebGL fallback (RESL-01, v2 / OPTIONAL — 04-UI-SPEC §Fallback).
	// When the WebGL probe in +page.svelte fails, this simple scrollable 2D list of
	// all grants renders IN PLACE OF the <Canvas>. Each row reuses the SAME tested
	// display helpers (formatAmount / formatDeadline) and the SAME status hue tokens
	// as the rest of the HUD, and a row click calls select(id) so the EXISTING
	// DetailPanel opens (no new detail UI). No new tokens, no new state, no a11y work.
	import { grants } from '$lib/data';
	import { formatAmount, formatDeadline } from '$lib/data/format';
	import { select } from '$lib/state/crystarium.svelte.js';

	// tone → declared token (mirrors DetailPanel — no raw hex here either).
	const amountColor: Record<string, string> = {
		gold: 'var(--secured-gold)',
		muted: 'var(--text-lo)',
		hi: 'var(--text-hi)'
	};
	const deadlineColor: Record<string, string> = {
		urgent: 'var(--urgent)',
		'in-progress': 'var(--status-in-progress)',
		declined: 'var(--status-declined)',
		lo: 'var(--text-lo)',
		hi: 'var(--text-hi)'
	};
</script>

<div class="fallback">
	<p class="notice">3D view unavailable on this device — showing the grant list.</p>
	<ul class="rows">
		{#each grants as grant (grant.id)}
			{@const amount = formatAmount(grant.amount)}
			{@const deadline = formatDeadline(grant.deadline)}
			<li class="row">
				<button type="button" class="open-row" onclick={() => select(grant.id)}>
					<span class="pill" style:--pill-hue={`var(--status-${grant.status})`}>
						<span class="pill-swatch" aria-hidden="true"></span>
						{grant.statusLabel}
					</span>
					<span class="funder">{grant.funder}</span>
					<span class="amount" style:color={amountColor[amount.tone]}>{amount.text}</span>
					<span class="deadline" style:color={deadlineColor[deadline.tone]}>{deadline.text}</span>
				</button>
				<a class="link" href={grant.link} target="_blank" rel="noopener noreferrer">Open ↗</a>
			</li>
		{/each}
	</ul>
</div>

<style>
	.fallback {
		position: fixed;
		inset: 0;
		z-index: 0;
		overflow-y: auto;
		padding: 88px 24px 120px; /* clear the ambient Title / Readout / drawer */
		background: var(--bg);
	}

	.notice {
		max-width: 760px;
		margin: 0 auto 24px;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-lo);
	}

	.rows {
		max-width: 760px;
		margin: 0 auto;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 8px 16px;
		border-radius: 10px;
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
	}

	.open-row {
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		gap: 16px;
		min-width: 0;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		text-align: left;
	}

	.pill {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 4px 10px;
		border-radius: 999px;
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-hi);
		background: color-mix(in srgb, var(--pill-hue) 16%, transparent);
		border: 1px solid color-mix(in srgb, var(--pill-hue) 40%, transparent);
	}

	.pill-swatch {
		width: 12px;
		height: 12px;
		background: var(--pill-hue);
		transform: rotate(45deg);
	}

	.funder {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-hi);
	}

	.amount {
		flex: 0 0 auto;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		font-variant-numeric: tabular-nums;
	}

	.deadline {
		flex: 0 0 auto;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		font-variant-numeric: tabular-nums;
	}

	.link {
		flex: 0 0 auto;
		padding: 4px 10px;
		border-radius: 8px;
		border: 1px solid var(--surface-glass-border);
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.5;
		text-decoration: none;
		color: var(--text-hi);
	}

	@media (max-width: 640px) {
		.fallback {
			padding: 72px 16px 120px;
		}
		.row {
			flex-wrap: wrap;
			gap: 8px;
		}
		.open-row {
			flex-wrap: wrap;
			gap: 8px;
		}
	}
</style>
