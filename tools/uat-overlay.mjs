// Phase-4 interactive UAT driver: loads the live scene, drives the overlay
// (drawer toggle, QR toggle, node click), screenshots each state. Not part of the build.
// Usage: node tools/uat-overlay.mjs <url> <outDir>
import { chromium } from '@playwright/test';
import { setTimeout as sleep } from 'node:timers/promises';

const URL = process.argv[2] || 'https://wolfwdavid.github.io/Eman_dashboard/';
const OUT = (process.argv[3] || '.').replace(/\/$/, '');

let browser;
const report = { url: URL, steps: [], consoleErrors: [] };
try {
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => report.consoleErrors.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await sleep(6000);
  await page.screenshot({ path: `${OUT}/uat-1-initial.png` });
  report.steps.push({ step: 'initial', canvas: await page.locator('canvas').count() });

  // 2. open the pipeline drawer (find its toggle by role/text)
  const drawerBtn = page.getByRole('button', { name: /pipeline|overview|charts|expand/i }).first();
  if (await drawerBtn.count()) {
    await drawerBtn.click();
    await sleep(1200);
    await page.screenshot({ path: `${OUT}/uat-2-drawer.png` });
    report.steps.push({ step: 'drawer-open', ok: true });
  } else {
    // fallback: any button inside the bottom-center drawer header
    const btns = await page.locator('button').allTextContents();
    report.steps.push({ step: 'drawer-open', ok: false, buttons: btns.slice(0, 15) });
  }

  // 3. toggle the QR panel
  const qrBtn = page.getByRole('button', { name: /share|qr/i }).first();
  if (await qrBtn.count()) {
    await qrBtn.click();
    await sleep(800);
    await page.screenshot({ path: `${OUT}/uat-3-qr.png` });
    report.steps.push({ step: 'qr-open', ok: true, qrSvgs: await page.locator('svg').count() });
    await qrBtn.click(); // close again
    await sleep(400);
  } else {
    report.steps.push({ step: 'qr-open', ok: false });
  }

  // 4. click the canvas near center (the gold active node orbits near center)
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (box) {
    // try a few spots around center to hit a crystal
    const spots = [ [0.5, 0.5], [0.48, 0.47], [0.52, 0.52], [0.45, 0.5], [0.55, 0.48] ];
    let opened = false;
    for (const [fx, fy] of spots) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      await sleep(1500);
      // detail rail should contain "NEXT ACTION" or a funder-site link when open
      const railOpen = await page.locator('text=/next action/i').count();
      if (railOpen) { opened = true; break; }
    }
    await page.screenshot({ path: `${OUT}/uat-4-node-select.png` });
    report.steps.push({ step: 'node-select', detailRailOpen: opened });
  }

  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  report.error = String(e);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
