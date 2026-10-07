import { expect, test } from '@playwright/test';
import {
  VIEWPORTS,
  attachErrorGuards,
  assertMapSurface,
} from './errorAllowlist.js';

function boxesIntersect(a, b, pad = 2) {
  return !(
    a.x + a.width + pad <= b.x
    || b.x + b.width + pad <= a.x
    || a.y + a.height + pad <= b.y
    || b.y + b.height + pad <= a.y
  );
}

async function box(locator) {
  const handle = await locator.boundingBox();
  expect(handle).toBeTruthy();
  return handle;
}

test.describe('Map overlay collision', () => {
  for (const [name, viewport] of Object.entries({
    desktop1920: { width: 1920, height: 1080 },
    desktop1440: VIEWPORTS.desktop,
    desktop1366: { width: 1366, height: 768 },
  })) {
    test(`Nanjing sandbox overlays do not intersect (${name})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const guards = attachErrorGuards(page);
      await page.goto('/?case=nanjing');
      await page.getByTestId('open-sandbox').click();
      await expect(page.getByTestId('step-title')).toHaveText(/What conditions should we plan for/i);
      await assertMapSurface(page);

      const legend = page.getByTestId('map-legend');
      await expect(legend).toBeVisible();
      const legendBox = await box(legend);
      const mapBox = await page.locator('.map').boundingBox();
      expect(mapBox).toBeTruthy();
      expect(legendBox.x).toBeGreaterThanOrEqual(0);
      expect(legendBox.y).toBeGreaterThanOrEqual(0);
      expect(legendBox.x + legendBox.width).toBeLessThanOrEqual(mapBox.width + 2);
      expect(legendBox.y + legendBox.height).toBeLessThanOrEqual(viewport.height + 2);

      const layers = page.locator('.map-layers');
      if (await layers.count()) {
        const layersBox = await box(layers);
        expect(boxesIntersect(legendBox, layersBox)).toBe(false);
      }

      const help = page.getByTestId('legend-help');
      await expect(help).toBeVisible();
      await help.locator('summary').click();
      await expect(help.locator('p')).toBeVisible();
      const tipBox = await box(help.locator('p'));
      // Tip sits above the legend card; it may share x-range but must not cover the swatch body.
      expect(tipBox.y + tipBox.height).toBeLessThanOrEqual(legendBox.y + 4);

      guards.assertClean();
    });
  }
});

test.describe('Step 6 early-action theme', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('Medellín review card uses dark surface styles', async ({ page }) => {
    const guards = attachErrorGuards(page);
    await page.goto('/?case=medellin');
    await page.getByTestId('open-sandbox').click();
    await page.getByTestId('flow-continue').click();
    await page.getByTestId('confirm-priority').click();
    await page.getByTestId('generate-alternatives').click();
    await expect(page.getByTestId('step-title')).toHaveText(/Does this plan hold up/i, { timeout: 180000 });
    await page.getByTestId('review-safeguards').click();
    await expect(page.getByTestId('hillside-mechanism')).toBeVisible();

    const styles = await page.getByTestId('hillside-mechanism').evaluate((node) => {
      const card = getComputedStyle(node);
      const canvas = getComputedStyle(node.querySelector('.mechanism-canvas'));
      const title = getComputedStyle(node.querySelector('b'));
      return {
        cardBg: card.backgroundColor,
        canvasBg: canvas.backgroundColor,
        titleColor: title.color,
      };
    });

    const parseRgb = (value) => value.match(/\d+/g)?.map(Number) ?? [];
    const [cr, cg, cb] = parseRgb(styles.cardBg);
    // Dark surface: channel averages well below mid-gray
    expect((cr + cg + cb) / 3).toBeLessThan(80);
    const [tr, tg, tb] = parseRgb(styles.titleColor);
    expect((tr + tg + tb) / 3).toBeGreaterThan(160);

    guards.assertClean();
  });
});
