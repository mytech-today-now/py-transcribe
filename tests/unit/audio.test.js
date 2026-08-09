import { describe, expect, it } from 'vitest';
import {
  classifyMediaFile,
  encodeWavBytes,
  resampleFloat32,
  validateMediaFile
} from '../../web/lib/audio.js';

describe('audio helpers', () => {
  it('classifies common media types', () => {
    expect(classifyMediaFile(new File([''], 'sample.wav', { type: 'audio/wav' })).kind).toBe('audio');
    expect(classifyMediaFile(new File([''], 'sample.mp4', { type: 'video/mp4' })).kind).toBe('video');
  });

  it('validates file size and type', () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    expect(validateMediaFile(file, 1024).ok).toBe(false);
  });

  it('resamples float32 audio and emits a WAV header', () => {
    const samples = resampleFloat32(new Float32Array([0, 1, 0, -1]), 4, 8);
    expect(samples).toHaveLength(8);

    const wav = encodeWavBytes(new Float32Array([0, 0.5, -0.5]), 16_000);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe('WAVE');
  });
});
