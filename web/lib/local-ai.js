export const OLLAMA_DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
export const OLLAMA_LOCALHOST_BASE_URL = 'http://localhost:11434';
export const OLLAMA_IPV6_LOOPBACK_BASE_URL = 'http://[::1]:11434';
export const OLLAMA_PROXY_BASE_URL = 'api/ollama';
const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';
const LOCAL_AI_MAX_TRANSCRIPT_CHARS = 160000;
const LOCAL_AI_MAX_CHAT_TRANSCRIPT_CHARS = 120000;
const LOCAL_AI_MAX_CHAT_HISTORY_MESSAGES = 12;

export const LOCAL_AI_DETAIL_LEVELS = {
  brief: {
    label: 'Brief',
    definition: '1-3 sentences or key points only.'
  },
  standard: {
    label: 'Standard',
    definition: 'A concise paragraph followed by bullet points covering the main ideas.'
  },
  detailed: {
    label: 'Detailed',
    definition: 'A comprehensive multi-paragraph summary that preserves nuance, names, numbers, and context.'
  }
};

export const LOCAL_AI_PULL_CANDIDATES = [
  {
    name: 'kimi-k3:cloud',
    label: 'Kimi K3 (cloud)'
  },
  {
    name: 'kimi-k2.7-code:cloud',
    label: 'Kimi K2.7 Code (cloud)'
  },
  {
    name: 'kimi-k2.6:cloud',
    label: 'Kimi K2.6 (cloud)'
  },
  {
    name: 'richardyoung/kimi-vl-a3b-thinking',
    label: 'Kimi-VL-A3B-Thinking'
  },
  {
    name: 'rubenftenorio/kimi-k25-local',
    label: 'Kimi K2.5 local'
  },
  {
    name: 'huihui_ai/kimi-k2',
    label: 'Kimi K2-Instruct'
  }
];

export function buildOllamaApiUrl(baseUrl = OLLAMA_DEFAULT_BASE_URL, endpoint) {
  const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');
  const normalizedEndpoint = String(endpoint || '').trim().replace(/^\/+/, '');

  if (!normalizedEndpoint) {
    throw new Error('No Ollama endpoint was provided.');
  }

  if (!normalizedBaseUrl) {
    return `${OLLAMA_DEFAULT_BASE_URL}/api/${normalizedEndpoint}`;
  }

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(normalizedBaseUrl)) {
    return `${normalizedBaseUrl}/api/${normalizedEndpoint}`;
  }

  return `${normalizedBaseUrl}/${normalizedEndpoint}.php`;
}

export function normalizeOllamaBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

export function resolveOllamaBaseUrlCandidates(baseUrl = OLLAMA_PROXY_BASE_URL) {
  const normalizedBaseUrl = normalizeOllamaBaseUrl(baseUrl);
  const candidates = [];
  const isAbsoluteBaseUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(normalizedBaseUrl);
  const isLoopbackBaseUrl = normalizedBaseUrl === OLLAMA_DEFAULT_BASE_URL
    || normalizedBaseUrl === OLLAMA_LOCALHOST_BASE_URL
    || normalizedBaseUrl === OLLAMA_IPV6_LOOPBACK_BASE_URL;

  if (normalizedBaseUrl && !isAbsoluteBaseUrl) {
    candidates.push(normalizedBaseUrl);
  }

  if (normalizedBaseUrl && isAbsoluteBaseUrl && !isLoopbackBaseUrl) {
    candidates.push(normalizedBaseUrl);
  }

  candidates.push(OLLAMA_PROXY_BASE_URL);
  candidates.push(OLLAMA_DEFAULT_BASE_URL);
  candidates.push(OLLAMA_LOCALHOST_BASE_URL);
  candidates.push(OLLAMA_IPV6_LOOPBACK_BASE_URL);

  if (normalizedBaseUrl && isAbsoluteBaseUrl && isLoopbackBaseUrl) {
    candidates.push(normalizedBaseUrl);
  }

  return uniqueOllamaBaseUrls(candidates);
}

