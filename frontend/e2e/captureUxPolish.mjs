/**
 * Capture UX polish screenshots for CICSIC QA.
 * Usage: node e2e/captureUxPolish.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/cicsic/figures/ux-polish');
const base = process.env.OUREA_PREVIEW_URL || 'http://127.0.0.1:4190';

async function shot(page, name) {
  await mkdir(outDir, { recursive: true });
  await page.screenshot({ path: join(outDir, `${name}.png`), animations: 'disabled' });
  console.log('wrote', name);
}

async function dismissGuide(page) {
  const tip = page.getByTestId('demo-guide-dismiss');
  if (await tip.count()) await tip.click().catch(() => {});
}

async function medellinToReview(page) {
  await page.goto(`${base}/?case=medellin`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await shot(page, '01-medellin-step1');
  await page.getByTestId('open-sandbox').click();
  await page.waitForTimeout(2000);
  await shot(page, '02-medellin-conditions');
  await page.getByTestId('flow-continue').click();
  await page.getByTestId('confirm-priority').click();
  await page.getByTestId('generate-alternatives').click();
  await page.getByTestId('step-title').waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(2500);
  await shot(page, '03-medellin-portfolio-result');
  await page.getByTestId('view-none').click();
  await page.waitForTimeout(1200);
  await shot(page, '04-medellin-before');
  await page.getByTestId('view-ai').click();
  await page.waitForTimeout(1200);
  await shot(page, '05-medellin-after');
}

async function nanjingFlow(page) {
  await page.goto(`${base}/?case=nanjing`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await shot(page, '06-nanjing-step1');
  await page.getByTestId('open-sandbox').click();
  await page.waitForTimeout(2500);
  await shot(page, '07-nanjing-conditions');
  await page.getByTestId('flow-continue').click();
  await page.getByTestId('confirm-priority').click();
  await page.getByTestId('generate-alternatives').click();
  await page.getByTestId('step-title').waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(2500);
  await shot(page, '08-nanjing-portfolio-result');
  await page.getByTestId('view-none').click();
  await page.waitForTimeout(1200);
  await shot(page, '09-nanjing-before');
  await page.getByTestId('view-ai').click();
  await page.waitForTimeout(1200);
  await shot(page, '10-nanjing-after');
}

async function citySelector(page) {
  await page.goto(`${base}/?case=medellin`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Change city/i }).click();
  await page.getByTestId('case-selector').waitFor({ state: 'visible' });
  await shot(page, '00-city-selection');
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await citySelector(page);
  await medellinToReview(page);
  await nanjingFlow(page);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
