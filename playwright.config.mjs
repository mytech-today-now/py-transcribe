import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const chromeCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome Beta/Application/chrome.exe',
  'C:/Program Files/Google/Chrome Canary/Application/chrome.exe'
];

const chromeExecutablePath = chromeCandidates.find((candidate) => existsSync(candidate));

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 120_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    launchOptions: chromeExecutablePath
      ? {
          executablePath: chromeExecutablePath,
          args: ['--disable-dev-shm-usage']
        }
      : {
          args: ['--disable-dev-shm-usage']
        },
    viewport: {
      width: 1440,
      height: 1440
    },
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run test:e2e:serve',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000
  },
  outputDir: 'test-results/e2e'
});
