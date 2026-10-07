/**
 * Capture density QA screenshots across steps + rainfall drawer.
 * Usage: OUREA_PREVIEW_URL=http://127.0.0.1:4193 node e2e/captureDensityUx.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/cicsic/figures/ux-density');
const base = process.env.OUREA_PREVIEW_URL || 'http://127.0.0.1:4193';

async function shot(page, name) {
  await mkdir(outDir, { recursive: true });
  await page.screenshot({ path: join(outDir, `${name}.png`), animations: 'disabled' });
  console.log('wrote', name);
}

async function dismissGuide(page) {
  const tip = page.getByTestId('demo-guide-dismiss');
  if (await tip.count()) await tip.click().catch(() => {});
}

async function loadExampleToReview(page) {
  await page.goto(`${base}/?case=medellin`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await page.getByTestId('run-guided-demo').click();
  await page.getByTestId('example-banner').waitFor({ timeout: 180000 });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${base}/?case=medellin`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await shot(page, 'step1-where');

  await page.getByTestId('open-sandbox').click();
  await page.getByTestId('step-conditions').waitFor({ timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, 'step2-conditions');

  await page.getByTestId('adjust-manually').click();
  await page.getByTestId('scenario-controls').waitFor();
  await page.waitForTimeout(400);
  await shot(page, 'drawer-rainfall');

  await page.getByRole('button', { name: 'Close' }).click().catch(async () => {
    await page.locator('.flow-drawer-head .bar-button').first().click();
  });

  // Advance via guided demo for later steps
  await page.goto(`${base}/?case=medellin`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await page.getByTestId('run-guided-demo').click();
  await page.getByTestId('example-banner').waitFor({ timeout: 180000 });
  await shot(page, 'step5-compare');

  await page.setViewportSize({ width: 1366, height: 768 });
  await shot(page, 'step5-compare-1366');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId('review-safeguards').click();
  await page.getByTestId('package-ready').waitFor();
  await page.waitForTimeout(600);
  await shot(page, 'step6-review');

  await page.setViewportSize({ width: 1366, height: 768 });
  await shot(page, 'step6-review-1366');

  // Step 3 priorities via fresh path
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/?case=medellin`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await page.getByTestId('open-sandbox').click();
  await page.getByTestId('climate-preset-typical_wet').click();
  await page.getByTestId('flow-continue').click().catch(async () => {
    await page.getByRole('button', { name: /Continue/i }).click();
  });
  await page.waitForTimeout(600);
  // May land on priorities after conditions continue
  const priority = page.getByTestId('priority-balanced');
  if (await priority.count()) {
    await shot(page, 'step3-priorities');
    await page.setViewportSize({ width: 1366, height: 768 });
    await shot(page, 'step3-priorities-1366');
  }

  // Rainfall drawer at 1366
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${base}/?case=medellin`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await page.getByTestId('open-sandbox').click();
  await page.waitForTimeout(500);
  await page.getByTestId('adjust-manually').click();
  await page.getByTestId('scenario-controls').waitFor();
  await shot(page, 'drawer-rainfall-1366');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
