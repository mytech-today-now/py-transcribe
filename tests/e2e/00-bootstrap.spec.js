import { test, expect } from './fixtures.js';
import { openApp } from './helpers.js';

test.describe('Bootstrap', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('renders the compact hero and status chips', async ({ page }) => {
    await expect(page.locator('#hero-title')).toContainText(/load whisper/i);
    await expect(page.locator('#browserNote')).toContainText('nothing is uploaded');
    await expect(page.locator('#runtimeState')).toHaveText('Not loaded');
    await expect(page.locator('#deviceState')).toHaveText(/WASM fallback|WebGPU available/);
    await expect(page.locator('#fileState')).toHaveText('No file');
    await expect(page.locator('#outputState')).toHaveText('Waiting');
    await expect(page.locator('.tag-row')).toHaveCount(0);
  });

  test('keeps the main controls visible and ready', async ({ page }) => {
    await expect(page.locator('#dropZone')).toBeVisible();
    await expect(page.locator('#loadRuntimeButton')).toBeVisible();
    await expect(page.locator('#browseButton')).toBeVisible();
    await expect(page.locator('#transcribeButton')).toBeDisabled();
    await expect(page.locator('#status')).toHaveText(/ready\. load the runtime, then choose a file\./i);
  });
});
