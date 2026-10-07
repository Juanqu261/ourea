import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 240000,
  expect: { timeout: 30000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: process.env.OUREA_DEMO_URL
    ? undefined
    : {
        command: 'npx vite build && npx vite preview --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: false,
        timeout: 120000,
        env: {
          ...process.env,
          OUREA_E2E: '1',
          VITE_OUREA_AI_API_URL: '',
        },
      },
});
