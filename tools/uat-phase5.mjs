// Phase-5 live visual gate: intro (mid + settled), readout-hide fix, drawer cap.
import { chromium } from '@playwright/test';
import { setTimeout as sleep } from 'node:timers/promises';

const URL = process.argv[2] || 'https://wolfwdavid.github.io/Eman_dashboard/';
const OUT = (process.argv[3] || '.').replace(/\/$/, '');
const report = { steps: [], consoleErrors: [] };
let browser;
try {
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => report.consoleErrors.push(e.message));

  // 1) intro mid-flight (~1.2s after load)
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/p5-1-intro-mid.png` });
  // 2) settled (~5s)
  await sleep(4000);
  await page.screenshot({ path: `${OUT}/p5-2-settled.png` });
  report.steps.push({ step: 'intro-captured' });

  // 3) select a node → rail opens AND top-right readout hides
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  let opened = false;
  outer: for (let fy = 0.30; fy <= 0.70; fy += 0.08) {
    for (let fx = 0.30; fx <= 0.72; fx += 0.06) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      await sleep(700);
      if (await page.locator('text=/next action/i').count()) { opened = true; break outer; }
    }
  }
  await sleep(600);
  await page.screenshot({ path: `${OUT}/p5-3-rail-readout.png` });
  const readoutHidden = await page.evaluate(() => {
    const els = [...document.querySelectorAll('*')].filter(e => e.textContent === 'SECURED' && e.children.length === 0);
    const panel = els[0]?.closest('[class]');
    if (!panel) return 'not-found';
    const s = getComputedStyle(panel);
    return { opacity: s.opacity, cls: panel.className.slice(0, 60) };
  });
  report.steps.push({ step: 'rail-open', opened, readoutProbe: readoutHidden });

  // 4) Esc, then expand drawer → title must remain visible
  await page.keyboard.press('Escape');
  await sleep(600);
  await page.getByRole('button', { name: /pipeline|overview/i }).first().click();
  await sleep(1000);
  const titleVisible = await page.locator('text=GRANT CRYSTARIUM').first().isVisible();
  await page.screenshot({ path: `${OUT}/p5-4-drawer-capped.png` });
  report.steps.push({ step: 'drawer-cap', titleVisible });

  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  report.error = String(e);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
