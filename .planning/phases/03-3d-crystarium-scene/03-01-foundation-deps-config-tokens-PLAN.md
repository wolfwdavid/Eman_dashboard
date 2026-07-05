---
phase: 03-3d-crystarium-scene
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-lock.yaml
  - vite.config.ts
  - vitest.config.ts
  - src/app.d.ts
  - src/lib/crystarium/tokens.ts
  - src/lib/crystarium/tokens.test.ts
autonomous: true
requirements: [CRYS-01, CRYS-03]
must_haves:
  truths:
    - "The 3D + bloom + animation deps are installed at the pinned versions (three stays 0.185.1)"
    - "pnpm build can resolve postprocessing during prerender (noExternal set)"
    - "vitest discovers and runs tests under src/lib/crystarium"
    - "Every status hue and activation level is a named token (no raw hex in future components/materials)"
  artifacts:
    - path: "src/lib/crystarium/tokens.ts"
      provides: "numeric-hex status hue map + activation-level map + path/beam/urgent tokens for Three materials"
      contains: "statusHue"
    - path: "src/lib/crystarium/tokens.test.ts"
      provides: "asserts 8 status hues + 8 activation levels match UI-SPEC"
    - path: "vite.config.ts"
      provides: "ssr.noExternal postprocessing"
      contains: "noExternal"
    - path: "vitest.config.ts"
      provides: "crystarium test glob"
      contains: "crystarium"
  key_links:
    - from: "vite.config.ts"
      to: "postprocessing (prerender)"
      via: "ssr.noExternal"
      pattern: "noExternal.*postprocessing"
    - from: "package.json"
      to: "three@0.185.1"
      via: "pinned dependency"
      pattern: "\"three\": \"0.185.1\""
---

<objective>
Lay the Phase-3 foundation: install the pinned 3D/bloom/animation dependency set, apply the two non-obvious SvelteKit build gotchas (postprocessing `noExternal`, crystarium vitest glob), augment types for typed pointer events, and create the `tokens.ts` colour/activation contract that every crystal material and the legend will consume.

Purpose: Everything downstream (pure layout, scene, bloom) depends on these deps + config being correct, and on colours being named tokens (no raw hex) per UI-SPEC token discipline. Getting the `noExternal` and `three` pin right here prevents the two build-time failures the research flags.
Output: Installed deps, patched `vite.config.ts` / `vitest.config.ts` / `src/app.d.ts`, and a tested `src/lib/crystarium/tokens.ts`.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-3d-crystarium-scene/03-RESEARCH.md
@.planning/phases/03-3d-crystarium-scene/03-UI-SPEC.md
@src/lib/data/types.ts

<interfaces>
<!-- The GrantStatus union the tokens map must be exhaustive over (from src/lib/data/types.ts) -->
```typescript
export type GrantStatus =
  | 'active' | 'in-progress' | 'to-research' | 'recurring'
  | 'applied' | 'declined' | 'not-eligible' | 'not-eligible-yet';
```

<!-- UI-SPEC LOCKED status hues (Color System) — mirror these EXACT hexes as numeric literals -->
active #FFC24B · in-progress #33E1FF · applied #A98BFF · recurring #4BE39B ·
to-research #5B84C4 · not-eligible-yet #B0894E · not-eligible #565D75 · declined #8A5560

<!-- UI-SPEC LOCKED signal/path tokens -->
secured-gold #FFC24B · urgent #FF5A3C · path #6FA8FF · beam-core #FFC24B · beam-tip #7FE9FF ·
bg #05060D · bg-glow #0A0E1A

<!-- UI-SPEC LOCKED status → emissiveIntensity activation levels (Crystal Node Visual) -->
to-research 0.15 · recurring 0.20 · in-progress 0.40 · applied 0.60 ·
active 1.00 · not-eligible-yet 0.12 · not-eligible 0.06 · declined 0.06

<!-- Current vitest include (extend, do not replace) -->
include: ['tools/**/*.test.mjs', 'src/lib/data/**/*.test.ts']

