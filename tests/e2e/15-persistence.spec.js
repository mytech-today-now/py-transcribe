import { test, expect } from './fixtures.js';
import { createAudioFile, loadRuntime, openApp, selectFilesViaButton, transcribeCurrentFile } from './helpers.js';

test.describe('Persistence', () => {
  test('restores the selected file, transcript, and runtime after a page reload', async ({ page }) => {
    await openApp(page, { whisperLoadDelayMs: 250 });
    await selectFilesViaButton(page, [createAudioFile({ name: 'persisted.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#transcriptEditor')).toHaveValue('Transcript from local Whisper');

    await page.locator('#transcriptEditor').fill('Edited transcript from storage');
    await expect(page.locator('#transcriptPreview')).toContainText('Edited transcript from storage');

    await page.reload();

    await expect(page.locator('#loadRuntimeButton')).toHaveText('Load Whisper / Python');
    await expect(page.locator('#fileSummary')).toContainText('persisted.wav');
    await expect(page.locator('#transcriptEditor')).toHaveValue('Edited transcript from storage');
    await expect(page.locator('#transcriptPreview')).toContainText('Edited transcript from storage');
    await expect(page.locator('#runtimeBadge')).toHaveText('Loaded');
    await expect(page.locator('#runtimeDetail')).toContainText('Whisper is ready');
    await expect(page.locator('#transcribeButton')).toBeEnabled();
  });
});
