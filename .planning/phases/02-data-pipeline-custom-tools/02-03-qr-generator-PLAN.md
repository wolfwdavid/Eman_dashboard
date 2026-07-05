---
phase: 02-data-pipeline-custom-tools
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/lib/config/sites.js
  - tools/generate-qr.mjs
  - src/lib/data/qr.generated.js
  - tools/qr.test.mjs
autonomous: true
requirements: [DATA-06]
must_haves:
  truths:
    - "`src/lib/config/sites.js` holds exactly two PLACEHOLDER absolute https:// URLs in one swappable module with a comment telling the user they are swappable"
    - "`node tools/generate-qr.mjs` reads sites.js and emits src/lib/data/qr.generated.js with one inline SVG per site"
    - "Each QR encodes the ABSOLUTE external URL — no app `base` / `/Eman_dashboard/` prefix ever touches it"
    - "A non-http URL in sites.js makes the QR tool exit non-zero"
  artifacts:
    - path: "src/lib/config/sites.js"
      provides: "the single swap point for the two QR target URLs"
      exports: ["sites"]
    - path: "tools/generate-qr.mjs"
      provides: "build-time QR SVG generator (qrcode lib)"
    - path: "src/lib/data/qr.generated.js"
      provides: "export const qrCodes = [{id,label,url,svg}] — inline SVG, no runtime fetch"
      contains: "export const qrCodes"
  key_links:
    - from: "tools/generate-qr.mjs"
      to: "src/lib/config/sites.js"
      via: "import { sites }"
      pattern: "from.*config/sites"
    - from: "tools/generate-qr.mjs"
      to: "qrcode"
      via: "QRCode.toString(url,{type:'svg'})"
      pattern: "toString.*svg"
---

<objective>
Build the QR subsystem: a single `src/lib/config/sites.js` module holding the two (PLACEHOLDER, swappable) absolute external site URLs, and `tools/generate-qr.mjs` which renders each to an inline SVG at build time and emits `src/lib/data/qr.generated.js`. The QR targets are absolute `https://` external URLs and must NEVER be routed through the app `base`.

Purpose: DATA-06 — decoupled, config-driven QR generation. Swapping a URL + rebuilding regenerates the codes with zero component-code change (the Phase-4 QR panel just imports `qrCodes`). Independent of the data pipeline, so it runs in parallel (Wave 2) with 02-02.
Output: `src/lib/config/sites.js`, `tools/generate-qr.mjs`, `src/lib/data/qr.generated.js`, `tools/qr.test.mjs`.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# READ FIRST — Tool 2 spec + Pitfall 5 (why QR bypasses base).
@.planning/phases/02-data-pipeline-custom-tools/02-RESEARCH.md
@tools/verify-build.mjs

