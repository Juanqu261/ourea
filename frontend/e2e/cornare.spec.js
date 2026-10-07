import { expect, test } from '@playwright/test';

const steps = ['overview', 'diagnosis', 'prioritize', 'portfolio', 'stress', 'robustness', 'residual', 'monitoring', 'export'];

test('the corridor decision is usable on a laptop and a phone', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const tiles = page.waitForResponse((response) => response.url().includes('.pbf') && response.ok(), { timeout: 25000 });
  await page.goto('/');
  await tiles;
  await expect(page.getByTestId('app-title')).toHaveText('Ourea');
  await expect(page.getByTestId('budget-pill')).toContainText('5.000');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.getByTestId('decision-map')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.map-legend')).toContainText('Rionegro');
  await expect(page.getByTestId('mode-2d')).toBeVisible();
  await expect(page.getByTestId('layer-panel')).toBeVisible();
  await expect(page.getByTestId('layer-wetlands')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.locator('.decision-map').screenshot({ path: '../docs/climaterisk/figures/overview-2d.png' });
  await page.getByTestId('mode-3d').click();
  await expect(page.getByTestId('mode-3d')).toHaveClass(/is-active/);
  await expect(page.getByTestId('terrain-exaggeration')).toBeVisible();
  await expect(page.getByTestId('basemap-toggle')).toBeChecked();
  await expect(page.getByTestId('map-note')).toHaveCount(0);
  await page.waitForTimeout(1600);
  await page.locator('.decision-map').screenshot({ path: '../docs/climaterisk/figures/overview-3d.png' });
  await page.getByTestId('green-blue').click();
  await expect(page.getByTestId('layer-protected_areas')).toBeChecked();
  await page.waitForTimeout(800);
  await page.locator('.decision-map').screenshot({ path: '../docs/climaterisk/figures/green-blue.png' });
  for (const step of steps) {
    await page.getByTestId(`nav-${step}`).click();
    await expect(page.getByTestId(`step-${step}`)).toBeVisible();
  }
  await page.getByTestId('nav-portfolio').click();
  await expect(page.getByTestId('measure-bio_pa')).toBeVisible();
  await page.getByTestId('map-focus-bio_pa').click();
  await expect(page.getByTestId('map-focus-card')).toContainText('Por definir', { timeout: 20000 });
  await page.locator('.decision-map').screenshot({ path: '../docs/climaterisk/figures/portfolio-measure.png' });
  await expect(page.getByTestId('budget-remaining')).toContainText('200');
  await page.getByTestId('nav-diagnosis').click();
  await page.getByRole('button', { name: 'Riesgo', exact: true }).click();
  await expect(page.locator('.decision-map figcaption')).toContainText('riesgo');
  await page.getByTestId('nav-stress').click();
  await expect(page.getByTestId('stress-status')).toContainText('Mayormente robusta');
  await page.getByTestId('nav-robustness').click();
  const nearBest = page.getByTestId('near-best-sentence');
  await expect(nearBest).toContainText(/Casi óptimo en \d+% de los 4\.000 mundos probados/);
  await expect(nearBest).not.toContainText('probabilidad');
  await expect(page.getByTestId('inclusion-bars').locator('li')).toHaveCount(15);
  await page.getByTestId('nav-diagnosis').click();
  await expect(page.getByTestId('lever-grid')).toContainText('Sin desagregar');
  await page.getByTestId('nav-residual').click();
  await expect(page.getByTestId('gap-ranking')).toContainText('gap-company-water');

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
