import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  VIEWPORTS,
  attachErrorGuards,
  assertNoHorizontalOverflow,
  assertNoVerticalPageOverflow,
  assertMapSurface,
} from './errorAllowlist.js';
import {
  assertCityLanding,
  exportPackage,
  generateToReview,
  walkToPortfolio,
} from './guidedJourney.js';

const SCREENSHOT_DIR = fileURLToPath(new URL('../../docs/competition/screenshots/', import.meta.url));

async function shot(page, name) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: `${SCREENSHOT_DIR}${name}.png`,
    animations: 'disabled',
  });
}

async function runRecommendedJourney(page, { screenshots = false } = {}) {
  const guards = attachErrorGuards(page);
  await page.goto('/');
  await assertCityLanding(page);
  if (screenshots) await shot(page, 'step-1-desktop');

  await walkToPortfolio(page);
  if (screenshots) {
    await page.getByTestId('flow-step-conditions').click();
    await expect(page.getByTestId('step-title')).toHaveText(/What conditions should we plan for/i);
    await shot(page, 'step-2-desktop');
    await page.getByTestId('flow-continue').click();
    await page.getByTestId('confirm-priority').click();
  }

  await generateToReview(page);
  await expect(page.getByTestId('view-ai')).toBeVisible();
  await expect(page.getByTestId('view-user')).toHaveCount(0);
  await page.getByTestId('view-none').click();
  await page.getByTestId('view-ai').click();
  if (screenshots) await shot(page, 'step-5-desktop');

  await page.getByTestId('open-advanced').click();
  await expect(page.getByTestId('drawer-advanced')).toBeVisible();
  await expect(page.getByTestId('select-profile-balanced')).toBeVisible({ timeout: 120000 });
  await page.getByTestId('select-profile-equity').click();
  await page.getByTestId('select-profile-access').click();
  await page.getByTestId('select-profile-low_regret').click();
  await page.getByTestId('select-profile-balanced').click();
  await page.getByTestId('analyze-benchmark').click();
  await expect(page.getByTestId('breakage-combination-count')).toBeVisible({ timeout: 120000 });
  await expect(page.getByTestId('breakage-combination-count')).toContainText('scenario combinations');
  await expect(page.getByTestId('breakage-combination-count')).not.toContainText('grid cells');
  await page.getByTestId('advanced-tab-frontier').click();
  await page.getByTestId('analyze-frontier').click();
  await expect(page.locator('.frontier-row').first()).toBeVisible({ timeout: 120000 });
  await page.getByTestId('advanced-tab-tradeoffs').click();
  await page.getByTestId('analyze-pareto').click();
  await expect(page.locator('.pareto-row').first()).toBeVisible({ timeout: 120000 });
  if (screenshots) await shot(page, 'drawer-advanced-desktop');
  await page.getByTestId('advanced-close').click();

  const payload = await exportPackage(page);
  if (screenshots) await shot(page, 'step-6-desktop');
  await assertNoHorizontalOverflow(page);
  guards.assertClean();
  return payload;
}

