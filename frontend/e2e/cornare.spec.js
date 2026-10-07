import { expect, test } from '@playwright/test';

const steps = ['territory', 'priority', 'portfolio', 'horizon', 'robustness', 'residual', 'followup'];

test('seven steps share one map on a projector, a laptop and a small desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const tiles = page.waitForResponse((response) => response.url().includes('.pbf') && response.ok(), { timeout: 25000 });
  await page.goto('/');
  await tiles;
  await expect(page.getByTestId('app-title')).toHaveText('Ourea');
  await expect(page.getByTestId('budget-pill')).toContainText('5.000');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.getByTestId('decision-map')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.map-legend')).toContainText('Rionegro');
  const mounts = await page.evaluate(() => window.__oureaMapMounts);
  expect(mounts).toBe(1);

  await page.getByTestId('layer-panel-toggle').click();
  await expect(page.getByTestId('layer-panel')).toBeVisible();
  await expect(page.getByTestId('layer-wetlands')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: '../docs/climaterisk/figures/step-territory-1920.png' });

  await page.getByTestId('mode-3d').click();
  await expect(page.getByTestId('mode-3d')).toHaveClass(/is-active/);
  await expect(page.getByTestId('terrain-exaggeration')).toBeVisible();
  await expect(page.getByTestId('basemap-toggle')).toBeChecked();
  await expect(page.getByTestId('map-note')).toHaveCount(0);
  await page.waitForTimeout(1200);
  await page.locator('.decision-map').screenshot({ path: '../docs/climaterisk/figures/overview-3d.png' });
  await page.getByTestId('green-blue').click();
  await expect(page.getByTestId('layer-protected_areas')).toBeChecked();
  await page.locator('.decision-map').screenshot({ path: '../docs/climaterisk/figures/green-blue.png' });
  await page.getByTestId('mode-2d').click();
  await page.locator('.decision-map').screenshot({ path: '../docs/climaterisk/figures/overview-2d.png' });
  await page.getByTestId('layer-panel-toggle').click();
  await expect(page.getByTestId('layer-panel')).toHaveCount(0);

  for (const step of steps) {
    while (await page.getByTestId(`step-${step}`).count() === 0) {
      await page.getByTestId('step-next').click();
    }
    await expect(page.getByTestId(`step-${step}`)).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__oureaMapMounts)).toBe(1);
    await page.screenshot({ path: `../docs/climaterisk/figures/step-${step}-1920.png` });
  }

  while (await page.getByTestId('step-portfolio').count() === 0) {
    await page.getByTestId('step-back').click();
  }
  await page.getByTestId('map-focus-bio_pa').click();
  await expect(page.getByTestId('map-focus-card')).toContainText('Área candidata para prefactibilidad', { timeout: 20000 });
  await page.locator('.decision-map').screenshot({ path: '../docs/climaterisk/figures/portfolio-measure.png' });
  await expect(page.getByTestId('budget-remaining')).toHaveText('0');
  await page.getByTestId('why-bio_pa').click();
  await page.locator('.measure-why').scrollIntoViewIfNeeded();
  await expect(page.locator('.measure-why')).toContainText('vulnerabilidad');
  await page.screenshot({ path: '../docs/climaterisk/figures/portfolio-why-1920.png' });

  await page.getByTestId('open-compare').click();
  await expect(page.getByTestId('compare-drawer')).toContainText('Infraestructura gris');
  await expect(page.getByTestId('compare-institutional-recommended')).toContainText('Puntaje institucional verificado');
  await expect(page.getByTestId('compare-lens-cobenefit')).toContainText('Lente de naturaleza');
  await expect(page.getByTestId('compare-lens-regret')).toContainText('Índice de bajo arrepentimiento');
  await expect(page.getByTestId('compare-lens-regret')).toContainText('no un puntaje de vulnerabilidad');
  await page.screenshot({ path: '../docs/climaterisk/figures/compare-drawer-1920.png' });
  await page.getByTestId('drawer-close').click();

  while (await page.getByTestId('step-priority').count() === 0) {
    await page.getByTestId('step-back').click();
  }
  await expect(page.getByTestId('matrix-compact').locator('tbody tr')).toHaveCount(9);
  await page.getByTestId('open-calc').click();
  await expect(page.getByTestId('calc-equation')).toContainText('0,70');
  await page.getByTestId('calc-tab-path').click();
  await expect(page.getByTestId('calc-path-facts')).toContainText('32.768');
  await page.getByTestId('drawer-close').click();
  await expect(page.getByTestId('matrix-hab_green')).toContainText('0,280');
  await page.screenshot({ path: '../docs/climaterisk/figures/priority-matrix-1920.png' });
  await page.getByTestId('open-matrix').click();
  await expect(page.getByTestId('matrix-full')).toBeVisible();
  await expect(page.getByTestId('matrix-bio_restore')).toContainText('Por integrar');
  await expect(page.getByTestId('matrix-bio_restore')).toContainText('0,775');
  await expect(page.getByTestId('matrix-full')).not.toContainText('6 / 6');
  await page.screenshot({ path: '../docs/climaterisk/figures/decision-matrix-1920.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('matrix-drawer')).toHaveCount(0);

  await page.getByTestId('open-sources').click();
  await expect(page.getByTestId('sources-drawer')).toContainText('CORNARE');
  await expect(page.locator('body')).not.toContainText('CORNARE no entregó');
  await expect(page.locator('body')).not.toContainText('no nos dieron');
  await page.getByTestId('drawer-close').click();

  while (await page.getByTestId('step-territory').count() === 0) {
    await page.getByTestId('step-back').click();
  }
  await page.getByRole('button', { name: 'Riesgo', exact: true }).click();
  await page.getByTestId('map-readout-toggle').click();
  await expect(page.getByTestId('map-readout')).toContainText('riesgo');
  await page.getByTestId('map-readout-toggle').click();
  while (await page.getByTestId('step-horizon').count() === 0) {
    await page.getByTestId('step-next').click();
  }
  await page.getByTestId('scenario-2060').click();
  await expect(page.getByTestId('stress-status')).toContainText('Mayormente robusta');
  await expect(page.getByTestId('stress-outcome')).toContainText('El portafolio no cambia ante el cambio cuantificado');
  await expect(page.getByTestId('stress-coverage')).toContainText('1 señal cuantificada');
  await expect(page.getByTestId('stress-coverage')).toContainText('Rionegro');
  await expect(page.getByTestId('stress-meaning')).toContainText('no significa que todas las dimensiones tengan series SSP3-7.0');
  await expect(page.getByTestId('decision-hinge')).toContainText('0,0025');
  await expect(page.getByTestId('decision-hinge')).toContainText('rango total posible del componente participativo');
  await expect(page.locator('body')).not.toContainText('6 / 6');
  await expect(page.locator('body')).not.toContainText('Portafolio óptimo');
  await page.getByTestId('map-readout-toggle').click();
  await expect(page.getByTestId('map-readout')).toContainText('2060');
  await page.getByTestId('map-readout-toggle').click();
  await page.getByTestId('decision-hinge').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '../docs/climaterisk/figures/robustness-1920.png' });
  await page.screenshot({ path: '../docs/climaterisk/figures/decision-hinge-1920.png' });
  while (await page.getByTestId('step-robustness').count() === 0) {
    await page.getByTestId('step-next').click();
  }
  const nearBest = page.getByTestId('near-best-sentence');
  await expect(nearBest).toContainText(/Casi óptimo en \d+% de los 4\.000 mundos probados/);
  await expect(nearBest).not.toContainText('probabilidad');
  await expect(page.getByTestId('inclusion-bars').locator('li')).toHaveCount(15);
  await expect(page.getByTestId('lever-grid')).toContainText('Sin desagregar');
  await expect(page.getByTestId('gap-ranking')).toContainText('gap-company-water');

  while (await page.getByTestId('step-followup').count() === 0) {
    await page.getByTestId('step-next').click();
  }
  await page.getByTestId('nbs-screen').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('decision-line')).toContainText('COP 5.000 M a seis medidas');
  await expect(page.getByTestId('nbs-screen')).toContainText('No es una certificación');
  await page.screenshot({ path: '../docs/climaterisk/figures/nbs-screen-1920.png' });

  const sizes = [[1366, 768], [1024, 768], [390, 844]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    while (await page.getByTestId('step-territory').count() === 0) {
      await page.getByTestId('step-back').click();
    }
    for (const step of steps) {
      while (await page.getByTestId(`step-${step}`).count() === 0) {
        await page.getByTestId('step-next').click();
      }
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      expect(fits).toBe(true);
      await page.screenshot({ path: `../docs/climaterisk/figures/step-${step}-${width}.png` });
    }
  }
  for (const [width, height] of [[1366, 768], [1024, 768], [390, 844]]) {
    await page.setViewportSize({ width, height });
    while (await page.getByTestId('step-priority').count() === 0) {
      await page.getByTestId('step-back').click();
    }
    await page.getByTestId('matrix-compact').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `../docs/climaterisk/figures/priority-matrix-${width}.png` });
    await page.getByTestId('open-matrix').click();
    await expect(page.getByTestId('matrix-full')).toBeVisible();
    await page.screenshot({ path: `../docs/climaterisk/figures/decision-matrix-${width}.png` });
    await page.keyboard.press('Escape');
    while (await page.getByTestId('step-portfolio').count() === 0) {
      await page.getByTestId('step-next').click();
    }
    if (await page.locator('.measure-why').count() === 0) {
      await page.getByTestId('why-bio_pa').click();
    }
    await page.locator('.measure-why').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `../docs/climaterisk/figures/portfolio-why-${width}.png` });
    await page.getByTestId('open-compare').click();
    await expect(page.getByTestId('compare-lens-regret')).toBeVisible();
    await page.screenshot({ path: `../docs/climaterisk/figures/compare-drawer-${width}.png` });
    await page.getByTestId('drawer-close').click();
    while (await page.getByTestId('step-horizon').count() === 0) {
      await page.getByTestId('step-next').click();
    }
    await page.getByTestId('scenario-2060').click();
    await page.getByTestId('decision-hinge').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `../docs/climaterisk/figures/decision-hinge-${width}.png` });
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(fits).toBe(true);
  }
  for (const [width, height] of [[820, 1180], [768, 1024], [430, 932], [360, 800], [1440, 900], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(fits).toBe(true);
    await page.screenshot({ path: `../docs/climaterisk/figures/qa-${width}x${height}.png` });
  }
});

test('published demo serves the corridor', async ({ page }) => {
  test.skip(!process.env.OUREA_DEMO_URL, 'local preview covers the same flow');
  await page.goto(process.env.OUREA_DEMO_URL);
  await expect(page.getByTestId('app-title')).toHaveText('Ourea');
  await expect(page.getByTestId('budget-pill')).toContainText('5.000');
});
