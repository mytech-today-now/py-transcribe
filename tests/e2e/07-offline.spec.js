import { test, expect } from './fixtures.js';
import {
  createAudioFile,
  openApp,
  selectFilesViaButton,
  loadRuntime,
  transcribeCurrentFile,
  readTextDownload
} from './helpers.js';

test.describe('Offline behavior', () => {
  test('keeps transcribing after the network goes offline', async ({ page, context }) => {
    await openApp(page, { allowRealServiceWorker: true });
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length > 0);

    await selectFilesViaButton(page, [createAudioFile({ name: 'prime-online.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#status')).toContainText(/finished in/i);
    await expect(page.locator('#transcriptPreview')).toContainText('Transcript from local Whisper');

    await context.setOffline(true);
    await selectFilesViaButton(page, [createAudioFile({ name: 'offline-audio.wav' })]);
    await transcribeCurrentFile(page);

    await expect(page.locator('#status')).toContainText(/finished in/i);
    await expect(page.locator('#transcriptPreview')).toContainText('Transcript from local Whisper');
  });

  test('still downloads artifacts after the runtime has been loaded once', async ({ page, context }) => {
    await openApp(page, { allowRealServiceWorker: true });
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length > 0);

    await selectFilesViaButton(page, [createAudioFile({ name: 'offline-download.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);
    await context.setOffline(true);

    const result = await readTextDownload(page, '#downloadTxtButton');
    expect(result.contents).toContain('Transcript from local Whisper');
    expect(result.suggestedFilename).toMatch(/\.txt$/);
  });
});
