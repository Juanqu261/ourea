/**
 * Capture Nanjing/Medellín dynamic building-color screenshots for CICSIC QA.
 * Usage: node e2e/captureDynamicBuildingUx.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/cicsic/figures/map-ux');
const base = process.env.OUREA_PREVIEW_URL || 'http://127.0.0.1:4188';

async function shot(page, name) {
  await mkdir(outDir, { recursive: true });
  await page.screenshot({
    path: join(outDir, `${name}.png`),
    animations: 'disabled',
  });
  console.log('wrote', name);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Nanjing baseline typical
  await page.goto(`${base}/?case=nanjing`, { waitUntil: 'networkidle' });
  await page.getByTestId('open-sandbox').click();
  await page.getByTestId('climate-preset-typical_wet').click();
  await page.waitForTimeout(2500);
  await shot(page, 'nanjing-typical-before-plan');

  await page.getByTestId('climate-preset-extreme_observed').click();
  await page.waitForTimeout(2500);
  await shot(page, 'nanjing-extreme-before-plan');

  await page.getByTestId('climate-preset-high_rainfall').click();
  await page.waitForTimeout(2500);
  await shot(page, 'nanjing-high-before-plan');

  await page.getByTestId('flow-continue').click();
  await page.getByTestId('confirm-priority').click();
  await page.getByTestId('generate-alternatives').click();
  await page.getByTestId('step-title').waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(3000);
  await shot(page, 'nanjing-high-after-plan');

  // Medellín before/after
  await page.goto(`${base}/?case=medellin`, { waitUntil: 'networkidle' });
  await page.getByTestId('open-sandbox').click();
  await page.getByTestId('climate-preset-typical_wet').click();
  await page.waitForTimeout(2500);
  await shot(page, 'medellin-before-plan');

  await page.getByTestId('flow-continue').click();
  await page.getByTestId('confirm-priority').click();
  await page.getByTestId('generate-alternatives').click();
  await page.getByTestId('step-title').waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(3000);
  await shot(page, 'medellin-after-plan');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