<!-- Current vite.config.ts plugins array (add ssr key alongside) -->
plugins: [tailwindcss(), sveltekit()]
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install pinned 3D deps + apply the two build gotchas + typed pointer events</name>
  <read_first>package.json, vite.config.ts, vitest.config.ts, src/app.d.ts, .planning/phases/03-3d-crystarium-scene/03-RESEARCH.md (§Standard Stack + §Required config changes)</read_first>
  <files>package.json, pnpm-lock.yaml, vite.config.ts, vitest.config.ts, src/app.d.ts</files>
  <action>
    1. Install the phase deps at the researched-verified versions (pnpm, exact):
       `pnpm add @threlte/core@8.5.16 @threlte/extras@9.21.0 three@0.185.1 postprocessing@6.39.2 gsap@3.15.0`
       then `pnpm add -D @types/three@0.185.0`.
       `three` MUST resolve to `0.185.1` exactly — postprocessing@6.39.2 peer is `three >=0.168 <0.186`; do NOT let it float to 0.186+. Do NOT add `layerchart` (that is Phase 4).
    2. `vite.config.ts` — add `ssr: { noExternal: ['postprocessing'] }` to the config object (alongside the existing `plugins` array). WHY: postprocessing is ESM that SvelteKit externalizes for SSR and then fails to resolve during prerender — without this, `pnpm build` breaks referencing postprocessing (RESEARCH Pitfall B). Result:
       ```ts
       export default defineConfig({
         plugins: [tailwindcss(), sveltekit()],
         ssr: { noExternal: ['postprocessing'] }
       });
       ```
    3. `vitest.config.ts` — EXTEND the existing `include` array (do not replace the two current globs) with `'src/lib/crystarium/**/*.test.{js,ts}'`. WHY: the current globs only cover tools + src/lib/data, so the Phase-3 layout/tokens tests would silently never run. Result include: `['tools/**/*.test.mjs', 'src/lib/data/**/*.test.ts', 'src/lib/crystarium/**/*.test.{js,ts}']`.
    4. `src/app.d.ts` — add the Threlte interactivity augmentation so `onclick`/`onpointerenter` handlers on `<T.Mesh>` type-check in later plans:
       ```ts
       import type { InteractivityProps } from '@threlte/extras';
       declare global {
         namespace App { /* ...existing... */ }
         namespace Threlte { interface UserProps extends InteractivityProps {} }
       }
       export {};
       ```
  </action>
  <verify>
    <automated>node -e "const p=require('./package.json'); if(p.dependencies.three!=='0.185.1') throw new Error('three not pinned 0.185.1: '+p.dependencies.three); for(const d of ['@threlte/core','@threlte/extras','postprocessing','gsap']){ if(!p.dependencies[d]) throw new Error('missing '+d);} console.log('deps ok')"</automated>
    <automated>grep -q "noExternal" vite.config.ts && grep -q "crystarium" vitest.config.ts && grep -q "InteractivityProps" src/app.d.ts && echo "config ok"</automated>
  </verify>
  <done>package.json shows `"three": "0.185.1"` plus the 4 other deps; `@types/three@0.185.0` in devDeps; `vite.config.ts` contains `ssr:{noExternal:['postprocessing']}`; `vitest.config.ts` include contains the crystarium glob; `src/app.d.ts` declares `Threlte.UserProps extends InteractivityProps`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: tokens.ts — numeric-hex status/activation/path token contract + tests</name>
  <read_first>.planning/phases/03-3d-crystarium-scene/03-UI-SPEC.md (§Color System + §Crystal Node Visual activation table), src/lib/data/types.ts</read_first>
  <files>src/lib/crystarium/tokens.ts, src/lib/crystarium/tokens.test.ts</files>
  <behavior>
    - `statusHue` maps all 8 GrantStatus values to their EXACT UI-SPEC hex as numeric literals (active 0xffc24b, in-progress 0x33e1ff, applied 0xa98bff, recurring 0x4be39b, to-research 0x5b84c4, not-eligible-yet 0xb0894e, not-eligible 0x565d75, declined 0x8a5560).
    - `activation` maps all 8 statuses to emissiveIntensity base (active 1.0, applied 0.6, in-progress 0.4, recurring 0.2, to-research 0.15, not-eligible-yet 0.12, not-eligible 0.06, declined 0.06).
    - `secured` === 0xffc24b (=== statusHue.active), `urgent` === 0xff5a3c, `path` === 0x6fa8ff, `beamCore` === 0xffc24b, `beamTip` === 0x7fe9ff, `bg` === 0x05060d, `bgGlow` === 0x0a0e1a.
    - Both maps are exhaustive: every GrantStatus key present (test iterates the 8 literal statuses).
  </behavior>
  <action>
    Create `src/lib/crystarium/tokens.ts` — the numeric-hex mirror of the UI-SPEC CSS tokens, so Three materials NEVER carry a raw hex literal (token discipline, UI-SPEC design authority). Import `GrantStatus` from `../data/types`. Export:
    ```ts
    import type { GrantStatus } from '../data/types';
    export const statusHue: Record<GrantStatus, number> = {
      active: 0xffc24b, 'in-progress': 0x33e1ff, applied: 0xa98bff, recurring: 0x4be39b,
      'to-research': 0x5b84c4, 'not-eligible-yet': 0xb0894e, 'not-eligible': 0x565d75, declined: 0x8a5560
    };
    export const activation: Record<GrantStatus, number> = {
      active: 1.0, applied: 0.6, 'in-progress': 0.4, recurring: 0.2,
      'to-research': 0.15, 'not-eligible-yet': 0.12, 'not-eligible': 0.06, declined: 0.06
    };
    export const secured = 0xffc24b;   // gold — secured node core + $20,000 figure ONLY
    export const urgent  = 0xff5a3c;   // deadline pulse additive ONLY
    export const path    = 0x6fa8ff;   // spine + family edges
    export const beamCore = 0xffc24b;  // fiscal-sponsor beam anchor at NYCT
    export const beamTip  = 0x7fe9ff;  // beam terminus gradient tip
    export const bg = 0x05060d, bgGlow = 0x0a0e1a;
    ```
    Then create `src/lib/crystarium/tokens.test.ts` (vitest) asserting the `<behavior>` cases: iterate a literal array of the 8 statuses and assert both maps have every key defined; assert the exact hex numbers; assert `secured === statusHue.active`.
  </action>
  <verify>
    <automated>pnpm exec vitest run src/lib/crystarium/tokens.test.ts</automated>
  </verify>
  <done>tokens.ts exports `statusHue` + `activation` (both exhaustive over the 8 GrantStatus values) + `secured/urgent/path/beamCore/beamTip/bg/bgGlow`; tokens.test.ts passes with the exact UI-SPEC hexes asserted.</done>
</task>

</tasks>

<verification>
- `pnpm exec vitest run src/lib/crystarium` passes (tokens tests discovered via the new glob — proves the vitest.config change works).
- `grep noExternal vite.config.ts` and `grep "three\": \"0.185.1" package.json` both match (build gotcha + pin in place).
- No `layerchart` added.
</verification>

<success_criteria>
Deps installed at pinned versions (three 0.185.1), the two build gotchas applied, typed pointer events declared, and `tokens.ts` provides the full named-colour + activation contract that materials and the legend will consume — all covered by a passing vitest run.
</success_criteria>

<output>
After completion, create `.planning/phases/03-3d-crystarium-scene/03-01-SUMMARY.md`.
</output>
