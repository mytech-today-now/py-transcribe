import {
  buildChatSystemPrompt,
  buildSummaryPrompt,
  normalizeLocalAiDetailLevel
} from './local-ai.js';

export const AI_POWERED_DEFAULT_BASE_URL = 'http://127.0.0.1:3001';
export const AI_POWERED_LOCALHOST_BASE_URL = 'http://localhost:3001';
export const AI_POWERED_IPV6_LOOPBACK_BASE_URL = 'http://[::1]:3001';
export const AI_POWERED_PROXY_BASE_URL = 'api/ai-powered';
const AI_POWERED_MAX_CHAT_HISTORY_MESSAGES = 12;

export const AI_POWERED_STATUS_MESSAGES = Object.freeze({
  checking: 'Checking AI-Powered...',
  ready: 'AI-Powered detected',
  unavailable: 'AI-Powered unavailable',
  loading: 'Connecting to AI-Powered...',
  summarizing: 'Summarizing with AI-Powered...',
  chatting: 'Chatting with AI-Powered...'
});

const AI_POWERED_NOISE_PATTERNS = [
  /cors/i,
  /origin/i,
  /failed to fetch/i,
  /networkerror/i,
  /\bload failed\b/i
];

export function normalizeAiPoweredBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

export function resolveAiPoweredBaseUrlCandidates(baseUrl = AI_POWERED_PROXY_BASE_URL) {
  const normalizedBaseUrl = normalizeAiPoweredBaseUrl(baseUrl);
  const isAbsoluteBaseUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(normalizedBaseUrl);
  const candidates = [];
  const isLoopbackBaseUrl = normalizedBaseUrl === AI_POWERED_DEFAULT_BASE_URL
    || normalizedBaseUrl === AI_POWERED_LOCALHOST_BASE_URL
    || normalizedBaseUrl === AI_POWERED_IPV6_LOOPBACK_BASE_URL;

  if (normalizedBaseUrl && !isAbsoluteBaseUrl) {
    candidates.push(normalizedBaseUrl);
  }

  if (normalizedBaseUrl && isAbsoluteBaseUrl && !isLoopbackBaseUrl) {
    candidates.push(normalizedBaseUrl);
  }

  candidates.push(AI_POWERED_PROXY_BASE_URL);
  candidates.push(AI_POWERED_DEFAULT_BASE_URL);
  candidates.push(AI_POWERED_LOCALHOST_BASE_URL);
  candidates.push(AI_POWERED_IPV6_LOOPBACK_BASE_URL);

  if (normalizedBaseUrl && isAbsoluteBaseUrl && isLoopbackBaseUrl) {
    candidates.push(normalizedBaseUrl);
  }

  return uniqueBaseUrls(candidates);
}

export function buildAiPoweredApiUrl(baseUrl = AI_POWERED_PROXY_BASE_URL, endpoint) {
  const normalizedBaseUrl = normalizeAiPoweredBaseUrl(baseUrl) || AI_POWERED_PROXY_BASE_URL;
  const normalizedEndpoint = String(endpoint || '').trim().replace(/^\/+/, '');

  if (!normalizedEndpoint) {
    throw new Error('No AI-Powered endpoint was provided.');
  }

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(normalizedBaseUrl)) {
    return `${normalizedBaseUrl}/api/${normalizedEndpoint}`;
  }

  return `${normalizedBaseUrl}/${normalizedEndpoint}.php`;
}

export function normalizeAiPoweredModel(model) {
  if (!model || typeof model !== 'object') {
    return null;
  }

  const id = String(model.id || '').trim();
  const name = String(model.name || '').trim() || id;
  const capabilities = Array.isArray(model.capabilities)
    ? Array.from(new Set(model.capabilities.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean)))
    : [];

  if (!id && !name) {
    return null;
  }

  return {
    ...model,
    id: id || name,
    name,
    capabilities
  };
}

