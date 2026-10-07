import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  VIEWPORTS,
  attachErrorGuards,
  assertNoHorizontalOverflow,
} from './errorAllowlist.js';
import { assertCityLanding, generateToReview, walkToPortfolio } from './guidedJourney.js';
import { VALID_SYNTHESIS } from '../tests/fixtures/aiReview.js';

const MOCK_PATH = '/__ourea_ai';

function collectAiRequests(page) {
  const urls = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('openai.com') || url.includes('decision-readiness') || url.includes('__ourea_ai')) {
      urls.push({ url, method: request.method() });
    }
  });
  return urls;
}

async function openReview(page) {
  await page.goto('/');
  await assertCityLanding(page);
  await walkToPortfolio(page);
  await generateToReview(page);
}

function mockEnvelope() {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      synthesis: VALID_SYNTHESIS,
      generated_at: '2026-08-28T12:00:00Z',
    }),
  };
}

function pendingGate() {
  let release = () => {};
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  return { wait, release };
}

async function mockReview(page, fulfill) {
  await page.addInitScript((path) => {
    window.__OUREA_AI_API_URL__ = `${window.location.origin}${path}`;
  }, MOCK_PATH);
  await page.route(`**${MOCK_PATH}`, fulfill);
}

test.describe('AI decision review', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('card is idle without an automatic request and PDF still exports', async ({ page }) => {
    const guards = attachErrorGuards(page);
    const urls = collectAiRequests(page);
    await openReview(page);
    await expect(page.getByTestId('ai-decision-review')).toBeVisible();
    await expect(page.getByTestId('ai-review-unconfigured')).toBeVisible();
    await expect(page.getByTestId('generate-decision-review')).toHaveCount(0);
    expect(urls.filter((item) => item.url.includes('openai.com'))).toEqual([]);
    await page.getByTestId('review-safeguards').click();
    await expect(page.getByTestId('package-ready')).toBeVisible();
    await expect(page.getByTestId('ai-review-summary')).toHaveCount(0);
    const downloads = [];
    page.on('download', (download) => downloads.push(download));
    await page.getByTestId('export-package').click();
    await expect.poll(() => downloads.length).toBeGreaterThanOrEqual(1);
    const pdf = downloads.find((item) => item.suggestedFilename().endsWith('.pdf'));
    const bytes = await readFile(await pdf.path());
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(bytes.toString('latin1')).toMatch(/\/Count [6-8]/);
    await assertNoHorizontalOverflow(page);
    guards.assertClean();
  });

  test('Download PDF stays deterministic when no review was generated', async ({ page }) => {
    const guards = attachErrorGuards(page);
    const urls = collectAiRequests(page);
    let hits = 0;
    await mockReview(page, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204 });
        return;
      }
      hits += 1;
      await route.fulfill(mockEnvelope());
    });
    await openReview(page);
    await expect(page.getByTestId('generate-decision-review')).toBeVisible();
    await page.getByTestId('review-safeguards').click();
    await expect(page.getByTestId('export-package')).toBeEnabled();
    const downloads = [];
    page.on('download', (download) => downloads.push(download));
    await page.getByTestId('export-package').click();
    await expect.poll(() => downloads.length).toBeGreaterThanOrEqual(1);
    expect(hits).toBe(0);
    expect(urls.filter((item) => item.url.includes('openai.com'))).toEqual([]);
    const pdf = downloads.find((item) => item.suggestedFilename().endsWith('.pdf'));
    const bytes = await readFile(await pdf.path());
    const body = bytes.toString('latin1');
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(body).toMatch(/\/Count [6-8]/);
    expect(body).toMatch(/Executive decision|Implementation pathway|Why this proving ground/);
    expect(body).not.toMatch(/AI-assisted decision synthesis/);
    expect(body).not.toMatch(/Cost and robustness interpretation/);
    await assertNoHorizontalOverflow(page);
    guards.assertClean();
  });

  test('cached AI synthesis is included in the PDF without a second request', async ({ page }) => {
    const guards = attachErrorGuards(page);
    const urls = collectAiRequests(page);
    let hits = 0;
    await mockReview(page, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204 });
        return;
      }
      hits += 1;
      await route.fulfill(mockEnvelope());
    });
    await openReview(page);
    await page.getByTestId('generate-decision-review').click();
    await expect(page.getByTestId('ai-review-badge')).toBeVisible();
    expect(hits).toBe(1);
    await page.getByTestId('review-safeguards').click();
    const downloads = [];
    page.on('download', (download) => downloads.push(download));
    await page.getByTestId('export-package').click();
    await expect.poll(() => downloads.length).toBeGreaterThanOrEqual(1);
    expect(hits).toBe(1);
    const pdf = downloads.find((item) => item.suggestedFilename().endsWith('.pdf'));
    const body = (await readFile(await pdf.path())).toString('latin1');
    expect(body).toMatch(/\/Count [6-8]/);
    expect(body).toMatch(/AI-assisted decision synthesis/);
    expect(body).toMatch(/Cost and robustness interpretation/);
    expect(body).toMatch(/Ready for field validation|Walk cells/);
    await page.getByTestId('export-package').click();
    await expect.poll(() => downloads.length).toBeGreaterThanOrEqual(2);
    expect(hits).toBe(1);
    expect(urls.filter((item) => item.url.includes('openai.com'))).toEqual([]);
    await assertNoHorizontalOverflow(page);
    guards.assertClean();
  });

  test('generate, loading, success, regenerate and safeguards summary', async ({ page }) => {
    const guards = attachErrorGuards(page);
    const urls = collectAiRequests(page);
    const gate = pendingGate();
    let hits = 0;
    await mockReview(page, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204 });
        return;
      }
      hits += 1;
      await gate.wait;
      await route.fulfill(mockEnvelope());
    });
    await openReview(page);
    await expect(page.getByTestId('generate-decision-review')).toBeVisible();
    await expect(page.getByTestId('ai-review-result')).toHaveCount(0);
    await page.getByTestId('generate-decision-review').click();
    await expect(page.getByTestId('ai-review-loading')).toBeVisible();
    await expect(page.getByTestId('cancel-decision-review')).toBeVisible();
    expect(hits).toBe(1);
    expect(urls.filter((item) => item.url.includes('openai.com'))).toEqual([]);
    gate.release();
    await expect(page.getByTestId('ai-review-badge')).toBeVisible();
    await expect(page.getByTestId('ai-review-headline')).toContainText(/Walk cells/i);
    await expect(page.getByTestId('ai-review-why')).toBeVisible();
    await expect(page.getByTestId('ai-review-gates')).toBeVisible();
    await expect(page.getByTestId('ai-review-questions')).toBeVisible();
    await expect(page.getByTestId('ai-review-next')).toBeVisible();
    await expect(page.getByTestId('ai-review-cost-robustness')).toBeVisible();
    await expect(page.getByTestId('ai-review-cost-driver')).toBeVisible();
    await expect(page.getByTestId('ai-review-robust-caveat')).toBeVisible();
    await expect(page.getByTestId('ai-review-cannot')).toBeVisible();
    await expect(page.getByTestId('ai-review-cannot')).toContainText('What Ourea cannot conclude');
    await expect(async () => {
      await page.getByTestId('regenerate-decision-review').click();
      expect(hits).toBe(2);
    }).toPass({ timeout: 20000 });
    await expect(page.getByTestId('ai-review-badge')).toBeVisible();
    expect(urls.filter((item) => item.url.includes('openai.com'))).toEqual([]);
    await page.getByTestId('review-safeguards').click();
    await expect(page.getByTestId('ai-review-summary')).toBeVisible();
    await expect(page.getByTestId('ai-review-summary')).toContainText(/Ready for field validation|Proceed with conditions|Needs evidence review/);
    await page.getByTestId('flow-step-review').click();
    await expect(page.getByTestId('ai-review-result')).toBeVisible();
    await page.getByTestId('flow-step-conditions').click();
    await page.getByTestId('climate-preset-extreme_observed').click();
    await page.getByTestId('flow-step-review').click();
    await expect(page.getByTestId('stale-recommendation')).toBeVisible();
    await expect(page.getByTestId('ai-review-result')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    guards.assertClean();
  });

  test('timeout, 429 and 500 leave the deterministic flow usable', async ({ page }) => {
    const guards = attachErrorGuards(page);
    const queue = [408, 429, 500];
    let hits = 0;
    await mockReview(page, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204 });
        return;
      }
      hits += 1;
      const status = queue.shift() ?? 500;
      await route.fulfill({ status, contentType: 'application/json', body: '{"error":{"code":"x"}}' });
    });
    await openReview(page);
    await page.getByTestId('generate-decision-review').click();
    await expect(page.getByTestId('ai-review-error')).toBeVisible();
    await page.waitForTimeout(8500);
    await page.getByTestId('generate-decision-review').click();
    await expect(page.getByTestId('ai-review-error')).toBeVisible();
    await page.waitForTimeout(8500);
    await page.getByTestId('generate-decision-review').click();
    await expect(page.getByTestId('ai-review-error')).toBeVisible();
    expect(hits).toBe(3);
    await page.getByTestId('review-safeguards').click();
    await expect(page.getByTestId('export-package')).toBeEnabled();
    const downloads = [];
    page.on('download', (download) => downloads.push(download));
    await page.getByTestId('export-package').click();
    await expect.poll(() => downloads.length).toBeGreaterThanOrEqual(1);
    expect(hits).toBe(3);
    const pdf = downloads.find((item) => item.suggestedFilename().endsWith('.pdf'));
    const body = (await readFile(await pdf.path())).toString('latin1');
    expect(body).toMatch(/\/Count [6-8]/);
    expect(body).not.toMatch(/AI-assisted decision synthesis/);
    await assertNoHorizontalOverflow(page);
    guards.assertClean();
  });
});

for (const [name, viewport] of Object.entries({ tablet: VIEWPORTS.tablet, mobile: VIEWPORTS.mobile })) {
  test.describe(`AI decision review ${name}`, () => {
    test.use({ viewport });
    test('card remains usable without overflow', async ({ page }) => {
      const guards = attachErrorGuards(page);
      await openReview(page);
      await expect(page.getByTestId('ai-decision-review')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await page.getByTestId('review-safeguards').click();
      await expect(page.getByTestId('export-package')).toBeEnabled();
      await assertNoHorizontalOverflow(page);
      guards.assertClean();
    });
  });
}
