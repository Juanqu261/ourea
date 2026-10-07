import { expect, test } from '@playwright/test';

const steps = ['overview', 'diagnosis', 'prioritize', 'portfolio', 'stress', 'residual', 'monitoring', 'export'];

test('the corridor decision is usable on a laptop and a phone', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByTestId('app-title')).toHaveText('Ourea');
  await expect(page.getByTestId('budget-pill')).toContainText('5.000');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('.map-legend')).toContainText('Rionegro');
  for (const step of steps) {
    await page.getByTestId(`nav-${step}`).click();
    await expect(page.getByTestId(`step-${step}`)).toBeVisible();
  }
  await page.getByTestId('nav-portfolio').click();
  await expect(page.getByTestId('measure-bio_pa')).toBeVisible();
  await expect(page.getByTestId('budget-remaining')).toContainText('200');
  await page.getByTestId('nav-stress').click();
  await expect(page.getByTestId('stress-status')).toContainText('Mayormente robusta');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('nav-overview').click();
  await expect(page.getByRole('heading', { name: '¿Dónde debe intervenir primero CORNARE, y con qué portafolio?' })).toBeVisible();
});

test('published demo serves the corridor', async ({ page }) => {
  test.skip(!process.env.OUREA_DEMO_URL, 'local preview covers the same flow');
  await page.goto(process.env.OUREA_DEMO_URL);
  await expect(page.getByTestId('app-title')).toHaveText('Ourea');
  await expect(page.getByTestId('budget-pill')).toContainText('5.000');
});