export function captureBrowserContext() {
  if (typeof navigator === 'undefined') {
    return {
      userAgent: '',
      platform: '',
      maxTouchPoints: 0,
      connectionType: '',
      effectiveType: '',
      saveData: false,
      online: true
    };
  }

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;

  return {
    userAgent: navigator.userAgent || '',
    platform: navigator.platform || '',
    maxTouchPoints: Number(navigator.maxTouchPoints || 0),
    connectionType: String(connection?.type || ''),
    effectiveType: String(connection?.effectiveType || ''),
    saveData: Boolean(connection?.saveData),
    online: navigator.onLine !== false
  };
}

export function shouldAttemptLocalAiDetection(context = captureBrowserContext()) {
  if (!context.online) {
    return true;
  }

  const userAgent = String(context.userAgent || '');
  const platform = String(context.platform || '');
  const hasTouch = Number(context.maxTouchPoints || 0) > 1;
  const isiPhoneOrIPad = /iP(hone|ad|od)/i.test(userAgent) || (/Mac/i.test(platform) && hasTouch);
  const isSafari = /Safari/i.test(userAgent) && !/(Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPR|Opera)/i.test(userAgent);
  const isMobileSafari = isiPhoneOrIPad && isSafari;
  const connectionType = String(context.connectionType || '').toLowerCase();
  const effectiveType = String(context.effectiveType || '').toLowerCase();
  const isCellularOnly = connectionType === 'cellular' || /(^|[^a-z])(2g|3g)([^a-z]|$)/i.test(effectiveType) || Boolean(context.saveData && !connectionType);

  return !isMobileSafari && !isCellularOnly;
}

export function normalizeLocalAiModelName(model) {
  if (!model || typeof model !== 'object') {
    return '';
  }

  return String(model.name || model.model || model.model_name || '').trim();
}

