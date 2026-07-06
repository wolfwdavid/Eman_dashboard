<script lang="ts">
	// QR panel (QRUI-01 / QRUI-02) — a bottom-right toggle widget (the one free
	// corner). A small glass `SHARE ◹` button toggles a LOCAL `open` (not the
	// shared `ui`) and expands upward into a glass panel holding the two build-time
	// QR tiles side by side, each on a white "scannability plate".
	//
	// `{@html qr.svg}` is SAFE here: `qrCodes[].svg` is generated at build time by
	// tools/generate-qr.mjs from the fixed `src/lib/config/sites.js` config — a
	// trusted static string with NO user/runtime input (04-RESEARCH Pitfall 5).
	import { scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { qrCodes } from '$lib/data';

	let open = $state(false);
</script>

<div class="qr-widget">
	{#if open}
		<div
			class="panel"
			in:scale={{ duration: 200, start: 0.85, opacity: 0, easing: cubicOut }}
			out:scale={{ duration: 140, start: 0.85, opacity: 0, easing: cubicOut }}
		>
			<p class="title">SHARE</p>
			<div class="tiles">
				{#each qrCodes as qr (qr.id)}
					<figure class="qr-tile">
						<!-- Trusted build-time inline SVG (no user input) -->
						<div class="plate">{@html qr.svg}</div>
						<figcaption class="caption">
							<span class="label">{qr.label}</span>
							<small class="url">{qr.url}</small>
						</figcaption>
					</figure>
				{/each}
			</div>
			<p class="swap-note">
				URLs live in <code>src/lib/config/sites.js</code> — edit there and re-run
				<code>node tools/generate-qr.mjs</code> (or <code>pnpm build</code>) to regenerate. No
				component change needed.
			</p>
		</div>
	{/if}

	<button type="button" class="toggle" onclick={() => (open = !open)} aria-expanded={open}>
		SHARE <span class="glyph">◹</span>
	</button>
</div>

<style>
	.qr-widget {
		position: fixed;
		right: 24px;
		bottom: 24px;
		z-index: 30;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 12px;
		pointer-events: auto;
	}

	.toggle {
		align-self: flex-end;
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

	.glyph {
		color: var(--text-lo);
	}

	.panel {
		/* Expands upward from the toggle. */
		transform-origin: bottom right;
		padding: 20px;
		border-radius: 14px;
		background: var(--surface-glass);
		border: 1px solid var(--surface-glass-border);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
	}

	.title {
		margin: 0 0 16px;
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: 0.02em;
		color: var(--text-hi);
	}

	.tiles {
		display: flex;
		gap: 32px;
	}

	.qr-tile {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: flex-start;
		max-width: 160px;
	}

	.plate {
		/* The one intentional white surface — QR needs a light background to scan. */
		width: clamp(112px, 40vw, 160px);
		height: clamp(112px, 40vw, 160px);
		padding: 16px;
		border-radius: 12px;
		/* Intentional white surface (QR scannability exception, per 04-UI-SPEC);
		   `white` keyword keeps the no-raw-hex discipline. */
		background: white;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.plate :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}

	.caption {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.label {
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-hi);
	}

	.url {
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-lo);
	}

	.swap-note {
		max-width: 384px;
		margin: 16px 0 0;
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.5;
		color: var(--text-lo);
	}

	.swap-note code {
		font-family: var(--font-body);
		color: var(--text-hi);
	}

	@media (max-width: 640px) {
		.qr-widget {
			right: 16px;
			bottom: 16px;
		}

		.tiles {
			gap: 24px;
		}
	}
</style>
