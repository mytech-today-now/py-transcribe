import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect } from '@playwright/test';
import JSZip from 'jszip';

const DEFAULT_TRANSCRIPT_TEXT = 'Transcript from local Whisper';
const DEFAULT_OLLAMA_PULL_LINES = [
  { status: 'pulling manifest', total: 100, completed: 10 },
  { status: 'pulling manifest', total: 100, completed: 60 },
  { status: 'success', total: 100, completed: 100 }
];
const DEFAULT_OLLAMA_CHAT_LINES = [
  { message: { content: 'Local summary.' }, done: false },
  { message: { content: '\n- Main idea.' }, done: false },
  { message: { content: '\n- Action item.' }, done: true }
];

export function createAudioFile({
  name = 'sample.wav',
  durationSeconds = 1,
  sampleRate = 16_000
} = {}) {
  return {
    name,
    mimeType: 'audio/wav',
    buffer: createSilentWavBuffer(durationSeconds, sampleRate)
  };
}

export function createVideoFile({
  name = 'sample.mp4',
  mimeType = 'video/mp4',
  content = 'fake video payload'
} = {}) {
  return {
    name,
    mimeType,
    buffer: Buffer.from(content, 'utf8')
  };
}

export function createUnsupportedFile({
  name = 'notes.txt',
  mimeType = 'text/plain',
  content = 'plain text'
} = {}) {
  return {
    name,
    mimeType,
    buffer: Buffer.from(content, 'utf8')
  };
}

export function createEmptyAudioFile({
  name = 'empty.wav',
  mimeType = 'audio/wav'
} = {}) {
  return {
    name,
    mimeType,
    buffer: Buffer.alloc(0)
  };
}

export function withSpoofedSize(file, sizeOverride) {
  return {
    ...file,
    sizeOverride
  };
}

export async function openApp(page, options = {}) {
  await installAppHarness(page, options);
  await page.goto('/');
  await page.locator('#loadRuntimeButton').waitFor({ state: 'visible' });
  await page.locator('#status').waitFor({ state: 'visible' });
}