export function normalizeLocalAiDetailLevel(value) {
  const normalized = String(value || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(LOCAL_AI_DETAIL_LEVELS, normalized)
    ? normalized
    : 'standard';
}

export function resolveBestKimiModel(models, { cachedModelName = '' } = {}) {
  if (!Array.isArray(models) || models.length === 0) {
    return null;
  }

  let best = null;
  for (const candidate of models) {
    const modelName = normalizeLocalAiModelName(candidate);
    const score = scoreKimiModel(candidate, { cachedModelName });
    if (!Number.isFinite(score)) {
      continue;
    }

    if (!best || score > best.score) {
      best = {
        model: candidate,
        modelName,
        score
      };
    }
  }

  return best;
}

export function resolvePreferredOllamaModel(models, {
  selectedModelName = '',
  cachedModelName = ''
} = {}) {
  if (!Array.isArray(models) || models.length === 0) {
    return null;
  }

  const normalizedSelected = String(selectedModelName || '').trim().toLowerCase();
  const normalizedCached = String(cachedModelName || '').trim().toLowerCase();

  if (normalizedSelected) {
    const selected = models.find((model) => normalizeLocalAiModelName(model).toLowerCase() === normalizedSelected);
    if (selected) {
      return {
        model: selected,
        modelName: normalizeLocalAiModelName(selected),
        score: Number.POSITIVE_INFINITY,
        reason: 'selected'
      };
    }
  }

  if (normalizedCached) {
    const cached = models.find((model) => normalizeLocalAiModelName(model).toLowerCase() === normalizedCached);
    if (cached) {
      return {
        model: cached,
        modelName: normalizeLocalAiModelName(cached),
        score: Number.POSITIVE_INFINITY - 1,
        reason: 'cached'
      };
    }
  }

  let best = null;
  for (const candidate of models) {
    const modelName = normalizeLocalAiModelName(candidate);
    const score = scoreOllamaModel(candidate, {
      selectedModelName: normalizedSelected,
      cachedModelName: normalizedCached
    });
    if (!Number.isFinite(score)) {
      continue;
    }

    if (!best || score > best.score) {
      best = {
        model: candidate,
        modelName,
        score,
        reason: 'heuristic'
      };
    }
  }

  return best;
}

export function resolvePreferredKimiPullCandidate({ cachedModelName = '' } = {}) {
  if (cachedModelName) {
    const cached = LOCAL_AI_PULL_CANDIDATES.find((candidate) => sameKimiFamily(candidate.name, cachedModelName));
    if (cached) {
      return cached;
    }
  }

  return LOCAL_AI_PULL_CANDIDATES[0] || null;
}

export function prepareTranscriptForSummary(transcriptText, { maxChars = LOCAL_AI_MAX_TRANSCRIPT_CHARS } = {}) {
  const text = String(transcriptText || '').trim();
  if (!text) {
    return {
      text: '',
      truncated: false,
      omittedChars: 0,
      warning: ''
    };
  }

  if (text.length <= maxChars) {
    return {
      text,
      truncated: false,
      omittedChars: 0,
      warning: ''
    };
  }

  const headChars = Math.max(1, Math.floor(maxChars * 0.7));
  const tailChars = Math.max(1, maxChars - headChars);
  const omittedChars = Math.max(0, text.length - headChars - tailChars);
  const warning = `Transcript was truncated by ${formatCompactNumber(omittedChars)} characters to fit the local model context.`;
  const textToSummarize = [
    text.slice(0, headChars),
    '',
    `[Transcript omitted ${formatCompactNumber(omittedChars)} characters to fit the local model context.]`,
    '',
    text.slice(-tailChars)
  ].join('\n');

  return {
    text: textToSummarize,
    truncated: true,
    omittedChars,
    warning
  };
}

export function buildSummaryPrompt(transcriptText, detailLevel, { maxChars = LOCAL_AI_MAX_TRANSCRIPT_CHARS } = {}) {
  const levelKey = normalizeLocalAiDetailLevel(detailLevel);
  const detail = LOCAL_AI_DETAIL_LEVELS[levelKey];
  const preparedTranscript = prepareTranscriptForSummary(transcriptText, { maxChars });

  // Map the user's chosen detail level to an explicit instruction so Ollama gets one unambiguous request.
  const systemPrompt = [
    'You summarize transcriptions for an offline, on-device application.',
    'Stay faithful to the source text and do not invent names, numbers, dates, or conclusions.',
    'Preserve the original meaning, and clearly note uncertainty if the transcript is incomplete or ambiguous.',
    'Return only the summary text with no preamble, apology, or metadata.'
  ].join(' ');

  const userPrompt = [
    `Summarize the following transcription at a ${detail.label} level of detail.`,
    'Follow the definition of that level exactly.',
    `Level definition: ${detail.definition}`,
    preparedTranscript.truncated
      ? 'The transcript was truncated to fit the local model context. Preserve the important ideas from the visible text and mention the omission only if it affects the summary.'
      : '',
    '',
    'Transcript begins:',
    preparedTranscript.text,
    'Transcript ends.'
  ].filter(Boolean).join('\n');

  return {
    levelKey,
    detail,
    systemPrompt,
    userPrompt,
    preparedTranscript
  };
}

export function buildChatSystemPrompt(transcriptText, summaryText, { maxTranscriptChars = LOCAL_AI_MAX_CHAT_TRANSCRIPT_CHARS } = {}) {
  const preparedTranscript = prepareTranscriptForSummary(transcriptText, { maxChars: maxTranscriptChars });
  const preparedSummary = String(summaryText || '').trim();

  // The chat model gets a fixed context block so the conversation stays anchored to the current transcript and summary.
  const systemPrompt = [
    'You are a careful assistant helping the user review a transcript.',
    'Treat the transcript and summary below as immutable context for this chat session.',
    'Do not rewrite, replace, or forget the transcript.',
    preparedSummary
      ? `Transcript summary:\n${preparedSummary}`
      : 'Transcript summary: (no summary has been generated yet)',
    preparedTranscript.truncated
      ? 'The transcript below was shortened to fit the model context. Preserve the important details from the visible text and mention the truncation only if it matters to your answer.'
      : '',
    'Transcript:',
    preparedTranscript.text || '(no transcript provided)',
    'Answer the user using the transcript and summary as the source of truth.',
    'If the transcript or summary does not support an answer, say that clearly.',
    'Keep replies concise unless the user asks for more detail.'
  ].filter(Boolean).join('\n\n');

  return {
    preparedTranscript,
    preparedSummary,
    systemPrompt
  };
}

export async function fetchOllamaModels({
  baseUrl = OLLAMA_DEFAULT_BASE_URL,
  signal,
  fetchImpl = fetch
} = {}) {
  // Ollama reachability probe: GET /api/tags is the quickest way to confirm the local daemon is alive.
  const response = await fetchImpl(buildOllamaApiUrl(baseUrl, 'tags'), {
    method: 'GET',
    cache: 'no-store',
    signal
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(`Ollama returned ${response.status} while listing local models.${responseText.trim() ? ` ${responseText.trim()}` : ''}`);
  }

  const payload = await response.json().catch(() => null);
  const models = Array.isArray(payload?.models) ? payload.models : null;

  if (!models) {
    throw new Error('Ollama returned an empty or malformed model list.');
  }

  return models;
}

export async function fetchOllamaModelsFromCandidates({
  baseUrls = [OLLAMA_PROXY_BASE_URL, OLLAMA_DEFAULT_BASE_URL, OLLAMA_LOCALHOST_BASE_URL, OLLAMA_IPV6_LOOPBACK_BASE_URL],
  signal,
  fetchImpl = fetch
} = {}) {
  const attempts = [];

  for (const candidateBaseUrl of uniqueOllamaBaseUrls(Array.isArray(baseUrls) ? baseUrls : [baseUrls])) {
    try {
      const models = await fetchOllamaModels({
        baseUrl: candidateBaseUrl,
        signal,
        fetchImpl
      });

      return {
        baseUrl: candidateBaseUrl,
        models
      };
    } catch (error) {
      attempts.push({
        baseUrl: candidateBaseUrl,
        error: error instanceof Error ? error : new Error(String(error))
      });

      if (signal?.aborted) {
        throw error;
      }
    }
  }

  const failure = new Error('Could not reach Ollama on any configured endpoint.');
  failure.attempts = attempts;
  throw failure;
}

export async function pullOllamaModelWithProgress({
  modelName,
  baseUrl = OLLAMA_DEFAULT_BASE_URL,
  signal,
  fetchImpl = fetch,
  onProgress
} = {}) {
  if (!modelName) {
    throw new Error('No Ollama model name was provided for the pull request.');
  }

  // Ollama pull streaming: POST /api/pull emits NDJSON status objects that we can surface as a live progress bar.
  const response = await fetchImpl(buildOllamaApiUrl(baseUrl, 'pull'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      stream: true
    }),
    signal
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(`Ollama returned ${response.status} while downloading ${modelName}.${responseText.trim() ? ` ${responseText.trim()}` : ''}`);
  }

  let lastStatus = '';
  for await (const chunk of readOllamaJsonStream(response, { signal })) {
    if (signal?.aborted) {
      throw abortError();
    }

    lastStatus = String(chunk.status || lastStatus || '');
    const total = toPositiveNumber(chunk.total);
    const completed = toPositiveNumber(chunk.completed);
    const progress = total > 0 && completed >= 0
      ? Math.max(0, Math.min(100, (completed / total) * 100))
      : null;

    onProgress?.({
      status: lastStatus,
      completed,
      total,
      progress
    });

    if (chunk.status === 'success') {
      return {
        modelName,
        status: chunk.status,
        lastStatus
      };
    }
  }

  return {
    modelName,
    status: lastStatus || 'success',
    lastStatus
  };
}

export async function summarizeWithOllama({
  modelName,
  transcriptText,
  detailLevel,
  baseUrl = OLLAMA_DEFAULT_BASE_URL,
  signal,
  fetchImpl = fetch,
  onChunk,
  modelOptions = {}
} = {}) {
  if (!modelName) {
    throw new Error('No Ollama model name was provided for summarization.');
  }

  const prompt = buildSummaryPrompt(transcriptText, detailLevel);
  if (!prompt.preparedTranscript.text) {
    throw new Error('Add a transcript before asking for a summary.');
  }

  // Ollama chat streaming: POST /api/chat lets us keep the request fully local while still surfacing partial text.
  const response = await fetchImpl(buildOllamaApiUrl(baseUrl, 'chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      stream: true,
      keep_alive: '5m',
      options: {
        temperature: 0.2,
        ...modelOptions
      },
      messages: [
        {
          role: 'system',
          content: prompt.systemPrompt
        },
        {
          role: 'user',
          content: prompt.userPrompt
        }
      ]
    }),
    signal
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(`Ollama returned ${response.status} while summarizing with ${modelName}.${responseText.trim() ? ` ${responseText.trim()}` : ''}`);
  }

  let summary = '';
  for await (const chunk of readOllamaJsonStream(response, { signal })) {
    if (signal?.aborted) {
      throw abortError();
    }

    const messageContent = String(chunk?.message?.content || chunk?.response || '');
    if (messageContent) {
      summary += messageContent;
      onChunk?.(summary, chunk);
    }

    if (chunk.done && !messageContent && summary) {
      break;
    }
  }

  const normalized = normalizeSummaryText(summary);
  if (!normalized) {
    throw new Error('The model returned an empty summary.');
  }

  return {
    summary: normalized,
    preparedTranscript: prompt.preparedTranscript,
    levelKey: prompt.levelKey,
    detail: prompt.detail
  };
}

