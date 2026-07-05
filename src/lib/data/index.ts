// Barrel for the Eman_dashboard grant dataset. Components import the typed
// grants from here — the JSON is inlined by Vite at build time, so there is NO
// runtime fetch and no loading state (Pattern 2, build-time bake).
//   import { grants } from '$lib/data';
import raw from './grants.generated.json';
import type { Grant } from './types';

export const grants = raw as Grant[];

export * from './types';
