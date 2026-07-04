// Fully static: every route prerenders to HTML at build time (DPLY-01).
export const prerender = true;
// Keep SSR on so prerendered pages contain real content (never ssr=false — SvelteKit #14471).
export const ssr = true;
// Directory-style URLs (/about/) — avoids GitHub Pages redirect/asset surprises.
export const trailingSlash = 'always';
