/**
 * Capture Step 6 theme + map overlay QA screenshots.
 * Usage: node e2e/captureThemeOverlayUx.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/cicsic/figures/ux-theme-overlays');
const base = process.env.OUREA_PREVIEW_URL || 'http://127.0.0.1:4191';

async function shot(page, name) {
  await mkdir(outDir, { recursive: true });
  await page.screenshot({ path: join(outDir, `${name}.png`), animations: 'disabled' });
  console.log('wrote', name);
}

async function dismissGuide(page) {
  const tip = page.getByTestId('demo-guide-dismiss');
  if (await tip.count()) await tip.click().catch(() => {});
}

async function toSafeguards(page, city) {
  await page.goto(`${base}/?case=${city}`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await page.getByTestId('open-sandbox').click();
  await page.waitForTimeout(1500);
  await shot(page, `${city}-detailed-map-desktop`);
  await page.getByTestId('flow-continue').click();
  await page.getByTestId('confirm-priority').click();
  await page.getByTestId('generate-alternatives').click();
  await page.getByTestId('step-title').waitFor({ state: 'visible', timeout: 180000 });
  await page.getByTestId('review-safeguards').click();
  await page.getByTestId('hillside-mechanism').waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  await shot(page, `${city}-step6-theme`);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await toSafeguards(page, 'medellin');
  await toSafeguards(page, 'nanjing');

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${base}/?case=nanjing`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await page.getByTestId('open-sandbox').click();
  await page.waitForTimeout(1500);
  await shot(page, 'nanjing-detailed-map-1366');

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`${base}/?case=nanjing`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await page.getByTestId('open-sandbox').click();
  await page.waitForTimeout(1500);
  await shot(page, 'nanjing-detailed-map-tablet');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