export async function chatWithOllama({
  modelName,
  transcriptText,
  summaryText,
  history = [],
  userMessage,
  baseUrl = OLLAMA_DEFAULT_BASE_URL,
  signal,
  fetchImpl = fetch,
  onChunk,
  modelOptions = {}
} = {}) {
  if (!modelName) {
    throw new Error('No Ollama model name was provided for chat.');
  }

  const prompt = buildChatSystemPrompt(transcriptText, summaryText);
  const normalizedUserMessage = String(userMessage || '').trim();
  if (!normalizedUserMessage) {
    throw new Error('Add a question before starting the chat.');
  }

  const conversation = [
    {
      role: 'system',
      content: prompt.systemPrompt
    },
    ...normalizeChatHistory(history, { maxMessages: LOCAL_AI_MAX_CHAT_HISTORY_MESSAGES }),
    {
      role: 'user',
      content: normalizedUserMessage
    }
  ];

  // Ollama chat streaming: POST /api/chat keeps the transcript context fixed while the user carries on a multi-turn conversation.
  const response = await fetchImpl(buildOllamaApiUrl(baseUrl, 'chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      stream: true,
      keep_alive: '5m',
      options: {
        temperature: 0.25,
        ...modelOptions
      },
      messages: conversation
    }),
    signal
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(`Ollama returned ${response.status} while chatting with ${modelName}.${responseText.trim() ? ` ${responseText.trim()}` : ''}`);
  }

  let reply = '';
  for await (const chunk of readOllamaJsonStream(response, { signal })) {
    if (signal?.aborted) {
      throw abortError();
    }

    const messageContent = String(chunk?.message?.content || chunk?.response || '');
    if (messageContent) {
      reply += messageContent;
      onChunk?.(reply, chunk);
    }

    if (chunk.done && !messageContent && reply) {
      break;
    }
  }

  const normalized = normalizeSummaryText(reply);
  if (!normalized) {
    throw new Error('The model returned an empty chat response.');
  }

  return {
    reply: normalized,
    preparedTranscript: prompt.preparedTranscript,
    preparedSummary: prompt.preparedSummary
  };
}