export function formatAiPoweredModelLabel(model) {
  const entry = normalizeAiPoweredModel(model);
  if (!entry) {
    return 'Unknown AI-Powered model';
  }

  const parts = [entry.name || entry.id];
  if (entry.id && entry.id !== entry.name) {
    parts.push(entry.id);
  }
  if (entry.capabilities.length) {
    parts.push(entry.capabilities.join(' · '));
  }

  return parts.filter(Boolean).join(' · ');
}

export function resolvePreferredAiPoweredModel(models, {
  selectedModelId = '',
  cachedModelId = ''
} = {}) {
  if (!Array.isArray(models) || models.length === 0) {
    return null;
  }

  const normalizedSelected = String(selectedModelId || '').trim().toLowerCase();
  const normalizedCached = String(cachedModelId || '').trim().toLowerCase();

  if (normalizedSelected) {
    const selected = models.find((model) => normalizeAiPoweredModel(model)?.id.toLowerCase() === normalizedSelected);
    if (selected) {
      const normalized = normalizeAiPoweredModel(selected);
      return {
        model: normalized,
        modelId: normalized.id,
        reason: 'selected'
      };
    }
  }

  if (normalizedCached) {
    const cached = models.find((model) => normalizeAiPoweredModel(model)?.id.toLowerCase() === normalizedCached);
    if (cached) {
      const normalized = normalizeAiPoweredModel(cached);
      return {
        model: normalized,
        modelId: normalized.id,
        reason: 'cached'
      };
    }
  }

  const preferred = [...models]
    .map((model) => normalizeAiPoweredModel(model))
    .filter(Boolean)
    .sort((left, right) => {
      const leftText = isTextCapableModel(left) ? 0 : 1;
      const rightText = isTextCapableModel(right) ? 0 : 1;
      if (leftText !== rightText) {
        return leftText - rightText;
      }

      return left.name.localeCompare(right.name);
    })[0] || null;

  if (!preferred) {
    return null;
  }

  return {
    model: preferred,
    modelId: preferred.id,
    reason: 'heuristic'
  };
}

export async function fetchAiPoweredHealth({
  baseUrl = AI_POWERED_PROXY_BASE_URL,
  signal,
  fetchImpl = fetch
} = {}) {
  const response = await fetchImpl(buildAiPoweredApiUrl(baseUrl, 'health'), {
    method: 'GET',
    cache: 'no-store',
    signal
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(`AI-Powered returned ${response.status} while checking health.${responseText.trim() ? ` ${responseText.trim()}` : ''}`);
  }

  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || String(payload.status || '').toLowerCase() !== 'ok') {
    throw new Error('AI-Powered returned an empty or malformed health payload.');
  }

  return payload;
}

