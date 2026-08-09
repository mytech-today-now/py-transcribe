import { test, expect } from './fixtures.js';
import {
  createAudioFile,
  openApp,
  selectFilesViaButton,
  loadRuntime,
  transcribeCurrentFile
} from './helpers.js';

test.describe('Concurrency', () => {
  test('ignores a synthetic double click while the runtime is loading', async ({ page }) => {
    await openApp(page, { whisperLoadDelayMs: 1500 });
    await page.evaluate(() => {
      const button = document.getElementById('loadRuntimeButton');
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    await expect(page.locator('#status')).toContainText(/loading pyodide and base whisper/i);
    await expect(page.locator('#status')).toContainText(/pyodide and base whisper are ready/i);

    const workerSummary = await page.evaluate(() => window.__pyTranscribeTestState.workers);
    expect(workerSummary).toHaveLength(2);
  });

  test('cancels an in-flight transcription and returns to idle', async ({ page }) => {
    await openApp(page, { transcribeDelayMs: 2000 });
    await selectFilesViaButton(page, [createAudioFile({ name: 'cancel-me.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#cancelButton')).toBeEnabled();
    await expect(page.locator('#status')).toContainText(/preparing cancel-me\.wav/i);

    await page.locator('#cancelButton').click();

    await expect(page.locator('#status')).toContainText(/transcription cancelled/i);
    await expect(page.locator('#transcribeButton')).toBeEnabled();
    await expect(page.locator('#downloadZipButton')).toBeDisabled();
    await expect(page.locator('#transcriptPreview')).toContainText('Transcription cancelled');
  });

  test('auto-reloads the runtime after the selected model changes', async ({ page }) => {
    await openApp(page, { whisperLoadDelayMs: 300 });
    await selectFilesViaButton(page, [createAudioFile({ name: 'model-change.wav' })]);
    await loadRuntime(page);
    await expect(page.locator('#status')).toContainText(/pyodide and base whisper are ready/i);

    await page.locator('#modelSelect').selectOption('small');
    await expect(page.locator('#status')).toContainText(/pyodide and small whisper are ready/i);
    await expect(page.locator('#runtimeBadge')).toHaveText('Loaded');
    await expect(page.locator('#transcribeButton')).toBeEnabled();
  });
});
