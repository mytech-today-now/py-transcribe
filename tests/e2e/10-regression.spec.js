import { test, expect } from './fixtures.js';
import {
  createAudioFile,
  installLocalAiRoutes,
  openApp,
  selectFilesViaButton,
  loadRuntime,
  transcribeCurrentFile
} from './helpers.js';

test.describe('Visual regression', () => {
  test('keeps the hero compact and punchy', async ({ page }) => {
    await openApp(page);

    await expect(page.locator('header.hero')).toHaveScreenshot('hero-compact.png', {
      animations: 'disabled'
    });
  });

  test('stacks the runtime toolbar and splits the source controls', async ({ page }) => {
    await openApp(page);

    const [runtimeBox, copyBox, actionBox, dropBox, recordCardBox, recordButtonBox] = await Promise.all([
      page.locator('.toolbar-runtime-row').boundingBox(),
      page.locator('.toolbar-copy-row').boundingBox(),
      page.locator('.toolbar-action-row').boundingBox(),
      page.locator('#dropZone').boundingBox(),
      page.locator('.source-record').boundingBox(),
      page.locator('#recordButton').boundingBox()
    ]);

    expect(runtimeBox).not.toBeNull();
    expect(copyBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    expect(dropBox).not.toBeNull();
    expect(recordCardBox).not.toBeNull();
    expect(recordButtonBox).not.toBeNull();

    expect(copyBox.y).toBeGreaterThan(runtimeBox.y + runtimeBox.height - 2);
    expect(actionBox.y).toBeGreaterThan(copyBox.y + copyBox.height - 2);
    expect(recordCardBox.x).toBeGreaterThan(dropBox.x + dropBox.width * 0.4);
    expect(Math.abs(dropBox.y - recordCardBox.y)).toBeLessThan(8);
    expect(recordButtonBox.y).toBeGreaterThan(recordCardBox.y);
  });

  test('keeps the source and transcript grid stable', async ({ page }) => {
    await openApp(page);

    await expect(page.locator('section.grid')).toHaveScreenshot('workspace-grid-idle.png', {
      animations: 'disabled'
    });
  });

  test('shows the loaded filename in the toolbar', async ({ page }) => {
    await openApp(page);
    await selectFilesViaButton(page, [createAudioFile({ name: 'snapshot.wav' })]);

    await expect(page.locator('.toolbar')).toHaveScreenshot('toolbar-loaded.png', {
      animations: 'disabled'
    });
  });

  test('keeps the local AI panel stable after a summary is generated', async ({ page }) => {
    await installLocalAiRoutes(page, {
      models: [
        {
          name: 'rubenftenorio/kimi-k25-local',
          details: { family: 'Kimi', parameter_size: '2.5B' }
        }
      ]
    });

    await openApp(page);
    await selectFilesViaButton(page, [createAudioFile({ name: 'local-ai-panel.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);
    await page.locator('#summarizeButton').click();

    await expect(page.locator('.local-ai-panel')).toHaveScreenshot('local-ai-panel-ready.png', {
      animations: 'disabled'
    });
  });

  test('keeps the transcript rows stable after transcription', async ({ page }) => {
    await openApp(page);
    await selectFilesViaButton(page, [createAudioFile({ name: 'snapshot.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('.transcript-panel')).toHaveScreenshot('transcript-panel-ready.png', {
      animations: 'disabled'
    });
  });

  test('keeps the transcript downloads above the editable transcript area', async ({ page }) => {
    await openApp(page);
    await selectFilesViaButton(page, [createAudioFile({ name: 'snapshot.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    const [downloadBox, rowsBox] = await Promise.all([
      page.locator('.download-row').boundingBox(),
      page.locator('.transcript-rows').boundingBox()
    ]);

    expect(downloadBox).not.toBeNull();
    expect(rowsBox).not.toBeNull();
    expect(downloadBox.y).toBeLessThan(rowsBox.y);
  });
});
