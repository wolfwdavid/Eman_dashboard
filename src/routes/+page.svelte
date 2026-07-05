<script lang="ts">
	// The Crystarium landing surface (CRYS-01). The glassmorphic HUD prerenders as
	// real DOM (keeps first paint + verify-build check #6 alive); the Threlte
	// <Canvas> mounts ONLY in the browser, behind `{#if browser && mounted}` via a
	// dynamic import — so `three`/WebGL never run during prerender. NEVER ssr=false.
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import SceneTitle from '$lib/hud/SceneTitle.svelte';
	import PipelineReadout from '$lib/hud/PipelineReadout.svelte';
	import Legend from '$lib/hud/Legend.svelte';

	let mounted = $state(false);
	onMount(() => (mounted = true));
</script>

<svelte:head>
	<!-- KEEP the literal "Eman_dashboard" — verify-build check #6 greps the <title>. -->
	<title>Eman_dashboard — DID Grant Crystarium</title>
</svelte:head>

<!-- Prerendered glass HUD (SSR-safe, real content around the guarded Canvas). -->
<SceneTitle />
<PipelineReadout secured={20000} potential={296500} />
<Legend />

<!-- WebGL scene: client-only, dynamically imported so three code-splits out of SSR. -->
{#if browser && mounted}
	{#await import('$lib/crystarium/CrystariumCanvas.svelte') then { default: Canvas }}
		<Canvas />
	{/await}
{/if}
