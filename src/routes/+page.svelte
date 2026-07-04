<script lang="ts">
	// Phase 1 has no navigation or assets yet. If any internal link/asset is
	// added later it MUST route through `base` (never a root-absolute /… URL),
	// or it 404s on the /Eman_dashboard/ subpath on GitHub Pages.
	// import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Eman_dashboard — DID Grant Command Center</title>
</svelte:head>

<main class="shell">
	<div class="halo" aria-hidden="true"></div>

	<section class="stack">
		<p class="eyebrow">Diversity Includes Disability</p>

		<h1 class="title">Eman_dashboard</h1>

		<p class="subtitle">Grant Command Center</p>

		<p class="premise">
			A Crystarium sphere-grid view of the funding pipeline — coming online.
		</p>

		<div class="rule" aria-hidden="true"></div>

		<p class="status">
			<span class="pulse"></span>
			Deploy skeleton live · base-path &amp; prerender verified
		</p>
	</section>
</main>

<style>
	.shell {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 2rem;
		overflow: hidden;
		text-align: center;
	}

	/* Soft crystal-cyan glow behind the title (uses the --color-glow token). */
	.halo {
		position: absolute;
		width: min(70vw, 640px);
		height: min(70vw, 640px);
		border-radius: 9999px;
		background: radial-gradient(circle, color-mix(in srgb, var(--color-glow) 22%, transparent) 0%, transparent 70%);
		filter: blur(40px);
		pointer-events: none;
	}

	.stack {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.1rem;
		max-width: 42rem;
	}

	.eyebrow {
		font-family: var(--font-body);
		text-transform: uppercase;
		letter-spacing: 0.42em;
		font-size: 0.72rem;
		color: color-mix(in srgb, var(--color-glow) 75%, #e8ecf4);
		margin: 0;
		padding-left: 0.42em;
	}

	.title {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(2.6rem, 9vw, 5.5rem);
		line-height: 1.02;
		margin: 0;
		letter-spacing: 0.04em;
		background: linear-gradient(180deg, #ffffff 0%, var(--color-glow) 140%);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		text-shadow: 0 0 42px color-mix(in srgb, var(--color-glow) 30%, transparent);
	}

	.subtitle {
		font-family: var(--font-display);
		font-size: clamp(1rem, 3vw, 1.5rem);
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--color-gold);
		margin: 0;
	}

	.premise {
		font-family: var(--font-body);
		font-size: clamp(0.95rem, 2vw, 1.1rem);
		color: color-mix(in srgb, #e8ecf4 78%, transparent);
		margin: 0.4rem 0 0;
		max-width: 34rem;
	}

	.rule {
		width: 6rem;
		height: 1px;
		margin: 0.6rem 0;
		background: linear-gradient(90deg, transparent, var(--color-glow), transparent);
		opacity: 0.7;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		font-family: var(--font-body);
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		color: color-mix(in srgb, #e8ecf4 62%, transparent);
		margin: 0;
	}

	.pulse {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 9999px;
		background: var(--color-glow);
		box-shadow: 0 0 10px var(--color-glow);
		animation: pulse 2.4s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.35;
			transform: scale(0.8);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
		}
	}
</style>
