import { test, expect } from './fixtures.js';
import { openApp } from './helpers.js';

const viewportMatrix = [
  { name: 'old-phone-portrait', width: 320, height: 568 },
  { name: 'old-phone-landscape', width: 667, height: 375 },
  { name: 'tablet-portrait', width: 1024, height: 1366 },
  { name: 'wuhd-desktop', width: 3440, height: 1440 },
  { name: 'uhd-desktop', width: 3840, height: 2160 },
  { name: '8k-desktop', width: 7680, height: 4320 }
];

async function getBox(locator, label) {
  const box = await locator.boundingBox();
  expect(box, `${label} should be visible`).not.toBeNull();
  return box;
}

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));

  expect(metrics.scrollWidth, 'page should not overflow horizontally').toBeLessThanOrEqual(metrics.innerWidth + 1);
}

for (const viewport of viewportMatrix) {
  test(`stays contained in ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openApp(page);

    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole('button', { name: /myTech\.Today/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /README/i })).toBeVisible();
    await expect(page.locator('header.hero')).toBeVisible();
    await expect(page.locator('footer.footer')).toBeVisible();
    await expect(page.locator('.fine-print')).toContainText(
      'Local model inference runs in the browser. PHP only stores optional backups and serves the shell.'
    );
    await expect(page.locator('#dropZone')).toBeVisible();
    await expect(page.locator('#recordButton')).toBeVisible();
    await expect(page.locator('.download-row')).toBeVisible();

    const runtimeButtonBox = await getBox(page.locator('#loadRuntimeButton'), 'runtime button');
    const runtimeStateBox = await getBox(page.locator('#runtimeState'), 'runtime state');
    const runtimeRowBox = await getBox(page.locator('.toolbar-runtime-row'), 'runtime row');
    const copyRowBox = await getBox(page.locator('.toolbar-copy-row'), 'save-copy row');
    const actionRowBox = await getBox(page.locator('.toolbar-action-row'), 'transcribe row');
    const heroBox = await getBox(page.locator('header.hero'), 'hero');
    const heroActionsBox = await getBox(page.locator('.hero-actions'), 'hero actions');
    const statusCardBox = await getBox(page.locator('footer.footer'), 'status card');
    const gridBox = await getBox(page.locator('.grid'), 'content grid');
    const dropZoneBox = await getBox(page.locator('#dropZone'), 'drop zone');
    const recordCardBox = await getBox(page.locator('.source-record'), 'record card');
    const downloadRowBox = await getBox(page.locator('.download-row'), 'download row');
    const transcriptRowsBox = await getBox(page.locator('.transcript-rows'), 'transcript rows');

    expect(runtimeButtonBox.y).toBeGreaterThanOrEqual(runtimeRowBox.y - 2);
    expect(runtimeStateBox.y).toBeGreaterThanOrEqual(runtimeRowBox.y - 2);
    expect(runtimeButtonBox.y + runtimeButtonBox.height).toBeLessThanOrEqual(runtimeRowBox.y + runtimeRowBox.height + 2);
    expect(runtimeStateBox.y + runtimeStateBox.height).toBeLessThanOrEqual(runtimeRowBox.y + runtimeRowBox.height + 2);
    expect(runtimeStateBox.x).toBeGreaterThan(runtimeButtonBox.x);
    expect(copyRowBox.y).toBeGreaterThan(runtimeButtonBox.y + runtimeButtonBox.height - 2);
    expect(actionRowBox.y).toBeGreaterThan(copyRowBox.y + copyRowBox.height - 2);
    if (viewport.width > 640) {
      expect(heroActionsBox.x + heroActionsBox.width / 2).toBeGreaterThan(heroBox.x + heroBox.width * 0.55);
    }
    expect(statusCardBox.y).toBeGreaterThan(runtimeRowBox.y + runtimeRowBox.height - 2);
    expect(statusCardBox.y + statusCardBox.height).toBeLessThanOrEqual(gridBox.y + 2);
    expect(downloadRowBox.y).toBeLessThan(transcriptRowsBox.y);

    const narrowViewport = viewport.width < 980 || viewport.height > viewport.width;
    if (narrowViewport) {
      expect(recordCardBox.y).toBeGreaterThan(dropZoneBox.y + dropZoneBox.height - 2);
    } else {
      expect(recordCardBox.x).toBeGreaterThan(dropZoneBox.x + dropZoneBox.width * 0.35);
      expect(Math.abs(recordCardBox.y - dropZoneBox.y)).toBeLessThan(12);
    }
  });
}
