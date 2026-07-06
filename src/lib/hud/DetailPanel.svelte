<script lang="ts">
	// DetailPanel — the right-edge slide-in glass rail (04-UI-SPEC §Detail Panel,
	// DETL-01/02/03). The DOM mirror of the scene's "one selected node": opens when
	// `ui.selected` is set, surfaces all 9 `Grant` fields, and closes (off-canvas)
	// when null. ALL display logic lives in the tested `format.ts` — this component
	// is composition + the inherited Phase-3 glass styling (blur 16px, tokens only).
	import { ui, deselect } from '$lib/state/crystarium.svelte.js';
	import { grants } from '$lib/data';
	import { formatAmount, formatDeadline, gateBadge } from '$lib/data/format';

	// The selected record (null → panel closed). Derived so it tracks ui.selected.
	const grant = $derived(ui.selected ? (grants.find((g) => g.id === ui.selected) ?? null) : null);

	// Shaped values via the pure helpers (raw preserved for the subtext, DETL-02).
	const amount = $derived(grant ? formatAmount(grant.amount) : null);
	const deadline = $derived(grant ? formatDeadline(grant.deadline) : null);
	const gate = $derived(grant ? gateBadge(grant.requires501c3, grant.requires501c3Raw) : null);

	// tone → declared token (no raw hex in the component; token discipline).
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
	const gateColor: Record<string, string> = {
		open: 'var(--gate-open)',
		gated: 'var(--gate-gated)',
		unknown: 'var(--gate-unknown)'
	};

	// TYPE badge hue: Fellowship = violet, Investment = ash, Grant = neutral slate.
	const typeHue = $derived(
		grant?.type === 'Grant/Fellowship'
			? 'var(--status-applied)'
			: grant?.type === 'Investment'
				? 'var(--status-not-eligible)'
				: 'var(--text-lo)'
	);
</script>

{#if grant}
	<aside class="panel" style:--node-hue={`var(--status-${grant.status})`}>
		<!-- Header: node-hue accent + funder title + program + × deselect -->
		<header class="header">
			<span class="swatch" aria-hidden="true"></span>
			<div class="titles">
				<h2 class="funder">{grant.funder}</h2>
				{#if grant.program}
					<p class="program">{grant.program}</p>
				{/if}
			</div>
			<button type="button" class="close" onclick={() => deselect()} title="Close">×</button>
		</header>

		<!-- Row 1 · STATUS -->
		<section class="row">
			<span class="eyebrow">STATUS</span>
			<span class="pill" style:--pill-hue="var(--node-hue)">
				<span class="pill-swatch" aria-hidden="true"></span>
				{grant.statusLabel}
			</span>
		</section>

		<!-- Row 2 · TYPE -->
		<section class="row">
			<span class="eyebrow">TYPE</span>
			<span class="type-badge" style:--type-hue={typeHue}>
				{grant.type}{#if grant.type === 'Investment'}<span class="equity">Equity — not a grant</span
					>{/if}
			</span>
		</section>

		<!-- Row 3 · AMOUNT (human-readable + raw subtext, DETL-02) -->
		<section class="row">
			<span class="eyebrow">AMOUNT</span>
			<span class="amount-value" style:color={amountColor[amount!.tone]}>{amount!.text}</span>
			<span class="subtext">{amount!.raw}</span>
		</section>

		<!-- Row 4 · DEADLINE (human-readable + raw subtext, DETL-02) -->
		<section class="row">
			<span class="eyebrow">DEADLINE</span>
			<span class="deadline-chip" style:color={deadlineColor[deadline!.tone]}>{deadline!.text}</span>
			<span class="subtext">{deadline!.raw}</span>
		</section>

		<!-- Row 5 · 501(C)(3) gate badge (+ fiscal-sponsor gold hint) -->
		<section class="row">
			<span class="eyebrow">501(C)(3)</span>
			<span class="gate-badge" style:color={gateColor[gate!.tone]} style:border-color={gateColor[gate!.tone]}
				>{gate!.label}</span
			>
			{#if gate!.sponsorHint}
				<span class="hint">NY Community Trust may sponsor</span>
			{/if}
		</section>

		<!-- Row 6 · FIT / ELIGIBILITY -->
		<section class="row">
			<span class="eyebrow">FIT / ELIGIBILITY</span>
			<p class="fit">{grant.fit}</p>
		</section>
	</aside>
{/if}

<style>
	.panel {
		position: fixed;
		top: 0;
		right: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		gap: 16px; /* md — between detail rows */
		width: 380px;
		max-width: 100vw;
		height: 100vh;
		padding: 24px; /* lg — panel outer padding */
		overflow-y: auto;
		border-left: 1px solid var(--surface-glass-border);
		border-radius: 14px 0 0 14px;
		border-top: 2px solid var(--node-hue); /* hairline echoes the selected crystal */
		background: var(--surface-glass);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		pointer-events: auto;
	}

	/* Header --------------------------------------------------------------- */
	.header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: start;
		gap: 8px; /* sm */
	}
	.swatch {
		width: 12px;
		height: 12px;
		margin-top: 4px;
		background: var(--node-hue);
		transform: rotate(45deg); /* crystal diamond (inherited icon exception) */
	}
	.titles {
		display: flex;
		flex-direction: column;
		gap: 4px; /* xs */
		min-width: 0;
	}
	.funder {
		margin: 0;
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 600;
		line-height: 1.2;
		color: var(--text-hi);
	}
	.program {
		margin: 0;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-lo);
	}
	.close {
		font-family: var(--font-body);
		font-size: 20px;
		font-weight: 400;
		line-height: 1;
		padding: 0 4px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-lo);
		transition: color 150ms ease;
	}
	.close:hover {
		color: var(--text-hi);
	}

	/* Field rows ----------------------------------------------------------- */
	.row {
		display: flex;
		flex-direction: column;
		gap: 8px; /* sm — inner row gap */
	}
	.eyebrow {
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.5;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-lo);
	}
	.subtext {
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-lo);
		font-variant-numeric: tabular-nums;
	}

	/* Row 1 · status pill */
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		align-self: flex-start;
		padding: 4px 10px;
		border-radius: 999px;
		font-family: var(--font-body);
		font-size: 14px;
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

	/* Row 2 · type badge */
	.type-badge {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
		align-self: flex-start;
		padding: 4px 10px;
		border-radius: 6px;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-hi);
		border: 1px solid color-mix(in srgb, var(--type-hue) 55%, transparent);
		background: color-mix(in srgb, var(--type-hue) 12%, transparent);
	}
	.equity {
		font-size: 12px;
		color: var(--text-lo);
	}

	/* Row 3 · amount */
	.amount-value {
		font-family: var(--font-display);
		font-size: 32px;
		font-weight: 600;
		line-height: 1.2;
		font-variant-numeric: tabular-nums;
	}

	/* Row 4 · deadline chip */
	.deadline-chip {
		align-self: flex-start;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		font-variant-numeric: tabular-nums;
	}

	/* Row 5 · gate badge */
	.gate-badge {
		align-self: flex-start;
		padding: 4px 10px;
		border-radius: 6px;
		border: 1px solid;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		background: color-mix(in srgb, currentColor 10%, transparent);
	}
	.hint {
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--secured-gold);
	}

	/* Row 6 · fit prose */
	.fit {
		margin: 0;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-hi);
	}

	@media (max-width: 640px) {
		.panel {
			top: auto;
			bottom: 0;
			width: 100vw;
			height: auto;
			max-height: 80vh;
			padding: 16px; /* md edge inset below 640 */
			border-radius: 14px 14px 0 0;
			border-left: none;
		}
	}
</style>
