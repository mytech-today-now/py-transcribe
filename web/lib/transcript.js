const DEFAULT_SPEAKER_NAMES = ['Speaker 1', 'Speaker 2'];

export function slugify(value, fallback = 'transcript') {
  const normalized = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s_-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .toLowerCase();

  return normalized || fallback;
}

export function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) {
    return `${size} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unitIndex]}`;
}

export function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Number(seconds) || 0);
  const wholeSeconds = Math.floor(totalSeconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const secs = wholeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function formatTimestamp(seconds, separator = ',') {
  const totalMilliseconds = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1_000);
  const millis = totalMilliseconds % 1_000;

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(secs).padStart(2, '0')
  ].join(':') + `${separator}${String(millis).padStart(3, '0')}`;
}

export function cleanupTranscript(text) {
  const source = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (!source) {
    return '';
  }

  return source
    .split(/\n{2,}/)
    .map((paragraph) => paragraph
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([,.;:!?])(?![\s"')\]\}])/g, '$1 ')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

export function buildPlainTranscript(segments, { cleanup = false, speakerMode = false, speakerNames = DEFAULT_SPEAKER_NAMES } = {}) {
  const lines = [];

  for (const [index, segment] of (Array.isArray(segments) ? segments : []).entries()) {
    const text = cleanup ? cleanupTranscript(segment?.text) : String(segment?.text ?? '').trim();
    if (!text) {
      continue;
    }

    if (speakerMode) {
      const label = segment?.speakerLabel || speakerNames[index % speakerNames.length] || `Speaker ${index + 1}`;
      lines.push(`[${label}] ${text}`);
    } else {
      lines.push(text);
    }
  }

  return lines.join('\n\n').trim();
}

export function buildTimestampPreview(segments, {
  cleanup = false,
  speakerMode = false,
  speakerNames = DEFAULT_SPEAKER_NAMES,
  includeTimestamps = true
} = {}) {
  const prepared = applySpeakerLabels(segments, speakerMode, speakerNames);

  if (!includeTimestamps) {
    return buildPlainTranscript(prepared, { cleanup, speakerMode, speakerNames });
  }

  if (!prepared.length) {
    return 'No transcript yet.';
  }

  return prepared.map((segment) => {
    const start = formatTimestamp(segment.start, '.');
    const end = formatTimestamp(segment.end, '.');
    const text = cleanup ? cleanupTranscript(segment.text) : String(segment.text ?? '').trim();
    const speakerPrefix = segment.speakerLabel ? `[${segment.speakerLabel}] ` : '';
    return `[${start} - ${end}] ${speakerPrefix}${text}`.trim();
  }).join('\n');
}

export function buildSrt(segments, {
  cleanup = false,
  speakerMode = false,
  speakerNames = DEFAULT_SPEAKER_NAMES
} = {}) {
  const prepared = applySpeakerLabels(segments, speakerMode, speakerNames);

  if (!prepared.length) {
    return '1\n00:00:00,000 --> 00:00:01,000\nNo transcript yet.';
  }

  return prepared.map((segment, index) => {
    const text = cleanup ? cleanupTranscript(segment.text) : String(segment.text ?? '').trim();
    const speakerPrefix = segment.speakerLabel ? `[${segment.speakerLabel}] ` : '';
    return [
      String(index + 1),
      `${formatTimestamp(segment.start, ',')} --> ${formatTimestamp(segment.end, ',')}`,
      `${speakerPrefix}${text}`.trim()
    ].join('\n');
  }).join('\n\n');
}

export function buildVtt(segments, {
  cleanup = false,
  speakerMode = false,
  speakerNames = DEFAULT_SPEAKER_NAMES
} = {}) {
  const prepared = applySpeakerLabels(segments, speakerMode, speakerNames);

  if (!prepared.length) {
    return 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nNo transcript yet.';
  }

  return [
    'WEBVTT',
    '',
    ...prepared.map((segment) => {
      const text = cleanup ? cleanupTranscript(segment.text) : String(segment.text ?? '').trim();
      const speakerPrefix = segment.speakerLabel ? `[${segment.speakerLabel}] ` : '';
      return [
        `${formatTimestamp(segment.start, '.')} --> ${formatTimestamp(segment.end, '.')}`,
        `${speakerPrefix}${text}`.trim(),
        ''
      ].join('\n');
    })
  ].join('\n').trimEnd();
}

export function normalizeSegments(result, fallbackDurationSeconds = 1) {
  const chunks = Array.isArray(result?.chunks) ? result.chunks : [];
  if (chunks.length === 0) {
    const text = String(result?.text ?? '').trim();
    return text ? [{
      start: 0,
      end: Math.max(1, Number(fallbackDurationSeconds) || 1),
      text
    }] : [];
  }

  const segments = [];
  let fallbackStart = 0;

  for (const chunk of chunks) {
    const timestamp = Array.isArray(chunk?.timestamp) ? chunk.timestamp : [];
    const rawStart = Number(timestamp[0]);
    const rawEnd = Number(timestamp[1]);
    const start = Number.isFinite(rawStart) ? rawStart : fallbackStart;
    let end = Number.isFinite(rawEnd) ? rawEnd : Math.max(start + 1, fallbackStart + 1);
    if (end <= start) {
      end = start + 0.5;
    }

    const text = String(chunk?.text ?? '').trim();
    if (text) {
      segments.push({ start, end, text });
    }

    fallbackStart = end;
  }

  if (!segments.length) {
    const text = String(result?.text ?? '').trim();
    return text ? [{
      start: 0,
      end: Math.max(1, Number(fallbackDurationSeconds) || 1),
      text
    }] : [];
  }

  return segments;
}

export function applySpeakerLabels(segments, speakerMode = false, speakerNames = DEFAULT_SPEAKER_NAMES) {
  const prepared = [];
  const names = Array.isArray(speakerNames) && speakerNames.length > 0
    ? speakerNames.map((name, index) => String(name || `Speaker ${index + 1}`).trim() || `Speaker ${index + 1}`)
    : DEFAULT_SPEAKER_NAMES;

  for (const [index, segment] of (Array.isArray(segments) ? segments : []).entries()) {
    const text = String(segment?.text ?? '').trim();
    if (!text) {
      continue;
    }

    prepared.push({
      ...segment,
      text,
      speakerLabel: speakerMode ? names[index % names.length] : ''
    });
  }

  return prepared;
}

export function buildExportBaseName(fileName, task = 'transcribe') {
  const stem = slugify(String(fileName ?? '').replace(/\.[^.]+$/, ''));
  return `${stem}-${task === 'translate' ? 'translation' : 'transcript'}`;
}

export function buildExportNames(fileName, task = 'transcribe') {
  const baseName = buildExportBaseName(fileName, task);
  return {
    baseName,
    txt: `${baseName}.txt`,
    srt: `${baseName}.srt`,
    vtt: `${baseName}.vtt`,
    wav: `${baseName}-cleaned.wav`,
    zip: `${baseName}.zip`
  };
}
