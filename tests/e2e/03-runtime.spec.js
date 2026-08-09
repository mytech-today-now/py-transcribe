import { test, expect } from './fixtures.js';
import { openApp, loadRuntime } from './helpers.js';

test.describe('Runtime loading', () => {
  test('loads the runtime and updates the visible controls', async ({ page }) => {
    await openApp(page);
    await loadRuntime(page);

    await expect(page.locator('#status')).toContainText(/pyodide and base whisper are ready/i);
    await expect(page.locator('#loadRuntimeButton')).toHaveText('Reload Whisper / Python');
    await expect(page.locator('#runtimeBadge')).toHaveText('Loaded');
    await expect(page.locator('#runtimeState')).toHaveText('Base ready');
    await expect(page.locator('#runtimeDetail')).toContainText('Whisper is ready');

    const workerSummary = await page.evaluate(() => window.__pyTranscribeTestState.workers);
    expect(workerSummary).toHaveLength(2);
    expect(workerSummary.map((worker) => worker.kind)).toEqual(['whisper', 'python']);
  });

  test('surfaces runtime bootstrap failures and supports retrying', async ({ page }) => {
    await openApp(page, { whisperMode: 'error' });
    await loadRuntime(page);

    await expect(page.locator('#status')).toContainText(/failed to load runtime/i);
    await expect(page.locator('#runtimeBadge')).toHaveText('Idle');
    await expect(page.locator('#loadRuntimeButton')).toHaveText('Reload Whisper / Python');

    await page.evaluate(() => {
      window.__pyTranscribeTestState.config.whisperMode = 'ready';
    });
    await loadRuntime(page);

    await expect(page.locator('#status')).toContainText(/pyodide and base whisper are ready/i);
    await expect(page.locator('#runtimeBadge')).toHaveText('Loaded');

    const workerSummary = await page.evaluate(() => window.__pyTranscribeTestState.workers);
    expect(workerSummary).toHaveLength(4);
    expect(workerSummary.filter((worker) => worker.kind === 'whisper')).toHaveLength(2);
  });

  test('shows a loading state while the runtime is booting', async ({ page }) => {
    await openApp(page, { whisperLoadDelayMs: 3000 });
    await loadRuntime(page);

    await expect(page.locator('#status')).toContainText(/loading pyodide and base whisper/i);
    await expect(page.locator('#runtimeBadge')).toHaveText('Loading');
    await expect(page.locator('#loadRuntimeButton')).toBeDisabled();

    await expect(page.locator('#status')).toContainText(/pyodide and base whisper are ready/i);
    await expect(page.locator('#runtimeBadge')).toHaveText('Loaded');
  });
});
