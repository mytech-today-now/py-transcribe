import { test, expect } from './fixtures.js';
import {
  createEmptyAudioFile,
  createUnsupportedFile,
  createVideoFile,
  openApp,
  selectFilesViaButton,
  dropFiles,
  withSpoofedSize
} from './helpers.js';

const oversizedBytes = 1_073_741_825;

test.describe('File validation', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('rejects unsupported file types before transcription starts', async ({ page }) => {
    await selectFilesViaButton(page, [createUnsupportedFile({ name: 'notes.txt' })]);

    await expect(page.locator('#status')).toContainText(/unsupported file type/i);
    await expect(page.locator('#fileBadge')).toHaveText('Waiting');
    await expect(page.locator('#fileSummary')).toContainText('No file selected yet');
  });

  test('rejects empty media files', async ({ page }) => {
    await selectFilesViaButton(page, [createEmptyAudioFile({ name: 'empty.wav' })]);

    await expect(page.locator('#status')).toContainText(/file is empty/i);
    await expect(page.locator('#fileBadge')).toHaveText('Waiting');
  });

  test('rejects oversized media files', async ({ page }) => {
    await dropFiles(page, '#dropZone', [withSpoofedSize(createVideoFile({ name: 'huge.mov' }), oversizedBytes)]);

    await expect(page.locator('#status')).toContainText(/too large/i);
    await expect(page.locator('#fileBadge')).toHaveText('Waiting');
    await expect(page.locator('#fileSummary')).toContainText('No file selected yet');
  });
});
