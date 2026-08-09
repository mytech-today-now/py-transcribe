import { test, expect } from './fixtures.js';
import {
  createAudioFile,
  installLocalAiRoutes,
  loadRuntime,
  openApp,
  selectFilesViaButton,
  transcribeCurrentFile
} from './helpers.js';

test.describe('Local AI summary flows', () => {
  test('integration: auto-downloads the latest Kimi model on desktop and chats against the transcript', async ({ page }) => {
    const requests = await installLocalAiRoutes(page, {
      models: [],
      pullDelayMs: 250
    });

    await openApp(page, { localAiAutoDownload: true });
    await expect.poll(() => requests.pull.length).toBe(1);
    expect(requests.pull[0].postData?.model).toBe('kimi-k3:cloud');
    await expect(page.locator('#aiState')).toContainText(/model ready/i);
    await expect(page.locator('#aiModelMeta')).toContainText(/installed model/i);
    await expect(page.locator('#checkAiButton')).toHaveText(/refresh local ai/i);

    await selectFilesViaButton(page, [createAudioFile({ name: 'summary-demo.wav' })]);
    await expect(page.locator('#summarizeButton')).toBeDisabled();

    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#summarizeButton')).toBeEnabled();
    await page.locator('#summaryDetailDetailed').check();
    await page.locator('#summarizeButton').click();

    await expect(page.locator('#summaryPanel')).toBeVisible();
    await expect(page.locator('#summaryPanelTitle')).toHaveText('Local AI summary');
    await expect(page.locator('#summaryContent')).toContainText('Local summary.');
    await expect(page.locator('#summaryContent')).toContainText('Action item.');
    await expect(page.locator('#summaryMeta')).toContainText('Detailed detail');
    await expect.poll(() => requests.chat.length).toBe(1);

    await page.locator('#chatInput').fill('What action items were mentioned?');
    await page.locator('#chatSendButton').click();

    await expect(page.locator('#chatHistory')).toContainText('Action item.');
    await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
    await expect.poll(() => requests.chat.length).toBe(2);

    expect(requests.chat[1].postData.messages[0].content).toContain('Treat the transcript and summary below as immutable context');
    expect(requests.chat[1].postData.messages[0].content).toContain('Transcript summary:');
    expect(requests.chat[1].postData.messages.at(-1).content).toBe('What action items were mentioned?');
  });

  test('regression: recognizes Ollama on the local loopback even when the PHP proxy returns 500', async ({ page }) => {
    const requests = await installLocalAiRoutes(page, {
      models: [
        {
          name: 'rubenftenorio/kimi-k25-local',
          details: { family: 'Kimi', parameter_size: '2.5B' }
        }
      ],
      proxyTagsStatus: 500
    });

    await openApp(page);
    await expect(page.locator('#aiState')).toContainText(/model ready/i);
    await expect(page.locator('#aiModelMeta')).toContainText(/installed model/i);
    expect(requests.tags).toHaveLength(1);
    expect(requests.tags[0].kind).toBe('direct');
    expect(requests.tags[0].url).toContain('/api/tags');
  });

  test('integration: persists a generated summary and chats against the saved transcript context', async ({ page }) => {
    const requests = await installLocalAiRoutes(page, {
      models: [
        {
          name: 'rubenftenorio/kimi-k25-local',
          details: { family: 'Kimi', parameter_size: '2.5B' }
        }
      ]
    });

    await openApp(page);
    await expect(page.locator('#aiState')).toContainText(/model ready/i);

    await selectFilesViaButton(page, [createAudioFile({ name: 'summary-demo.wav' })]);
    await expect(page.locator('#summarizeButton')).toBeDisabled();

    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#summarizeButton')).toBeEnabled();
    await page.locator('#summaryDetailDetailed').check();
    await page.locator('#summarizeButton').click();

    await expect(page.locator('#summaryPanel')).toBeVisible();
    await expect(page.locator('#summaryPanelTitle')).toHaveText('Local AI summary');
    await expect(page.locator('#summaryContent')).toContainText('Local summary.');
    await expect(page.locator('#summaryContent')).toContainText('Action item.');
    await expect(page.locator('#summaryMeta')).toContainText('Detailed detail');
    await expect.poll(() => requests.chat.length).toBe(1);

    await page.reload();
    await expect(page.locator('#summaryPanel')).toBeVisible();
    await expect(page.locator('#summaryMeta')).toContainText('Model: rubenftenorio/kimi-k25-local');
    await expect(page.locator('#chatPanel')).toBeVisible();
    await expect(page.locator('#chatStatus')).toContainText(/ask a follow-up question/i);

    await page.locator('#chatInput').fill('What action items were mentioned?');
    await page.locator('#chatSendButton').click();

    await expect(page.locator('#chatHistory')).toContainText('Action item.');
    await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
    await expect.poll(() => requests.chat.length).toBe(2);

    expect(requests.chat[1].postData).not.toBeNull();
    expect(requests.chat[1].postData.messages[0].content).toContain('Treat the transcript and summary below as immutable context');
    expect(requests.chat[1].postData.messages[0].content).toContain('Transcript summary:');
    expect(requests.chat[1].postData.messages.at(-1).content).toBe('What action items were mentioned?');
  });

  test('edge: keeps summarization disabled until a transcript exists', async ({ page }) => {
    await installLocalAiRoutes(page, {
      models: [
        {
          name: 'huihui_ai/kimi-k2',
          details: { family: 'Kimi', parameter_size: '2B' }
        }
      ]
    });

    await openApp(page);
    await expect(page.locator('#aiState')).toContainText(/model ready/i);

    await selectFilesViaButton(page, [createAudioFile({ name: 'edge-case.wav' })]);
    await expect(page.locator('#summarizeButton')).toBeDisabled();

    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#summarizeButton')).toBeEnabled();
  });

  test('e2e: downloads the selected Kimi variant from the model picker', async ({ page }) => {
    const requests = await installLocalAiRoutes(page, {
      models: [],
      pullDelayMs: 250
    });

    await openApp(page, { localAiAutoDownload: false });
    await expect(page.locator('#aiModelMeta')).toContainText(/kimi-k3:cloud is not installed yet/i);

    await page.locator('#aiModelSelect').selectOption('rubenftenorio/kimi-k25-local');
    await expect(page.locator('#checkAiButton')).toHaveText(/download selected model/i);

    await page.locator('#checkAiButton').click();
    await expect(page.locator('#aiProgress')).toBeVisible();
    await expect(page.locator('#aiState')).toContainText(/model ready/i);
    await expect(page.locator('#aiModelMeta')).toContainText(/installed model/i);
    await expect(page.locator('#checkAiButton')).toHaveText(/refresh local ai/i);
    await expect.poll(() => requests.pull.length).toBe(1);
  });

  test('regression: marks a generated summary and chat session stale after the transcript changes', async ({ page }) => {
    const requests = await installLocalAiRoutes(page, {
      models: [
        {
          name: 'rubenftenorio/kimi-k25-local',
          details: { family: 'Kimi', parameter_size: '2.5B' }
        }
      ]
    });

    await openApp(page);
    await selectFilesViaButton(page, [createAudioFile({ name: 'stale-summary.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);
    await page.locator('#summarizeButton').click();

    await expect(page.locator('#summaryPanel')).toBeVisible();

    await page.locator('#chatInput').fill('What should I follow up on?');
    await page.locator('#chatSendButton').click();
    await expect(page.locator('#chatHistory')).toContainText('Action item.');

    await page.locator('#transcriptEditor').fill('Transcript from local Whisper\nUpdated after review.');

    await expect(page.locator('#summaryPanelTitle')).toHaveText('Summary out of date');
    await expect(page.locator('#summaryMeta')).toContainText('Transcript changed since this summary was generated.');
    await expect(page.locator('#chatPanelTitle')).toHaveText('Chat session out of date');
    await expect(page.locator('#chatStatus')).toContainText(/out of date/i);
    await expect(page.locator('#chatSendButton')).toBeDisabled();
    await expect(page.locator('#chatNewSessionButton')).toBeDisabled();

    await page.locator('#summarizeButton').click();
    await expect(page.locator('#summaryPanelTitle')).toHaveText('Local AI summary');
    await expect(page.locator('#summaryMeta')).not.toContainText('Transcript changed since this summary was generated.');
    await expect(page.locator('#chatPanelTitle')).toHaveText('Chat session out of date');
    await expect(page.locator('#chatNewSessionButton')).toBeEnabled();

    await page.locator('#chatNewSessionButton').click();
    await expect(page.locator('#chatPanelTitle')).toHaveText('Local transcript chat');
    await expect(page.locator('#chatStatus')).toContainText(/ask a follow-up question/i);

    await page.locator('#chatInput').fill('What changed after review?');
    await page.locator('#chatSendButton').click();
    await expect(page.locator('#chatHistory')).toContainText('Action item.');
    await expect.poll(() => requests.chat.length).toBe(4);
  });
});