test.describe('desktop', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('new user completes the six recommended steps', async ({ page }) => {
    await runRecommendedJourney(page, { screenshots: true });
    await assertNoVerticalPageOverflow(page);
    await expect(page.getByTestId('flow-actions')).toBeVisible();
  });

  test('stepper locks future steps and allows return', async ({ page }) => {
    const guards = attachErrorGuards(page);
    await page.goto('/');
    await assertCityLanding(page);
    await expect(page.getByTestId('flow-continue')).toHaveCount(0);
    await expect(page.getByTestId('flow-step-area')).toHaveAttribute('aria-current', 'step');
    await page.getByTestId('open-sandbox').click();
    await expect(page.getByTestId('step-area')).toHaveCount(0);
    await expect(page.getByTestId('flow-step-conditions')).toHaveAttribute('aria-current', 'step');
    await page.getByTestId('flow-step-area').click();
    await expect(page.getByTestId('step-title')).toHaveText(/Where should the city act/i);
    await expect(page.getByTestId('flow-step-portfolio')).toBeDisabled();
    guards.assertClean();
  });

  test('changing climate invalidates and update restores review', async ({ page }) => {
    const guards = attachErrorGuards(page);
    await page.goto('/');
    await assertCityLanding(page);
    await page.getByTestId('open-sandbox').click();
    await page.getByTestId('flow-continue').click();
    await page.getByTestId('confirm-priority').click();
    await generateToReview(page);
    await page.getByTestId('flow-step-conditions').click();
    await page.getByTestId('climate-preset-extreme_observed').click();
    await page.getByTestId('flow-step-review').click();
    await expect(page.getByTestId('stale-recommendation')).toBeVisible();
    await expect(page.getByTestId('action-footprint')).toHaveCount(0);
    await page.getByTestId('update-recommendation').click();
    await expect(page.getByTestId('step-title')).toHaveText(/Does this plan hold up/i, { timeout: 180000 });
    await expect(page.getByTestId('stale-recommendation')).toHaveCount(0);
    await expect(page.getByTestId('action-footprint')).toBeVisible();
    guards.assertClean();
  });

  test('manual portfolio path reaches review', async ({ page }) => {
    const guards = attachErrorGuards(page);
    await page.goto('/');
    await assertCityLanding(page);
    await walkToPortfolio(page);
    await page.getByTestId('choose-manual').click();
    await page.getByTestId('select-cell').selectOption({ index: 1 });
    await page.getByTestId('select-type-rwh').click();
    await page.getByTestId('add-intervention').click();
    await page.getByTestId('confirm-manual-portfolio').click();
    await expect(page.getByTestId('step-title')).toHaveText(/Does this plan hold up/i);
    await expect(page.getByTestId('view-user')).toBeVisible();
    await expect(page.getByTestId('view-ai')).toHaveCount(0);
    await page.getByTestId('view-none').click();
    await page.getByTestId('view-user').click();
    guards.assertClean();
  });

  test('load completed example opens review', async ({ page }) => {
    const guards = attachErrorGuards(page);
    await page.goto('/');
    await page.getByTestId('run-guided-demo').click();
    await expect(page.getByTestId('example-banner')).toBeVisible({ timeout: 180000 });
    await expect(page.getByTestId('step-title')).toHaveText(/Does this plan hold up/i);
    await expect(page.getByTestId('climate-context-panel')).toBeVisible();
    await expect(page.getByTestId('decision-engine')).toBeVisible();
    await expect(page.getByTestId('action-footprint')).toBeVisible();
    await assertMapSurface(page);
    guards.assertClean();
  });

  test('explore freely and return to guided', async ({ page }) => {
    const guards = attachErrorGuards(page);
    await page.goto('/');
    await page.getByTestId('open-sandbox').click();
    await page.getByTestId('app-menu').click();
    await page.getByTestId('toggle-explore').click();
    await expect(page.getByTestId('explore-workspace')).toBeVisible();
    await expect(page.getByTestId('explore-tab-scenario')).toHaveAttribute('aria-selected', 'true');
    await page.locator('#rain-depth').fill('210');
    await expect(page.getByTestId('preset-mode')).toContainText('Explore');
    await page.getByTestId('explore-tab-build').click();
    await expect(page.getByTestId('select-cell')).toBeVisible();
    await page.getByTestId('explore-tab-compare').click();
    await page.getByTestId('explore-tab-evidence').click();
    await page.getByTestId('app-menu').click();
    await page.getByTestId('toggle-explore').click();
    await expect(page.getByTestId('flow-stepper')).toBeVisible();
    await expect(page.getByTestId('step-title')).toBeVisible();
    guards.assertClean();
  });

  test('keyboard can open the proving ground', async ({ page }) => {
    const guards = attachErrorGuards(page);
    await page.goto('/');
    await expect(page.getByTestId('open-sandbox')).toBeVisible({ timeout: 60000 });
    await page.getByTestId('open-sandbox').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('step-title')).toHaveText(/What conditions should we plan for/i);
    await assertMapSurface(page);
    await page.keyboard.press('Tab');
    guards.assertClean();
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('prefers-reduced-motion stylesheet is present', async ({ page }) => {
    const guards = attachErrorGuards(page);
    await page.goto('/');
    await expect(page.getByTestId('open-sandbox')).toBeVisible({ timeout: 60000 });
    const present = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            const text = String(rule.cssText || '');
            const condition = String(rule.conditionText || '');
            if (condition.includes('prefers-reduced-motion') || text.includes('prefers-reduced-motion')) {
              return true;
            }
          }
        } catch {
          // Cross-origin stylesheets are not readable.
        }
      }
      return false;
    });
    expect(present).toBe(true);
    guards.assertClean();
  });
});

test.describe('tablet', () => {
  test.use({ viewport: VIEWPORTS.tablet });
  test('responsive decision path', async ({ page }) => {
    await runRecommendedJourney(page);
  });
});

test.describe('mobile', () => {
  test.use({ viewport: VIEWPORTS.mobile });
  test('390x844 bottom sheet covers climate plus export', async ({ page }) => {
    const guards = attachErrorGuards(page);
    await page.goto('/');
    await assertCityLanding(page);
    await expect(page.getByTestId('sheet-handle')).toBeVisible();
    await walkToPortfolio(page);
    await page.getByTestId('choose-manual').click();
    await page.getByTestId('select-cell').selectOption({ index: 1 });
    await page.getByTestId('add-intervention').click();
    await page.getByTestId('confirm-manual-portfolio').click();
    await expect(page.getByTestId('step-title')).toHaveText(/Does this plan hold up/i);
    await shot(page, 'mobile-review');
    await exportPackage(page);
    await assertNoHorizontalOverflow(page);
    const cta = page.getByTestId('export-package');
    const box = await cta.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    guards.assertClean();
  });
});

