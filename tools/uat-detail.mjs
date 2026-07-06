// Phase-4 UAT: node-click → detail rail, on a fresh page (no drawer open).
import { chromium } from '@playwright/test';
import { setTimeout as sleep } from 'node:timers/promises';

const URL = process.argv[2] || 'https://wolfwdavid.github.io/Eman_dashboard/';
const OUT = (process.argv[3] || '.').replace(/\/$/, '');

let browser;
const report = { steps: [], consoleErrors: [] };
try {
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => report.consoleErrors.push(e.message));
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await sleep(6000);

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  // dense grid sweep across the middle band of the canvas until the rail opens
  let opened = false, hit = null;
  outer: for (let fy = 0.30; fy <= 0.70; fy += 0.08) {
    for (let fx = 0.30; fx <= 0.72; fx += 0.06) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      await sleep(700);
      if (await page.locator('text=/next action/i').count()) { opened = true; hit = [fx.toFixed(2), fy.toFixed(2)]; break outer; }
    }
  }
  report.steps.push({ step: 'node-select', detailRailOpen: opened, hit });
  await page.screenshot({ path: `${OUT}/uat-5-detail.png` });

  if (opened) {
    // filter check: rail open → press Esc to deselect, then verify rail closes
    await page.keyboard.press('Escape');
    await sleep(600);
    report.steps.push({ step: 'esc-deselect', railClosed: (await page.locator('text=/next action/i').count()) === 0 });
  }
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  report.error = String(e);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
