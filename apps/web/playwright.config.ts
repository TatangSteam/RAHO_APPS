import { defineConfig, devices } from '@playwright/test';

const webPort = Number(process.env.E2E_WEB_PORT || 3000);
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${webPort}`;
const apiURL = process.env.E2E_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api/v1';
const shouldStartWebServer = process.env.E2E_START_WEB_SERVER !== 'false';
const includeMobileProject = process.env.E2E_INCLUDE_MOBILE === 'true';
const workers = Number(process.env.E2E_WORKERS || (process.env.CI ? 2 : 1));
const browserChannel = process.env.E2E_BROWSER_CHANNEL || 'chromium';
const video = process.env.E2E_VIDEO === 'off' ? 'off' : 'retain-on-failure';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers,
  outputDir: './test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    channel: browserChannel,
    extraHTTPHeaders: {
      'X-E2E-Test': 'true',
    },
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: shouldStartWebServer
    ? {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${webPort}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          NEXT_PUBLIC_API_URL: apiURL,
        },
      }
    : undefined,
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    ...(includeMobileProject
      ? [
          {
            name: 'mobile-chrome',
            use: { ...devices['Pixel 5'] },
            dependencies: ['setup'],
          },
        ]
      : []),
  ],
});
