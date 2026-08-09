import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildChatSystemPrompt,
  buildSummaryPrompt,
  chatWithOllama,
  buildOllamaApiUrl,
  fetchOllamaModels,
  fetchOllamaModelsFromCandidates,
  describeLocalAiError,
  normalizeLocalAiDetailLevel,
  prepareTranscriptForSummary,
  resolveBestKimiModel,
  resolvePreferredOllamaModel,
  resolvePreferredKimiPullCandidate,
  resolveOllamaBaseUrlCandidates,
  shouldAttemptLocalAiDetection
} from '../../web/lib/local-ai.js';

describe('local AI helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a detail-aware prompt from the transcript', () => {
    const prompt = buildSummaryPrompt('One line. Two line.', 'detailed');

    expect(prompt.levelKey).toBe('detailed');
    expect(prompt.detail.label).toBe('Detailed');
    expect(prompt.detail.definition).toContain('multi-paragraph summary');
    expect(prompt.systemPrompt).toContain('do not invent names, numbers, dates, or conclusions');
    expect(prompt.userPrompt).toContain('Summarize the following transcription at a Detailed level of detail.');
    expect(prompt.userPrompt).toContain('Transcript begins:');
    expect(prompt.preparedTranscript.text).toBe('One line. Two line.');
  });

  it('builds a chat prompt anchored to the transcript and summary', () => {
    const prompt = buildChatSystemPrompt('Alpha transcript', 'Short summary');

    expect(prompt.systemPrompt).toContain('Treat the transcript and summary below as immutable context');
    expect(prompt.systemPrompt).toContain('Transcript summary:');
    expect(prompt.systemPrompt).toContain('Short summary');
    expect(prompt.preparedTranscript.text).toBe('Alpha transcript');
  });

  it('streams chat replies with prior user and assistant context', async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push({
        url,
        body: JSON.parse(options.body)
      });

      return {
        ok: true,
        status: 200,
        body: null,
        text: async () => [
          JSON.stringify({ message: { content: 'First' }, done: false }),
          JSON.stringify({ message: { content: ' reply' }, done: true })
        ].join('\n')
      };
    };

    const result = await chatWithOllama({
      modelName: 'demo-model',
      transcriptText: 'Transcript text',
      summaryText: 'Summary text',
      history: [
        { role: 'user', content: 'Earlier question' },
        { role: 'assistant', content: 'Earlier answer' },
        { role: 'system', content: 'ignored' }
      ],
      userMessage: 'What happens next?',
      fetchImpl
    });

    expect(result.reply).toBe('First reply');
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain('/api/chat');
    expect(requests[0].body.messages[0].role).toBe('system');
    expect(requests[0].body.messages[1].content).toBe('Earlier question');
    expect(requests[0].body.messages[2].content).toBe('Earlier answer');
    expect(requests[0].body.messages.at(-1).content).toBe('What happens next?');
  });

  it('builds direct and same-origin Ollama request URLs', async () => {
    expect(buildOllamaApiUrl('http://127.0.0.1:11434', 'tags')).toBe('http://127.0.0.1:11434/api/tags');
    expect(buildOllamaApiUrl('http://localhost:11434', 'tags')).toBe('http://localhost:11434/api/tags');
    expect(buildOllamaApiUrl('api/ollama', 'chat')).toBe('api/ollama/chat.php');

    const requests = [];
    await fetchOllamaModels({
      baseUrl: 'api/ollama',
      fetchImpl: async (url) => {
        requests.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({ models: [] }),
          text: async () => ''
        };
      }
    });

    expect(requests).toEqual(['api/ollama/tags.php']);
  });

  it('prefers the configured Ollama proxy bridge before loopback endpoints', () => {
    expect(resolveOllamaBaseUrlCandidates('api/ollama')).toEqual([
      'api/ollama',
      'http://127.0.0.1:11434',
      'http://localhost:11434',
      'http://[::1]:11434'
    ]);
  });

  it('keeps custom absolute Ollama endpoints ahead of loopback candidates', () => {
    expect(resolveOllamaBaseUrlCandidates('http://example.test:11434')).toEqual([
      'http://example.test:11434',
      'api/ollama',
      'http://127.0.0.1:11434',
      'http://localhost:11434',
      'http://[::1]:11434'
    ]);
  });

  it('falls back through proxy and loopback candidate endpoints until Ollama responds', async () => {
    const requests = [];

    const result = await fetchOllamaModelsFromCandidates({
      baseUrls: resolveOllamaBaseUrlCandidates('api/ollama'),
      fetchImpl: async (url) => {
        requests.push(url);

        if (String(url).startsWith('api/ollama')) {
          return {
            ok: false,
            status: 500,
            text: async () => 'bridge error'
          };
        }

        if (String(url).startsWith('http://127.0.0.1:11434')) {
          throw new Error('Failed to fetch');
        }

        if (String(url).startsWith('http://localhost:11434')) {
          throw new Error('Failed to fetch');
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({ models: [{ name: 'demo-model' }] }),
          text: async () => ''
        };
      }
    });

    expect(result.baseUrl).toBe('http://[::1]:11434');
    expect(result.models).toEqual([{ name: 'demo-model' }]);
    expect(requests).toEqual([
      'api/ollama/tags.php',
      'http://127.0.0.1:11434/api/tags',
      'http://localhost:11434/api/tags',
      'http://[::1]:11434/api/tags'
    ]);
  });

  it('prefers the selected Ollama model, then the cached model, then a heuristic fallback', () => {
    const models = [
      {
        name: 'acme/kimi-small',
        details: {
          family: 'Kimi',
          parameter_size: '2B',
          quantization_level: 'Q4_K_M'
        },
        size: 1_000_000_000,
        modified_at: '2024-01-01T00:00:00Z'
      },
      {
        name: 'acme/kimi-large',
        details: {
          family: 'Kimi',
          parameter_size: '7B',
          quantization_level: 'Q5_K_M'
        },
        size: 5_000_000_000,
        modified_at: '2025-01-01T00:00:00Z'
      }
    ];

    expect(resolvePreferredOllamaModel(models, {
      selectedModelName: 'acme/kimi-small',
      cachedModelName: 'acme/kimi-large'
    })).toMatchObject({
      modelName: 'acme/kimi-small',
      reason: 'selected'
    });

    expect(resolvePreferredOllamaModel(models, {
      selectedModelName: 'missing-model',
      cachedModelName: 'acme/kimi-large'
    })).toMatchObject({
      modelName: 'acme/kimi-large',
      reason: 'cached'
    });

    expect(resolvePreferredOllamaModel(models, {
      selectedModelName: 'missing-model',
      cachedModelName: 'missing-model'
    })).toMatchObject({
      modelName: 'acme/kimi-large',
      reason: 'heuristic'
    });
  });

  it('normalizes unexpected detail levels back to standard', () => {
    expect(normalizeLocalAiDetailLevel('')).toBe('standard');
    expect(normalizeLocalAiDetailLevel('something-else')).toBe('standard');
    expect(normalizeLocalAiDetailLevel('brief')).toBe('brief');
  });

  it('trims oversized transcripts and records the omitted context', () => {
    const prepared = prepareTranscriptForSummary('A'.repeat(120), { maxChars: 40 });

    expect(prepared.truncated).toBe(true);
    expect(prepared.omittedChars).toBeGreaterThan(0);
    expect(prepared.warning).toMatch(/truncated/i);
    expect(prepared.text).toContain('[Transcript omitted');
  });

  it('prefers installed local Kimi models and skips cloud-tagged entries', () => {
    const best = resolveBestKimiModel([
      { name: 'huihui_ai/kimi-k2:cloud', details: { family: 'Kimi' } },
      { name: 'richardyoung/kimi-vl-a3b-thinking', details: { family: 'Kimi' } },
      { name: 'rubenftenorio/kimi-k25-local', details: { family: 'Kimi' } },
      { name: 'openai/gpt-4o', details: { family: 'GPT' } }
    ]);

    expect(best?.modelName).toBe('rubenftenorio/kimi-k25-local');
  });

  it('uses the cached family when picking a Kimi pull candidate', () => {
    const candidate = resolvePreferredKimiPullCandidate({
      cachedModelName: 'rubenftenorio/kimi-k25-local:latest'
    });

    expect(candidate?.name).toBe('rubenftenorio/kimi-k25-local');
  });

  it('defaults to the latest Kimi pull candidate when there is no cached model', () => {
    const candidate = resolvePreferredKimiPullCandidate();

    expect(candidate?.name).toBe('kimi-k3:cloud');
  });

  it('avoids local AI detection on mobile Safari and cellular-only contexts', () => {
    expect(shouldAttemptLocalAiDetection({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
      connectionType: 'cellular',
      effectiveType: '4g',
      saveData: false,
      online: true
    })).toBe(false);

    expect(shouldAttemptLocalAiDetection({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36',
      platform: 'Win32',
      maxTouchPoints: 0,
      connectionType: 'wifi',
      effectiveType: '4g',
      saveData: false,
      online: true
    })).toBe(true);
  });

  it('formats actionable local AI error messages for summary, pull, and chat phases', () => {
    expect(describeLocalAiError(new Error('AbortError'), { phase: 'summary' })).toBe('Summarization cancelled.');
    expect(describeLocalAiError(new Error('Failed to fetch'), { phase: 'chat' })).toContain('Ollama is not running');
    expect(describeLocalAiError(new Error('download failed'), { phase: 'pull' })).toContain('Could not finish downloading');
  });
});
