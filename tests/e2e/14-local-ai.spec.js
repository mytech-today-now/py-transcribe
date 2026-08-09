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
  test('integration: falls back to browser WASM when Ollama is CORS-blocked, then summarizes and chats locally', async ({ page }) => {
    const requests = await installLocalAiRoutes(page, {
      models: [],
      proxyTagsStatus: 500,
      directCors: false
    });

    await openApp(page);

    await expect(page.locator('#aiRuntimeSelect')).toHaveValue('auto');
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/auto mode checks local ollama first/i);
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/last successful runtime: browser wasm/i);
    await expect(page.locator('#aiState')).toContainText(/browser model ready/i);
    await expect(page.locator('#checkAiButton')).toHaveText(/refresh browser model/i);
    expect(requests.tags.map((request) => request.kind)).toEqual(['proxy', 'direct']);

    await selectFilesViaButton(page, [createAudioFile({ name: 'browser-fallback.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#summarizeButton')).toBeEnabled();
    await page.locator('#summaryDetailDetailed').check();
    await page.locator('#summarizeButton').click();

    await expect(page.locator('#summaryPanel')).toBeVisible();
    await expect(page.locator('#summaryPanelTitle')).toHaveText('Local AI summary');
    await expect(page.locator('#summaryContent')).toContainText('Browser summary.');
    await expect(page.locator('#summaryContent')).toContainText('Action item.');
    await expect(page.locator('#summaryMeta')).toContainText('Kimi/Opus Distill 2B');

    await page.locator('#chatInput').fill('What action items were mentioned?');
    await page.locator('#chatSendButton').click();

    await expect(page.locator('#chatHistory')).toContainText('Browser reply.');
    await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);

    const browserState = await page.evaluate(() => window.__pyTranscribeTestState.browserAi);
    expect(browserState.loadCalls).toBeGreaterThan(0);
    expect(browserState.summarizeCalls).toBe(1);
    expect(browserState.chatCalls).toBe(1);
  });

  test('regression: persists the selected runtime mode across reloads', async ({ page }) => {
    await openApp(page);

    await expect(page.locator('#aiRuntimeSelect')).toHaveValue('auto');

    await page.locator('#aiRuntimeSelect').selectOption('browser');
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/browser-only mode/i);
    await expect(page.locator('#aiState')).toContainText(/browser model ready/i);

    await page.reload();
    await expect(page.locator('#aiRuntimeSelect')).toHaveValue('browser');
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/browser-only mode/i);
    await expect(page.locator('#aiState')).toContainText(/browser model ready/i);

    await page.locator('#aiRuntimeSelect').selectOption('local');
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/local-only mode/i);

    await page.reload();
    await expect(page.locator('#aiRuntimeSelect')).toHaveValue('local');
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/local-only mode/i);
  });

  test('regression: auto-selects the strongest installed Ollama model when the saved model is missing', async ({ page }) => {
    const requests = await installLocalAiRoutes(page, {
      models: [
        {
          name: 'acme/kimi-small',
          details: {
            family: 'Kimi',
            parameter_size: '2B',
            quantization_level: 'Q4_K_M'
          },
          size: 1_000_000_000
        },
        {
          name: 'acme/kimi-large',
          details: {
            family: 'Kimi',
            parameter_size: '7B',
            quantization_level: 'Q5_K_M'
          },
          size: 5_000_000_000
        }
      ],
      directCors: true
    });

    await openApp(page, {
      initialSettings: {
        localAiModelName: 'missing-model'
      }
    });

    await expect(page.locator('#aiState')).toContainText(/model ready/i);
    await expect(page.locator('#aiModelSelect')).toHaveValue('acme/kimi-large');
    await expect(page.locator('#aiModelMeta')).toContainText(/auto-selected via the ranking heuristic/i);
    expect(requests.tags[0].kind).toBe('proxy');
    expect(requests.tags[0].url).toContain('/api/ollama/tags.php');
  });

  test('integration: auto-downloads the latest Kimi model on desktop and chats against the transcript', async ({ page }) => {
    const requests = await installLocalAiRoutes(page, {
      models: [],
      pullDelayMs: 250
    });

    await openApp(page, { localAiAutoDownload: true });
    await expect.poll(() => requests.pull.length).toBe(1);
    expect(requests.pull[0].kind).toBe('proxy');
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
    expect(requests.chat[0].kind).toBe('proxy');

    await page.locator('#chatInput').fill('What action items were mentioned?');
    await page.locator('#chatSendButton').click();

    await expect(page.locator('#chatHistory')).toContainText('Action item.');
    await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
    await expect.poll(() => requests.chat.length).toBe(2);

    expect(requests.chat[1].postData.messages[0].content).toContain('Treat the transcript and summary below as immutable context');
    expect(requests.chat[1].postData.messages[0].content).toContain('Transcript summary:');
    expect(requests.chat[1].postData.messages.at(-1).content).toBe('What action items were mentioned?');
  });

  test('regression: falls back from the PHP bridge to loopback when the bridge returns 500', async ({ page }) => {
    const requests = await installLocalAiRoutes(page, {
      models: [
        {
          name: 'rubenftenorio/kimi-k25-local',
          details: { family: 'Kimi', parameter_size: '2.5B' }
        }
      ],
      proxyTagsStatus: 500,
      directCors: true
    });

    await openApp(page);
    await expect(page.locator('#aiState')).toContainText(/model ready/i);
    await expect(page.locator('#aiModelMeta')).toContainText(/installed model/i);
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/ollama endpoint: http:\/\/127\.0\.0\.1:11434/i);
    expect(requests.tags.map((request) => request.kind)).toEqual(['proxy', 'direct']);
    expect(requests.tags[0].url).toContain('/api/ollama/tags.php');
    expect(requests.tags[1].url).toContain('/api/tags');
  });

  test('regression: persists the selected Ollama model, summary, and runtime metadata across reloads', async ({ page }) => {
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
    await expect(page.locator('#aiModelSelect')).toHaveValue('rubenftenorio/kimi-k25-local');
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/same-origin PHP bridge/i);
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/last successful runtime: local ollama/i);
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

    await openApp(page, {
      localAiAutoDownload: false,
      initialSettings: {
        localAiRuntimeMode: 'local'
      }
    });
    await expect(page.locator('#aiModelMeta')).toContainText(/kimi-k3:cloud is not installed yet/i);

    await page.locator('#aiModelSelect').selectOption('rubenftenorio/kimi-k25-local');
    await expect(page.locator('#checkAiButton')).toHaveText(/download selected model/i);

    await page.locator('#checkAiButton').click();
    await expect(page.locator('#aiProgress')).toBeVisible();
    await expect(page.locator('#aiState')).toContainText(/model ready/i);
    await expect(page.locator('#aiModelMeta')).toContainText(/installed model/i);
    await expect(page.locator('#checkAiButton')).toHaveText(/refresh local ai/i);
    await expect.poll(() => requests.pull.length).toBe(1);
    expect(requests.pull[0].kind).toBe('proxy');
  });

  test('regression: bypasses Ollama entirely in browser-only mode', async ({ page }) => {
    const requests = await installLocalAiRoutes(page, {
      models: [
        {
          name: 'rubenftenorio/kimi-k25-local',
          details: { family: 'Kimi', parameter_size: '2.5B' }
        }
      ]
    });

    await openApp(page, {
      initialSettings: {
        localAiRuntimeMode: 'browser'
      }
    });

    await expect(page.locator('#aiRuntimeMeta')).toContainText(/browser-only mode/i);
    await expect(page.locator('#aiState')).toContainText(/browser model ready/i);
    expect(requests.tags).toHaveLength(0);
    expect(requests.pull).toHaveLength(0);
    expect(requests.chat).toHaveLength(0);

    const browserState = await page.evaluate(() => window.__pyTranscribeTestState.browserAi);
    expect(browserState.loadCalls).toBeGreaterThan(0);
  });

  test('regression: stays on Ollama and does not fall back to browser in local-only mode', async ({ page }) => {
    const requests = await installLocalAiRoutes(page, {
      models: [],
      proxyTagsStatus: 500,
      directCors: false
    });

    await openApp(page, {
      initialSettings: {
        localAiRuntimeMode: 'local'
      }
    });

    await expect(page.locator('#aiState')).toContainText(/ollama detected/i);
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/local-only mode/i);
    expect(requests.tags.map((request) => request.kind)).toEqual(['proxy', 'direct']);

    const browserState = await page.evaluate(() => window.__pyTranscribeTestState.browserAi);
    expect(browserState.loadCalls).toBe(0);
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
