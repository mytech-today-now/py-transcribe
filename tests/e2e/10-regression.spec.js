import { test, expect } from './fixtures.js';
import {
  createAudioFile,
  openApp,
  selectFilesViaButton,
  loadRuntime,
  transcribeCurrentFile
} from './helpers.js';

test.describe('Visual regression', () => {
  test('keeps the upload zone snapshot stable', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#dropZone')).toHaveScreenshot('dropzone-idle.png', {
      animations: 'disabled'
    });
  });

  test('keeps the runtime controls snapshot stable after loading', async ({ page }) => {
    await openApp(page);
    await loadRuntime(page);

    await expect(page.locator('article[aria-labelledby="runtime-title"] .control-row')).toHaveScreenshot('runtime-controls-loaded.png', {
      animations: 'disabled'
    });
  });

  test('keeps the download controls snapshot stable after transcription', async ({ page }) => {
    await openApp(page);
    await selectFilesViaButton(page, [createAudioFile({ name: 'snapshot.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('.download-grid')).toHaveScreenshot('download-controls-ready.png', {
      animations: 'disabled'
    });
  });
});
