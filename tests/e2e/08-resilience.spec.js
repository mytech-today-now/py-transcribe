import { test, expect } from './fixtures.js';
import {
  createAudioFile,
  dropFiles,
  openApp,
  selectFilesViaButton,
  loadRuntime,
  withSpoofedSize
} from './helpers.js';

async function injectBlockedBeacon(page) {
  await page.route(/cloudflareinsights|beacon\.min\.js/i, (route) => route.abort());
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    script.async = true;
    document.head.appendChild(script);
  });
}

test.describe('Network resilience', () => {
  test('ignores a blocked analytics beacon and still allows file selection', async ({ page }) => {
    await openApp(page);
    await injectBlockedBeacon(page);
    await selectFilesViaButton(page, [createAudioFile({ name: 'beacon-audio.wav' })]);

    await expect(page.locator('#status')).toContainText(/selected beacon-audio\.wav/i);
    await expect(page.locator('#fileBadge')).toHaveText('Audio');
  });

  test('ignores a blocked analytics beacon and still loads Whisper', async ({ page }) => {
    await openApp(page);
    await injectBlockedBeacon(page);
    await selectFilesViaButton(page, [createAudioFile({ name: 'beacon-load.wav' })]);
    await loadRuntime(page);

    await expect(page.locator('#status')).toContainText(/pyodide and base whisper are ready/i);
    await expect(page.locator('#runtimeBadge')).toHaveText('Loaded');
  });

  test('reports failing host backups without throwing an unhandled rejection', async ({ page }) => {
    const uploadRequests = [];
    await page.route(/\/api\/upload\.php$/i, async (route, request) => {
      uploadRequests.push(request.method());
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'No file was uploaded.'
        })
      });
    });

    await openApp(page);
    await page.locator('#serverCopyToggle').setChecked(true);
    await selectFilesViaButton(page, [createAudioFile({ name: 'host-backup.wav' })]);

    await expect(page.locator('#status')).toContainText(/selected host-backup\.wav/i);
    await expect(page.locator('#fileBadge')).toHaveText('Audio');
    await expect(page.locator('#serverBackupState')).toContainText(/no file was uploaded/i);
    await expect.poll(() => uploadRequests.length).toBe(1);
  });

  test('skips host backups for files larger than the shared-host limit', async ({ page }) => {
    const uploadRequests = [];
    await page.route(/\/api\/upload\.php$/i, async (route, request) => {
      uploadRequests.push(request.method());
      await route.fulfill({
        status: 413,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'The file is larger than the host upload limit.'
        })
      });
    });

    await openApp(page);
    await page.locator('#serverCopyToggle').setChecked(true);
    await dropFiles(page, '#dropZone', [
      withSpoofedSize(createAudioFile({ name: 'oversized.wav' }), 32 * 1024 * 1024)
    ]);

    await expect(page.locator('#status')).toContainText(/selected oversized\.wav/i);
    await expect(page.locator('#fileBadge')).toHaveText('Audio');
    await expect(page.locator('#serverBackupState')).toContainText(/skipped/i);
    await expect.poll(() => uploadRequests.length).toBe(0);
  });
});
