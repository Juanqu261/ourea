/**
 * Capture Step 1 panel hierarchy QA screenshots.
 * Usage: node e2e/captureAreaStepUx.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/cicsic/figures/ux-area-step');
const base = process.env.OUREA_PREVIEW_URL || 'http://127.0.0.1:4192';

async function shot(page, name) {
  await mkdir(outDir, { recursive: true });
  await page.screenshot({ path: join(outDir, `${name}.png`), animations: 'disabled' });
  console.log('wrote', name);
}

async function dismissGuide(page) {
  const tip = page.getByTestId('demo-guide-dismiss');
  if (await tip.count()) await tip.click().catch(() => {});
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${base}/?case=nanjing`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await page.waitForTimeout(1200);
  await shot(page, 'nanjing-step1-after');

  await page.goto(`${base}/?case=medellin`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await page.waitForTimeout(1200);
  await shot(page, 'medellin-step1-after');

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${base}/?case=nanjing`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await page.waitForTimeout(1000);
  await shot(page, 'nanjing-step1-1366');

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`${base}/?case=nanjing`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await page.waitForTimeout(1000);
  await shot(page, 'nanjing-step1-tablet');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
