import { expect } from '@playwright/test';

export const VIEWPORTS = Object.freeze({
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
});

export function isAllowedFailedRequest(url, failureText = '') {
  if (url.includes('basemaps.cartocdn.com')) {
    return 'Optional Carto dark basemap; local GeoJSON and terrain still load.';
  }
  if (url.includes('tile.openstreetmap.org')) {
    return 'Optional OSM raster probe; primary basemap is keyless Esri street tiles.';
  }
  if (url.includes('server.arcgisonline.com') && failureText.includes('net::ERR_ABORTED')) {
    return 'MapLibre aborts in-flight basemap tiles during camera moves.';
  }
  if (url.includes('elevation-tiles-prod') || url.includes('s3.amazonaws.com/elevation-tiles-prod')) {
    return 'Optional remote Mapzen/AWS terrarium DEM for Nanjing hillshade.';
  }
  if (url.includes('demotiles.maplibre.org')) {
    return 'Optional MapLibre glyph atlas for labels.';
  }
  if (/\/(?:ourea\/)?terrain\/\d+\/\d+\/\d+\.png/.test(url)) {
    return 'Sparse local DEM TMS; empty tiles 404 by design.';
  }
  if (url.includes('community_evidence.json')) {
    return 'Optional participatory file; absence means not assessed.';
  }
  if (url.includes('/__ourea_ai') || url.includes('/api/decision-readiness')) {
    return 'Optional AI review endpoint; deterministic analysis continues without it.';
  }
  if (url.endsWith('/favicon.ico')) {
    return 'SVG favicon is shipped; browsers may still probe favicon.ico.';
  }
  if (failureText.includes('net::ERR_ABORTED') && url.includes('terrain/')) {
    return 'MapLibre aborts in-flight DEM tiles during camera moves.';
  }
  return null;
}

const CHROMIUM_URLLESS_404 = new Set([
  'Failed to load resource: the server responded with a status of 404 ()',
  'Failed to load resource: the server responded with a status of 404 (Not Found)',
]);

export function isAllowedConsoleError(text, resourceUrl = '') {
  if (resourceUrl && isAllowedFailedRequest(resourceUrl, text)) return true;
  if (isAllowedFailedRequest(text, text)) return true;
  // Chromium often logs sparse DEM / favicon 404s without the resource URL.
  // Unexpected own-resource 404s still fail via requestfailed and response.
  if (CHROMIUM_URLLESS_404.has(text.trim())) return true;
  return false;
}

export function attachErrorGuards(page) {
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const resourceUrl = message.location()?.url ?? '';
    if (isAllowedConsoleError(text, resourceUrl)) return;
    consoleErrors.push(resourceUrl ? `${text} [${resourceUrl}]` : text);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText ?? '';
    if (isAllowedFailedRequest(url, failure)) return;
    failedRequests.push(`${url} :: ${failure}`);
  });
  page.on('response', (response) => {
    const url = response.url();
    if (response.ok()) return;
    if (isAllowedFailedRequest(url, String(response.status()))) return;
    const origin = page.url();
    const own = url.startsWith(new URL(origin).origin);
    if (own && response.status() >= 400) {
      failedRequests.push(`${url} :: HTTP ${response.status()}`);
    }
  });

  return {
    assertClean() {
      expect(pageErrors, pageErrors.join('\n')).toEqual([]);
      expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
      expect(failedRequests, failedRequests.join('\n')).toEqual([]);
    },
  };
}

export async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow, 'horizontal overflow').toBe(false);
}

export async function assertNoVerticalPageOverflow(page) {
  const metrics = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    bodyOverflow: getComputedStyle(document.body).overflowY,
  }));
  expect(metrics.scrollHeight, 'vertical page overflow').toBeLessThanOrEqual(metrics.clientHeight + 1);
}

export async function assertMapSurface(page) {
  const fallback = page.getByTestId('map-fallback');
  if (await fallback.isVisible()) return;
  const host = page.getByTestId('map-canvas');
  await expect(host).toBeVisible();
  const box = await host.boundingBox();
  expect(box?.width ?? 0, 'map surface width').toBeGreaterThan(120);
  expect(box?.height ?? 0, 'map surface height').toBeGreaterThan(120);
  const canvasSize = await host.evaluate((el) => {
    const canvas = el.querySelector('canvas');
    return { width: canvas?.width ?? 0, height: canvas?.height ?? 0 };
  });
  expect(canvasSize.width, 'MapLibre drawing buffer width').toBeGreaterThan(0);
  expect(canvasSize.height, 'MapLibre drawing buffer height').toBeGreaterThan(0);
}
