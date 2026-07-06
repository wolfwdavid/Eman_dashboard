import { chromium } from '@playwright/test';
import { setTimeout as sleep } from 'node:timers/promises';
const OUT = process.argv[2];
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('https://wolfwdavid.github.io/Eman_dashboard/', { waitUntil: 'load' });
await sleep(6000);
await page.getByRole('button', { name: /pipeline|overview/i }).first().click();
await sleep(800);
await page.getByRole('button', { name: /In progress 3/i }).first().click();
await sleep(1500);
// collapse drawer to see the scene
await page.getByRole('button', { name: /pipeline|overview/i }).first().click();
await sleep(1000);
await page.screenshot({ path: OUT });
console.log('filter applied, screenshot saved');
await browser.close();
