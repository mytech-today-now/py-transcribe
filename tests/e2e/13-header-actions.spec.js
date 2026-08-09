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

const mockReadmeHtml = `
  <article class="markdown-body">
    <h1>py-transcribe</h1>
    <p>Browser-first transcription studio for shared hosting.</p>
    <p>Rendered <strong>Markdown</strong> and <em>HTML</em> stay styled.</p>
    <blockquote>Local model inference runs in the browser.</blockquote>
    <pre><code>npm run build</code></pre>
  </article>
`;

async function mockReadmeRequest(page) {
  await page.route(/api\.github\.com\/repos\/mytech-today-now\/py-transcribe\/readme/i, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      headers: {
        'access-control-allow-origin': '*'
      },
      body: mockReadmeHtml
    });
  });
}

for (const viewport of viewportMatrix) {
  test(`opens the promo and README views in ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockReadmeRequest(page);
    await openApp(page);

    const promoButton = page.locator('#promoButton');
    const readmeButton = page.locator('#readmeButton');

    await expect(promoButton).toBeVisible();
    await expect(readmeButton).toBeVisible();

    await promoButton.click();
    await expect(page.locator('#promoDialog')).toHaveAttribute('open', '');
    await expect(page.locator('#promoDialog .promo-funnel')).toHaveCount(1);
    await expect(page.locator('#promoDialog .promo-step')).toHaveCount(3);
    await expect(page.getByRole('link', { name: /Visit myTech\.Today/i })).toHaveAttribute('href', 'https://mytech.today');

    await page.locator('#promoDialog .sheet-dialog-close').click();
    await expect(page.locator('#promoDialog')).not.toHaveAttribute('open', '');

    await readmeButton.click();
    await expect(page.locator('#readmeDialog')).toHaveAttribute('open', '');
    await expect(page.locator('#readmeStatus')).toContainText(/Rendered from GitHub as HTML/i);
    await expect(page.locator('#readmeContent')).toBeVisible();
    await expect(page.locator('#readmeContent h1')).toHaveText('py-transcribe');
    await expect(page.locator('#readmeContent strong')).toHaveText('Markdown');
    await expect(page.locator('#readmeContent em')).toHaveText('HTML');
    await expect(page.locator('#readmeContent pre code')).toHaveText('npm run build');
    await expect(page.getByRole('link', { name: /Open source README/i })).toHaveAttribute(
      'href',
      'https://github.com/mytech-today-now/py-transcribe/blob/main/readme.md'
    );
  });
}