export function describeLocalAiError(error, { phase = 'connect', baseUrl = OLLAMA_DEFAULT_BASE_URL } = {}) {
  const message = String(error instanceof Error ? error.message : error || '').trim();
  const lowered = message.toLowerCase();
  if (!message || lowered.includes('aborterror') || lowered.includes('cancel')) {
    if (phase === 'chat') {
      return 'Chat cancelled.';
    }

    if (phase === 'pull') {
      return 'Model download cancelled.';
    }

    if (phase === 'summary') {
      return 'Summarization cancelled.';
    }

    return 'Local AI check cancelled.';
  }

  if (lowered.includes('failed to fetch') || lowered.includes('networkerror') || /\bload failed\b/i.test(lowered)) {
    return `Ollama is not running on this machine or the browser cannot reach ${baseUrl}. Install Ollama from ${OLLAMA_DOWNLOAD_URL}, start it with ollama serve, then click Retry.`;
  }

  if (lowered.includes('cors') || lowered.includes('origin')) {
    return `The browser blocked access to Ollama at ${baseUrl}. If Ollama is already running, allow this app in OLLAMA_ORIGINS or keep the same-origin PHP Ollama bridge enabled, then click Retry.`;
  }

  if (phase === 'summary') {
    return `Could not summarize the transcript. ${message}`;
  }

  if (phase === 'pull') {
    return `Could not finish downloading the selected model. ${message}`;
  }

  if (phase === 'chat') {
    return `Chat stopped because Ollama could not answer. ${message}`;
  }

  return `Could not reach Ollama. ${message}`;
}

