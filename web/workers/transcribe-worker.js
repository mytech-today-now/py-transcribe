import { pipeline, env, WhisperTextStreamer } from '@huggingface/transformers';
import { buildWhisperTranscriptionRequest } from '../lib/whisper.js';

let modelPromise = null;
let modelConfig = null;
let transcriber = null;

env.allowRemoteModels = true;
env.allowLocalModels = false;
env.useBrowserCache = true;
env.useFS = false;

self.addEventListener('message', async (event) => {
  const message = event.data ?? {};

  try {
    if (message.type === 'init') {
      await ensureModel(message);
      self.postMessage({
        id: message.id,
        type: 'ready',
        modelId: modelConfig?.modelId ?? message.modelId,
        device: modelConfig?.device ?? message.device ?? 'wasm'
      });
      return;
    }

    if (message.type === 'transcribe') {
      await ensureModel({
        modelId: message.modelId,
        device: message.device,
        allowDeviceFallback: true
      });

      const result = await transcribeAudio(message);
      self.postMessage({
        id: message.id,
        type: 'result',
        result
      });
      return;
    }

    if (message.type === 'cancel') {
      return;
    }

    self.postMessage({
      id: message.id,
      type: 'error',
      error: {
        name: 'Error',
        message: `Unsupported whisper worker message: ${String(message.type)}`
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

async function ensureModel(message) {
  const requestedModelId = String(message.modelId || 'Xenova/whisper-tiny.en');
  const requestedDevice = String(message.device || 'wasm');
  const allowDeviceFallback = message.allowDeviceFallback !== false;

  if (
    transcriber &&
    modelConfig &&
    modelConfig.modelId === requestedModelId &&
    modelConfig.device === requestedDevice
  ) {
    return transcriber;
  }

  const load = async (device) => {
    modelConfig = {
      modelId: requestedModelId,
      device
    };

    modelPromise = pipeline('automatic-speech-recognition', requestedModelId, {
      device,
      progress_callback: (info) => {
        self.postMessage({
          id: message.id,
          type: 'progress',
          progress: info
        });
      }
    });

    transcriber = await modelPromise;
    return transcriber;
  };

  try {
    return await load(requestedDevice);
  } catch (error) {
    if (allowDeviceFallback && requestedDevice === 'webgpu') {
      return await load('wasm');
    }

    throw error;
  }
}

async function transcribeAudio(message) {
  const audio = message.audio instanceof Float32Array
    ? message.audio
    : new Float32Array(message.audio ?? []);
  const durationSeconds = Number(message.durationSeconds) || (audio.length / 16_000) || 1;
  const useChunking = durationSeconds > 30;
  const request = buildWhisperTranscriptionRequest({
    modelId: message.modelId,
    task: message.task,
    language: message.language
  });
  const options = {
    ...request.options
  };

  if (useChunking) {
    options.chunk_length_s = 30;
    options.stride_length_s = 5;
  }

  if (transcriber?.tokenizer) {
    const streamer = new WhisperTextStreamer(transcriber.tokenizer, {
      skip_prompt: true,
      callback_function: (text) => {
        self.postMessage({
          id: message.id,
          type: 'partial',
          text: String(text ?? '')
        });
      }
    });

    options.streamer = streamer;
  }

  const startedAt = performance.now();
  const output = await transcriber(audio, options);
  const processingSeconds = Math.max(0.01, (performance.now() - startedAt) / 1000);

  return {
    text: String(output?.text ?? '').trim(),
    chunks: Array.isArray(output?.chunks) ? output.chunks : [],
    language: String(output?.language ?? message.language ?? 'auto'),
    processingSeconds,
    modelId: modelConfig?.modelId ?? message.modelId,
    device: modelConfig?.device ?? message.device ?? 'wasm'
  };
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
    message: String(error?.message || error || 'Whisper worker error.')
  };
}
