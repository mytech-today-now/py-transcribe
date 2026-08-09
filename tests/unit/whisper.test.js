import { describe, expect, it } from 'vitest';
import {
  buildWhisperTranscriptionRequest,
  isEnglishOnlyWhisperModel
} from '../../web/lib/whisper.js';

describe('whisper helpers', () => {
  it('identifies English-only Whisper models', () => {
    expect(isEnglishOnlyWhisperModel('Xenova/whisper-tiny.en')).toBe(true);
    expect(isEnglishOnlyWhisperModel('Xenova/whisper-small')).toBe(false);
  });

  it('drops unsupported task and language settings for English-only models', () => {
    const request = buildWhisperTranscriptionRequest({
      modelId: 'Xenova/whisper-tiny.en',
      task: 'translate',
      language: 'es'
    });

    expect(request.englishOnly).toBe(true);
    expect(request.task).toBe('transcribe');
    expect(request.language).toBe('auto');
    expect(request.options).toEqual({
      return_timestamps: true
    });
  });

  it('keeps translation options for multilingual models', () => {
    const request = buildWhisperTranscriptionRequest({
      modelId: 'Xenova/whisper-small',
      task: 'translate',
      language: 'es'
    });

    expect(request.englishOnly).toBe(false);
    expect(request.task).toBe('translate');
    expect(request.language).toBe('es');
    expect(request.options).toEqual({
      return_timestamps: true,
      task: 'translate',
      language: 'es'
    });
  });
});
