import { describe, expect, it } from 'vitest';
import {
  AI_POWERED_NGROK_BASE_URL,
  buildAiPoweredApiUrl,
  buildAiPoweredSelectionKey,
  fetchAiPoweredCatalogsFromCandidates,
  fetchAiPoweredModelsFromCandidates,
  formatAiPoweredModelLabel,
  parseAiPoweredSelectionKey,
  resolveAiPoweredBaseUrlCandidates,
  resolvePreferredAiPoweredModel
} from '../../web/lib/ai-powered.js';

describe('AI-Powered helpers', () => {
  it('builds direct and same-origin AI-Powered request URLs', () => {
    expect(buildAiPoweredApiUrl('api/ai-powered', 'health')).toBe('api/ai-powered/health.php');
    expect(buildAiPoweredApiUrl('api/ai-powered', 'providers')).toBe('api/ai-powered/providers.php');
    expect(buildAiPoweredApiUrl('http://127.0.0.1:3001', 'health')).toBe('api/ai-powered/health.php?upstream=local');
    expect(buildAiPoweredApiUrl('http://localhost:3001', 'stream')).toBe('api/ai-powered/stream.php?upstream=localhost');
    expect(buildAiPoweredApiUrl(AI_POWERED_NGROK_BASE_URL, 'providers')).toBe('api/ai-powered/providers.php?upstream=ngrok');
  });

  it('prefers the configured AI-Powered proxy bridge before ngrok and loopback endpoints', () => {
    expect(resolveAiPoweredBaseUrlCandidates('api/ai-powered')).toEqual([
      'api/ai-powered',
      AI_POWERED_NGROK_BASE_URL,
      'http://127.0.0.1:3001',
      'http://localhost:3001',
      'http://[::1]:3001'
    ]);
  });

  it('falls back through AI-Powered candidates until a provider responds', async () => {
    const requests = [];
    const fetchImpl = async (url) => {
      requests.push(String(url));

      if (String(url).startsWith('api/ai-powered/health.php?upstream=ngrok')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok' }),
          text: async () => ''
        };
      }

      if (String(url).startsWith('api/ai-powered/health.php')) {
        return {
          ok: false,
          status: 502,
          text: async () => 'bridge unavailable'
        };
      }

      if (String(url).startsWith('api/ai-powered/models.php?upstream=ngrok')) {
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

    expect(result.baseUrl).toBe(AI_POWERED_NGROK_BASE_URL);
    expect(result.models).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'anthropic/claude-sonnet-4',
        name: 'Claude Sonnet 4',
        capabilities: ['text', 'structured']
      })
    ]));
    expect(requests).toEqual([
      'api/ai-powered/health.php',
      'api/ai-powered/health.php?upstream=ngrok',
      'api/ai-powered/models.php?upstream=ngrok&modality=text'
    ]);
  });

  it('fetches and combines provider catalogs across reachable endpoints', async () => {
    const requests = [];
    const sameOriginProviders = [
      { id: 'anthropic', name: 'Anthropic', active: true, modalities: ['text', 'structured'], inputModalities: [] },
      { id: 'openai', name: 'OpenAI', active: true, modalities: ['text'], inputModalities: [] }
    ];
    const ngrokProviders = [
      { id: 'xai', name: 'xAI / Grok', active: true, modalities: ['text', 'structured'], inputModalities: [] },
      { id: 'openrouter', name: 'OpenRouter', active: true, modalities: ['text'], inputModalities: [] }
    ];

    const catalogModels = {
      sameOrigin: {
        anthropic: [
          {
            id: 'anthropic/claude-sonnet-4',
            name: 'Claude Sonnet 4',
            capabilities: ['text', 'structured'],
            providerId: 'anthropic',
            providerName: 'Anthropic'
          }
        ],
        openai: [
          {
            id: 'openai/gpt-4.1-mini',
            name: 'GPT-4.1 Mini',
            capabilities: ['text'],
            providerId: 'openai',
            providerName: 'OpenAI'
          }
        ]
      },
      ngrok: {
        xai: [
          {
            id: 'xai/grok-4',
            name: 'Grok 4',
            capabilities: ['text', 'structured'],
            providerId: 'xai',
            providerName: 'xAI / Grok'
          }
        ],
        openrouter: [
          {
            id: 'openrouter/qwen-3-coder',
            name: 'Qwen 3 Coder',
            capabilities: ['text'],
            providerId: 'openrouter',
            providerName: 'OpenRouter'
          }
        ]
      }
    };

    const fetchImpl = async (url) => {
      requests.push(String(url));
      const text = String(url);

      if (text.startsWith('api/ai-powered/health.php?upstream=ngrok')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', service: 'ai-powered' }),
          text: async () => ''
        };
      }

      if (text.startsWith('api/ai-powered/health.php')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', service: 'ai-powered' }),
          text: async () => ''
        };
      }

      if (text.startsWith('api/ai-powered/providers.php')) {
        const parsed = new URL(text, 'http://example.test');
        const upstream = parsed.searchParams.get('upstream') || '';
        return {
          ok: true,
          status: 200,
          json: async () => upstream === 'ngrok' ? ngrokProviders : sameOriginProviders,
          text: async () => ''
        };
      }

      if (text.startsWith('api/ai-powered/models.php')) {
        const parsed = new URL(text, 'http://example.test');
        const upstream = parsed.searchParams.get('upstream') || '';
        const provider = parsed.searchParams.get('provider') || '';
        return {
          ok: true,
          status: 200,
          json: async () => (upstream === 'ngrok'
            ? catalogModels.ngrok[provider] || []
            : catalogModels.sameOrigin[provider] || []),
          text: async () => ''
        };
      }

      throw new Error(`Unexpected request: ${url}`);
    };

    const result = await fetchAiPoweredCatalogsFromCandidates({
      baseUrls: resolveAiPoweredBaseUrlCandidates('api/ai-powered'),
      fetchImpl
    });

    expect(result.catalogs).toHaveLength(2);
    expect(result.providers).toHaveLength(4);
    expect(result.models).toHaveLength(4);
    expect(result.models.some((model) => model.baseUrl === 'api/ai-powered' && model.providerId === 'anthropic')).toBe(true);
    expect(result.models.some((model) => model.baseUrl === AI_POWERED_NGROK_BASE_URL && model.providerId === 'xai')).toBe(true);

    const selectionKey = buildAiPoweredSelectionKey({
      baseUrl: AI_POWERED_NGROK_BASE_URL,
      providerId: 'xai',
      modelId: 'xai/grok-4'
    });
    expect(parseAiPoweredSelectionKey(selectionKey)).toEqual({
      baseUrl: AI_POWERED_NGROK_BASE_URL,
      providerId: 'xai',
      modelId: 'xai/grok-4'
    });

    expect(requests).toEqual(expect.arrayContaining([
      'api/ai-powered/health.php',
      'api/ai-powered/providers.php',
      'api/ai-powered/models.php?provider=anthropic&modality=text',
      'api/ai-powered/models.php?provider=openai&modality=text',
      'api/ai-powered/health.php?upstream=ngrok',
      'api/ai-powered/providers.php?upstream=ngrok',
      'api/ai-powered/models.php?upstream=ngrok&provider=xai&modality=text',
      'api/ai-powered/models.php?upstream=ngrok&provider=openrouter&modality=text'
    ]));
  });

  it('prefers selected, cached, then heuristic AI-Powered models', () => {
    const models = [
      { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', capabilities: ['text'] },
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', capabilities: ['text', 'structured'] },
      { id: 'runway/gen-4', name: 'Runway Gen-4', capabilities: ['video'] },
      {
        id: 'xai/grok-4',
        name: 'Grok 4',
        capabilities: ['text', 'structured'],
        providerId: 'xai',
        providerName: 'xAI / Grok',
        baseUrl: AI_POWERED_NGROK_BASE_URL
      },
      {
        id: 'xai/grok-4',
        name: 'Grok 4',
        capabilities: ['text', 'structured'],
        providerId: 'xai',
        providerName: 'xAI / Grok',
        baseUrl: 'api/ai-powered'
      }
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

    expect(resolvePreferredAiPoweredModel(models, {
      selectedModelId: 'xai/grok-4',
      selectedProviderId: 'xai',
      selectedBaseUrl: AI_POWERED_NGROK_BASE_URL
    })).toMatchObject({
      modelId: 'xai/grok-4',
      reason: 'selected'
    });

    expect(formatAiPoweredModelLabel(models[1])).toContain('Claude Sonnet 4');
    expect(formatAiPoweredModelLabel(models[1])).toContain('structured');
    expect(formatAiPoweredModelLabel(models[3])).toContain('xAI / Grok');
  });
});