export async function fetchAiPoweredModels({
  baseUrl = AI_POWERED_PROXY_BASE_URL,
  modality = 'text',
  signal,
  fetchImpl = fetch
} = {}) {
  const url = buildAiPoweredApiUrl(baseUrl, 'models');
  const requestUrl = modality
    ? `${url}${String(url).includes('?') ? '&' : '?'}modality=${encodeURIComponent(modality)}`
    : url;

  const response = await fetchImpl(requestUrl, {
    method: 'GET',
    cache: 'no-store',
    signal
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(`AI-Powered returned ${response.status} while listing models.${responseText.trim() ? ` ${responseText.trim()}` : ''}`);
  }

  const payload = await response.json().catch(() => null);
  const models = Array.isArray(payload) ? payload.map((model) => normalizeAiPoweredModel(model)).filter(Boolean) : null;

  if (!models) {
    throw new Error('AI-Powered returned an empty or malformed model list.');
  }

  return models;
}

export async function fetchAiPoweredModelsFromCandidates({
  baseUrls = [AI_POWERED_PROXY_BASE_URL, AI_POWERED_DEFAULT_BASE_URL, AI_POWERED_LOCALHOST_BASE_URL, AI_POWERED_IPV6_LOOPBACK_BASE_URL],
  modality = 'text',
  signal,
  fetchImpl = fetch
} = {}) {
  const attempts = [];

  for (const candidateBaseUrl of uniqueBaseUrls(Array.isArray(baseUrls) ? baseUrls : [baseUrls])) {
    try {
      await fetchAiPoweredHealth({
        baseUrl: candidateBaseUrl,
        signal,
        fetchImpl
      });

      const models = await fetchAiPoweredModels({
        baseUrl: candidateBaseUrl,
        modality,
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

  const failure = new Error('Could not reach AI-Powered on any configured endpoint.');
  failure.attempts = attempts;
  throw failure;
}

export async function summarizeWithAiPowered({
  modelId,
  transcriptText,
  detailLevel,
  baseUrl = AI_POWERED_PROXY_BASE_URL,
  signal,
  fetchImpl = fetch,
  onChunk
} = {}) {
  const normalizedModelId = String(modelId || '').trim();
  if (!normalizedModelId) {
    throw new Error('No AI-Powered model was provided for summarization.');
  }

  const prompt = buildSummaryPrompt(transcriptText, detailLevel);
  if (!prompt.preparedTranscript.text) {
    throw new Error('Add a transcript before asking for a summary.');
  }

  const response = await fetchImpl(buildAiPoweredApiUrl(baseUrl, 'stream'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt.userPrompt,
      systemPrompt: prompt.systemPrompt,
      model: normalizedModelId,
      temperature: 0.2
    }),
    signal
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(`AI-Powered returned ${response.status} while summarizing with ${normalizedModelId}.${responseText.trim() ? ` ${responseText.trim()}` : ''}`);
  }

  let summary = '';
  for await (const chunk of readAiPoweredStream(response, { signal })) {
    if (signal?.aborted) {
      throw abortError();
    }

    if (!chunk) {
      continue;
    }

    summary += chunk;
    onChunk?.(summary, chunk);
  }

  const normalized = normalizeResponseText(summary);
  if (!normalized) {
    throw new Error('AI-Powered returned an empty summary.');
  }

  return {
    summary: normalized,
    preparedTranscript: prompt.preparedTranscript,
    levelKey: prompt.levelKey,
    detail: prompt.detail
  };
}

export async function chatWithAiPowered({
  modelId,
  transcriptText,
  summaryText,
  history = [],
  userMessage,
  baseUrl = AI_POWERED_PROXY_BASE_URL,
  signal,
  fetchImpl = fetch,
  onChunk
} = {}) {
  const normalizedModelId = String(modelId || '').trim();
  if (!normalizedModelId) {
    throw new Error('No AI-Powered model was provided for chat.');
  }

  const prompt = buildChatSystemPrompt(transcriptText, summaryText);
  const normalizedUserMessage = String(userMessage || '').trim();
  if (!normalizedUserMessage) {
    throw new Error('Add a question before starting the chat.');
  }

  const response = await fetchImpl(buildAiPoweredApiUrl(baseUrl, 'stream'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: buildChatPrompt(normalizedUserMessage, history, prompt.preparedTranscript, prompt.preparedSummary),
      systemPrompt: prompt.systemPrompt,
      model: normalizedModelId,
      temperature: 0.25
    }),
    signal
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(`AI-Powered returned ${response.status} while chatting with ${normalizedModelId}.${responseText.trim() ? ` ${responseText.trim()}` : ''}`);
  }

  let reply = '';
  for await (const chunk of readAiPoweredStream(response, { signal })) {
    if (signal?.aborted) {
      throw abortError();
    }

    if (!chunk) {
      continue;
    }

    reply += chunk;
    onChunk?.(reply, chunk);
  }

  const normalized = normalizeResponseText(reply);
  if (!normalized) {
    throw new Error('AI-Powered returned an empty chat response.');
  }

  return {
    reply: normalized,
    preparedTranscript: prompt.preparedTranscript,
    preparedSummary: prompt.preparedSummary
  };
}

export function describeAiPoweredError(error, {
  phase = 'connect',
  baseUrl = AI_POWERED_DEFAULT_BASE_URL
} = {}) {
  const message = String(error instanceof Error ? error.message : error || '').trim();
  const lowered = message.toLowerCase();

  if (!message || lowered.includes('aborterror') || lowered.includes('cancel')) {
    if (phase === 'chat') {
      return 'AI-Powered chat cancelled.';
    }

    if (phase === 'summary') {
      return 'AI-Powered summarization cancelled.';
    }

    return 'AI-Powered check cancelled.';
  }

  if (lowered.includes('cors') || lowered.includes('origin')) {
    return `The browser blocked access to AI-Powered at ${baseUrl}. If the local ai-powered server is running, allow https://mytech.today in its browser origins or keep its browser-safe proxy mode enabled, then click Retry.`;
  }

  if (lowered.includes('failed to fetch') || lowered.includes('networkerror') || /\bload failed\b/i.test(lowered)) {
    return `Could not reach AI-Powered at ${baseUrl}. Start the local ai-powered server on this machine, then click Retry.`;
  }

  if (phase === 'summary') {
    return `Could not summarize with AI-Powered. ${message}`;
  }

  if (phase === 'chat') {
    return `AI-Powered chat failed. ${message}`;
  }

  return `Could not reach AI-Powered. ${message}`;
}

async function* readAiPoweredStream(response, { signal } = {}) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = await response.text();
    yield* parseAiPoweredText(text);
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

        const chunk = parseAiPoweredSseLine(trimmed);
        if (chunk) {
          yield chunk;
        }
      }
    }

    buffer += decoder.decode();
    yield* parseAiPoweredText(buffer);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore reader release failures when the response has already ended.
    }
  }
}

