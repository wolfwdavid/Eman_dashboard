<script lang="ts">
	// TEMPLATES panel — a top-left toggle that sits directly under the GRANT
	// CRYSTARIUM title card (owner request 2026-11-09). A glass `TEMPLATES ▾`
	// button toggles a LOCAL `open` (not the shared `ui`) and drops a glass
	// popover listing every grant whose proposal template / draft URL is filled in.
	//
	// Data-driven from `grantsWithTemplates(grants)`: filling more cells in the
	// Template column of data/grants.csv grows the list with no code change.
	// Clicking a row's name calls `select(id)` — the SAME DetailPanel the scene
	// opens — and closes the list; the `Open ↗` link opens the template URL in a
	// new tab. Escape or the toggle closes it.
	//
	// Mobile: the popover becomes a centered modal over a scrim, and the whole
	// widget hides while the detail sheet is open (that rule lives in +page.svelte).
	import { scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { grants, grantsWithTemplates } from '$lib/data';
	import { select } from '$lib/state/crystarium.svelte.js';

	let open = $state(false);
	// Static build-time data — a plain const is enough.
	const templates = grantsWithTemplates(grants);

	function pick(id: string) {
		select(id);
		open = false;
	}

	function onKey(e: KeyboardEvent) {
		if (open && e.key === 'Escape') open = false;
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="templates-root" class:open>
	<button
		type="button"
		class="toggle"
		onclick={() => (open = !open)}
		aria-expanded={open}
		aria-controls="templates-popover"
	>
		TEMPLATES
		{#if templates.length > 0}
			<span class="badge" aria-label="{templates.length} {templates.length === 1 ? 'template' : 'templates'}">{templates.length}</span>
		{/if}
		<span class="glyph" class:flipped={open} aria-hidden="true">▾</span>
	</button>

	{#if open}
		<!-- Mobile-only scrim: taps close the modal (display:none on desktop). -->
		<button
			type="button"
			class="scrim"
			aria-label="Close templates list"
			onclick={() => (open = false)}
		></button>
		<div
			id="templates-popover"
			class="panel"
			role="dialog"
			aria-label="Proposal templates"
			in:scale={{ duration: 200, start: 0.85, opacity: 0, easing: cubicOut }}
			out:scale={{ duration: 140, start: 0.85, opacity: 0, easing: cubicOut }}
		>
			<p class="eyebrow">PROPOSAL TEMPLATES</p>
			<p class="sub">Drafts and templates linked from the grant tracker</p>
			{#if templates.length === 0}
				<p class="empty">No templates yet. Add a link in the Template column of data/grants.csv.</p>
			{:else}
				<ul class="rows">
					{#each templates as g (g.id)}
						<li class="row" style:--node-hue={`var(--status-${g.status})`}>
							<button type="button" class="pick" onclick={() => pick(g.id)}>
								<span class="swatch" aria-hidden="true"></span>
								<span class="names">
									<span class="funder">{g.funder}</span>
									{#if g.program}<span class="program">{g.program}</span>{/if}
								</span>
							</button>
							<a
								class="link"
								href={g.template ?? undefined}
								target="_blank"
								rel="noopener noreferrer">Open ↗</a
							>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

<style>
	.templates-root {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		pointer-events: auto;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		border-radius: 12px;
		border: 1px solid var(--surface-glass-border);
		background: var(--surface-glass);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		cursor: pointer;
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: 0.06em;
		color: var(--text-hi);
		transition:
			color 120ms ease,
			border-color 120ms ease;
	}

	.toggle:hover {
		color: var(--secured-gold);
		border-color: var(--secured-gold);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 20px;
		height: 20px;
		padding: 0 6px;
		border-radius: 10px;
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-hi);
		background: color-mix(in srgb, var(--secured-gold) 18%, transparent);
		border: 1px solid color-mix(in srgb, var(--secured-gold) 45%, transparent);
	}

	.glyph {
		color: var(--text-lo);
		transition: transform 160ms ease;
	}

	.glyph.flipped {
		transform: rotate(180deg);
	}

	/* Scrim only exists on mobile (centered-modal mode). */
	.scrim {
		display: none;
	}

	.panel {
		/* Drops downward from the toggle. */
		transform-origin: top left;
		width: 340px;
		max-width: calc(100vw - 48px);
		max-height: 60vh;
		overflow-y: auto;
		padding: 16px 18px;
		border-radius: 14px;
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
	}

	.eyebrow {
		margin: 0 0 4px;
		font-family: var(--font-body);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--text-lo);
	}

	.sub {
		margin: 0 0 12px;
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-lo);
	}

	.empty {
		margin: 0;
		font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-lo);
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 44px;
		padding: 6px 0;
	}

	.row + .row {
		border-top: 1px solid var(--surface-glass-border);
	}

	.pick {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 0;
		min-height: 44px;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		color: inherit;
		font: inherit;
	}

	.pick:hover .funder,
	.pick:focus-visible .funder {
		color: var(--secured-gold);
	}

	.pick:focus-visible {
		outline: 2px solid var(--node-hue);
		outline-offset: 2px;
		border-radius: 6px;
	}

	.swatch {
		flex-shrink: 0;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--node-hue);
		box-shadow: 0 0 8px color-mix(in srgb, var(--node-hue) 60%, transparent);
	}

	.names {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.funder,
	.program {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1.3;
		font-family: var(--font-body);
	}

	.funder {
		font-size: 14px;
		color: var(--text-hi);
	}

	.program {
		font-size: 12px;
		color: var(--text-lo);
	}

	.link {
		flex-shrink: 0;
		white-space: nowrap;
		padding: 6px 12px;
		border-radius: 8px;
		border: 1px solid color-mix(in srgb, var(--node-hue) 55%, transparent);
		background: color-mix(in srgb, var(--node-hue) 10%, transparent);
		font-family: var(--font-body);
		font-size: 13px;
		text-decoration: none;
		color: var(--text-hi);
		transition:
			background 120ms ease,
			border-color 120ms ease;
	}

	.link:hover {
		background: color-mix(in srgb, var(--node-hue) 22%, transparent);
		border-color: var(--node-hue);
	}

	.link:focus-visible {
		outline: 2px solid var(--node-hue);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.glyph {
			transition: none;
		}
	}

	/* Mobile (MOB-01): open as a CENTERED modal over a dark scrim instead of a
	   popover that would overflow a phone. Desktop (>768px) unchanged. */
	@media (max-width: 768px) {
		.toggle {
			min-height: 44px;
		}

		.scrim {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 39;
			border: none;
			padding: 0;
			background: rgba(3, 5, 12, 0.62);
			-webkit-backdrop-filter: blur(2px);
			backdrop-filter: blur(2px);
			cursor: pointer;
		}

		.panel {
			position: fixed;
			z-index: 40;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			transform-origin: center;
			width: min(92vw, 360px);
			max-width: none;
			max-height: 82dvh;
			overflow-y: auto;
			padding: 20px;
			/* Opaque so the scene does not muddy the list. */
			background: var(--surface);
		}
	}
</style>