async function* readOllamaJsonStream(response, { signal } = {}) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = await response.text();
    yield* parseJsonLines(text);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        throw abortError();
      }

      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        yield parseOllamaJson(trimmed);
      }
    }

    buffer += decoder.decode();
    yield* parseJsonLines(buffer);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore reader release failures when the stream has already been torn down.
    }
  }
}

function* parseJsonLines(text) {
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    yield parseOllamaJson(trimmed);
  }
}

function parseOllamaJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Ollama streamed malformed JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeChatHistory(history, { maxMessages = LOCAL_AI_MAX_CHAT_HISTORY_MESSAGES } = {}) {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }

  return history
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      role: String(entry.role || '').toLowerCase(),
      content: String(entry.content || '').trim()
    }))
    .filter((entry) => (entry.role === 'user' || entry.role === 'assistant') && entry.content)
    .slice(-Math.max(1, maxMessages));
}

function scoreKimiModel(model, { cachedModelName = '' } = {}) {
  const name = normalizeLocalAiModelName(model).toLowerCase();
  if (!name || isCloudModelName(name)) {
    return Number.NEGATIVE_INFINITY;
  }

  const families = Array.isArray(model?.details?.families)
    ? model.details.families.map((family) => String(family || '').toLowerCase())
    : [];
  const family = String(model?.details?.family || '').toLowerCase();
  const looksLikeKimi = /(^|[\/:-])kimi/i.test(name) || families.some((entry) => entry.includes('kimi')) || family.includes('kimi');

  if (!looksLikeKimi) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 100;
  if (sameKimiFamily(name, cachedModelName)) {
    score += 75;
  }

  if (name.includes('k3')) {
    score += 300;
  }
  if (name.includes('k2.7')) {
    score += 240;
  }
  if (name.includes('k2.6')) {
    score += 220;
  }
  if (name.includes('k2.5') || name.includes('k25')) {
    score += 180;
  }
  if (name.includes('k2')) {
    score += 160;
  }
  if (name.includes('thinking')) {
    score += 25;
  }
  if (name.includes('local')) {
    score += 20;
  }
  if (name.includes('abliterated')) {
    score -= 15;
  }

  const parameterSize = parseParameterSize(model?.details?.parameter_size);
  if (parameterSize) {
    score += Math.min(240, Math.log10(parameterSize + 1) * 45);
  }

  const byteSize = toPositiveNumber(model?.size);
  if (byteSize) {
    score += Math.min(120, Math.log10(byteSize + 1) * 12);
  }

  const modifiedAt = Date.parse(String(model?.modified_at || ''));
  if (Number.isFinite(modifiedAt)) {
    const ageDays = Math.max(0, (Date.now() - modifiedAt) / (1000 * 60 * 60 * 24));
    score += Math.max(0, 30 - Math.min(30, ageDays));
  }

  return score;
}

