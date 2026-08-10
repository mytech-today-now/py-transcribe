import { test, expect } from './fixtures.js';
import {
  AI_POWERED_NGROK_BASE_URL,
  buildAiPoweredSelectionKey
} from '../../web/lib/ai-powered.js';
import {
  createAudioFile,
  installAiPoweredRoutes,
  installLocalAiRoutes,
  loadRuntime,
  openApp,
  selectFilesViaButton,
  transcribeCurrentFile
} from './helpers.js';

test.describe('Local AI summary flows', () => {
  test('integration: uses the same-origin Ollama bridge before loopback candidates, then summarizes and chats locally', async ({ page }) => {
    const requests = await installLocalAiRoutes(page, {
      models: [
        {
          name: 'rubenftenorio/kimi-k25-local',
          details: { family: 'Kimi', parameter_size: '2.5B' }
        }
      ],
      directCors: false
    });

    await openApp(page);

    await expect(page.locator('#aiRuntimeSelect')).toHaveValue('auto');
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/auto mode checks local ollama first/i);
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/ollama endpoint: same-origin php bridge/i);
    await expect(page.locator('#aiState')).toContainText(/model ready/i);
    await expect(page.locator('#checkAiButton')).toHaveText(/refresh local ai/i);
    expect(requests.tags).toHaveLength(1);
    expect(requests.tags[0].kind).toBe('proxy');
    expect(requests.tags[0].url).toContain('/api/ollama/tags.php');

    await selectFilesViaButton(page, [createAudioFile({ name: 'browser-fallback.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#summarizeButton')).toBeEnabled();
    await page.locator('#summaryDetailDetailed').check({ force: true });
    await page.locator('#summarizeButton').click({ force: true });

    await expect(page.locator('#summaryPanel')).toBeVisible();
    await expect(page.locator('#summaryPanelTitle')).toHaveText('Local AI summary');
    await expect(page.locator('#summaryContent')).toContainText('Local summary.');
    await expect(page.locator('#summaryContent')).toContainText('Action item.');
    await expect(page.locator('#summaryMeta')).toContainText('Model: rubenftenorio/kimi-k25-local');

    await page.locator('#chatInput').fill('What action items were mentioned?');
    await page.locator('#chatSendButton').click({ force: true });

    await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
    await expect(page.locator('#chatHistory')).toContainText('Local summary.');
    expect(requests.chat).toHaveLength(2);
    expect(requests.chat.every((request) => request.kind === 'proxy')).toBe(true);

    const browserState = await page.evaluate(() => window.__pyTranscribeTestState.browserAi);
    expect(browserState.loadCalls).toBe(0);
  });

  test('integration: loads AI-Powered models from the same-origin bridge and uses them for summary and chat', async ({ page }) => {
    const requests = await installAiPoweredRoutes(page);

    await openApp(page, {
      initialSettings: {
        localAiRuntimeMode: 'ai-powered'
      }
    });

    await expect(page.locator('#aiRuntimeSelect')).toHaveValue('ai-powered');
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/ai-powered mode uses the local bridge/i);
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/ai-powered endpoint: same-origin php bridge/i);
    await expect(page.locator('#aiState')).toContainText(/ai-powered detected/i);
    await expect(page.locator('#aiModelLabel')).toHaveText('AI-Powered provider/model');
    await expect(page.locator('#aiModelSelect')).toHaveValue(buildAiPoweredSelectionKey({
      baseUrl: 'api/ai-powered',
      providerId: 'anthropic',
      modelId: 'anthropic/claude-sonnet-4'
    }));
    await expect(page.locator('#aiModelMeta')).toContainText(/Anthropic/i);
    await expect(page.locator('#aiModelMeta')).toContainText(/same-origin php bridge/i);
    await expect(page.locator('#checkAiButton')).toHaveText(/refresh ai-powered providers/i);
    expect(requests.health.some((request) => request.kind === 'proxy')).toBe(true);
    expect(requests.providers).toHaveLength(1);
    expect(requests.models).toHaveLength(2);
    expect(requests.providers[0].kind).toBe('proxy');
    expect(requests.models.every((request) => request.kind === 'proxy')).toBe(true);

    await selectFilesViaButton(page, [createAudioFile({ name: 'ai-powered.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#summarizeButton')).toBeEnabled();
    await page.locator('#summaryDetailDetailed').check({ force: true });
    await page.locator('#summarizeButton').click({ force: true });

    await expect(page.locator('#summaryPanel')).toBeVisible();
    await expect(page.locator('#summaryContent')).toContainText('AI-Powered summary.');
    await expect(page.locator('#summaryContent')).toContainText('Action item.');
    await expect(page.locator('#summaryMeta')).toContainText('Model: Claude Sonnet 4');

    await page.locator('#chatInput').fill('What action items were mentioned?');
    await page.locator('#chatSendButton').click({ force: true });

    await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
    await expect(page.locator('#chatHistory')).toContainText('AI-Powered reply.');
    expect(requests.stream).toHaveLength(2);
    expect(requests.stream[0].phase).toBe('summary');
    expect(requests.stream[1].phase).toBe('chat');
    expect(requests.stream.every((request) => request.kind === 'proxy' && request.postData.provider === 'anthropic')).toBe(true);

    const browserState = await page.evaluate(() => window.__pyTranscribeTestState.browserAi);
    expect(browserState.loadCalls).toBe(0);
  });

  test('integration: surfaces ngrok AI-Powered providers and can summarize/chat through the remote catalog', async ({ page }) => {
    const requests = await installAiPoweredRoutes(page, {
      ngrokHealthStatus: 200,
      ngrokModelsStatus: 200,
      ngrokStreamStatus: 200,
      ngrokModels: [
        {
          id: 'xai/grok-4',
          name: 'Grok 4',
          capabilities: ['text', 'structured'],
          providerId: 'xai',
          providerName: 'xAI / Grok'
        },
        {
          id: 'openrouter/qwen-3-coder',
          name: 'Qwen 3 Coder',
          capabilities: ['text'],
          providerId: 'openrouter',
          providerName: 'OpenRouter'
        }
      ],
      ngrokSummaryChunks: [
        'Ngrok summary.',
        '\n- Remote provider.',
        '\n- Action item.'
      ],
      ngrokChatChunks: [
        'Ngrok reply.',
        '\n- Remote provider.'
      ]
    });

    await openApp(page, {
      initialSettings: {
        localAiRuntimeMode: 'ai-powered'
      }
    });

    const groupLabels = await page.locator('#aiModelSelect optgroup').evaluateAll((groups) => groups.map((group) => group.label));
    expect(groupLabels).toEqual(expect.arrayContaining(['same-origin PHP bridge', 'ngrok tunnel']));
    await expect(page.locator('#aiModelSelect')).toContainText(/OpenRouter/i);
    await expect(page.locator('#aiModelSelect')).toContainText(/xAI \/ Grok/i);

    const remoteSelectionKey = buildAiPoweredSelectionKey({
      baseUrl: AI_POWERED_NGROK_BASE_URL,
      providerId: 'openrouter',
      modelId: 'openrouter/qwen-3-coder'
    });
    await page.locator('#aiModelSelect').selectOption(remoteSelectionKey);
    await expect(page.locator('#aiModelMeta')).toContainText(/OpenRouter/i);
    await expect(page.locator('#aiModelMeta')).toContainText(/ngrok tunnel/i);

    await selectFilesViaButton(page, [createAudioFile({ name: 'ngrok-ai-powered.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#summarizeButton')).toBeEnabled();
    await page.locator('#summaryDetailDetailed').check({ force: true });
    await page.locator('#summarizeButton').click({ force: true });

    await expect(page.locator('#summaryContent')).toContainText('Ngrok summary.');
    await expect(page.locator('#summaryMeta')).toContainText('Model: Qwen 3 Coder');

    await page.locator('#chatInput').fill('What remote provider was used?');
    await page.locator('#chatSendButton').click({ force: true });

    await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
    await expect(page.locator('#chatHistory')).toContainText('Ngrok reply.');
    expect(requests.providers.some((request) => request.source === 'ngrok tunnel')).toBe(true);
    expect(requests.models.some((request) => request.source === 'ngrok tunnel')).toBe(true);
    expect(requests.stream.some((request) => request.source === 'ngrok tunnel')).toBe(true);
    expect(requests.stream.every((request) => request.postData.provider === 'openrouter')).toBe(true);
  });

  test('integration: falls back to browser WASM when the Ollama bridge is unavailable, then summarizes and chats locally', async ({ page }) => {
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
    await expect(page.locator('#aiModelMeta')).toContainText(/browser model/i);
    await expect(page.locator('#checkAiButton')).toHaveText(/refresh browser model/i);
    expect(requests.tags.length).toBeGreaterThanOrEqual(4);
    expect(requests.tags.every((request) => request.kind === 'proxy')).toBe(true);

    await selectFilesViaButton(page, [createAudioFile({ name: 'browser-fallback.wav' })]);
    await loadRuntime(page);
    await transcribeCurrentFile(page);

    await expect(page.locator('#summarizeButton')).toBeEnabled();
    await page.locator('#summaryDetailDetailed').check({ force: true });
    await page.locator('#summarizeButton').click({ force: true });

    await expect(page.locator('#summaryPanel')).toBeVisible();
    await expect(page.locator('#summaryPanelTitle')).toHaveText('Local AI summary');
    await expect(page.locator('#summaryContent')).toContainText('Browser summary.');
    await expect(page.locator('#summaryContent')).toContainText('Action item.');
    await expect(page.locator('#summaryMeta')).toContainText('Kimi/Opus Distill 2B');

    await page.locator('#chatInput').fill('What action items were mentioned?');
    await page.locator('#chatSendButton').click({ force: true });

    await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
    await expect(page.locator('#chatHistory')).toContainText('Browser reply.');

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
    expect(requests.tags).toHaveLength(1);
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
    expect(requests.tags.length).toBeGreaterThanOrEqual(1);
    expect(requests.tags.every((request) => request.kind === 'proxy')).toBe(true);
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
    await page.locator('#summaryDetailDetailed').check({ force: true });
    await page.locator('#summarizeButton').click({ force: true });

    await expect(page.locator('#summaryPanel')).toBeVisible();
    await expect(page.locator('#summaryPanelTitle')).toHaveText('Local AI summary');
    await expect(page.locator('#summaryContent')).toContainText('Local summary.');
    await expect(page.locator('#summaryContent')).toContainText('Action item.');
    await expect(page.locator('#summaryMeta')).toContainText('Detailed detail');
    await expect.poll(() => requests.chat.length).toBe(1);
    expect(requests.chat[0].kind).toBe('proxy');

    await page.locator('#chatInput').fill('What action items were mentioned?');
    await page.locator('#chatSendButton').click({ force: true });

    await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
    await expect(page.locator('#chatHistory')).toContainText('Action item.');
    await expect.poll(() => requests.chat.length).toBe(2);

    expect(requests.chat[1].postData.messages[0].content).toContain('Treat the transcript and summary below as immutable context');
    expect(requests.chat[1].postData.messages[0].content).toContain('Transcript summary:');
    expect(requests.chat[1].postData.messages.at(-1).content).toBe('What action items were mentioned?');
  });

  test('regression: prefers loopback even when the PHP bridge is unhealthy', async ({ page }) => {
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
    await expect(page.locator('#aiModelMeta')).toContainText(/browser model/i);
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/ollama endpoint: same-origin php bridge/i);
    expect(requests.tags.length).toBeGreaterThanOrEqual(4);
    expect(requests.tags.every((request) => request.kind === 'proxy')).toBe(true);
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
    await page.locator('#summaryDetailDetailed').check({ force: true });
    await page.locator('#summarizeButton').click({ force: true });

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
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/ollama endpoint: same-origin php bridge/i);
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/last successful runtime: local ollama/i);
    await expect(page.locator('#chatPanel')).toBeVisible();
    await expect(page.locator('#chatStatus')).toContainText(/ask a follow-up question/i);

    await page.locator('#chatInput').fill('What action items were mentioned?');
    await page.locator('#chatSendButton').click({ force: true });

    await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
    await expect(page.locator('#chatHistory')).toContainText('Action item.');
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

    await expect(page.locator('#aiState')).toContainText(/local ai unavailable/i);
    await expect(page.locator('#aiRuntimeMeta')).toContainText(/local-only mode/i);
    expect(requests.tags.length).toBeGreaterThan(0);
    expect(requests.tags.every((request) => request.kind === 'proxy')).toBe(true);

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
    await page.locator('#summarizeButton').click({ force: true });

    await expect(page.locator('#summaryPanel')).toBeVisible();

    await page.locator('#chatInput').fill('What should I follow up on?');
    await page.locator('#chatSendButton').click({ force: true });
    await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
    await expect(page.locator('#chatHistory')).toContainText('Action item.');

    await page.locator('#transcriptEditor').fill('Transcript from local Whisper\nUpdated after review.');

    await expect(page.locator('#summaryPanelTitle')).toHaveText('Summary out of date');
    await expect(page.locator('#summaryMeta')).toContainText('Transcript changed since this summary was generated.');
    await expect(page.locator('#chatPanelTitle')).toHaveText('Chat session out of date');
    await expect(page.locator('#chatStatus')).toContainText(/out of date/i);
    await expect(page.locator('#chatSendButton')).toBeDisabled();
    await expect(page.locator('#chatNewSessionButton')).toBeDisabled();

    await page.locator('#summarizeButton').click({ force: true });
    await expect(page.locator('#summaryPanelTitle')).toHaveText('Local AI summary');
    await expect(page.locator('#summaryMeta')).not.toContainText('Transcript changed since this summary was generated.');
    await expect(page.locator('#chatPanelTitle')).toHaveText('Chat session out of date');
    await expect(page.locator('#chatNewSessionButton')).toBeEnabled();

    await page.locator('#chatNewSessionButton').click();
    await expect(page.locator('#chatPanelTitle')).toHaveText('Local transcript chat');
    await expect(page.locator('#chatStatus')).toContainText(/ask a follow-up question/i);

    await page.locator('#chatInput').fill('What changed after review?');
    await page.locator('#chatSendButton').click({ force: true });
    await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
    await expect(page.locator('#chatHistory')).toContainText('Action item.');
    await expect.poll(() => requests.chat.length).toBe(4);
  });
});
