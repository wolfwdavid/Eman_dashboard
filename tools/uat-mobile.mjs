// Mobile UAT: phone-viewport screenshots + touch interactions on the live site.
// Usage: node tools/uat-mobile.mjs <url> <outDir>
import { chromium, devices } from '@playwright/test';
import { setTimeout as sleep } from 'node:timers/promises';

const URL = process.argv[2] || 'https://wolfwdavid.github.io/Eman_dashboard/';
const OUT = (process.argv[3] || '.').replace(/\/$/, '');
const report = { steps: [], consoleErrors: [] };
let browser;
try {
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.consoleErrors.push(e.message));
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await sleep(7000);
  await page.screenshot({ path: `${OUT}/mob-1-initial.png` });

  // horizontal overflow check
  const overflow = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth, winW: window.innerWidth,
    horizScroll: document.documentElement.scrollWidth > window.innerWidth,
  }));
  report.steps.push({ step: 'initial', overflow });

  // tap a node (grid sweep on canvas)
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  let opened = false, hit = null;
  if (box) {
    outer: for (let fy = 0.25; fy <= 0.6; fy += 0.07) {
      for (let fx = 0.2; fx <= 0.8; fx += 0.1) {
        await page.tap('canvas', { position: { x: box.width * fx, y: box.height * fy } }).catch(() => {});
        await sleep(700);
        if (await page.locator('text=/next action/i').count()) { opened = true; hit = [fx.toFixed(2), fy.toFixed(2)]; break outer; }
      }
    }
  }
  await page.screenshot({ path: `${OUT}/mob-2-detail.png` });
  report.steps.push({ step: 'node-tap-detail', opened, hit });

  // close detail if open (× button or Escape)
  const closeBtn = page.getByRole('button', { name: /×|close/i }).first();
  if (await closeBtn.count()) await closeBtn.click().catch(() => {});
  await sleep(600);

  // open drawer
  const drawerBtn = page.getByRole('button', { name: /pipeline|overview/i }).first();
  if (await drawerBtn.count()) { await drawerBtn.click(); await sleep(1000); }
  await page.screenshot({ path: `${OUT}/mob-3-drawer.png` });
  report.steps.push({ step: 'drawer' });
  if (await drawerBtn.count()) { await drawerBtn.click().catch(() => {}); await sleep(500); }

  // QR
  const qrBtn = page.getByRole('button', { name: /share|qr/i }).first();
  if (await qrBtn.count()) { await qrBtn.click(); await sleep(800); }
  await page.screenshot({ path: `${OUT}/mob-4-qr.png` });
  report.steps.push({ step: 'qr' });

  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  report.error = String(e);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
