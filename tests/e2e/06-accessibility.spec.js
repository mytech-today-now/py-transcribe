import { test, expect } from './fixtures.js';
import { createAudioFile, openApp, selectFilesViaButton } from './helpers.js';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('pressing Enter on the drop zone opens the native file chooser', async ({ page }) => {
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#dropZone').focus();
    await page.keyboard.press('Enter');
    const chooser = await chooserPromise;
    await chooser.setFiles([createAudioFile({ name: 'keyboard-enter.wav' })]);

    await expect(page.locator('#fileSummary')).toContainText('keyboard-enter.wav');
  });

  test('pressing Space on the drop zone opens the native file chooser', async ({ page }) => {
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#dropZone').focus();
    await page.keyboard.press('Space');
    const chooser = await chooserPromise;
    await chooser.setFiles([createAudioFile({ name: 'keyboard-space.wav' })]);

    await expect(page.locator('#fileSummary')).toContainText('keyboard-space.wav');
  });

  test('exposes the expected ARIA hooks for status and browsing', async ({ page }) => {
    await expect(page.locator('#status')).toHaveAttribute('role', 'status');
    await expect(page.locator('#status')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#dropZone')).toHaveAttribute('role', 'group');
    await expect(page.locator('#dropZone')).toHaveAttribute('aria-describedby', 'dropHelp');
    await expect(page.getByRole('button', { name: 'Load Python / Whisper' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transcribe media' })).toBeDisabled();

    await selectFilesViaButton(page, [createAudioFile({ name: 'aria-check.wav' })]);
    await expect(page.locator('#fileBadge')).toHaveText('Audio');
  });
});
