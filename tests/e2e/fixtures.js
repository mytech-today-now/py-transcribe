import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    await page.addInitScript(() => {
      const state = window.__pyTranscribeRuntimeErrors || (window.__pyTranscribeRuntimeErrors = []);
      window.addEventListener('error', (event) => {
        if (event?.error instanceof Error) {
          state.push(`${event.error.name}: ${event.error.message}`);
        } else if (event?.message) {
          state.push(String(event.message));
        }
      });
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event?.reason;
        if (reason instanceof Error) {
          state.push(`${reason.name}: ${reason.message}`);
        } else if (reason && typeof reason.message === 'string') {
          state.push(reason.message);
        } else {
          state.push(String(reason || 'Unhandled rejection'));
        }
      });
    });

    await use([]);

    const runtimeErrors = await page.evaluate(() => window.__pyTranscribeRuntimeErrors || []);
    expect(runtimeErrors, 'runtime errors').toEqual([]);
  }, { auto: true }]
});

export { expect };