function scoreOllamaModel(model, {
  selectedModelName = '',
  cachedModelName = ''
} = {}) {
  const name = normalizeLocalAiModelName(model).toLowerCase();
  if (!name) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  if (name.includes(selectedModelName) && selectedModelName) {
    score += 1_000;
  }

  if (name.includes(cachedModelName) && cachedModelName) {
    score += 450;
  }

  const familyTokens = new Set([
    String(model?.details?.family || '').toLowerCase(),
    ...(Array.isArray(model?.details?.families) ? model.details.families.map((family) => String(family || '').toLowerCase()) : [])
  ].filter(Boolean));

  const familyWeights = [
    ['kimi', 260],
    ['qwen', 240],
    ['llama', 220],
    ['gemma', 210],
    ['mistral', 190],
    ['deepseek', 185],
    ['phi', 175],
    ['mixtral', 160],
    ['nous', 150],
    ['openhermes', 140],
    ['yi', 130],
    ['granite', 110],
    ['codellama', 100],
    ['orca', 95]
  ];

  for (const [family, weight] of familyWeights) {
    if (familyTokens.has(family) || name.includes(family)) {
      score += weight;
      break;
    }
  }

  if (/\b(instruct|chat|assistant|thinking|reasoning)\b/i.test(name)) {
    score += 40;
  }

  if (/\bbase\b/i.test(name)) {
    score -= 25;
  }

  if (isCloudModelName(name)) {
    return Number.NEGATIVE_INFINITY;
  }

  const parameterSize = parseParameterSize(model?.details?.parameter_size);
  if (parameterSize) {
    score += Math.min(320, Math.log10(parameterSize + 1) * 55);
  }

  const byteSize = toPositiveNumber(model?.size);
  if (byteSize) {
    score += Math.min(160, Math.log10(byteSize + 1) * 14);
  }

  const quantization = String(model?.details?.quantization_level || '').trim().toUpperCase();
  const quantizationWeights = [
    ['FP16', 115],
    ['F16', 115],
    ['Q8_0', 100],
    ['Q6_K', 88],
    ['Q5_K_M', 80],
    ['Q5_K_S', 76],
    ['Q4_K_M', 68],
    ['Q4_K_S', 64],
    ['Q4_0', 58],
    ['Q3_K_M', 42],
    ['Q3_K_S', 35],
    ['Q3_0', 30],
    ['Q2_K', 12]
  ];

  for (const [pattern, weight] of quantizationWeights) {
    if (quantization === pattern || name.includes(pattern.toLowerCase())) {
      score += weight;
      break;
    }
  }

  const modifiedAt = Date.parse(String(model?.modified_at || ''));
  if (Number.isFinite(modifiedAt)) {
    const ageDays = Math.max(0, (Date.now() - modifiedAt) / (1000 * 60 * 60 * 24));
    score += Math.max(0, 45 - Math.min(45, ageDays / 10));
  }

  if (/kimi/.test(name)) {
    score += 20;
  }

  return score;
}

function sameKimiFamily(left, right) {
  const leftName = String(left || '').toLowerCase().replace(/:latest$/, '');
  const rightName = String(right || '').toLowerCase().replace(/:latest$/, '');
  if (!leftName || !rightName) {
    return false;
  }

  const leftTokens = leftName.split('/').pop() || leftName;
  const rightTokens = rightName.split('/').pop() || rightName;
  return leftTokens === rightTokens || leftName === rightName || leftTokens.includes(rightTokens) || rightTokens.includes(leftTokens);
}

function isCloudModelName(name) {
  const normalized = String(name || '').toLowerCase();
  return normalized.endsWith(':cloud') || normalized.includes('/cloud') || normalized.includes(' cloud ') || normalized.includes('cloud');
}

function parseParameterSize(value) {
  const text = String(value || '').trim().toUpperCase();
  if (!text) {
    return null;
  }

  const match = text.match(/^([\d.]+)\s*([KMBT])?$/);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return null;
  }

  const suffix = match[2] || '';
  const multipliers = {
    K: 1e3,
    M: 1e6,
    B: 1e9,
    T: 1e12
  };

  return suffix ? amount * multipliers[suffix] : amount;
}

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizeSummaryText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function uniqueOllamaBaseUrls(values) {
  const seen = new Set();
  const urls = [];

  for (const value of values) {
    const normalized = normalizeOllamaBaseUrl(value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    urls.push(normalized);
  }

  return urls;
}

function formatCompactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return String(value || 0);
  }

  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(number);
}

function abortError() {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted.', 'AbortError');
  }

  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}
