import { describe, expect, it } from 'vitest';
import {
  applySpeakerLabels,
  buildPlainTranscript,
  buildSrt,
  buildTimestampPreview,
  buildVtt,
  cleanupTranscript,
  formatBytes,
  formatDuration,
  formatTimestamp,
  normalizeSegments
} from '../../web/lib/transcript.js';

describe('transcript helpers', () => {
  it('cleans punctuation and repeated spaces', () => {
    expect(cleanupTranscript('Hello , world !  This  is  a test.')).toBe('Hello, world! This is a test.');
  });

  it('formats timestamps for subtitle export', () => {
    expect(formatTimestamp(65.23, ',')).toBe('00:01:05,230');
    expect(formatTimestamp(65.23, '.')).toBe('00:01:05.230');
  });

  it('builds SRT and VTT output with speaker labels', () => {
    const segments = applySpeakerLabels([
      { start: 0, end: 1.2, text: 'Hello there.' },
      { start: 1.2, end: 2.7, text: 'General Kenobi.' }
    ], true, ['A', 'B']);

    const srt = buildSrt(segments, { speakerMode: true, speakerNames: ['A', 'B'] });
    const vtt = buildVtt(segments, { speakerMode: true, speakerNames: ['A', 'B'] });
    expect(srt).toContain('00:00:00,000 --> 00:00:01,200');
    expect(srt).toContain('[A] Hello there.');
    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('[B] General Kenobi.');
  });

  it('builds previews and plain transcripts from segments', () => {
    const segments = normalizeSegments({
      chunks: [
        { timestamp: [0, 1], text: 'Hello' },
        { timestamp: [1, 2], text: 'world' }
      ]
    });

    expect(buildPlainTranscript(segments)).toBe('Hello\n\nworld');
    expect(buildTimestampPreview(segments, { includeTimestamps: true })).toContain('[00:00:00.000 - 00:00:01.000]');
  });

  it('formats sizes and durations for the UI', () => {
    expect(formatBytes(1536)).toBe('1.50 KB');
    expect(formatDuration(125)).toBe('2:05');
  });
});
