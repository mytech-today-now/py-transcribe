import { test, expect } from './fixtures.js';
import {
  createAudioFile,
  openApp,
  selectFilesViaButton,
  loadRuntime,
  transcribeCurrentFile,
  readTextDownload,
  readZipDownload,
  chunkCases
} from './helpers.js';

const downloadCases = [
  {
    name: 'downloads TXT as a plain transcript',
    selector: '#downloadTxtButton',
    verify: async (page) => {
      const result = await readTextDownload(page, '#downloadTxtButton');
      expect(result.suggestedFilename).toMatch(/\.txt$/);
      expect(result.contents).toContain('Transcript from local Whisper');
    }
  },
  {
    name: 'downloads SRT with subtitle timestamps',
    selector: '#downloadSrtButton',
    verify: async (page) => {
      const result = await readTextDownload(page, '#downloadSrtButton');
      expect(result.suggestedFilename).toMatch(/\.srt$/);
      expect(result.contents).toContain('00:00:00,000 --> 00:00:01,000');
      expect(result.contents).toContain('Transcript from local Whisper');
    }
  },
  {
    name: 'downloads VTT with WebVTT headers',
    selector: '#downloadVttButton',
    verify: async (page) => {
      const result = await readTextDownload(page, '#downloadVttButton');
      expect(result.suggestedFilename).toMatch(/\.vtt$/);
      expect(result.contents).toContain('WEBVTT');
      expect(result.contents).toContain('Transcript from local Whisper');
    }
  },
  {
    name: 'downloads a ZIP bundle with all outputs',
    selector: '#downloadZipButton',
    verify: async (page) => {
      const result = await readZipDownload(page, '#downloadZipButton');
      const archiveFiles = Object.keys(result.archive.files).sort();
      expect(result.suggestedFilename).toMatch(/\.zip$/);
      expect(archiveFiles).toEqual(expect.arrayContaining([
        'episode-one-transcript.txt',
        'episode-one-transcript.srt',
        'episode-one-transcript.vtt',
        'episode-one-transcript-cleaned.wav',
        'episode-one.wav'
      ]));

      const transcript = await result.archive.file('episode-one-transcript.txt').async('string');
      expect(transcript).toContain('Transcript from local Whisper');
    }
  }
];

for (const [groupIndex, groupCases] of chunkCases(downloadCases, 2).entries()) {
  test.describe(`Downloads matrix - group ${groupIndex + 1}`, () => {
    test.beforeEach(async ({ page }) => {
      await openApp(page);
      await selectFilesViaButton(page, [createAudioFile({ name: 'episode-one.wav' })]);
      await loadRuntime(page);
      await transcribeCurrentFile(page);
      await expect(page.locator('#status')).toContainText(/finished in/i);
      await expect(page.locator('#downloadZipButton')).toBeEnabled();
    });

    for (const testCase of groupCases) {
      test(testCase.name, async ({ page }) => {
        await testCase.verify(page);
      });
    }
  });
}
