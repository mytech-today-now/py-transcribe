import {
  buildChatSystemPrompt,
  buildSummaryPrompt,
  normalizeLocalAiDetailLevel
} from './local-ai.js';

export const LOCAL_AI_RUNTIME_MODES = Object.freeze({
  auto: 'auto',
  local: 'local',
  browser: 'browser'
});

export const BROWSER_AI_MODEL_CATALOG = Object.freeze([
  {
    id: 'kimi-qwen35-2b-q4',
    label: 'Kimi/Opus Distill 2B',
    repo: 'mradermacher/Qwen3.5-2b-Kimi-and-Opus-Distillation-GGUF',
    file: 'Qwen3.5-2b-Kimi-and-Opus-Distillation.Q4_K_M.gguf',
    quantization: 'Q4_K_M',
    sizeLabel: '1.4 GB',
    approxSizeBytes: 1400000000,
    nCtx: 8192,
    maxSummaryChars: 24000,
    maxChatTranscriptChars: 18000,
    maxTokens: 512,
    temperature: 0.2,
    topP: 0.9,
    parallelDownloads: 3,
    note: 'Strongest browser-friendly default.'
  },
  {
    id: 'kimi-qwen35-2b-q2',
    label: 'Kimi/Opus Distill 2B Lite',
    repo: 'mradermacher/Qwen3.5-2b-Kimi-and-Opus-Distillation-GGUF',
    file: 'Qwen3.5-2b-Kimi-and-Opus-Distillation.Q2_K.gguf',
    quantization: 'Q2_K',
    sizeLabel: '1.1 GB',
    approxSizeBytes: 1100000000,
    nCtx: 7168,
    maxSummaryChars: 20000,
    maxChatTranscriptChars: 15000,
    maxTokens: 384,
    temperature: 0.2,
    topP: 0.9,
    parallelDownloads: 3,
    note: 'Smaller fallback when memory or cache is tight.'
  },
  {
    id: 'kimi-v2-1p2b-q4',
    label: 'Kimi V2 Distill 1.2B',
    repo: 'mradermacher/LFM2.5-1.2B-Thinking-Kimi-V2-Heretic-Uncensored-DISTILL-GGUF',
    file: 'LFM2.5-1.2B-Thinking-Kimi-V2-Heretic-Uncensored-DISTILL.Q4_K_M.gguf',
    quantization: 'Q4_K_M',
    sizeLabel: '0.8 GB',
    approxSizeBytes: 800000000,
    nCtx: 6144,
    maxSummaryChars: 16000,
    maxChatTranscriptChars: 12000,
    maxTokens: 320,
    temperature: 0.2,
    topP: 0.9,
    parallelDownloads: 3,
    note: 'Low-memory fallback with a smaller cache footprint.'
  }
]);

const BROWSER_AI_DEFAULT_MODEL_ID = BROWSER_AI_MODEL_CATALOG[0]?.id || '';

