import { expect, test } from '@playwright/test';
import {
  VIEWPORTS,
  attachErrorGuards,
  assertMapSurface,
} from './errorAllowlist.js';

test.describe('Nanjing dynamic building stress', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('condition and plan update sandbox building feature-state', async ({ page }) => {
    const guards = attachErrorGuards(page);
    await page.goto('/?case=nanjing');
    await expect(page.getByTestId('step-title')).toHaveText(/Where should the city act/i, { timeout: 60000 });
    await page.getByTestId('open-sandbox').click();
    await expect(page.getByTestId('step-title')).toHaveText(/What conditions should we plan for/i);
    await assertMapSurface(page);

    await page.getByTestId('climate-preset-typical_wet').click();
    await expect(page.getByTestId('climate-preset-typical_wet')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/Baseline/i).first()).toBeVisible();

    await page.getByTestId('climate-preset-extreme_observed').click();
    await expect(page.getByTestId('climate-preset-extreme_observed')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/Baseline/i).first()).toBeVisible();

    await page.getByTestId('flow-continue').click();
    await page.getByTestId('confirm-priority').click();
    await expect(page.getByTestId('step-title')).toHaveText(/How do you want to build the plan/i);
    await page.getByTestId('generate-alternatives').click();
    await expect(page.getByTestId('step-title')).toHaveText(/Does this plan hold up/i, { timeout: 180000 });
    await expect(page.getByText(/After plan|residual/i).first()).toBeVisible();

    guards.assertClean();
  });
});
