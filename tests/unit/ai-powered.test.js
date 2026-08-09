import { describe, expect, it } from 'vitest';
import {
  buildAiPoweredApiUrl,
  fetchAiPoweredModelsFromCandidates,
  formatAiPoweredModelLabel,
  resolveAiPoweredBaseUrlCandidates,
  resolvePreferredAiPoweredModel
} from '../../web/lib/ai-powered.js';

describe('AI-Powered helpers', () => {
  it('builds direct and same-origin AI-Powered request URLs', () => {
    expect(buildAiPoweredApiUrl('api/ai-powered', 'health')).toBe('api/ai-powered/health.php');
    expect(buildAiPoweredApiUrl('http://127.0.0.1:3001', 'health')).toBe('http://127.0.0.1:3001/api/health');
    expect(buildAiPoweredApiUrl('http://localhost:3001', 'stream')).toBe('http://localhost:3001/api/stream');
  });

  it('prefers the configured AI-Powered proxy bridge before loopback endpoints', () => {
    expect(resolveAiPoweredBaseUrlCandidates('api/ai-powered')).toEqual([
      'api/ai-powered',
      'http://127.0.0.1:3001',
      'http://localhost:3001',
      'http://[::1]:3001'
    ]);
  });

  it('falls back through AI-Powered candidates until a provider responds', async () => {
    const requests = [];
    const fetchImpl = async (url) => {
      requests.push(String(url));

      if (String(url).startsWith('api/ai-powered/health.php')) {
        return {
          ok: false,
          status: 502,
          text: async () => 'bridge unavailable'
        };
      }

      if (String(url).startsWith('http://127.0.0.1:3001/api/health')) {
        throw new Error('Failed to fetch');
      }

      if (String(url).startsWith('http://localhost:3001/api/health')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok' }),
          text: async () => ''
        };
      }

      if (String(url).startsWith('http://localhost:3001/api/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ([
            { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', capabilities: ['text', 'structured'] }
          ]),
          text: async () => ''
        };
      }

      throw new Error(`Unexpected request: ${url}`);
    };

    const result = await fetchAiPoweredModelsFromCandidates({
      baseUrls: resolveAiPoweredBaseUrlCandidates('api/ai-powered'),
      fetchImpl
    });

    expect(result.baseUrl).toBe('http://localhost:3001');
    expect(result.models).toEqual([
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', capabilities: ['text', 'structured'] }
    ]);
    expect(requests).toEqual([
      'api/ai-powered/health.php',
      'http://127.0.0.1:3001/api/health',
      'http://localhost:3001/api/health',
      'http://localhost:3001/api/models?modality=text'
    ]);
  });

  it('prefers selected, cached, then heuristic AI-Powered models', () => {
    const models = [
      { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', capabilities: ['text'] },
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', capabilities: ['text', 'structured'] },
      { id: 'runway/gen-4', name: 'Runway Gen-4', capabilities: ['video'] }
    ];

    expect(resolvePreferredAiPoweredModel(models, {
      selectedModelId: 'anthropic/claude-sonnet-4'
    })).toMatchObject({
      modelId: 'anthropic/claude-sonnet-4',
      reason: 'selected'
    });

    expect(resolvePreferredAiPoweredModel(models, {
      selectedModelId: 'missing-model',
      cachedModelId: 'openai/gpt-4.1-mini'
    })).toMatchObject({
      modelId: 'openai/gpt-4.1-mini',
      reason: 'cached'
    });

    expect(resolvePreferredAiPoweredModel(models)).toMatchObject({
      modelId: 'anthropic/claude-sonnet-4',
      reason: 'heuristic'
    });

    expect(formatAiPoweredModelLabel(models[1])).toContain('Claude Sonnet 4');
    expect(formatAiPoweredModelLabel(models[1])).toContain('structured');
  });
});
