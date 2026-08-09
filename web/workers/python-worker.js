import {
  applySpeakerLabels,
  buildPlainTranscript,
  buildSrt,
  buildTimestampPreview,
  buildVtt
} from '../lib/transcript.js';

self.addEventListener('message', async (event) => {
  const message = event.data ?? {};

  try {
    if (message.type === 'init') {
      self.postMessage({
        id: message.id,
        type: 'ready'
      });
      return;
    }

    if (message.type === 'render') {
      const payload = message.payload ?? {};
      const speakerNames = extractSpeakerNames(payload.speakerNames, payload.speakerMode);
      const segments = applySpeakerLabels(payload.segments ?? [], Boolean(payload.speakerMode), speakerNames);
      const txt = payload.editorText != null
        ? String(payload.editorText)
        : buildPlainTranscript(segments, {
          cleanup: Boolean(payload.cleanup),
          speakerMode: Boolean(payload.speakerMode),
          speakerNames
        });
      const srt = buildSrt(segments, {
        cleanup: Boolean(payload.cleanup),
        speakerMode: Boolean(payload.speakerMode),
        speakerNames
      });
      const vtt = buildVtt(segments, {
        cleanup: Boolean(payload.cleanup),
        speakerMode: Boolean(payload.speakerMode),
        speakerNames
      });
      const preview = buildTimestampPreview(segments, {
        cleanup: Boolean(payload.cleanup),
        speakerMode: Boolean(payload.speakerMode),
        speakerNames,
        includeTimestamps: Boolean(payload.timestamps)
      });

      self.postMessage({
        id: message.id,
        type: 'result',
        result: {
          txt,
          srt,
          vtt,
          preview
        }
      });
      return;
    }

    self.postMessage({
      id: message.id,
      type: 'error',
      error: {
        name: 'Error',
        message: `Unsupported formatter worker message: ${String(message.type)}`
      }
    });
  } catch (error) {
    self.postMessage({
      id: message.id,
      type: 'error',
      error: serializeError(error)
    });
  }
});

function extractSpeakerNames(value, speakerMode) {
  const names = Array.isArray(value) ? value : [];
  if (!speakerMode) {
    return names;
  }

  const primary = String(names[0] || 'Speaker 1').trim() || 'Speaker 1';
  const secondary = String(names[1] || 'Speaker 2').trim() || 'Speaker 2';
  return [primary, secondary];
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return {
    name: 'Error',
    message: String(error?.message || error || 'Formatter worker error.')
  };
}
