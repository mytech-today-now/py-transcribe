import { test, expect } from './fixtures.js';
import {
  loadRuntime,
  openApp,
  recordMicrophoneClip,
  transcribeCurrentFile
} from './helpers.js';

test.describe('Microphone recording', () => {
  test('captures a clip, previews it, and transcribes it', async ({ page }) => {
    await openApp(page);
    await recordMicrophoneClip(page);

    await expect(page.locator('#sourceValue')).toContainText('microphone recording');
    await expect(page.locator('#recordingState')).toContainText(/Ready to review/i);
    await expect(page.locator('#recordButton')).toHaveAttribute('aria-pressed', 'false');

    const previewSrcIsBlob = await page.locator('#recordingPlayer').evaluate((element) => {
      return typeof element.src === 'string' && element.src.startsWith('blob:');
    });
    expect(previewSrcIsBlob).toBe(true);

    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#status')).toContainText(/finished in/i);
    await expect(page.locator('#transcriptPreview')).toContainText('Transcript from local Whisper');
    await expect(page.locator('#downloadZipButton')).toBeEnabled();
  });
});
