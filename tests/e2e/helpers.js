import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect } from '@playwright/test';
import JSZip from 'jszip';

const DEFAULT_TRANSCRIPT_TEXT = 'Transcript from local Whisper';
const DEFAULT_OLLAMA_PULL_LINES = [
  { status: 'pulling manifest', total: 100, completed: 10 },
  { status: 'pulling manifest', total: 100, completed: 60 },
  { status: 'success', total: 100, completed: 100 }
];
const DEFAULT_OLLAMA_CHAT_LINES = [
  { message: { content: 'Local summary.' }, done: false },
  { message: { content: '\n- Main idea.' }, done: false },
  { message: { content: '\n- Action item.' }, done: true }
];
const DEFAULT_BROWSER_AI_SUMMARY_CHUNKS = [
  'Browser summary.',
  '\n- Main idea.',
  '\n- Action item.'
];
const DEFAULT_BROWSER_AI_CHAT_CHUNKS = [
  'Browser reply.',
  '\n- Action item.'
];

export function createAudioFile({
  name = 'sample.wav',
  durationSeconds = 1,
  sampleRate = 16_000
} = {}) {
  return {
    name,
    mimeType: 'audio/wav',
    buffer: createSilentWavBuffer(durationSeconds, sampleRate)
  };
}

export function createVideoFile({
  name = 'sample.mp4',
  mimeType = 'video/mp4',
  content = 'fake video payload'
} = {}) {
  return {
    name,
    mimeType,
    buffer: Buffer.from(content, 'utf8')
  };
}

export function createUnsupportedFile({
  name = 'notes.txt',
  mimeType = 'text/plain',
  content = 'plain text'
} = {}) {
  return {
    name,
    mimeType,
    buffer: Buffer.from(content, 'utf8')
  };
}

export function createEmptyAudioFile({
  name = 'empty.wav',
  mimeType = 'audio/wav'
} = {}) {
  return {
    name,
    mimeType,
    buffer: Buffer.alloc(0)
  };
}

export function withSpoofedSize(file, sizeOverride) {
  return {
    ...file,
    sizeOverride
  };
}

export async function openApp(page, options = {}) {
  await installAppHarness(page, options);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#loadRuntimeButton').waitFor({ state: 'visible', timeout: 20_000 });
}