export function normalizeLocalAiRuntimeMode(value) {
  const normalized = String(value || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(LOCAL_AI_RUNTIME_MODES, normalized)
    ? normalized
    : LOCAL_AI_RUNTIME_MODES.auto;
}

export function supportsBrowserLocalAi() {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(
    typeof WebAssembly !== 'undefined'
    && typeof Worker !== 'undefined'
    && typeof Blob !== 'undefined'
    && typeof ReadableStream !== 'undefined'
    && typeof URL !== 'undefined'
  );
}

export function getBrowserAiModelById(modelId) {
  const normalized = String(modelId || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return BROWSER_AI_MODEL_CATALOG.find((model) => model.id.toLowerCase() === normalized) || null;
}

export function formatBrowserAiModelLabel(model) {
  const entry = normalizeBrowserAiModel(model);
  if (!entry) {
    return 'Unknown browser model';
  }

  const parts = [entry.label];
  if (entry.quantization) {
    parts.push(entry.quantization);
  }
  if (entry.sizeLabel) {
    parts.push(entry.sizeLabel);
  }

  return parts.join(' · ');
}

export function normalizeBrowserAiModel(model) {
  if (!model || typeof model !== 'object') {
    return null;
  }

  const id = String(model.id || '').trim();
  const label = String(model.label || '').trim();
  const repo = String(model.repo || '').trim();
  const file = String(model.file || '').trim();

  if (!id || !label || !repo || !file) {
    return null;
  }

  return {
    ...model,
    id,
    label,
    repo,
    file,
    quantization: String(model.quantization || '').trim(),
    sizeLabel: String(model.sizeLabel || '').trim(),
    note: String(model.note || '').trim(),
    nCtx: Number(model.nCtx || 0) || 0,
    maxSummaryChars: Number(model.maxSummaryChars || 0) || 0,
    maxChatTranscriptChars: Number(model.maxChatTranscriptChars || 0) || 0,
    maxTokens: Number(model.maxTokens || 0) || 0,
    temperature: Number.isFinite(Number(model.temperature)) ? Number(model.temperature) : 0.2,
    topP: Number.isFinite(Number(model.topP)) ? Number(model.topP) : 0.9,
    parallelDownloads: Number(model.parallelDownloads || 3) || 3,
    approxSizeBytes: Number(model.approxSizeBytes || 0) || 0
  };
}

export function resolvePreferredBrowserAiModel({
  selectedModelId = '',
  cachedModelId = '',
  deviceMemory = 0,
  hardwareConcurrency = 0
} = {}) {
  const selected = getBrowserAiModelById(selectedModelId);
  if (selected) {
    return {
      model: selected,
      reason: 'selected'
    };
  }

  const cached = getBrowserAiModelById(cachedModelId);
  if (cached) {
    return {
      model: cached,
      reason: 'cached'
    };
  }

  const memory = Number(deviceMemory || 0);
  const cores = Number(hardwareConcurrency || 0);
  const preferSmaller = (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);

  if (preferSmaller) {
    return {
      model: getBrowserAiModelById('kimi-v2-1p2b-q4') || BROWSER_AI_MODEL_CATALOG.at(-1) || null,
      reason: 'low-memory'
    };
  }

  return {
    model: getBrowserAiModelById(BROWSER_AI_DEFAULT_MODEL_ID) || BROWSER_AI_MODEL_CATALOG[0] || null,
    reason: 'default'
  };
}

export function buildBrowserStorageWarning({
  usage = 0,
  quota = 0
} = {}) {
  const safeUsage = Number(usage || 0);
  const safeQuota = Number(quota || 0);

  if (!Number.isFinite(safeQuota) || safeQuota <= 0) {
    return '';
  }

  const ratio = safeUsage / safeQuota;
  if (ratio >= 0.9) {
    return 'Browser storage is nearly full. Cached browser models may be evicted soon.';
  }

  if (ratio >= 0.75) {
    return 'Browser storage is getting tight. The larger browser model may not cache reliably.';
  }

  if (safeQuota < 1_500_000_000) {
    return 'This browser profile has a small storage quota. The browser model cache may be limited.';
  }

  return '';
}

export function describeBrowserAiError(error, { phase = 'connect', modelName = '' } = {}) {
  const message = String(error instanceof Error ? error.message : error || '').trim();
  const lowered = message.toLowerCase();
  const modelLabel = modelName ? ` ${modelName}` : '';

  if (!message || lowered.includes('aborterror') || lowered.includes('cancel')) {
    if (phase === 'summary') {
      return 'Browser summarization cancelled.';
    }

    if (phase === 'chat') {
      return 'Browser chat cancelled.';
    }

    return 'Browser model loading cancelled.';
  }

  if (lowered.includes('out of memory') || lowered.includes('oom') || lowered.includes('memory')) {
    return `The browser ran out of memory while loading${modelLabel}. Try the smaller Kimi model or close other tabs.`;
  }

  if (lowered.includes('failed to fetch') || lowered.includes('networkerror') || lowered.includes('load failed')) {
    return `Could not download the browser model${modelLabel}. Check connectivity and try again.`;
  }

  if (lowered.includes('sharedarraybuffer') || lowered.includes('coep') || lowered.includes('coop')) {
    return 'This browser cannot enable the shared-memory path for the WASM runtime. Try a modern desktop browser or use the local Ollama runtime.';
  }

  if (phase === 'summary') {
    return `Could not summarize with the browser model.${message ? ` ${message}` : ''}`;
  }

  if (phase === 'chat') {
    return `Browser chat failed.${message ? ` ${message}` : ''}`;
  }

  return `Could not load the browser model.${message ? ` ${message}` : ''}`;
}

export async function estimateBrowserStorageQuota({ estimateImpl } = {}) {
  const estimator = typeof estimateImpl === 'function'
    ? estimateImpl
    : typeof navigator !== 'undefined' && navigator.storage?.estimate
      ? navigator.storage.estimate.bind(navigator.storage)
      : null;

  if (!estimator) {
    return {
      supported: false,
      usage: 0,
      quota: 0,
      warning: ''
    };
  }

  try {
    const { usage = 0, quota = 0 } = await estimator();
    return {
      supported: true,
      usage: Number(usage || 0) || 0,
      quota: Number(quota || 0) || 0,
      warning: buildBrowserStorageWarning({ usage, quota })
    };
  } catch {
    return {
      supported: false,
      usage: 0,
      quota: 0,
      warning: ''
    };
  }
}

export async function createBrowserAiRuntime({
  model,
  onStatus,
  onProgress,
  logger,
  testHooks = globalThis.__PY_TRANSCRIBE_TEST_HOOKS__ || null
} = {}) {
  const normalizedModel = normalizeBrowserAiModel(model) || resolvePreferredBrowserAiModel().model;
  if (!normalizedModel) {
    throw new Error('No browser AI model is available.');
  }

  if (typeof testHooks?.createBrowserAiRuntime === 'function') {
    return await testHooks.createBrowserAiRuntime({
      model: normalizedModel,
      onStatus,
      onProgress,
      logger
    });
  }

  const [{ Wllama, LoggerWithoutDebug }, wasmModule] = await Promise.all([
    import('@wllama/wllama'),
    import('@wllama/wllama/esm/wasm/wllama.wasm?url')
  ]);

  const wasmUrl = wasmModule?.default || '';
  if (!wasmUrl) {
    throw new Error('The browser model runtime could not find the bundled wasm asset.');
  }

  const runtime = new BrowserAiRuntime(Wllama, wasmUrl, normalizedModel, {
    logger: logger || LoggerWithoutDebug,
    onStatus,
    onProgress
  });

  return runtime;
}

class BrowserAiRuntime {
  constructor(WllamaCtor, wasmUrl, model, { logger, onStatus, onProgress } = {}) {
    this.WllamaCtor = WllamaCtor;
    this.wasmUrl = wasmUrl;
    this.logger = logger;
    this.onStatus = onStatus;
    this.onProgress = onProgress;
    this.model = normalizeBrowserAiModel(model);
    this.instance = null;
    this.loadedModelId = '';
    this.loadedModel = null;
    this.loading = null;
    this.disposed = false;
  }

  async ensureReady({ model = this.model, forceRefresh = false, signal } = {}) {
    const selectedModel = normalizeBrowserAiModel(model);
    if (!selectedModel) {
      throw new Error('No browser AI model was selected.');
    }

    if (!forceRefresh && this.instance && this.loadedModelId === selectedModel.id) {
      return {
        model: selectedModel,
        cached: Boolean(this.loadedModel)
      };
    }

    if (this.loading) {
      return this.loading;
    }

    this.loading = this.#loadModel(selectedModel, { forceRefresh, signal });

    try {
      const result = await this.loading;
      return result;
    } finally {
      this.loading = null;
    }
  }

  async summarize({
    transcriptText,
    detailLevel,
    model = this.model,
    signal,
    onChunk
  } = {}) {
    const selectedModel = normalizeBrowserAiModel(model);
    await this.ensureReady({ model: selectedModel, signal });

    const prompt = buildSummaryPrompt(transcriptText, detailLevel, {
      maxChars: selectedModel.maxSummaryChars || undefined
    });

    const stream = await this.instance.createChatCompletion({
      messages: [
        {
          role: 'system',
          content: prompt.systemPrompt
        },
        {
          role: 'user',
          content: prompt.userPrompt
        }
      ],
      stream: true,
      max_tokens: selectedModel.maxTokens || 384,
      temperature: selectedModel.temperature ?? 0.2,
      top_p: selectedModel.topP ?? 0.9,
      abortSignal: signal
    });

    let summary = '';
    for await (const chunk of stream) {
      if (signal?.aborted) {
        throw abortError();
      }

      const choice = chunk?.choices?.[0];
      const content = String(choice?.delta?.content || '');
      if (!content) {
        continue;
      }

      summary += content;
      onChunk?.(summary, chunk);
    }

    const normalized = normalizeResponseText(summary);
    if (!normalized) {
      throw new Error('The browser model returned an empty summary.');
    }

    return {
      summary: normalized,
      preparedTranscript: prompt.preparedTranscript,
      levelKey: prompt.levelKey,
      detail: prompt.detail
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
    const selectedModel = normalizeBrowserAiModel(model);
    await this.ensureReady({ model: selectedModel, signal });

    const prompt = buildChatSystemPrompt(transcriptText, summaryText, {
      maxTranscriptChars: selectedModel.maxChatTranscriptChars || undefined
    });

    const normalizedUserMessage = String(userMessage || '').trim();
    if (!normalizedUserMessage) {
      throw new Error('Add a question before starting the chat.');
    }

    const messages = [
      {
        role: 'system',
        content: prompt.systemPrompt
      },
      ...normalizeChatHistory(history),
      {
        role: 'user',
        content: normalizedUserMessage
      }
    ];

    const stream = await this.instance.createChatCompletion({
      messages,
      stream: true,
      max_tokens: selectedModel.maxTokens || 320,
      temperature: selectedModel.temperature ?? 0.2,
      top_p: selectedModel.topP ?? 0.9,
      abortSignal: signal
    });

    let reply = '';
    for await (const chunk of stream) {
      if (signal?.aborted) {
        throw abortError();
      }

      const choice = chunk?.choices?.[0];
      const content = String(choice?.delta?.content || '');
      if (!content) {
        continue;
      }

      reply += content;
      onChunk?.(reply, chunk);
    }

    const normalized = normalizeResponseText(reply);
    if (!normalized) {
      throw new Error('The browser model returned an empty chat response.');
    }

    return {
      reply: normalized,
      preparedTranscript: prompt.preparedTranscript,
      preparedSummary: prompt.preparedSummary
    };
  }

  async dispose() {
    this.disposed = true;
    if (this.instance) {
      try {
        await this.instance.exit();
      } catch {
        // Ignore shutdown failures; the browser is about to reclaim the worker anyway.
      }
    }

    this.instance = null;
    this.loadedModelId = '';
    this.loadedModel = null;
    this.loading = null;
  }

  async #loadModel(model, { forceRefresh = false, signal } = {}) {
    if (this.instance && this.loadedModelId !== model.id) {
      await this.dispose();
    }

    if (!this.instance || forceRefresh) {
      this.instance = new this.WllamaCtor({ default: this.wasmUrl }, {
        logger: this.logger,
        parallelDownloads: model.parallelDownloads || 3
      });
    }

    this.onStatus?.({
      phase: 'loading',
      model,
      message: `Loading browser model: ${model.label}`,
      detail: `Loading ${formatBrowserAiModelLabel(model)} into the browser runtime.`
    });

    const progressCallback = ({ loaded, total }) => {
      const progress = total > 0
        ? Math.max(0, Math.min(100, (Number(loaded) / Number(total)) * 100))
        : null;
      this.onProgress?.({
        phase: 'loading',
        model,
        loaded: Number(loaded) || 0,
        total: Number(total) || 0,
        progress,
        message: progress == null
          ? `Loading ${model.label}...`
          : `Loading ${model.label}... (${Math.round(progress)}%)`
      });
    };

    await this.instance.loadModelFromHF({
      repo: model.repo,
      file: model.file
    }, {
      useCache: true,
      signal,
      progressCallback,
      n_ctx: model.nCtx || 8192,
      n_batch: 128,
      n_gpu_layers: 0,
      n_threads: Math.max(1, Math.floor(((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) / 2))
    });

    this.loadedModelId = model.id;
    this.loadedModel = model;
    this.onStatus?.({
      phase: 'ready',
      model,
      message: `Using browser model: ${formatBrowserAiModelLabel(model)}`,
      detail: model.note || 'Browser WASM runtime ready.'
    });

    return {
      model,
      cached: true
    };
  }
}

function normalizeChatHistory(history) {
  if (!Array.isArray(history) || !history.length) {
    return [];
  }

  return history
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      role: String(entry.role || '').toLowerCase(),
      content: String(entry.content || '').trim()
    }))
    .filter((entry) => (entry.role === 'user' || entry.role === 'assistant') && entry.content);
}

function normalizeResponseText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function abortError() {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted.', 'AbortError');
  }

  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}
