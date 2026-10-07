/**
 * Capture Step-1 / detail screenshots for Medellín and Nanjing map UX QA.
 * Run: node e2e/captureMapUx.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '..', 'docs', 'cicsic', 'figures', 'map-ux');
mkdirSync(outDir, { recursive: true });

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not ready: ${url}`);
}

async function main() {
  const preview = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', '4175'],
    {
      cwd: root,
      env: { ...process.env, OUREA_E2E: '1', VITE_OUREA_AI_API_URL: '' },
      stdio: 'ignore',
    },
  );
  try {
    await waitForServer('http://127.0.0.1:4175');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await page.goto('http://127.0.0.1:4175/');
    await page.getByTestId('open-sandbox').waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: join(outDir, 'medellin-step1.png'),
      animations: 'disabled',
    });

    await page.goto('http://127.0.0.1:4175/?case=nanjing');
    await page.getByTestId('open-sandbox').waitFor({ timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: join(outDir, 'nanjing-step1.png'),
      animations: 'disabled',
    });

    await page.getByTestId('open-sandbox').click();
    await page.getByTestId('step-title').waitFor({ timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: join(outDir, 'nanjing-detail.png'),
      animations: 'disabled',
    });

    await browser.close();
    console.log('Wrote screenshots to', outDir);
  } finally {
    preview.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
