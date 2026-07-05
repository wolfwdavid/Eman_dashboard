<script lang="ts">
	// Top-left glass title panel (03-UI-SPEC §HUD Layout 1). Plain Svelte 5 +
	// Tailwind v4 tokens, NO Three import — this prerenders as real DOM content
	// (keeps verify-build check #6 and first paint alive under the guarded Canvas).
</script>

<div class="panel">
	<p class="eyebrow">DIVERSITY INCLUDES DISABILITY</p>
	<h1 class="title">GRANT CRYSTARIUM</h1>
</div>

<style>
	.panel {
		position: fixed;
		top: 24px;
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

	.eyebrow {
		margin: 0 0 6px;
		font-family: var(--font-body);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.5;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--text-lo);
	}

	.title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 32px;
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--text-hi);
	}

	@media (max-width: 640px) {
		.panel {
			top: 16px;
			left: 16px;
		}
		.title {
			font-size: 24px;
		}
	}
</style>
