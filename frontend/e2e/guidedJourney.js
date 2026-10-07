import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { assertMapSurface, assertNoHorizontalOverflow } from './errorAllowlist.js';

export async function completeCommunityRecord(page) {
  const values = await page.getByTestId('community-project').locator('option').evaluateAll(
    (options) => options.map((option) => option.value).filter(Boolean),
  );
  expect(values.length).toBeGreaterThan(0);
  for (const value of values) {
    await page.getByTestId('community-project').selectOption(value);
    await page.getByTestId('community-consultation_status').selectOption('validated');
    await page.getByTestId('community-community_position').selectOption('support');
    await page.getByTestId('community-livelihood_disruption').selectOption('low');
    await page.getByTestId('community-maintenance_capacity').selectOption('medium');
    await page.getByTestId('community-displacement_risk').selectOption('none');
    await page.getByTestId('community-accessibility_concern').selectOption('none');
    await page.getByTestId('community-evidence_type').selectOption('participatory_input');
    await page.getByTestId('community-source').fill('Guided demo metadata');
    await page.getByTestId('community-as-of').fill('2026-08-27');
    await page.getByTestId('community-submit').click();
  }
}

export async function assertCityLanding(page) {
  await expect(page.getByTestId('open-sandbox')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('step-title')).toHaveText(/Where should the city act/i);
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
  expect(expanded.length).toBeGreaterThanOrEqual(8);
  const labels = await page.getByTestId('screening-row').allTextContents();
  expect(labels.join(' ')).not.toMatch(/Special \/ unmatched/i);
  await expect(page.locator('.step-shell')).toHaveCount(1);
  await expect(page.getByTestId('step-conditions')).toHaveCount(0);
  await expect(page.getByTestId('flow-step-review')).toBeDisabled();
  // Help + Menu always; Change city when multi-case (CICSIC fork).
  await expect(page.getByTestId('persistent-nav').locator(':scope > button, :scope > .topbar-menu > button')).toHaveCount(3);
  await expect(page.getByTestId('change-city')).toBeVisible();
  await expect(page.getByTestId('help-button')).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await assertMapSurface(page);
}

export async function walkToPortfolio(page) {
  await page.getByTestId('open-sandbox').click();
  await expect(page.getByTestId('step-title')).toHaveText(/What conditions should we plan for/i);
  await expect(page.getByTestId('flow-announcer')).toContainText(/Step 2 of 6/i);
  await page.getByTestId('climate-preset-high_rainfall').click();
  await expect(page.getByTestId('climate-preset-high_rainfall')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('how-calculated').click();
  await expect(page.getByTestId('drawer-method')).toBeVisible();
  await expect(page.getByTestId('climate-source-link')).toBeVisible();
  await page.getByTestId('climate-method').locator('summary').click();
  await expect(page.getByText(/does not issue real-time forecasts/i).first()).toBeVisible();
  await page.getByTestId('method-close').click();
  await page.getByTestId('flow-continue').click();
  await expect(page.getByTestId('step-title')).toHaveText(/What matters most/i);
  await page.getByTestId('confirm-priority').click();
  await expect(page.getByTestId('step-title')).toHaveText(/How do you want to build the plan/i);
}

export async function generateToReview(page) {
  await page.getByTestId('generate-alternatives').click();
  await expect(page.getByTestId('step-title')).toHaveText(/Does this plan hold up/i, { timeout: 180000 });
  await expect(page.getByTestId('action-footprint')).toBeVisible();
  await expect(page.getByTestId('decision-engine')).toBeVisible();
  await expect(page.getByTestId('recommended-plan')).toBeVisible();
  await expect(page.getByTestId('view-none')).toBeVisible();
  await expect(page.getByTestId('view-ai')).toBeVisible();
}

export async function exportPackage(page) {
  await page.getByTestId('review-safeguards').click();
  await expect(page.getByTestId('step-title')).toHaveText(/What should happen next/i);
  await page.getByTestId('view-evidence').click();
  await expect(page.getByTestId('drawer-evidence')).toBeVisible();
  await page.getByTestId('evidence-close').click();
  await page.getByTestId('view-alignment').click();
  await expect(page.getByTestId('plan-alignment')).toBeVisible();
  await expect(page.getByTestId('alignment-source-granizal-2025-mechanism')).toBeVisible();
  await expect(page.getByTestId('alignment-source-granizal-2025-mechanism')).not.toHaveText(/https?:\/\//);
  await page.getByTestId('alignment-close').click();
  await page.getByTestId('record-community').click();
  await page.getByTestId('community-project').selectOption({ index: 1 });
  await page.getByTestId('community-consultation_status').selectOption('in_progress');
  await page.getByTestId('community-submit').click();
  await expect(page.getByTestId('community-status')).toHaveAttribute('data-status', 'incomplete');
  await completeCommunityRecord(page);
  await expect(page.getByTestId('community-status')).toHaveAttribute('data-status', 'community_reviewed');
  await page.getByTestId('community-close').click();

  const downloads = [];
  page.on('download', (download) => downloads.push(download));
  await page.getByTestId('export-package').click();
  await expect.poll(() => downloads.length).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(700);
  expect(downloads.some((item) => item.suggestedFilename().endsWith('.json'))).toBe(false);
  const pdfDownload = downloads.find((item) => item.suggestedFilename().endsWith('.pdf'));
  expect(pdfDownload).toBeTruthy();
  const downloadPath = await pdfDownload.path();
  expect(downloadPath).toBeTruthy();
  const header = await readFile(downloadPath);
  expect(header.subarray(0, 4).toString()).toBe('%PDF');
  return pdfDownload;
}
