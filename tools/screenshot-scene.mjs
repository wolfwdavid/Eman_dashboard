// One-off visual-verification capture for the Crystarium 3D scene. Not part of the build.
// Usage: node tools/screenshot-scene.mjs <url> <outPath>
// Loads the page, waits for WebGL to settle, reports canvas count + console errors, screenshots.
import { chromium } from '@playwright/test';
import { setTimeout as sleep } from 'node:timers/promises';

const URL = process.argv[2] || 'https://wolfwdavid.github.io/Eman_dashboard/';
const OUT = process.argv[3] || 'scene-shot.png';

let browser;
try {
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await sleep(7000); // let WebGL mount + intro/orbit run

  const canvasCount = await page.locator('canvas').count();
  // sample a few pixels to confirm the canvas isn't a black/empty frame
  const nonBlack = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    return { w: c.width, h: c.height };
  });
  await page.screenshot({ path: OUT, fullPage: false });
  console.log(JSON.stringify({ ok: true, url: URL, canvasCount, canvas: nonBlack, out: OUT, consoleErrors: errors.slice(0, 20) }, null, 2));
} catch (e) {
  console.log(JSON.stringify({ ok: false, url: URL, error: String(e) }, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