<interfaces>
<!-- qrcode@1.5.4 installed by Plan 02-01. API: await QRCode.toString(url, { type:'svg', margin:1, errorCorrectionLevel:'M' }) → SVG string. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: sites.js config + generate-qr.mjs tool emitting qr.generated.js (DATA-06)</name>
  <files>src/lib/config/sites.js, tools/generate-qr.mjs, src/lib/data/qr.generated.js</files>
  <read_first>
    - 02-RESEARCH.md "Tool 2 — QR Generator" (lines ~307-319) — sites.js shape + emit format
    - 02-RESEARCH.md Pitfall 5 (lines ~389-390) — QR must NOT be base-prefixed
    - tools/verify-build.mjs (custom-tool style to mirror)
  </read_first>
  <action>
    1. Create `src/lib/config/sites.js` — the single swap point, with a clear comment that these are placeholders:
       ```js
       // PLACEHOLDER absolute external URLs — swap when the two real site URLs are finalized,
       // then re-run `node tools/generate-qr.mjs` (or `pnpm build`). No component code changes.
       // These are absolute external destinations — intentionally NOT routed through the app base path.
       export const sites = [
         { id: 'main',    label: 'Visit DID',         url: 'https://diversityincludesdisability.org' },
         { id: 'support', label: 'Support / Tracker', url: 'https://diversityincludesdisability.org/support' }
       ];
       ```
    2. Create `tools/generate-qr.mjs` (Node ESM, mirror verify-build.mjs style — shebang, clear PASS/FAIL, process.exit):
       - `import { sites } from '../src/lib/config/sites.js'` and `import QRCode from 'qrcode'`.
       - For each site: assert `url.startsWith('http')` → else print error + `process.exit(1)` (a relative/base-prefixed target is a build failure, Pitfall 5).
       - `const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })`.
       - Emit `src/lib/data/qr.generated.js`:
         `export const qrCodes = [{ id, label, url, svg }, …];` (inline SVG strings — inlined into the bundle, no static/ asset, no runtime fetch). Pretty-print the array.
       - Print a PASS summary listing each id + url.
    3. Run `node tools/generate-qr.mjs` to emit the committed `src/lib/data/qr.generated.js`.
  </action>
  <verify>
    <automated>node tools/generate-qr.mjs && node -e "import('./src/lib/data/qr.generated.js').then(m=>{const q=m.qrCodes;process.exit(q.length===2&&q.every(x=>x.svg.includes('<svg')&&x.url.startsWith('https://')&&!x.url.includes('/Eman_dashboard/'))?0:1)})"</automated>
  </verify>
  <acceptance_criteria>
    - `node tools/generate-qr.mjs` exits 0 and prints both site ids + urls
    - `grep -c "https://" src/lib/config/sites.js` shows 2 absolute URLs; `grep -qi "placeholder\|swap" src/lib/config/sites.js` (swappable comment present)
    - `grep -q "export const qrCodes" src/lib/data/qr.generated.js && grep -c "<svg" src/lib/data/qr.generated.js` shows 2 inline SVGs
    - `grep -q "startsWith('http')" tools/generate-qr.mjs` (absolute-URL guard present)
    - `grep -vq "/Eman_dashboard/" src/lib/data/qr.generated.js` (no base prefix ever encoded)
  </acceptance_criteria>
  <done>sites.js exposes two swappable absolute https URLs; generate-qr.mjs emits qr.generated.js with two inline SVGs encoding the absolute external URLs (never base-prefixed).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: qr.test.mjs — absolute-URL guard + SVG emit (DATA-06)</name>
  <files>tools/qr.test.mjs</files>
  <read_first>
    - 02-RESEARCH.md "qr.test.mjs" row in the Test Map (line ~477) and Pitfall 5
    - src/lib/config/sites.js and src/lib/data/qr.generated.js (created in Task 1)
  </read_first>
  <behavior>
    Write `tools/qr.test.mjs` asserting:
      - Every entry in `sites` (import from src/lib/config/sites.js) has `url.startsWith('https://')` and does NOT contain `/Eman_dashboard/`.
      - `sites.length === 2` and each has a unique `id` and a `label`.
      - The emitted `qrCodes` (import from src/lib/data/qr.generated.js) has 2 entries; each `svg` contains `'<svg'`; each `url` matches the corresponding `sites` url exactly (QR encodes the external destination, not an internal route).
      - Integration guard: `spawnSync('node', ['tools/generate-qr.mjs'])` returns status 0 on the good config.
      - (Negative) A unit assertion that a `startsWith('http')` check rejects a base-prefixed value like `/Eman_dashboard/foo` (guards the Pitfall-5 regression) — assert `'/Eman_dashboard/foo'.startsWith('http') === false`.
  </behavior>
  <action>
    Implement `tools/qr.test.mjs` (vitest, node env) covering the behavior above. Use `node:child_process` spawnSync for the integration guard.
  </action>
  <verify>
    <automated>pnpm exec vitest run tools/qr.test.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run tools/qr.test.mjs` exits 0
    - `grep -q "startsWith('https://')" tools/qr.test.mjs && grep -q "Eman_dashboard" tools/qr.test.mjs` (both the absolute-URL and no-base assertions present)
    - `grep -q "spawnSync" tools/qr.test.mjs` (integration guard present)
  </acceptance_criteria>
  <done>qr.test.mjs proves the two config URLs are absolute/non-base, both QR SVGs emit, and the generator exits 0 on good config.</done>
</task>

</tasks>

<verification>
- `node tools/generate-qr.mjs` emits qr.generated.js with 2 inline SVGs.
- `pnpm exec vitest run tools/qr.test.mjs` green.
- No QR url contains `/Eman_dashboard/`; both are absolute `https://`.
</verification>

<success_criteria>
- DATA-06: build-time QR tool reads a single config module (sites.js) and emits scannable inline-SVG codes for the two URLs; swapping a URL + rebuild regenerates with zero component change; targets are absolute external URLs, never base-prefixed.
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-pipeline-custom-tools/02-03-SUMMARY.md`
</output>
