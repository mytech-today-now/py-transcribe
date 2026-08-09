import { test, expect } from './fixtures.js';
import {
  createAudioFile,
  createVideoFile,
  openApp,
  selectFilesViaButton,
  dropFiles,
  waitForFileSelection,
  loadRuntime,
  transcribeCurrentFile
} from './helpers.js';

test.describe('Transcription flow', () => {
  test('transcribes an audio file end to end', async ({ page }) => {
    await openApp(page);
    await selectFilesViaButton(page, [createAudioFile({ name: 'episode-one.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#status')).toContainText(/finished in/i);
    await expect(page.locator('#transcriptPreview')).toContainText('Transcript from local Whisper');
    await expect(page.locator('#sourceValue')).toContainText('browser audio decode');
    await expect(page.locator('#downloadZipButton')).toBeEnabled();
  });

  test('transcribes a video file through the FFmpeg path', async ({ page }) => {
    await openApp(page);
    await dropFiles(page, '#dropZone', [createVideoFile({ name: 'panel-demo.mp4' })]);
    await waitForFileSelection(page, 'panel-demo.mp4');
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#status')).toContainText(/finished in/i);
    await expect(page.locator('#transcriptPreview')).toContainText('Transcript from local Whisper');
    await expect(page.locator('#sourceValue')).toContainText('FFmpeg extraction');
    await expect(page.locator('#downloadTxtButton')).toBeEnabled();
  });

  test('supports translated output names and preview text', async ({ page }) => {
    await openApp(page);
    await selectFilesViaButton(page, [createAudioFile({ name: 'meeting.wav' })]);
    await page.locator('#modelSelect').selectOption('tiny');
    await page.locator('#taskSelect').selectOption('translate');
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#status')).toContainText(/finished in/i);
    await expect(page.locator('#transcriptPreview')).toContainText('(translated)');
    await expect(page.locator('#downloadTxtButton')).toContainText('translation');
  });

  test('keeps English-only model requests compatible', async ({ page }) => {
    await openApp(page);
    await selectFilesViaButton(page, [createAudioFile({ name: 'english-only.wav' })]);
    await page.locator('#modelSelect').selectOption('small');
    await page.locator('#taskSelect').selectOption('translate');
    await page.locator('#languageSelect').selectOption('es');
    await page.locator('#modelSelect').selectOption('tiny-en');

    await expect(page.locator('#taskSelect')).toHaveValue('transcribe');
    await expect(page.locator('#taskSelect option[value="translate"]')).toBeDisabled();

    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#status')).toContainText(/finished in/i);
    await expect(page.locator('#transcriptPreview')).not.toContainText('(translated)');

    const whisperMessage = await page.evaluate(() => {
      const entry = window.__pyTranscribeTestState.workerMessages.find((workerEntry) => {
        return workerEntry.kind === 'whisper' && workerEntry.message.type === 'transcribe';
      });

      return entry?.message ?? null;
    });

    expect(whisperMessage).not.toHaveProperty('task');
    expect(whisperMessage).not.toHaveProperty('language');
  });
});
