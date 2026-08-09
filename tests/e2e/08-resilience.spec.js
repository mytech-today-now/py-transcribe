import { test, expect } from './fixtures.js';
import { createAudioFile, openApp, selectFilesViaButton, loadRuntime } from './helpers.js';

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
});
