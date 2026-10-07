/**
 * Capture Step 6 support-card + Advanced analysis QA screenshots.
 * Usage: OUREA_PREVIEW_URL=http://127.0.0.1:4194 node e2e/captureSupportAdvancedUx.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'docs/cicsic/figures/ux-support-advanced');
const base = process.env.OUREA_PREVIEW_URL || 'http://127.0.0.1:4194';

async function shot(page, name) {
  await mkdir(outDir, { recursive: true });
  await page.screenshot({ path: join(outDir, `${name}.png`), animations: 'disabled' });
  console.log('wrote', name);
}

async function dismissGuide(page) {
  const tip = page.getByTestId('demo-guide-dismiss');
  if (await tip.count()) await tip.click().catch(() => {});
}

async function assertNoIconOverlap(page) {
  const overlaps = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.support-card')];
    return cards.map((card) => {
      const icon = card.querySelector('.support-card-icon')?.getBoundingClientRect();
      const title = card.querySelector('.support-card-head b')?.getBoundingClientRect();
      if (!icon || !title) return { ok: false, reason: 'missing' };
      const overlap = !(icon.right <= title.left || title.right <= icon.left
        || icon.bottom <= title.top || title.bottom <= icon.top);
      return {
        ok: !overlap && title.left - icon.right >= 6,
        gap: title.left - icon.right,
        overlap,
      };
    });
  });
  const bad = overlaps.filter((item) => !item.ok);
  if (bad.length) {
    throw new Error(`support icon overlap/gap failures: ${JSON.stringify(bad)}`);
  }
  console.log('icon alignment ok', overlaps);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Preserve a before shot if denser prior exists
  const prior = join(root, 'docs/cicsic/figures/ux-density/step6-review.png');
  if (existsSync(prior)) {
    await mkdir(outDir, { recursive: true });
    await copyFile(prior, join(outDir, 'step6-before.png'));
    console.log('copied step6-before');
  }

  await page.goto(`${base}/?case=medellin`, { waitUntil: 'networkidle' });
  await dismissGuide(page);
  await page.getByTestId('run-guided-demo').click();
  await page.getByTestId('example-banner').waitFor({ timeout: 180000 });
  await page.getByTestId('review-safeguards').click();
  await page.getByTestId('package-ready').waitFor();
  await page.getByTestId('support-card-evidence').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot(page, 'step6-after');
  await assertNoIconOverlap(page);

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByTestId('support-card-community').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot(page, 'step6-after-1366');
  await assertNoIconOverlap(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId('flow-back').click();
  await page.getByTestId('open-advanced').click();
  await page.getByTestId('drawer-advanced').waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'advanced-benchmark');

  await page.getByTestId('advanced-tab-breakage').click();
  await page.waitForTimeout(400);
  await shot(page, 'advanced-breakage');

  await page.getByTestId('advanced-tab-frontier').click();
  await page.waitForTimeout(1200);
  await shot(page, 'advanced-frontier');

  await page.setViewportSize({ width: 820, height: 1100 });
  await page.getByTestId('advanced-tab-benchmark').click();
  await page.waitForTimeout(400);
  await shot(page, 'advanced-benchmark-narrow');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