function* parseAiPoweredText(text) {
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const chunk = parseAiPoweredSseLine(trimmed);
    if (chunk) {
      yield chunk;
      continue;
    }

    if (!trimmed.startsWith('data:')) {
      yield trimmed;
    }
  }
}

function parseAiPoweredSseLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('data:')) {
    return '';
  }

  const payload = trimmed.slice(5).trim();
  if (!payload || payload === '[DONE]') {
    return '';
  }

  try {
    const parsed = JSON.parse(payload);
    const delta = String(
      parsed?.delta
      || parsed?.text
      || parsed?.content
      || parsed?.choices?.[0]?.delta?.content
      || ''
    );
    return delta;
  } catch {
    return payload;
  }
}

function buildChatPrompt(userMessage, history, preparedTranscript, preparedSummary) {
  const historyLines = normalizeChatHistory(history).map((entry) => `${entry.role === 'assistant' ? 'Assistant' : 'User'}: ${entry.content}`);
  const conversationLines = [];

  if (preparedSummary?.text) {
    conversationLines.push('Transcript summary:');
    conversationLines.push(preparedSummary.text);
  }

  if (preparedTranscript?.text) {
    conversationLines.push('Transcript:');
    conversationLines.push(preparedTranscript.text);
  }

  if (historyLines.length) {
    conversationLines.push('Recent conversation:');
    conversationLines.push(...historyLines);
  }

  conversationLines.push(`User: ${userMessage}`);
  conversationLines.push('Assistant:');

  return conversationLines.join('\n');
}

function normalizeChatHistory(history) {
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
    .slice(-AI_POWERED_MAX_CHAT_HISTORY_MESSAGES);
}

function normalizeResponseText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function isTextCapableModel(model) {
  const capabilities = Array.isArray(model?.capabilities)
    ? model.capabilities.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean)
    : [];

  return capabilities.length === 0 || capabilities.includes('text') || capabilities.includes('structured');
}

function uniqueBaseUrls(values) {
  const seen = new Set();
  const urls = [];

  for (const value of values) {
    const normalized = normalizeAiPoweredBaseUrl(value);
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

function abortError() {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted.', 'AbortError');
  }

  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}
