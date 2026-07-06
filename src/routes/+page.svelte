<script lang="ts">
	// The Crystarium landing surface (CRYS-01) + the Phase-4 overlay mount.
	//
	// LAYER MODEL (04-UI-SPEC §Layout & Layer): the Threlte <Canvas> is a fixed,
	// full-viewport, INTERACTIVE hero at z-0 (raycast). Every overlay piece is a
	// DISCRETE `position: fixed` element that owns its own z-index + pointer-events
	// — there is NO full-viewport catch layer (a full-screen div would eat the canvas
	// raycast and kill orbit/hover/select — 04-RESEARCH Pitfall 2). Ambient HUD
	// (SceneTitle/PipelineReadout/Legend) stays pointer-events:none; interactive
	// panels set pointer-events:auto on THEMSELVES only. Empty overlay space passes
	// clicks straight through to the scene.
	//
	// The glassmorphic HUD prerenders as real DOM (keeps first paint + verify-build
	// check #6 alive); the Threlte <Canvas> mounts ONLY in the browser, behind
	// `{#if browser && mounted}` via a dynamic import — so `three`/WebGL never run
	// during prerender. NEVER ssr=false.
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import SceneTitle from '$lib/hud/SceneTitle.svelte';
	import PipelineReadout from '$lib/hud/PipelineReadout.svelte';
	import Legend from '$lib/hud/Legend.svelte';
	// Phase-4 overlay panels (each is a self-positioned fixed element).
	import DetailPanel from '$lib/hud/DetailPanel.svelte';
	import PipelineDrawer from '$lib/hud/PipelineDrawer.svelte';
	import QrPanel from '$lib/hud/QrPanel.svelte';
	// Single source of truth for the readout figures (computed, not literals).
	import { grants } from '$lib/data';
	import { securedTotal, potentialTotal } from '$lib/data/aggregates';

	let mounted = $state(false);
	// WebGL support probe (RESL-01). Defaults true so SSR/first paint assume the 3D
	// path; the real check runs client-side in onMount and only ever flips to false.
	// When false we render the 2D FallbackList in place of <Canvas> — no black screen.
	let webgl = $state(true);
	onMount(() => {
		mounted = true;
		const c = document.createElement('canvas');
		webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
	});
</script>

<svelte:head>
	<!-- KEEP the literal "Eman_dashboard" — verify-build check #6 greps the <title>. -->
	<title>Eman_dashboard — DID Grant Crystarium</title>
</svelte:head>

<!-- Prerendered glass HUD (SSR-safe, real content around the guarded Canvas). -->
<SceneTitle />
<PipelineReadout secured={securedTotal(grants)} potential={potentialTotal(grants)} />
<Legend />

<!-- Phase-4 overlay: discrete fixed panels (NO catch layer). Each owns its own
     z-index + pointer-events. DetailPanel opens on ui.selected; background-click
     deselect is wired inside the scene (CrystariumScene onpointermissed). -->
<DetailPanel />
<PipelineDrawer />
<QrPanel />

<!-- WebGL scene: client-only, dynamically imported so three code-splits out of SSR.
     If the WebGL probe fails, the 2D FallbackList renders instead (RESL-01) — its
     rows reuse the same helpers and call select(id) into the SAME DetailPanel. -->
{#if browser && mounted && webgl}
	{#await import('$lib/crystarium/CrystariumCanvas.svelte') then { default: Canvas }}
		<Canvas />
	{/await}
{:else if browser && mounted}
	{#await import('$lib/hud/FallbackList.svelte') then { default: FallbackList }}
		<FallbackList />
	{/await}
{/if}
