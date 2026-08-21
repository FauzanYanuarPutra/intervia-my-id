import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const useExistingServer = process.env.E2E_USE_EXISTING_SERVER === 'true';
const browserChannel =
  process.env.E2E_BROWSER_CHANNEL ||
  (process.platform === 'win32' && !process.env.CI ? 'chrome' : undefined);
const recordVideo = process.env.E2E_VIDEO === 'true';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: recordVideo ? 'retain-on-failure' : 'off',
  },
  webServer: useExistingServer
    ? undefined
    : {
        command: 'npm run dev',
        port: 3000,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
});
