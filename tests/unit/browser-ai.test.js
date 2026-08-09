import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildBrowserStorageWarning,
  describeBrowserAiError,
  estimateBrowserStorageQuota,
  formatBrowserAiModelLabel,
  getBrowserAiModelById,
  normalizeBrowserAiModel,
  normalizeLocalAiRuntimeMode,
  resolvePreferredBrowserAiModel
} from '../../web/lib/browser-ai.js';

describe('browser AI helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes runtime mode values and browser model metadata', () => {
    expect(normalizeLocalAiRuntimeMode('browser')).toBe('browser');
    expect(normalizeLocalAiRuntimeMode('LOCAL')).toBe('local');
    expect(normalizeLocalAiRuntimeMode('unexpected')).toBe('auto');

    const model = getBrowserAiModelById('kimi-qwen35-2b-q4');
    expect(model).not.toBeNull();
    expect(formatBrowserAiModelLabel(model)).toContain('Kimi/Opus Distill 2B');
    expect(formatBrowserAiModelLabel(model)).toContain('Q4_K_M');
  });

  it('prefers the selected model, then cached model, then a smaller low-memory fallback', () => {
    expect(resolvePreferredBrowserAiModel({
      selectedModelId: 'kimi-qwen35-2b-q2'
    }).model?.id).toBe('kimi-qwen35-2b-q2');

    expect(resolvePreferredBrowserAiModel({
      cachedModelId: 'kimi-v2-1p2b-q4'
    }).model?.id).toBe('kimi-v2-1p2b-q4');

    expect(resolvePreferredBrowserAiModel({
      deviceMemory: 2,
      hardwareConcurrency: 2
    }).model?.id).toBe('kimi-v2-1p2b-q4');
  });

  it('surfaces browser storage pressure and actionable errors', async () => {
    expect(buildBrowserStorageWarning({
      usage: 900_000_000,
      quota: 1_000_000_000
    })).toContain('nearly full');

    expect(describeBrowserAiError(new Error('Failed to fetch'), {
      phase: 'connect',
      modelName: 'Kimi/Opus Distill 2B'
    })).toContain('Could not download the browser model');

    expect(describeBrowserAiError(new Error('AbortError'), {
      phase: 'summary'
    })).toBe('Browser summarization cancelled.');

    expect(describeBrowserAiError(new Error('out of memory'), {
      phase: 'chat',
      modelName: 'Kimi V2 Distill 1.2B'
    })).toContain('ran out of memory');

    const quota = await estimateBrowserStorageQuota({
      estimateImpl: async () => ({
        usage: 850_000_000,
        quota: 1_000_000_000
      })
    });

    expect(quota.supported).toBe(true);
    expect(quota.warning).toContain('getting tight');
  });

  it('returns null for malformed browser model metadata', () => {
    expect(normalizeBrowserAiModel({})).toBeNull();
    expect(normalizeBrowserAiModel(null)).toBeNull();
    expect(normalizeBrowserAiModel({
      id: 'demo',
      label: 'Demo',
      repo: 'repo',
      file: 'file.gguf'
    })).not.toBeNull();
  });
});
