import { test, expect } from './fixtures.js';
import {
  createAudioFile,
  createVideoFile,
  openApp,
  selectFilesViaButton,
  dropFiles,
  waitForFileSelection
} from './helpers.js';

const uploadCases = [
  {
    name: 'button upload accepts audio files',
    method: 'button',
    file: createAudioFile({ name: 'interview.wav' }),
    kindLabel: 'Audio'
  },
  {
    name: 'button upload accepts video files',
    method: 'button',
    file: createVideoFile({ name: 'briefing.mp4' }),
    kindLabel: 'Video'
  },
  {
    name: 'drag and drop accepts audio files',
    method: 'drop',
    file: createAudioFile({ name: 'podcast.wav' }),
    kindLabel: 'Audio'
  },
  {
    name: 'drag and drop accepts video files',
    method: 'drop',
    file: createVideoFile({ name: 'demo.mov' }),
    kindLabel: 'Video'
  }
];

test.describe('Upload matrix', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  for (const testCase of uploadCases) {
    test(testCase.name, async ({ page }) => {
      if (testCase.method === 'button') {
        await selectFilesViaButton(page, [testCase.file]);
      } else {
        await dropFiles(page, '#dropZone', [testCase.file]);
      }

      await waitForFileSelection(page, testCase.file.name);
      await expect(page.locator('#fileState')).toContainText(testCase.file.name);
      await expect(page.locator('#fileBadge')).toHaveText(testCase.kindLabel);
      await expect(page.locator('#fileSummary')).toContainText(testCase.file.name);
      await expect(page.locator('#status')).toContainText(`Selected ${testCase.file.name}`);
      await expect(page.locator('#transcribeButton')).toBeDisabled();
    });
  }
});