test('explore rainfall controls remain available', async ({ page }) => {
  const guards = attachErrorGuards(page);
  await page.goto('/');
  await page.getByTestId('open-sandbox').click();
  await expect(page.getByTestId('climate-preset-typical_wet')).toBeVisible();
  await page.getByTestId('adjust-manually').click();
  await page.locator('#rain-depth').fill('210');
  await expect(page.getByTestId('preset-mode')).toContainText('Explore');
  guards.assertClean();
});

test('built app serves local data without third-party APIs', async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (
      url.startsWith('http://127.0.0.1')
      || url.startsWith('http://localhost')
      || url.startsWith('ws://127.0.0.1')
      || url.startsWith('ws://localhost')
    ) {
      return route.continue();
    }
    return route.abort();
  });
  await page.goto('/');
  await expect(page.getByTestId('open-sandbox')).toBeVisible({ timeout: 60000 });
  await page.getByTestId('open-sandbox').click();
  await page.getByTestId('how-calculated').click();
  await expect(page.getByTestId('climate-context-panel')).toBeVisible();
  await expect(page.getByTestId('climate-facts')).toContainText('Observed rainfall');
  await expect(page.getByTestId('climate-facts')).not.toContainText('CHIRPS');
});

test('falls back cleanly when WebGL2 is unavailable', async ({ page }) => {
  const guards = attachErrorGuards(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
      if (String(type).toLowerCase().includes('webgl')) return null;
      return original.call(this, type, ...args);
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('map-fallback')).toBeVisible({ timeout: 60000 });
  await expect(page.getByText('3D map unavailable in this browser')).toBeVisible();
  await expect(page.getByTestId('open-sandbox')).toBeVisible();
  await page.getByTestId('run-guided-demo').click();
  await expect(page.getByTestId('example-banner')).toBeVisible({ timeout: 180000 });
  await page.getByTestId('review-safeguards').click();
  await expect(page.getByTestId('export-package')).toBeEnabled();
  await expect(page.getByTestId('map-fallback')).toBeVisible();
  guards.assertClean();
});

test('published demo', async ({ page, baseURL }) => {
  const url = process.env.OUREA_DEMO_URL || baseURL;
  const guards = attachErrorGuards(page);
  await page.goto(url);
  await expect(page.getByTestId('open-sandbox')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('population-matches')).toContainText('248/249');
  const ranks = await page.getByTestId('screening-row').evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-rank')),
  );
  expect(ranks).toEqual(['1', '2', '3', '4', '5']);
  await page.getByTestId('show-full-ranking').click();
  const expanded = await page.getByTestId('screening-row').evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-rank')),
  );
  expect(expanded.slice(0, 8)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  await assertNoHorizontalOverflow(page);
  await assertMapSurface(page);

  const origin = new URL(page.url());
  if (!origin.pathname.endsWith('/')) origin.pathname += '/';
  const climate = await page.request.get(new URL('data/climate_context.json', origin).href);
  expect(climate.ok(), `climate_context.json ${climate.status()}`).toBeTruthy();
  const geojson = await page.request.get(new URL('data/medellin_city_priority_screen.geojson', origin).href);
  expect(geojson.ok(), `city screen geojson ${geojson.status()}`).toBeTruthy();
  const community = await page.request.get(new URL('data/community_evidence.json', origin).href);
  expect(community.ok(), `community_evidence.json ${community.status()}`).toBeTruthy();
  expect((await community.json()).records).toEqual([]);

  await page.getByTestId('run-guided-demo').click();
  await expect(page.getByTestId('example-banner')).toBeVisible({ timeout: 180000 });
  await expect(page.getByTestId('climate-context-panel')).toBeVisible();
  await expect(page.getByTestId('decision-engine')).toBeVisible();
  await expect(page.getByTestId('action-footprint')).toBeVisible();
  await assertMapSurface(page);
  guards.assertClean();
});

test('cell hash from the briefing opens that square on the map', async ({ page }) => {
  const guards = attachErrorGuards(page);
  await page.goto('/#area=llanaditas&cell=35&plan=12:rwh,18:drainage');
  await expect(page.getByTestId('step-safeguards')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('flow-announcer')).toContainText(/planning cell/i);
  await expect(page.getByTestId('package-ready')).toBeVisible();
  await expect(page.getByTestId('hillside-mechanism')).toBeVisible();
  await expect(page.getByTestId('mechanism-play')).toBeVisible();
  await expect(page.getByTestId('mechanism-pause')).toBeVisible();
  await expect(page.getByTestId('mechanism-replay')).toBeVisible();
  await expect(page.getByText(/Illustrative no-action mechanism/i)).toBeVisible();
  await expect(page.getByText(/Why early action matters/i)).toBeVisible();
  await expect(page.getByText(/houses fall/i)).toHaveCount(0);
  await expect(page.getByTestId('cell-place-list')).toBeVisible();
  await expect(page.getByTestId('open-google-maps').first()).toBeVisible();
  await expect(page.getByTestId('open-google-earth').first()).toBeVisible();
  await expect(page).toHaveURL(/cell=35/);
  await assertMapSurface(page);
  guards.assertClean();
});