export async function installLocalAiRoutes(page, {
  models = [],
  pullLines = DEFAULT_OLLAMA_PULL_LINES,
  chatLines = DEFAULT_OLLAMA_CHAT_LINES,
  pullDelayMs = 0,
  chatDelayMs = 0,
  tagsDelayMs = 0,
  proxyTagsStatus = 200,
  proxyPullStatus = 200,
  proxyChatStatus = 200,
  directCors = false
} = {}) {
  const requests = {
    tags: [],
    pull: [],
    chat: []
  };

  const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store'
  };

  const jsonHeaders = {
    ...corsHeaders,
    'content-type': 'application/json; charset=utf-8'
  };

  const ndjsonHeaders = {
    ...corsHeaders,
    'content-type': 'application/x-ndjson; charset=utf-8'
  };

  const directHeaders = directCors
    ? corsHeaders
    : {
        'cache-control': 'no-store'
      };

  const directJsonHeaders = {
    ...directHeaders,
    'content-type': 'application/json; charset=utf-8'
  };

  const directNdjsonHeaders = {
    ...directHeaders,
    'content-type': 'application/x-ndjson; charset=utf-8'
  };

  const fulfillPreflight = async (route, headers = corsHeaders) => {
    await route.fulfill({
      status: 204,
      headers,
      body: ''
    });
  };

  const fulfillJson = async (route, payload, headers = jsonHeaders) => {
    await route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify(payload)
    });
  };

  const fulfillNdjson = async (route, lines, headers = ndjsonHeaders) => {
    const body = `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
    await route.fulfill({
      status: 200,
      headers,
      body
    });
  };

  await page.route(/\/api\/tags(?:\?.*)?$/i, async (route, request) => {
    requests.tags.push({
      method: request.method(),
      url: request.url(),
      kind: 'direct'
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route, directCors ? corsHeaders : directHeaders);
      return;
    }

    if (tagsDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, tagsDelayMs));
    }

    await fulfillJson(route, { models }, directJsonHeaders);
  });

  await page.route(/\/api\/ollama\/tags\.php(?:\?.*)?$/i, async (route, request) => {
    requests.tags.push({
      method: request.method(),
      url: request.url(),
      kind: 'proxy'
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }

    if (proxyTagsStatus !== 200) {
      await route.fulfill({
        status: proxyTagsStatus,
        headers: jsonHeaders,
        body: JSON.stringify({
          ok: false,
          error: 'Ollama proxy unavailable.'
        })
      });
      return;
    }

    if (tagsDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, tagsDelayMs));
    }

    await fulfillJson(route, { models });
  });

  await page.route(/\/api\/pull(?:\?.*)?$/i, async (route, request) => {
    const payload = request.postDataJSON?.() ?? null;
    requests.pull.push({
      method: request.method(),
      url: request.url(),
      kind: 'direct',
      postData: payload
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route, directCors ? corsHeaders : directHeaders);
      return;
    }

    if (pullDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pullDelayMs));
    }

    await fulfillNdjson(route, pullLines, directNdjsonHeaders);

    const pulledModelName = String(payload?.model || '').trim();
    if (pulledModelName && !models.some((model) => String(model?.name || '').toLowerCase() === pulledModelName.toLowerCase())) {
      models.push({
        name: pulledModelName,
        details: {
          family: /kimi/i.test(pulledModelName) ? 'Kimi' : ''
        }
      });
    }
  });

  await page.route(/\/api\/ollama\/pull\.php(?:\?.*)?$/i, async (route, request) => {
    const payload = request.postDataJSON?.() ?? null;
    requests.pull.push({
      method: request.method(),
      url: request.url(),
      kind: 'proxy',
      postData: payload
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }

    if (proxyPullStatus !== 200) {
      await route.fulfill({
        status: proxyPullStatus,
        headers: jsonHeaders,
        body: JSON.stringify({
          ok: false,
          error: 'Ollama proxy unavailable.'
        })
      });
      return;
    }

    if (pullDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pullDelayMs));
    }

    await fulfillNdjson(route, pullLines);

    const pulledModelName = String(payload?.model || '').trim();
    if (pulledModelName && !models.some((model) => String(model?.name || '').toLowerCase() === pulledModelName.toLowerCase())) {
      models.push({
        name: pulledModelName,
        details: {
          family: /kimi/i.test(pulledModelName) ? 'Kimi' : ''
        }
      });
    }
  });

  await page.route(/\/api\/chat(?:\?.*)?$/i, async (route, request) => {
    requests.chat.push({
      method: request.method(),
      url: request.url(),
      kind: 'direct',
      postData: request.postDataJSON?.() ?? null
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route, directCors ? corsHeaders : directHeaders);
      return;
    }

    if (chatDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, chatDelayMs));
    }

    await fulfillNdjson(route, chatLines, directNdjsonHeaders);
  });

  await page.route(/\/api\/ollama\/chat\.php(?:\?.*)?$/i, async (route, request) => {
    requests.chat.push({
      method: request.method(),
      url: request.url(),
      kind: 'proxy',
      postData: request.postDataJSON?.() ?? null
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }

    if (proxyChatStatus !== 200) {
      await route.fulfill({
        status: proxyChatStatus,
        headers: jsonHeaders,
        body: JSON.stringify({
          ok: false,
          error: 'Ollama proxy unavailable.'
        })
      });
      return;
    }

    if (chatDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, chatDelayMs));
    }

    await fulfillNdjson(route, chatLines);
  });

  return requests;
}

export async function installAiPoweredRoutes(page, {
  models = [
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', capabilities: ['text', 'structured'] },
    { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', capabilities: ['text'] }
  ],
  ngrokModels = [],
  summaryChunks = [
    'AI-Powered summary.',
    '\n- Main idea.',
    '\n- Action item.'
  ],
  ngrokSummaryChunks = [
    'Ngrok summary.',
    '\n- Remote provider.',
    '\n- Action item.'
  ],
  chatChunks = [
    'AI-Powered reply.',
    '\n- Action item.'
  ],
  ngrokChatChunks = [
    'Ngrok reply.',
    '\n- Remote provider.',
    '\n- Action item.'
  ],
  healthDelayMs = 0,
  modelsDelayMs = 0,
  streamDelayMs = 0,
  ngrokHealthDelayMs = 0,
  ngrokModelsDelayMs = 0,
  ngrokStreamDelayMs = 0,
  healthStatus = 200,
  modelsStatus = 200,
  streamStatus = 200,
  ngrokHealthStatus = 502,
  ngrokModelsStatus = 502,
  ngrokStreamStatus = 502,
  allowLoopbackDirect = false
} = {}) {
  const requests = {
    health: [],
    providers: [],
    models: [],
    stream: []
  };

  const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store'
  };

  const jsonHeaders = {
    ...corsHeaders,
    'content-type': 'application/json; charset=utf-8'
  };

  const textHeaders = {
    ...corsHeaders,
    'content-type': 'text/plain; charset=utf-8'
  };

  const fulfillPreflight = async (route, headers = corsHeaders) => {
    await route.fulfill({
      status: 204,
      headers,
      body: ''
    });
  };

  const fulfillJson = async (route, payload, headers = jsonHeaders, status = 200) => {
    await route.fulfill({
      status,
      headers,
      body: JSON.stringify(payload)
    });
  };

  const fulfillText = async (route, body, headers = textHeaders, status = 200) => {
    await route.fulfill({
      status,
      headers,
      body
    });
  };

  const buildStreamBody = (chunks) => `${chunks.map((chunk) => `data: ${JSON.stringify({ text: chunk })}`).join('\n')}\n`;
  const normalizeText = (value) => String(value || '').trim();
  const titleCase = (value) => normalizeText(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
  const inferProviderId = (model) => {
    const explicit = normalizeText(model?.providerId || model?.provider || '');
    if (explicit) {
      return explicit;
    }

    const modelId = normalizeText(model?.id || '');
    return modelId.includes('/') ? normalizeText(modelId.split('/')[0]) : 'default';
  };
  const inferProviderName = (providerId, model) => normalizeText(model?.providerName || model?.provider_name || titleCase(providerId || 'Provider')) || 'Provider';

  const normalizeCatalogModels = (inputModels, { baseUrl, endpointLabel }) => {
    return (Array.isArray(inputModels) ? inputModels : []).map((model) => {
      const providerId = inferProviderId(model);
      const providerName = inferProviderName(providerId, model);
      const capabilities = Array.isArray(model?.capabilities)
        ? [...new Set(model.capabilities.map((entry) => normalizeText(entry).toLowerCase()).filter(Boolean))]
        : [];

      return {
        ...model,
        id: normalizeText(model?.id || ''),
        name: normalizeText(model?.name || model?.id || ''),
        capabilities,
        providerId,
        providerName,
        baseUrl,
        endpointLabel,
        selectionKey: `${baseUrl.toLowerCase()}|||${providerId.toLowerCase()}|||${normalizeText(model?.id || '').toLowerCase()}`
      };
    }).filter((model) => model.id && model.name);
  };

  const buildProviders = (catalogModels) => {
    const groups = new Map();

    for (const model of catalogModels) {
      const providerId = normalizeText(model.providerId || inferProviderId(model)).toLowerCase();
      if (!providerId) {
        continue;
      }

      const providerName = normalizeText(model.providerName || inferProviderName(providerId, model));
      const entry = groups.get(providerId) || {
        id: providerId,
        name: providerName,
        active: true,
        modalities: [],
        inputModalities: []
      };

      for (const capability of model.capabilities || ['text']) {
        if (!entry.modalities.includes(capability)) {
          entry.modalities.push(capability);
        }
      }

      groups.set(providerId, entry);
    }

    return Array.from(groups.values()).sort((left, right) => left.name.localeCompare(right.name));
  };

  const filterModels = (catalogModels, { providerId = '', modality = 'text' } = {}) => {
    const normalizedProviderId = normalizeText(providerId).toLowerCase();
    const normalizedModality = normalizeText(modality).toLowerCase();

    return catalogModels.filter((model) => {
      const modelProviderId = normalizeText(model.providerId || inferProviderId(model)).toLowerCase();
      if (normalizedProviderId && modelProviderId !== normalizedProviderId) {
        return false;
      }

      if (!normalizedModality) {
        return true;
      }

      if (!Array.isArray(model.capabilities) || model.capabilities.length === 0) {
        return normalizedModality === 'text';
      }

      return model.capabilities.includes(normalizedModality);
    });
  };

  const buildCatalog = ({
    baseUrl,
    endpointLabel,
    healthStatus: currentHealthStatus,
    modelsStatus: currentModelsStatus,
    streamStatus: currentStreamStatus,
    healthDelayMs: currentHealthDelayMs,
    modelsDelayMs: currentModelsDelayMs,
    streamDelayMs: currentStreamDelayMs,
    models: currentModels,
    summaryChunks: currentSummaryChunks,
    chatChunks: currentChatChunks
  }) => {
    const catalogModels = normalizeCatalogModels(currentModels, { baseUrl, endpointLabel });
    return {
      baseUrl,
      endpointLabel,
      healthStatus: currentHealthStatus,
      modelsStatus: currentModelsStatus,
      streamStatus: currentStreamStatus,
      healthDelayMs: currentHealthDelayMs,
      modelsDelayMs: currentModelsDelayMs,
      streamDelayMs: currentStreamDelayMs,
      providers: buildProviders(catalogModels),
      models: catalogModels,
      summaryChunks: Array.isArray(currentSummaryChunks) && currentSummaryChunks.length ? currentSummaryChunks : summaryChunks,
      chatChunks: Array.isArray(currentChatChunks) && currentChatChunks.length ? currentChatChunks : chatChunks
    };
  };

  const sameOriginCatalog = buildCatalog({
    baseUrl: 'api/ai-powered',
    endpointLabel: 'same-origin bridge',
    healthStatus,
    modelsStatus,
    streamStatus,
    healthDelayMs,
    modelsDelayMs,
    streamDelayMs,
    models,
    summaryChunks,
    chatChunks
  });

  const ngrokCatalog = buildCatalog({
    baseUrl: 'https://contorted-jarrod-supersecure.ngrok-free.dev',
    endpointLabel: 'ngrok tunnel',
    healthStatus: ngrokHealthStatus,
    modelsStatus: ngrokModelsStatus,
    streamStatus: ngrokStreamStatus,
    healthDelayMs: ngrokHealthDelayMs,
    modelsDelayMs: ngrokModelsDelayMs,
    streamDelayMs: ngrokStreamDelayMs,
    models: ngrokModels,
    summaryChunks: ngrokSummaryChunks,
    chatChunks: ngrokChatChunks
  });

  const proxyRoutePattern = /\/api\/ai-powered\/(health|providers|models|stream)\.php(?:\?.*)?$/i;
  const directRoutePattern = /(?:\/api)?\/(health|providers|models|stream)(?:\?.*)?$/i;

  const resolveCatalogForRequest = (request, { kind } = {}) => {
    const parsed = new URL(request.url());
    const upstream = String(parsed.searchParams.get('upstream') || '').trim().toLowerCase();

    if (kind === 'direct') {
      if (parsed.hostname.includes('ngrok-free.dev')) {
        return ngrokCatalog;
      }

      if (['127.0.0.1', 'localhost', '[::1]', '::1'].includes(parsed.hostname)) {
        return sameOriginCatalog;
      }
    }

    if (upstream === 'ngrok') {
      return ngrokCatalog;
    }

    return sameOriginCatalog;
  };

  const handleHealth = async (route, request, catalog, kind) => {
    requests.health.push({
      method: request.method(),
      url: request.url(),
      kind,
      source: catalog.endpointLabel
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }

    if (catalog.healthDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, catalog.healthDelayMs));
    }

    if (catalog.healthStatus !== 200) {
      await fulfillJson(route, {
        ok: false,
        error: 'AI-Powered bridge unavailable.'
      }, jsonHeaders, catalog.healthStatus);
      return;
    }

    await fulfillJson(route, {
      status: 'ok',
      service: 'ai-powered',
      source: catalog.endpointLabel
    });
  };

  const handleProviders = async (route, request, catalog, kind) => {
    requests.providers.push({
      method: request.method(),
      url: request.url(),
      kind,
      source: catalog.endpointLabel
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }

    if (catalog.healthStatus !== 200) {
      await fulfillJson(route, {
        ok: false,
        error: 'AI-Powered bridge unavailable.'
      }, jsonHeaders, catalog.healthStatus);
      return;
    }

    await fulfillJson(route, catalog.providers);
  };

  const handleModels = async (route, request, catalog, kind) => {
    const parsed = new URL(request.url());
    const providerId = parsed.searchParams.get('provider') || '';
    const modality = parsed.searchParams.get('modality') || 'text';
    requests.models.push({
      method: request.method(),
      url: request.url(),
      kind,
      source: catalog.endpointLabel,
      providerId,
      modality
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }

    if (catalog.modelsDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, catalog.modelsDelayMs));
    }

    if (catalog.modelsStatus !== 200) {
      await fulfillJson(route, {
        ok: false,
        error: 'AI-Powered bridge unavailable.'
      }, jsonHeaders, catalog.modelsStatus);
      return;
    }

    await fulfillJson(route, filterModels(catalog.models, { providerId, modality }));
  };

  const handleStream = async (route, request, catalog, kind) => {
    const payload = request.postDataJSON?.() ?? null;
    const prompt = String(payload?.prompt || '');
    const phase = /recent conversation:|transcript summary:/i.test(prompt) || requests.stream.length > 0
      ? 'chat'
      : 'summary';
    requests.stream.push({
      method: request.method(),
      url: request.url(),
      kind,
      source: catalog.endpointLabel,
      phase,
      postData: payload
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }

    if (catalog.streamDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, catalog.streamDelayMs));
    }

    if (catalog.streamStatus !== 200) {
      await fulfillText(route, 'AI-Powered stream unavailable.', textHeaders, catalog.streamStatus);
      return;
    }

    await fulfillText(route, buildStreamBody(phase === 'chat' ? catalog.chatChunks : catalog.summaryChunks));
  };

  await page.route(proxyRoutePattern, async (route, request) => {
    const catalog = resolveCatalogForRequest(request, { kind: 'proxy' });
    const endpoint = new URL(request.url()).pathname.split('/').pop() || '';

    if (endpoint.includes('health')) {
      await handleHealth(route, request, catalog, 'proxy');
      return;
    }

    if (endpoint.includes('providers')) {
      await handleProviders(route, request, catalog, 'proxy');
      return;
    }

    if (endpoint.includes('models')) {
      await handleModels(route, request, catalog, 'proxy');
      return;
    }

    await handleStream(route, request, catalog, 'proxy');
  });

  await page.route(directRoutePattern, async (route, request) => {
    const parsed = new URL(request.url());
    const isLoopback = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(parsed.hostname);
    const catalog = resolveCatalogForRequest(request, { kind: 'direct' });
    const endpoint = new URL(request.url()).pathname.split('/').pop() || '';

    if (isLoopback && !allowLoopbackDirect) {
      requests.health.push({
        method: request.method(),
        url: request.url(),
        kind: 'direct',
        source: 'loopback'
      });
      await route.fulfill({
        status: 502,
        headers: jsonHeaders,
        body: JSON.stringify({
          ok: false,
          error: 'Direct loopback access is disabled in this test harness.'
        })
      });
      return;
    }

    if (endpoint.includes('health')) {
      await handleHealth(route, request, catalog, 'direct');
      return;
    }

    if (endpoint.includes('providers')) {
      await handleProviders(route, request, catalog, 'direct');
      return;
    }

    if (endpoint.includes('models')) {
      await handleModels(route, request, catalog, 'direct');
      return;
    }

    await handleStream(route, request, catalog, 'direct');
  });

  return requests;
}

export async function installAppHarness(page, options = {}) {
  const {
    initialSettings,
    ...config
  } = {
    whisperMode: 'ready',
    pythonMode: 'ready',
    whisperLoadDelayMs: 0,
    pythonLoadDelayMs: 0,
    transcribeDelayMs: 0,
    renderDelayMs: 0,
    ffmpegLoadDelayMs: 0,
    ffmpegExecDelayMs: 0,
    browserAiMode: 'ready',
    browserAiLoadDelayMs: 0,
    browserAiSummaryChunks: DEFAULT_BROWSER_AI_SUMMARY_CHUNKS,
    browserAiChatChunks: DEFAULT_BROWSER_AI_CHAT_CHUNKS,
    browserStorageUsage: 0,
    browserStorageQuota: 8_000_000_000,
    localAiAutoDownload: false,
    transcriptText: DEFAULT_TRANSCRIPT_TEXT,
    allowRealServiceWorker: false,
    ...options
  };

  await page.addInitScript(({ config: injectedConfig, initialSettings: seededSettings }) => {
    window.__TRANSCRIBE_CONFIG__ = Object.assign(window.__TRANSCRIBE_CONFIG__ || {}, {
      ...injectedConfig
    });
    if (seededSettings && typeof seededSettings === 'object') {
      window.localStorage.setItem('py-transcribe:shared-hosting-state', JSON.stringify(seededSettings));
    }

    const state = window.__pyTranscribeTestState = {
      config: { ...injectedConfig },
      workers: [],
      workerMessages: [],
      browserAi: {
        loadCalls: 0,
        summarizeCalls: 0,
        chatCalls: 0,
        disposeCalls: 0,
        readyCalls: 0,
        activeModelIds: []
      },
      ffmpeg: {
        loadCalls: 0,
        execCalls: 0,
        terminateCalls: 0,
        writtenFiles: [],
        readFiles: []
      },
      downloads: []
    };

    const makeFloat32AudioBytes = (sampleCount = 16_000, sampleRate = 16_000) => {
      const samples = new Float32Array(sampleCount);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = Math.sin(index / 32) * 0.01;
      }

      return {
        sampleRate,
        bytes: new Uint8Array(samples.buffer.slice(0)),
        samples
      };
    };

    const emit = (listeners, type, event) => {
      for (const handler of listeners[type] || []) {
        handler(event);
      }
    };

    const schedule = (delay, callback) => window.setTimeout(callback, delay);
    const inferWorkerKind = (value) => {
      const text = String(value || '');
      let pathname = text;

      try {
        pathname = new URL(text, window.location.href).pathname;
      } catch {
        // Fall back to the raw string when the URL cannot be parsed.
      }

      if (pathname.includes('transcribe-worker')) {
        return 'whisper';
      }

      if (pathname.includes('python-worker')) {
        return 'python';
      }

      return 'unknown';
    };

    class FakeWorker {
      constructor(url, options = {}) {
        this.url = String(url);
        this.options = options;
        this.kind = inferWorkerKind(this.url);
        this.summary = {
          kind: this.kind,
          url: this.url,
          options: this.options
        };
        this.listeners = {
          message: [],
          error: [],
          messageerror: []
        };
        this.terminated = false;
        this.activeTranscribe = null;
        state.workers.push(this.summary);
      }

      addEventListener(type, handler) {
        if (this.listeners[type]) {
          this.listeners[type].push(handler);
        }
      }

      postMessage(message) {
        if (this.terminated) {
          throw new Error(`Worker already terminated: ${this.url}`);
        }

        state.workerMessages.push({
          kind: this.kind,
          message: { ...message }
        });

        queueMicrotask(() => this.#handleMessage(message));
      }

      terminate() {
        this.terminated = true;
      }

      #handleMessage(message) {
        if (this.terminated) {
          return;
        }

        if (message.type === 'init') {
          if (this.kind === 'unknown') {
            this.kind = message.modelId ? 'whisper' : 'python';
            this.summary.kind = this.kind;
          }

          const delayKey = this.kind === 'whisper' ? 'whisperLoadDelayMs' : 'pythonLoadDelayMs';
          const modeKey = this.kind === 'whisper' ? 'whisperMode' : 'pythonMode';
          schedule(Number(state.config[delayKey] || 0), () => {
            if (this.terminated) {
              return;
            }

            if (state.config[modeKey] === 'error') {
              const error = new Error(
                this.kind === 'whisper'
                  ? 'Whisper worker bootstrap failed.'
                  : 'Python worker bootstrap failed.'
              );
              emit(this.listeners, 'error', { message: error.message, error });
              return;
            }

            emit(this.listeners, 'message', {
              data: this.kind === 'whisper'
                ? {
                    id: message.id,
                    type: 'ready',
                    modelId: message.modelId,
                    device: message.device || 'wasm'
                  }
                : {
                    id: message.id,
                    type: 'ready'
                  }
            });
          });
          return;
        }

        if (message.type === 'render') {
          schedule(Number(state.config.renderDelayMs || 0), () => {
            if (this.terminated) {
              return;
            }

            const payload = message.payload || {};
            const baseText = String(payload.text || state.config.transcriptText || DEFAULT_TRANSCRIPT_TEXT).trim();
            const renderedText = payload.task === 'translate'
              ? `${baseText} (translated)`
              : baseText;
            const srt = [
              '1',
              '00:00:00,000 --> 00:00:01,000',
              renderedText
            ].join('\n');
            const vtt = [
              'WEBVTT',
              '',
              '00:00:00.000 --> 00:00:01.000',
              renderedText
            ].join('\n');

            emit(this.listeners, 'message', {
              data: {
                id: message.id,
                type: 'result',
                result: {
                  txt: renderedText,
                  srt,
                  vtt
                }
              }
            });
          });
          return;
        }

        if (message.type === 'transcribe') {
          const delay = Number(state.config.transcribeDelayMs || 0);
          const totalSeconds = Number(message.durationSeconds || 1);
          const progressPoints = [0.25, 0.5, 0.75, 1];
          const timerIds = [];
          const activeRequest = {
            id: message.id,
            cancelled: false,
            timerIds
          };

          this.activeTranscribe = activeRequest;

          for (const progress of progressPoints) {
            timerIds.push(schedule(delay * progress, () => {
              if (this.terminated || activeRequest.cancelled) {
                return;
              }

              emit(this.listeners, 'message', {
                data: {
                  type: 'progress',
                  phase: 'transcribe',
                  progress,
                  processedSeconds: Math.min(totalSeconds, totalSeconds * progress),
                  totalSeconds,
                  elapsedSeconds: delay * progress / 1000,
                  message: `Processed ${Math.round(progress * 100)}% of the audio.`
                }
              });
            }));
          }

          timerIds.push(schedule(delay, () => {
            if (this.terminated || activeRequest.cancelled) {
              return;
            }

            this.activeTranscribe = null;
            emit(this.listeners, 'message', {
              data: {
                id: message.id,
                type: 'result',
                result: {
                  text: state.config.transcriptText || DEFAULT_TRANSCRIPT_TEXT,
                  segments: [
                    {
                      start: 0,
                      end: Math.max(1, Math.min(1, totalSeconds || 1)),
                      text: state.config.transcriptText || DEFAULT_TRANSCRIPT_TEXT
                    }
                  ],
                  language: message.language || 'en',
                  processingSeconds: Math.max(0.25, delay / 1000)
                }
              }
            });
          }));
          return;
        }

        if (message.type === 'cancel') {
          const activeRequest = this.activeTranscribe;
          if (activeRequest) {
            activeRequest.cancelled = true;
            while (activeRequest.timerIds.length) {
              window.clearTimeout(activeRequest.timerIds.pop());
            }
            this.activeTranscribe = null;
            emit(this.listeners, 'message', {
              data: { type: 'status', message: 'Cancellation requested.' }
            });
            emit(this.listeners, 'message', {
              data: {
                id: activeRequest.id,
                type: 'error',
                error: {
                  name: 'Error',
                  message: 'Transcription cancelled.'
                }
              }
            });
            return;
          }

          emit(this.listeners, 'message', {
            data: { type: 'status', message: 'Cancellation requested.' }
          });
        }
      }
    }

    class FakeFFmpeg {
      constructor() {
        this.listeners = {
          log: [],
          progress: []
        };
        this.files = new Map();
      }

      on(type, handler) {
        if (this.listeners[type]) {
          this.listeners[type].push(handler);
        }
      }

      async load() {
        state.ffmpeg.loadCalls += 1;
        emit(this.listeners, 'log', { message: 'Fake FFmpeg loaded.' });
        const delay = Number(state.config.ffmpegLoadDelayMs || 0);
        if (delay > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, delay));
        }
      }

      async writeFile(name, data) {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        this.files.set(name, bytes);
        state.ffmpeg.writtenFiles.push(name);
      }

      async exec(args) {
        state.ffmpeg.execCalls += 1;
        emit(this.listeners, 'progress', { progress: 0.33 });
        emit(this.listeners, 'progress', { progress: 0.66 });
        emit(this.listeners, 'progress', { progress: 1 });
        const delay = Number(state.config.ffmpegExecDelayMs || 0);
        if (delay > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, delay));
        }

        const { bytes } = makeFloat32AudioBytes();
        this.files.set('audio.f32', bytes);
        return 0;
      }

      async readFile(name) {
        state.ffmpeg.readFiles.push(name);
        return this.files.get(name) || makeFloat32AudioBytes().bytes;
      }

      terminate() {
        state.ffmpeg.terminateCalls += 1;
      }
    }

    class FakeBrowserAiRuntime {
      constructor(model, { onStatus, onProgress, logger } = {}) {
        this.model = model;
        this.onStatus = onStatus;
        this.onProgress = onProgress;
        this.logger = logger;
        this.ready = false;
        this.disposed = false;
      }

      async ensureReady({ model = this.model, forceRefresh = false } = {}) {
        const selectedModel = model || this.model;
        if (!selectedModel) {
          throw new Error('No browser AI model is available.');
        }

        state.browserAi.loadCalls += 1;
        state.browserAi.activeModelIds.push(selectedModel.id);

        if (String(state.config.browserAiMode || 'ready') === 'error') {
          this.onStatus?.({
            phase: 'loading',
            model: selectedModel,
            message: `Loading browser model: ${selectedModel.label}`,
            detail: forceRefresh
              ? `Reloading ${selectedModel.label} into the browser runtime.`
              : `Loading ${selectedModel.label} into the browser runtime.`
          });
          throw new Error('Browser model loading failed.');
        }

        const progressSteps = Array.isArray(state.config.browserAiProgressSteps)
          ? state.config.browserAiProgressSteps
          : [25, 50, 100];

        this.onStatus?.({
          phase: 'loading',
          model: selectedModel,
          message: `Loading browser model: ${selectedModel.label}`,
          detail: forceRefresh
            ? `Reloading ${selectedModel.label} into the browser runtime.`
            : `Loading ${selectedModel.label} into the browser runtime.`
        });

        for (const progress of progressSteps) {
          this.onProgress?.({
            phase: 'loading',
            model: selectedModel,
            loaded: progress,
            total: 100,
            progress,
            message: `Loading ${selectedModel.label}... (${progress}%)`
          });
        }

        const delay = Number(state.config.browserAiLoadDelayMs || 0);
        if (delay > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, delay));
        }

        this.ready = true;
        state.browserAi.readyCalls += 1;
        this.onStatus?.({
          phase: 'ready',
          model: selectedModel,
          message: `Using browser model: ${selectedModel.label}`,
          detail: selectedModel.note || 'Browser WASM runtime ready.'
        });

        return {
          model: selectedModel,
          cached: true
        };
      }

      async summarize({
        transcriptText,
        detailLevel,
        model = this.model,
        signal,
        onChunk
      } = {}) {
        const selectedModel = model || this.model;
        if (!this.ready) {
          await this.ensureReady({ model: selectedModel, signal });
        }

        state.browserAi.summarizeCalls += 1;

        const chunks = Array.isArray(state.config.browserAiSummaryChunks)
          ? state.config.browserAiSummaryChunks
          : DEFAULT_BROWSER_AI_SUMMARY_CHUNKS;
        let summary = '';

        for (const chunk of chunks) {
          if (signal?.aborted) {
            throw new Error('AbortError');
          }

          summary += chunk;
          onChunk?.(summary, {
            choices: [
              {
                delta: {
                  content: chunk
                }
              }
            ]
          });
        }

        return {
          summary,
          preparedTranscript: {
            text: String(transcriptText || '').trim(),
            truncated: false,
            omittedChars: 0,
            warning: ''
          },
          levelKey: String(detailLevel || 'standard'),
          detail: ''
        };
      }

      async chat({
        transcriptText,
        summaryText,
        history = [],
        userMessage,
        model = this.model,
        signal,
        onChunk
      } = {}) {
        const selectedModel = model || this.model;
        if (!this.ready) {
          await this.ensureReady({ model: selectedModel, signal });
        }

        state.browserAi.chatCalls += 1;

        const chunks = Array.isArray(state.config.browserAiChatChunks)
          ? state.config.browserAiChatChunks
          : DEFAULT_BROWSER_AI_CHAT_CHUNKS;
        let reply = '';

        for (const chunk of chunks) {
          if (signal?.aborted) {
            throw new Error('AbortError');
          }

          reply += chunk;
          onChunk?.(reply, {
            choices: [
              {
                delta: {
                  content: chunk
                }
              }
            ]
          });
        }

        return {
          reply,
          preparedTranscript: {
            text: String(transcriptText || '').trim(),
            truncated: false,
            omittedChars: 0,
            warning: ''
          },
          preparedSummary: {
            text: String(summaryText || '').trim(),
            truncated: false,
            omittedChars: 0,
            warning: ''
          },
          history: Array.isArray(history) ? history : [],
          userMessage: String(userMessage || '')
        };
      }

      async dispose() {
        this.disposed = true;
        state.browserAi.disposeCalls += 1;
      }
    }

    class FakeMediaRecorder {
      constructor(stream, options = {}) {
        this.stream = stream;
        this.mimeType = options.mimeType || 'audio/webm';
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onerror = null;
        this.onstop = null;
      }

      static isTypeSupported() {
        return true;
      }

      start() {
        this.state = 'recording';
      }

      stop() {
        if (this.state === 'inactive') {
          return;
        }

        this.state = 'inactive';
        queueMicrotask(() => {
          if (typeof this.ondataavailable === 'function') {
            this.ondataavailable({
              data: new Blob([new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])], { type: this.mimeType })
            });
          }

          if (typeof this.onstop === 'function') {
            this.onstop();
          }
        });
      }
    }

    const fakeRecordingStream = {
      getTracks: () => [{
        stop: () => {}
      }]
    };

    try {
      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: FakeMediaRecorder
      });
    } catch {
      window.MediaRecorder = FakeMediaRecorder;
    }

    try {
      Object.defineProperty(window.navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => fakeRecordingStream
        }
      });
    } catch {
      window.navigator.mediaDevices = {
        getUserMedia: async () => fakeRecordingStream
      };
    }

    window.__PY_TRANSCRIBE_TEST_HOOKS__ = {
      createBrowserAiRuntime: ({ model, onStatus, onProgress, logger }) => new FakeBrowserAiRuntime(model, {
        onStatus,
        onProgress,
        logger
      }),
      createFFmpeg: () => new FakeFFmpeg(),
      fetchFile: async (file) => new Uint8Array(await file.arrayBuffer()),
      getJSZip: undefined,
      toBlobURL: async (value) => String(value)
    };

    window.Worker = FakeWorker;

    if (window.navigator?.serviceWorker && !state.config.allowRealServiceWorker) {
      try {
        Object.defineProperty(window.navigator.serviceWorker, 'register', {
          configurable: true,
          value: async () => ({
            active: null,
            installing: null,
            waiting: null,
            update: async () => {}
          })
        });
      } catch {
        // Ignore read-only service worker registration overrides.
      }
    }

    if (window.navigator?.storage?.persist && !state.config.allowRealServiceWorker) {
      try {
        Object.defineProperty(window.navigator.storage, 'persist', {
          configurable: true,
          value: async () => true
        });
      } catch {
        // Ignore read-only storage persistence overrides.
      }
    }

    try {
      const storageEstimate = async () => ({
        usage: Number(state.config.browserStorageUsage || 0),
        quota: Number(state.config.browserStorageQuota || 0)
      });

      if (window.navigator.storage) {
        Object.defineProperty(window.navigator.storage, 'estimate', {
          configurable: true,
          value: storageEstimate
        });
      } else {
        Object.defineProperty(window.navigator, 'storage', {
          configurable: true,
          value: {
            estimate: storageEstimate,
            persist: async () => true
          }
        });
      }
    } catch {
      // Ignore storage quota override failures.
    }
  }, { config, initialSettings });
}

export async function selectFilesViaButton(page, fileDescriptors) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#dropZone').click({ force: true });
  const chooser = await chooserPromise;
  await chooser.setFiles(fileDescriptors.map((descriptor) => ({
    ...descriptor,
    buffer: Buffer.isBuffer(descriptor.buffer)
      ? descriptor.buffer
      : Buffer.from(new Uint8Array(descriptor.buffer))
  })));
}

export async function dropFiles(page, selector, fileDescriptors) {
  const dataTransfer = await page.evaluateHandle(({ files }) => {
    const transfer = new DataTransfer();
    for (const descriptor of files) {
      const bytes = Array.isArray(descriptor.bytes)
        ? new Uint8Array(descriptor.bytes)
        : descriptor.buffer
          ? new Uint8Array(descriptor.buffer)
          : new Uint8Array();
      const blob = new Blob([bytes], { type: descriptor.mimeType || 'application/octet-stream' });
      const fileObject = new File([blob], descriptor.name, {
        type: descriptor.mimeType || 'application/octet-stream',
        lastModified: descriptor.lastModified || Date.now()
      });

      if (Number.isFinite(descriptor.sizeOverride)) {
        Object.defineProperty(fileObject, 'size', {
          configurable: true,
          value: descriptor.sizeOverride
        });
      }

      transfer.items.add(fileObject);
    }

    return transfer;
  }, {
    files: fileDescriptors.map(serializeFileDescriptor)
  });

  try {
    const eventInit = {
      bubbles: true,
      cancelable: true,
      dataTransfer
    };

    await page.locator(selector).dispatchEvent('dragenter', eventInit);
    await page.locator(selector).dispatchEvent('dragover', eventInit);
    await page.locator(selector).dispatchEvent('drop', eventInit);
  } finally {
    await dataTransfer.dispose();
  }
}

export async function loadRuntime(page) {
  await page.getByRole('button', { name: 'Load Whisper / Python' }).click({ force: true });
  await expect(page.locator('#transcribeButton')).toBeEnabled({ timeout: 120_000 });
}

export async function transcribeCurrentFile(page) {
  await page.getByRole('button', { name: 'Transcribe' }).click({ force: true });
  await expect(page.locator('#transcriptEditor')).not.toHaveValue('', { timeout: 120_000 });
}

export async function recordMicrophoneClip(page, { holdForMs = 1100 } = {}) {
  await page.getByRole('button', { name: 'Record Mic' }).click();
  await expect(page.locator('#recordingState')).toContainText(/Recording/i);
  await page.waitForTimeout(holdForMs);
  await page.getByRole('button', { name: 'Stop Recording' }).click();
  await expect(page.locator('#recordingState')).toContainText(/Ready to review/i);
  await expect(page.locator('#recordingPreview')).toBeVisible();
  await expect(page.locator('#fileSummary')).toContainText('recording-');
}

export async function waitForFileSelection(page, fileName) {
  await expect(page.locator('#fileSummary')).toContainText(fileName);
}

export async function captureDownload(page, selector) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator(selector).click();
  const download = await downloadPromise;
  const tempDir = join(tmpdir(), 'py-transcribe-playwright');
  await mkdir(tempDir, { recursive: true });
  const tempPath = join(tempDir, `${randomUUID()}-${download.suggestedFilename()}`);
  await download.saveAs(tempPath);
  return {
    download,
    tempPath
  };
}

export async function readTextDownload(page, selector) {
  const { tempPath, download } = await captureDownload(page, selector);
  const contents = await readFile(tempPath, 'utf8');
  return {
    contents,
    suggestedFilename: download.suggestedFilename(),
    tempPath
  };
}

export async function readZipDownload(page, selector) {
  const { tempPath, download } = await captureDownload(page, selector);
  const contents = await readFile(tempPath);
  const archive = await JSZip.loadAsync(contents);
  return {
    archive,
    suggestedFilename: download.suggestedFilename(),
    tempPath
  };
}

export function chunkCases(cases, maxPerGroup = 4) {
  const groups = [];
  for (let index = 0; index < cases.length; index += maxPerGroup) {
    groups.push(cases.slice(index, index + maxPerGroup));
  }
  return groups;
}

export function spoofSize(fileDescriptor, sizeOverride) {
  return {
    ...serializeFileDescriptor(fileDescriptor),
    sizeOverride
  };
}

export function serializeFileDescriptor(fileDescriptor) {
  const buffer = toArrayBuffer(fileDescriptor.buffer);
  return {
    name: fileDescriptor.name,
    mimeType: fileDescriptor.mimeType,
    buffer,
    bytes: Array.from(new Uint8Array(buffer)),
    lastModified: fileDescriptor.lastModified,
    sizeOverride: fileDescriptor.sizeOverride
  };
}

export function toArrayBuffer(value) {
  const bytes = value instanceof Uint8Array
    ? value
    : Buffer.isBuffer(value)
      ? new Uint8Array(value)
      : new Uint8Array(value || []);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function createSilentWavBuffer(durationSeconds, sampleRate) {
  const totalSamples = Math.max(1, Math.round(durationSeconds * sampleRate));
  const bytesPerSample = 2;
  const dataSize = totalSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}
