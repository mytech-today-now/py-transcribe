import { extractAudioWithFfmpeg } from './ffmpeg.js';
import { formatBytes } from './transcript.js';

const AUDIO_EXTENSIONS = new Set([
  'wav',
  'mp3',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'opus',
  'webm',
  'flac'
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'm4v',
  'mov',
  'qt',
  'webm',
  'ogv'
]);

export function classifyMediaFile(file) {
  const extension = getExtension(file);
  const mime = String(file?.type ?? '').toLowerCase();

  if (mime.startsWith('audio/') || AUDIO_EXTENSIONS.has(extension)) {
    return { kind: 'audio', extension, mime };
  }

  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.has(extension)) {
    return { kind: 'video', extension, mime };
  }

  return { kind: 'unknown', extension, mime };
}

export function validateMediaFile(file, maxBytes, { allowVideo = true } = {}) {
  if (!(file instanceof File)) {
    return {
      ok: false,
      message: 'Choose an audio file first.'
    };
  }

  if (file.size === 0) {
    return {
      ok: false,
      message: 'That file is empty.'
    };
  }

  if (Number.isFinite(maxBytes) && file.size > maxBytes) {
    return {
      ok: false,
      message: `That file is too large for this browser build. The current limit is ${formatBytes(maxBytes)}.`
    };
  }

  const media = classifyMediaFile(file);
  if (media.kind === 'unknown' || (!allowVideo && media.kind === 'video')) {
    return {
      ok: false,
      message: 'Unsupported file type. Use wav, mp3, m4a, webm, ogg, or a similar browser-decodable format.'
    };
  }

  return {
    ok: true,
    kind: media.kind,
    extension: media.extension,
    mime: media.mime
  };
}

export async function extractNormalizedAudio(file, {
  targetSampleRate = 16_000,
  preferFfmpeg = false
} = {}) {
  if (!(file instanceof File)) {
    throw new TypeError('Expected a File object.');
  }

  if (!preferFfmpeg) {
    try {
      return await decodeToMono16k(file, targetSampleRate);
    } catch (error) {
      // Browser audio decoding is fast when it works, but some containers and
      // codecs still need the FFmpeg fallback on shared hosting-friendly builds.
      console.warn('Browser decode failed, falling back to FFmpeg:', error);
    }
  }

  const samples = await extractAudioWithFfmpeg(file);
  return {
    samples,
    sampleRate: targetSampleRate,
    durationSeconds: samples.length / targetSampleRate,
    source: 'FFmpeg extraction'
  };
}

export async function decodeToMono16k(file, targetSampleRate = 16_000) {
  const context = new AudioContext();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const mono = mixToMono(decoded);
    const samples = resampleFloat32(mono.samples, mono.sampleRate, targetSampleRate);
    return {
      samples,
      sampleRate: targetSampleRate,
      durationSeconds: samples.length / targetSampleRate,
      source: 'browser audio decode'
    };
  } finally {
    await context.close().catch(() => {});
  }
}

export function mixToMono(audioBuffer) {
  const channels = [];
  for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
    channels.push(audioBuffer.getChannelData(channelIndex));
  }

  if (channels.length === 1) {
    return {
      samples: new Float32Array(channels[0]),
      sampleRate: audioBuffer.sampleRate
    };
  }

  const length = audioBuffer.length;
  const mixed = new Float32Array(length);
  for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
    let total = 0;
    for (const channel of channels) {
      total += channel[sampleIndex] || 0;
    }
    mixed[sampleIndex] = total / channels.length;
  }

  return {
    samples: mixed,
    sampleRate: audioBuffer.sampleRate
  };
}

export function resampleFloat32(samples, sourceSampleRate, targetSampleRate = 16_000) {
  const source = samples instanceof Float32Array ? samples : new Float32Array(samples);
  if (sourceSampleRate === targetSampleRate) {
    return new Float32Array(source);
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.round(source.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(source.length - 1, leftIndex + 1);
    const weight = position - leftIndex;
    const left = source[leftIndex] ?? 0;
    const right = source[rightIndex] ?? left;
    output[index] = left + (right - left) * weight;
  }

  return output;
}

export function encodeWavBytes(samples, sampleRate = 16_000) {
  const source = samples instanceof Float32Array ? samples : new Float32Array(samples);
  const dataSize = source.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < source.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, source[index] ?? 0));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

export function encodeWavBlob(samples, sampleRate = 16_000) {
  return new Blob([encodeWavBytes(samples, sampleRate)], { type: 'audio/wav' });
}

function writeString(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function getExtension(file) {
  const name = String(file?.name ?? '').toLowerCase();
  const match = name.match(/\.([a-z0-9]+)$/);
  if (match?.[1]) {
    return match[1];
  }

  const mime = String(file?.type ?? '').toLowerCase();
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  return '';
}
