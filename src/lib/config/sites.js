// src/lib/config/sites.js — the SINGLE SWAP POINT for the two QR target URLs (DATA-06).
//
// These are PLACEHOLDER absolute external URLs. When the two real site URLs are
// finalized, edit them HERE (and only here), then re-run:
//     node tools/generate-qr.mjs      (or: pnpm build)
// to regenerate src/lib/data/qr.generated.js. No component code changes needed —
// the Phase-4 QR panel just imports `qrCodes`.
//
// IMPORTANT: these are ABSOLUTE EXTERNAL destinations (fully-qualified). They are
// intentionally NOT routed through the app `base` (`/Eman_dashboard/…`): a QR
// must encode the real external site, never an internal dashboard route, or a
// scan would open the dashboard / 404. The generator asserts `startsWith('http')`
// and the emitted codes are asserted to contain no `/Eman_dashboard/` prefix.
export const sites = [
	{ id: 'main', label: 'Visit DID', url: 'https://diversityincludesdisability.org' },
	{ id: 'support', label: 'DID — Accessible Site', url: 'https://wolfwdavid.github.io/diversityincludesdisability_three/' }
];
