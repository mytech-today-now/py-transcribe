import { test, expect } from './fixtures.js';
import { openApp } from './helpers.js';

test.describe('Bootstrap', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('renders the compact hero and top controls', async ({ page }) => {
    await expect(page.locator('#hero-title')).toContainText(/local whisper/i);
    await expect(page.locator('#browserNote')).toContainText('Everything stays local');
    await expect(page.locator('#runtimeState')).toHaveText('Not loaded');
    await expect(page.locator('#fileState')).toHaveAttribute('hidden', '');
    await expect(page.getByRole('button', { name: 'Load Whisper / Python' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transcribe' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Record Mic' })).toBeVisible();
  });

  test('keeps the main controls visible and ready', async ({ page }) => {
    await expect(page.locator('#dropZone')).toBeVisible();
    await expect(page.locator('#loadRuntimeButton')).toBeVisible();
    await expect(page.locator('#recordButton')).toBeVisible();
    await expect(page.locator('#recordingState')).toHaveText('Mic idle');
    await expect(page.locator('#transcribeButton')).toBeDisabled();
    await expect(page.locator('#status')).toHaveText(/ready\. load whisper \/ python, then choose a file\./i);
  });
});