export async function installLocalAiRoutes(page, {
  models = [],
  pullLines = DEFAULT_OLLAMA_PULL_LINES,
  chatLines = DEFAULT_OLLAMA_CHAT_LINES,
  pullDelayMs = 0,
  chatDelayMs = 0,
  tagsDelayMs = 0,
  proxyTagsStatus = 200
} = {}) {
  const requests = {
    tags: [],
    pull: [],
    chat: []
  };

  const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store'
  };

  const jsonHeaders = {
    ...corsHeaders,
    'content-type': 'application/json; charset=utf-8'
  };

  const ndjsonHeaders = {
    ...corsHeaders,
    'content-type': 'application/x-ndjson; charset=utf-8'
  };

  const fulfillPreflight = async (route) => {
    await route.fulfill({
      status: 204,
      headers: corsHeaders,
      body: ''
    });
  };

  const fulfillJson = async (route, payload, headers = jsonHeaders) => {
    await route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify(payload)
    });
  };

  const fulfillNdjson = async (route, lines, headers = ndjsonHeaders) => {
    const body = `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
    await route.fulfill({
      status: 200,
      headers,
      body
    });
  };

  await page.route(/\/api\/tags(?:\?.*)?$/i, async (route, request) => {
    requests.tags.push({
      method: request.method(),
      url: request.url(),
      kind: 'direct'
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }

    if (tagsDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, tagsDelayMs));
    }

    await fulfillJson(route, { models });
  });

  await page.route(/\/api\/ollama\/tags\.php(?:\?.*)?$/i, async (route, request) => {
    requests.tags.push({
      method: request.method(),
      url: request.url(),
      kind: 'proxy'
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }

    if (proxyTagsStatus !== 200) {
      await route.fulfill({
        status: proxyTagsStatus,
        headers: jsonHeaders,
        body: JSON.stringify({
          ok: false,
          error: 'Ollama proxy unavailable.'
        })
      });
      return;
    }

    if (tagsDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, tagsDelayMs));
    }

    await fulfillJson(route, { models });
  });

  await page.route(/\/api\/pull(?:\?.*)?$/i, async (route, request) => {
    const payload = request.postDataJSON?.() ?? null;
    requests.pull.push({
      method: request.method(),
      url: request.url(),
      postData: payload
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }

    if (pullDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pullDelayMs));
    }

    await fulfillNdjson(route, pullLines);

    const pulledModelName = String(payload?.model || '').trim();
    if (pulledModelName && !models.some((model) => String(model?.name || '').toLowerCase() === pulledModelName.toLowerCase())) {
      models.push({
        name: pulledModelName,
        details: {
          family: /kimi/i.test(pulledModelName) ? 'Kimi' : ''
        }
      });
    }
  });

  await page.route(/\/api\/chat(?:\?.*)?$/i, async (route, request) => {
    requests.chat.push({
      method: request.method(),
      url: request.url(),
      postData: request.postDataJSON?.() ?? null
    });

    if (request.method() === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }

    if (chatDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, chatDelayMs));
    }

    await fulfillNdjson(route, chatLines);
  });

  return requests;
}

export async function installAppHarness(page, options = {}) {
  const config = {
    whisperMode: 'ready',
    pythonMode: 'ready',
    whisperLoadDelayMs: 0,
    pythonLoadDelayMs: 0,
    transcribeDelayMs: 0,
    renderDelayMs: 0,
    ffmpegLoadDelayMs: 0,
    ffmpegExecDelayMs: 0,
    localAiAutoDownload: false,
    transcriptText: DEFAULT_TRANSCRIPT_TEXT,
    allowRealServiceWorker: false,
    ...options
  };

  await page.addInitScript(({ config: injectedConfig }) => {
    window.__TRANSCRIBE_CONFIG__ = Object.assign(window.__TRANSCRIBE_CONFIG__ || {}, {
      ...injectedConfig
    });

    const state = window.__pyTranscribeTestState = {
      config: { ...injectedConfig },
      workers: [],
      workerMessages: [],
      ffmpeg: {
        loadCalls: 0,
        execCalls: 0,
        terminateCalls: 0,
        writtenFiles: [],
        readFiles: []
      },
      downloads: []
    };

    const makeFloat32AudioBytes = (sampleCount = 16_000, sampleRate = 16_000) => {
      const samples = new Float32Array(sampleCount);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = Math.sin(index / 32) * 0.01;
      }

      return {
        sampleRate,
        bytes: new Uint8Array(samples.buffer.slice(0)),
        samples
      };
    };

    const emit = (listeners, type, event) => {
      for (const handler of listeners[type] || []) {
        handler(event);
      }
    };

    const schedule = (delay, callback) => window.setTimeout(callback, delay);
    const inferWorkerKind = (value) => {
      const text = String(value || '');
      let pathname = text;

      try {
        pathname = new URL(text, window.location.href).pathname;
      } catch {
        // Fall back to the raw string when the URL cannot be parsed.
      }

      if (pathname.includes('transcribe-worker')) {
        return 'whisper';
      }

      if (pathname.includes('python-worker')) {
        return 'python';
      }

      return 'unknown';
    };

    class FakeWorker {
      constructor(url, options = {}) {
        this.url = String(url);
        this.options = options;
        this.kind = inferWorkerKind(this.url);
        this.summary = {
          kind: this.kind,
          url: this.url,
          options: this.options
        };
        this.listeners = {
          message: [],
          error: [],
          messageerror: []
        };
        this.terminated = false;
        this.activeTranscribe = null;
        state.workers.push(this.summary);
      }

      addEventListener(type, handler) {
        if (this.listeners[type]) {
          this.listeners[type].push(handler);
        }
      }

      postMessage(message) {
        if (this.terminated) {
          throw new Error(`Worker already terminated: ${this.url}`);
        }

        state.workerMessages.push({
          kind: this.kind,
          message: { ...message }
        });

        queueMicrotask(() => this.#handleMessage(message));
      }

      terminate() {
        this.terminated = true;
      }

      #handleMessage(message) {
        if (this.terminated) {
          return;
        }

        if (message.type === 'init') {
          if (this.kind === 'unknown') {
            this.kind = message.modelId ? 'whisper' : 'python';
            this.summary.kind = this.kind;
          }

          const delayKey = this.kind === 'whisper' ? 'whisperLoadDelayMs' : 'pythonLoadDelayMs';
          const modeKey = this.kind === 'whisper' ? 'whisperMode' : 'pythonMode';
          schedule(Number(state.config[delayKey] || 0), () => {
            if (this.terminated) {
              return;
            }

            if (state.config[modeKey] === 'error') {
              const error = new Error(
                this.kind === 'whisper'
                  ? 'Whisper worker bootstrap failed.'
                  : 'Python worker bootstrap failed.'
              );
              emit(this.listeners, 'error', { message: error.message, error });
              return;
            }

            emit(this.listeners, 'message', {
              data: this.kind === 'whisper'
                ? {
                    id: message.id,
                    type: 'ready',
                    modelId: message.modelId,
                    device: message.device || 'wasm'
                  }
                : {
                    id: message.id,
                    type: 'ready'
                  }
            });
          });
          return;
        }

        if (message.type === 'render') {
          schedule(Number(state.config.renderDelayMs || 0), () => {
            if (this.terminated) {
              return;
            }

            const payload = message.payload || {};
            const baseText = String(payload.text || state.config.transcriptText || DEFAULT_TRANSCRIPT_TEXT).trim();
            const renderedText = payload.task === 'translate'
              ? `${baseText} (translated)`
              : baseText;
            const srt = [
              '1',
              '00:00:00,000 --> 00:00:01,000',
              renderedText
            ].join('\n');
            const vtt = [
              'WEBVTT',
              '',
              '00:00:00.000 --> 00:00:01.000',
              renderedText
            ].join('\n');

            emit(this.listeners, 'message', {
              data: {
                id: message.id,
                type: 'result',
                result: {
                  txt: renderedText,
                  srt,
                  vtt
                }
              }
            });
          });
          return;
        }

        if (message.type === 'transcribe') {
          const delay = Number(state.config.transcribeDelayMs || 0);
          const totalSeconds = Number(message.durationSeconds || 1);
          const progressPoints = [0.25, 0.5, 0.75, 1];
          const timerIds = [];
          const activeRequest = {
            id: message.id,
            cancelled: false,
            timerIds
          };

          this.activeTranscribe = activeRequest;

          for (const progress of progressPoints) {
            timerIds.push(schedule(delay * progress, () => {
              if (this.terminated || activeRequest.cancelled) {
                return;
              }

              emit(this.listeners, 'message', {
                data: {
                  type: 'progress',
                  phase: 'transcribe',
                  progress,
                  processedSeconds: Math.min(totalSeconds, totalSeconds * progress),
                  totalSeconds,
                  elapsedSeconds: delay * progress / 1000,
                  message: `Processed ${Math.round(progress * 100)}% of the audio.`
                }
              });
            }));
          }

          timerIds.push(schedule(delay, () => {
            if (this.terminated || activeRequest.cancelled) {
              return;
            }

            this.activeTranscribe = null;
            emit(this.listeners, 'message', {
              data: {
                id: message.id,
                type: 'result',
                result: {
                  text: state.config.transcriptText || DEFAULT_TRANSCRIPT_TEXT,
                  segments: [
                    {
                      start: 0,
                      end: Math.max(1, Math.min(1, totalSeconds || 1)),
                      text: state.config.transcriptText || DEFAULT_TRANSCRIPT_TEXT
                    }
                  ],
                  language: message.language || 'en',
                  processingSeconds: Math.max(0.25, delay / 1000)
                }
              }
            });
          }));
          return;
        }

        if (message.type === 'cancel') {
          const activeRequest = this.activeTranscribe;
          if (activeRequest) {
            activeRequest.cancelled = true;
            while (activeRequest.timerIds.length) {
              window.clearTimeout(activeRequest.timerIds.pop());
            }
            this.activeTranscribe = null;
            emit(this.listeners, 'message', {
              data: { type: 'status', message: 'Cancellation requested.' }
            });
            emit(this.listeners, 'message', {
              data: {
                id: activeRequest.id,
                type: 'error',
                error: {
                  name: 'Error',
                  message: 'Transcription cancelled.'
                }
              }
            });
            return;
          }

          emit(this.listeners, 'message', {
            data: { type: 'status', message: 'Cancellation requested.' }
          });
        }
      }
    }

    class FakeFFmpeg {
      constructor() {
        this.listeners = {
          log: [],
          progress: []
        };
        this.files = new Map();
      }

      on(type, handler) {
        if (this.listeners[type]) {
          this.listeners[type].push(handler);
        }
      }

      async load() {
        state.ffmpeg.loadCalls += 1;
        emit(this.listeners, 'log', { message: 'Fake FFmpeg loaded.' });
        const delay = Number(state.config.ffmpegLoadDelayMs || 0);
        if (delay > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, delay));
        }
      }

      async writeFile(name, data) {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        this.files.set(name, bytes);
        state.ffmpeg.writtenFiles.push(name);
      }

      async exec(args) {
        state.ffmpeg.execCalls += 1;
        emit(this.listeners, 'progress', { progress: 0.33 });
        emit(this.listeners, 'progress', { progress: 0.66 });
        emit(this.listeners, 'progress', { progress: 1 });
        const delay = Number(state.config.ffmpegExecDelayMs || 0);
        if (delay > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, delay));
        }

        const { bytes } = makeFloat32AudioBytes();
        this.files.set('audio.f32', bytes);
        return 0;
      }

      async readFile(name) {
        state.ffmpeg.readFiles.push(name);
        return this.files.get(name) || makeFloat32AudioBytes().bytes;
      }

      terminate() {
        state.ffmpeg.terminateCalls += 1;
      }
    }

    class FakeMediaRecorder {
      constructor(stream, options = {}) {
        this.stream = stream;
        this.mimeType = options.mimeType || 'audio/webm';
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onerror = null;
        this.onstop = null;
      }

      static isTypeSupported() {
        return true;
      }

      start() {
        this.state = 'recording';
      }

      stop() {
        if (this.state === 'inactive') {
          return;
        }

        this.state = 'inactive';
        queueMicrotask(() => {
          if (typeof this.ondataavailable === 'function') {
            this.ondataavailable({
              data: new Blob([new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])], { type: this.mimeType })
            });
          }

          if (typeof this.onstop === 'function') {
            this.onstop();
          }
        });
      }
    }

    const fakeRecordingStream = {
      getTracks: () => [{
        stop: () => {}
      }]
    };

    try {
      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: FakeMediaRecorder
      });
    } catch {
      window.MediaRecorder = FakeMediaRecorder;
    }

    try {
      Object.defineProperty(window.navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => fakeRecordingStream
        }
      });
    } catch {
      window.navigator.mediaDevices = {
        getUserMedia: async () => fakeRecordingStream
      };
    }

    window.__PY_TRANSCRIBE_TEST_HOOKS__ = {
      createFFmpeg: () => new FakeFFmpeg(),
      fetchFile: async (file) => new Uint8Array(await file.arrayBuffer()),
      getJSZip: undefined,
      toBlobURL: async (value) => String(value)
    };

    window.Worker = FakeWorker;

    if (window.navigator?.serviceWorker && !state.config.allowRealServiceWorker) {
      try {
        Object.defineProperty(window.navigator.serviceWorker, 'register', {
          configurable: true,
          value: async () => ({
            active: null,
            installing: null,
            waiting: null,
            update: async () => {}
          })
        });
      } catch {
        // Ignore read-only service worker registration overrides.
      }
    }

    if (window.navigator?.storage?.persist && !state.config.allowRealServiceWorker) {
      try {
        Object.defineProperty(window.navigator.storage, 'persist', {
          configurable: true,
          value: async () => true
        });
      } catch {
        // Ignore read-only storage persistence overrides.
      }
    }
  }, { config });
}

export async function selectFilesViaButton(page, fileDescriptors) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#dropZone').click();
  const chooser = await chooserPromise;
  await chooser.setFiles(fileDescriptors.map((descriptor) => ({
    ...descriptor,
    buffer: Buffer.isBuffer(descriptor.buffer)
      ? descriptor.buffer
      : Buffer.from(new Uint8Array(descriptor.buffer))
  })));
}

export async function dropFiles(page, selector, fileDescriptors) {
  const dataTransfer = await page.evaluateHandle(({ files }) => {
    const transfer = new DataTransfer();
    for (const descriptor of files) {
      const bytes = Array.isArray(descriptor.bytes)
        ? new Uint8Array(descriptor.bytes)
        : descriptor.buffer
          ? new Uint8Array(descriptor.buffer)
          : new Uint8Array();
      const blob = new Blob([bytes], { type: descriptor.mimeType || 'application/octet-stream' });
      const fileObject = new File([blob], descriptor.name, {
        type: descriptor.mimeType || 'application/octet-stream',
        lastModified: descriptor.lastModified || Date.now()
      });

      if (Number.isFinite(descriptor.sizeOverride)) {
        Object.defineProperty(fileObject, 'size', {
          configurable: true,
          value: descriptor.sizeOverride
        });
      }

      transfer.items.add(fileObject);
    }

    return transfer;
  }, {
    files: fileDescriptors.map(serializeFileDescriptor)
  });

  try {
    const eventInit = {
      bubbles: true,
      cancelable: true,
      dataTransfer
    };

    await page.locator(selector).dispatchEvent('dragenter', eventInit);
    await page.locator(selector).dispatchEvent('dragover', eventInit);
    await page.locator(selector).dispatchEvent('drop', eventInit);
  } finally {
    await dataTransfer.dispose();
  }
}

export async function loadRuntime(page) {
  await page.getByRole('button', { name: 'Load Whisper / Python' }).click();
}

export async function transcribeCurrentFile(page) {
  await page.getByRole('button', { name: 'Transcribe' }).click();
}

export async function recordMicrophoneClip(page, { holdForMs = 1100 } = {}) {
  await page.getByRole('button', { name: 'Record Mic' }).click();
  await expect(page.locator('#recordingState')).toContainText(/Recording/i);
  await page.waitForTimeout(holdForMs);
  await page.getByRole('button', { name: 'Stop Recording' }).click();
  await expect(page.locator('#recordingState')).toContainText(/Ready to review/i);
  await expect(page.locator('#recordingPreview')).toBeVisible();
  await expect(page.locator('#fileSummary')).toContainText('recording-');
}

export async function waitForFileSelection(page, fileName) {
  await expect(page.locator('#fileSummary')).toContainText(fileName);
}

export async function captureDownload(page, selector) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator(selector).click();
  const download = await downloadPromise;
  const tempDir = join(tmpdir(), 'py-transcribe-playwright');
  await mkdir(tempDir, { recursive: true });
  const tempPath = join(tempDir, `${randomUUID()}-${download.suggestedFilename()}`);
  await download.saveAs(tempPath);
  return {
    download,
    tempPath
  };
}

export async function readTextDownload(page, selector) {
  const { tempPath, download } = await captureDownload(page, selector);
  const contents = await readFile(tempPath, 'utf8');
  return {
    contents,
    suggestedFilename: download.suggestedFilename(),
    tempPath
  };
}

export async function readZipDownload(page, selector) {
  const { tempPath, download } = await captureDownload(page, selector);
  const contents = await readFile(tempPath);
  const archive = await JSZip.loadAsync(contents);
  return {
    archive,
    suggestedFilename: download.suggestedFilename(),
    tempPath
  };
}

export function chunkCases(cases, maxPerGroup = 4) {
  const groups = [];
  for (let index = 0; index < cases.length; index += maxPerGroup) {
    groups.push(cases.slice(index, index + maxPerGroup));
  }
  return groups;
}

export function spoofSize(fileDescriptor, sizeOverride) {
  return {
    ...serializeFileDescriptor(fileDescriptor),
    sizeOverride
  };
}

export function serializeFileDescriptor(fileDescriptor) {
  const buffer = toArrayBuffer(fileDescriptor.buffer);
  return {
    name: fileDescriptor.name,
    mimeType: fileDescriptor.mimeType,
    buffer,
    bytes: Array.from(new Uint8Array(buffer)),
    lastModified: fileDescriptor.lastModified,
    sizeOverride: fileDescriptor.sizeOverride
  };
}

export function toArrayBuffer(value) {
  const bytes = value instanceof Uint8Array
    ? value
    : Buffer.isBuffer(value)
      ? new Uint8Array(value)
      : new Uint8Array(value || []);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function createSilentWavBuffer(durationSeconds, sampleRate) {
  const totalSamples = Math.max(1, Math.round(durationSeconds * sampleRate));
  const bytesPerSample = 2;
  const dataSize = totalSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}
