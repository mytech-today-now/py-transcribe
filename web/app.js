import {
  applySpeakerLabels,
  buildExportBaseName,
  buildExportNames,
  buildPlainTranscript,
  buildSrt,
  buildTimestampPreview,
  buildVtt,
  cleanupTranscript,
  formatBytes,
  formatDuration,
  normalizeSegments,
  slugify
} from './lib/transcript.js';
import {
  classifyMediaFile,
  decodeToMono16k,
  encodeWavBlob,
  extractNormalizedAudio,
  validateMediaFile,
  encodeWavBytes
} from './lib/audio.js';
import {
  buildWhisperTranscriptionRequest,
  isEnglishOnlyWhisperModel
} from './lib/whisper.js';
import JSZip from './lib/jszip.js';
import { createWorkerClient } from './lib/worker-rpc.js';
import whisperWorkerUrl from './workers/transcribe-worker.js?worker&url';
import formatterWorkerUrl from './workers/python-worker.js?worker&url';

const MODEL_OPTIONS = [
  {
    key: 'tiny-en',
    label: 'Tiny English',
    modelId: 'Xenova/whisper-tiny.en',
    note: 'Fastest option for English audio. Transcribe only.'
  },
  {
    key: 'tiny',
    label: 'Tiny multilingual',
    modelId: 'Xenova/whisper-tiny',
    note: 'Small multilingual model for translate mode.'
  },
  {
    key: 'small',
    label: 'Small multilingual',
    modelId: 'Xenova/whisper-small',
    note: 'Heavier but more accurate on weakly accented audio.'
  }
];

const LANGUAGE_OPTIONS = [
  ['auto', 'Auto detect'],
  ['en', 'English'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['it', 'Italian'],
  ['pt', 'Portuguese'],
  ['nl', 'Dutch'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['zh', 'Chinese'],
  ['hi', 'Hindi'],
  ['ar', 'Arabic']
];

const STORAGE_KEY = 'py-transcribe:shared-hosting-state';
const DEFAULT_CLIENT_LIMIT = 128 * 1024 * 1024;
const DEFAULT_SERVER_LIMIT = 16 * 1024 * 1024;

const state = {
  config: readConfig(),
  settings: loadSettings(),
  file: null,
  fileKind: 'none',
  fileSource: 'waiting',
  runtimeReady: false,
  runtimeLoading: false,
  runtimeDirty: false,
  runtimeDevice: null,
  runtimeProgressMessage: '',
  whisperClient: null,
  formatterClient: null,
  transcribing: false,
  recording: {
    active: false,
    stream: null,
    recorder: null,
    chunks: [],
    timerId: null,
    startedAt: 0,
    previewUrl: '',
    previewDurationSeconds: 0
  },
  dictation: {
    active: false,
    recognition: null,
    interim: ''
  },
  normalizedAudio: null,
  normalizedSampleRate: 16_000,
  segments: [],
  transcriptText: '',
  outputs: {
    txt: '',
    srt: '',
    vtt: '',
    preview: ''
  },
  transcriptNotice: '',
  serverBackup: null,
  durationSeconds: 0,
  currentJobId: 0
};

const refs = {};

document.addEventListener('DOMContentLoaded', bootstrap);

function bootstrap() {
  bindRefs();
  populateSelectors();
  hydrateFromStorage();
  registerEvents();
  registerServiceWorker();
  renderAll();
  setStatus('Ready. Reload Whisper, then choose a file.');
}

function bindRefs() {
  const ids = [
    'hero-title',
    'browserNote',
    'runtimeState',
    'deviceState',
    'fileState',
    'outputState',
    'loadRuntimeButton',
    'recordButton',
    'dictateButton',
    'cancelButton',
    'transcribeButton',
    'downloadTxtButton',
    'downloadSrtButton',
    'downloadVttButton',
    'downloadZipButton',
    'copyButton',
    'dropZone',
    'fileInput',
    'fileBadge',
    'runtimeBadge',
    'fileSummary',
    'runtimeDetail',
    'sourceValue',
    'status',
    'taskSelect',
    'languageSelect',
    'modelSelect',
    'cleanupToggle',
    'timestampsToggle',
    'speakerToggle',
    'speakerNames',
    'speakerOne',
    'speakerTwo',
    'serverCopyToggle',
    'transcriptPreview',
    'transcriptEditor',
    'timedPreview',
    'serverBackupState',
    'recordingState',
    'recordingPreview',
    'recordingPlayer',
    'runtimeHint'
  ];

  for (const id of ids) {
    refs[id] = document.getElementById(id);
  }
}

function populateSelectors() {
  refs.modelSelect.replaceChildren();
  for (const option of MODEL_OPTIONS) {
    refs.modelSelect.appendChild(optionNode(option.key, option.label, state.settings.modelKey === option.key));
  }

  refs.languageSelect.replaceChildren();
  for (const [value, label] of LANGUAGE_OPTIONS) {
    refs.languageSelect.appendChild(optionNode(value, label, state.settings.language === value));
  }

  refs.taskSelect.value = state.settings.task;
  refs.cleanupToggle.checked = state.settings.cleanup;
  refs.timestampsToggle.checked = state.settings.timestamps;
  refs.speakerToggle.checked = state.settings.speakerMode;
  refs.speakerOne.value = state.settings.speakerNames[0];
  refs.speakerTwo.value = state.settings.speakerNames[1];
  refs.serverCopyToggle.checked = Boolean(state.settings.serverCopy);
  refs.speakerNames.hidden = !state.settings.speakerMode;
  const dictationSupported = supportsDictation();
  refs.dictateButton.hidden = !dictationSupported;
  refs.dictateButton.parentElement.hidden = !dictationSupported;
  refs.cancelButton.hidden = true;
  refs.recordButton.textContent = 'Record Mic';
  refs.recordButton.setAttribute('aria-pressed', 'false');
  refs.dictateButton.textContent = dictationSupported ? 'Dictate Mic' : 'Dictation unavailable';
  refs.modelSelect.value = state.settings.modelKey;
  refs.languageSelect.value = state.settings.language;
  syncWhisperModelControls();
  updateRuntimeButtonLabel();
  updateTranscriptEditor();
  updateDownloadLabels();
  updateRecordingPreview();
  updateRecordingStatus();
}

function optionNode(value, label, selected = false) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  option.selected = selected;
  return option;
}

function registerEvents() {
  refs.loadRuntimeButton.addEventListener('click', () => {
    void loadRuntime();
  });

  refs.fileInput.addEventListener('change', async () => {
    const file = refs.fileInput.files?.[0];
    if (file) {
      await handleFileSelection(file);
    }
  });

  refs.dropZone.addEventListener('dragenter', preventDefaults);
  refs.dropZone.addEventListener('dragover', (event) => {
    preventDefaults(event);
    refs.dropZone.classList.add('is-dragging');
  });
  refs.dropZone.addEventListener('dragleave', () => {
    refs.dropZone.classList.remove('is-dragging');
  });
  refs.dropZone.addEventListener('drop', async (event) => {
    preventDefaults(event);
    refs.dropZone.classList.remove('is-dragging');
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await handleFileSelection(file);
    }
  });
  refs.dropZone.addEventListener('click', () => {
    refs.fileInput.click();
  });

  refs.recordButton.addEventListener('click', () => {
    void toggleRecording();
  });

  refs.dictateButton.addEventListener('click', () => {
    void toggleDictation();
  });

  refs.cancelButton.addEventListener('click', () => {
    cancelTranscription();
  });

  refs.transcribeButton.addEventListener('click', () => {
    void transcribeCurrentFile();
  });

  refs.copyButton.addEventListener('click', () => {
    void copyTranscript();
  });

  refs.downloadTxtButton.addEventListener('click', () => {
    void downloadText('txt');
  });

  refs.downloadSrtButton.addEventListener('click', () => {
    void downloadText('srt');
  });

  refs.downloadVttButton.addEventListener('click', () => {
    void downloadText('vtt');
  });

  refs.downloadZipButton.addEventListener('click', () => {
    void downloadZip();
  });

  refs.modelSelect.addEventListener('change', () => {
    state.settings.modelKey = refs.modelSelect.value;
    state.runtimeDirty = true;
    state.runtimeReady = false;
    syncWhisperModelControls();
    persistSettings();
    updateRuntimeButtonLabel();
    setStatus('Model changed. Reload Whisper to apply the new runtime.');
    renderAll();
  });

  refs.taskSelect.addEventListener('change', () => {
    state.settings.task = refs.taskSelect.value;
    persistSettings();
    updateDownloadLabels();
    rerenderFormatter();
    renderAll();
  });

  refs.languageSelect.addEventListener('change', () => {
    state.settings.language = refs.languageSelect.value;
    persistSettings();
    renderAll();
  });

  refs.cleanupToggle.addEventListener('change', () => {
    state.settings.cleanup = refs.cleanupToggle.checked;
    persistSettings();
    rerenderFormatter();
    renderAll();
  });

  refs.timestampsToggle.addEventListener('change', () => {
    state.settings.timestamps = refs.timestampsToggle.checked;
    persistSettings();
    rerenderFormatter();
    renderAll();
  });

  refs.speakerToggle.addEventListener('change', () => {
    state.settings.speakerMode = refs.speakerToggle.checked;
    refs.speakerNames.hidden = !refs.speakerToggle.checked;
    persistSettings();
    rerenderFormatter();
    renderAll();
  });

  refs.speakerOne.addEventListener('input', () => {
    state.settings.speakerNames[0] = refs.speakerOne.value || 'Speaker 1';
    persistSettings();
    rerenderFormatter();
  });

  refs.speakerTwo.addEventListener('input', () => {
    state.settings.speakerNames[1] = refs.speakerTwo.value || 'Speaker 2';
    persistSettings();
    rerenderFormatter();
  });

  refs.serverCopyToggle.addEventListener('change', () => {
    state.settings.serverCopy = refs.serverCopyToggle.checked;
    persistSettings();
    renderAll();
  });

  refs.transcriptEditor.addEventListener('input', () => {
    state.transcriptText = refs.transcriptEditor.value;
    state.outputs.txt = state.transcriptText;
    updateTranscriptPreview();
    persistSessionDraft();
    renderDownloadState();
  });
}

function preventDefaults(event) {
  event.preventDefault();
  event.stopPropagation();
}

function updateRuntimeButtonLabel() {
  refs.loadRuntimeButton.textContent = 'Reload Whisper / Python';
}

function transcriptPreviewText() {
  if (state.transcriptText) {
    return `${state.transcriptText}${state.transcriptNotice || ''}`;
  }

  return state.transcriptNotice || 'No transcript yet.';
}

function updateTranscriptPreview() {
  refs.transcriptPreview.textContent = transcriptPreviewText();
}

function updateDownloadLabels() {
  const suffix = state.settings.task === 'translate' ? 'translation' : 'transcript';
  refs.downloadTxtButton.textContent = `Download ${suffix}.txt`;
  refs.downloadSrtButton.textContent = `Download ${suffix}.srt`;
  refs.downloadVttButton.textContent = `Download ${suffix}.vtt`;
  refs.downloadZipButton.textContent = `Download ${suffix}.zip`;
}

function describeWhisperProgress(progress) {
  if (!progress || typeof progress !== 'object') {
    return '';
  }

  const stage = String(progress.status || '').toLowerCase();
  const percentValue = Number(progress.progress);
  const percent = Number.isFinite(percentValue)
    ? Math.max(0, Math.min(100, percentValue))
    : null;
  const percentSuffix = percent == null ? '' : ` ${Math.round(percent)}%`;
  const fileName = shortWhisperFileName(progress.file || progress.name);

  if (stage === 'progress_total') {
    return `Loading Whisper model files...${percentSuffix}`;
  }

  if (stage === 'progress') {
    return fileName
      ? `Loading ${fileName}...${percentSuffix}`
      : `Loading Whisper model files...${percentSuffix}`;
  }

  if (stage === 'download') {
    return fileName
      ? `Downloading ${fileName}...`
      : 'Downloading Whisper model files...';
  }

  if (stage === 'initiate') {
    return fileName
      ? `Starting ${fileName}...`
      : 'Preparing Whisper model files...';
  }

  if (stage === 'done') {
    return fileName
      ? `Finished ${fileName}.`
      : 'Finished loading a Whisper file.';
  }

  if (stage === 'ready') {
    return 'Whisper model loaded.';
  }

  return '';
}

function shortWhisperFileName(value) {
  return String(value || '').split('/').pop() || '';
}

async function loadRuntime() {
  if (state.runtimeLoading) {
    return;
  }

  if (!state.runtimeDirty && state.runtimeReady && state.whisperClient && state.formatterClient) {
    setStatus('Whisper and export helpers are already loaded.');
    return;
  }

  state.runtimeLoading = true;
  state.runtimeReady = false;
  state.runtimeProgressMessage = 'Loading Whisper model files...';
  renderAll();
  setStatus('Loading Pyodide and base Whisper...');
  refs.loadRuntimeButton.disabled = true;

  try {
    teardownWorkers();
    state.whisperClient = createWhisperWorker();
    state.formatterClient = createFormatterWorker();
    await state.formatterClient.request({ type: 'init' });

    const model = selectedModel();
    const device = preferredDevice();
    const whisperReady = await state.whisperClient.request({
      type: 'init',
      modelId: model.modelId,
      device,
      allowDeviceFallback: true
    });

    state.runtimeReady = true;
    state.runtimeDirty = false;
    state.runtimeDevice = whisperReady.device || device;
    state.runtimeProgressMessage = '';
    const runtimeLabel = model.key === 'tiny-en'
      ? 'base Whisper'
      : `${model.key} Whisper`;
    setStatus(`Pyodide and ${runtimeLabel} are ready.`);
  } catch (error) {
    state.runtimeReady = false;
    state.runtimeDevice = null;
    state.runtimeProgressMessage = '';
    setStatus(`Failed to load runtime: ${error.message}`);
  } finally {
    state.runtimeLoading = false;
    state.runtimeProgressMessage = '';
    refs.loadRuntimeButton.disabled = false;
    updateRuntimeButtonLabel();
    renderAll();
  }
}

function createWhisperWorker() {
  return createWorkerClient(whisperWorkerUrl, {
    onMessage: (message) => {
      if (message.type === 'progress' && state.runtimeLoading) {
        const progressMessage = describeWhisperProgress(message.progress);
        if (progressMessage) {
          state.runtimeProgressMessage = progressMessage;
          setStatus(progressMessage);
          renderAll();
        }
        return;
      }

      if (message.type === 'partial' && message.id === state.currentJobId) {
        refs.status.textContent = `Transcribing... ${message.text}`.trim();
      }
    }
  });
}

function createFormatterWorker() {
  return createWorkerClient(formatterWorkerUrl, {
    onMessage: () => {}
  });
}

function teardownWorkers() {
  state.whisperClient?.terminate?.();
  state.formatterClient?.terminate?.();
  state.whisperClient = null;
  state.formatterClient = null;
}

async function handleFileSelection(file, {
  preserveRecordingPreview = false,
  sourceLabel = '',
  initialDurationSeconds = 0
} = {}) {
  const validation = validateMediaFile(file, state.config.clientLimitBytes, { allowVideo: true });
  if (!validation.ok) {
    state.file = null;
    state.fileKind = 'none';
    state.fileSource = 'waiting';
    state.normalizedAudio = null;
    state.segments = [];
    state.transcriptText = '';
    state.transcriptNotice = '';
    state.outputs = { txt: '', srt: '', vtt: '', preview: '' };
    state.durationSeconds = 0;
    if (!preserveRecordingPreview) {
      clearRecordingPreview();
    }
    setStatus(validation.message);
    refs.transcriptEditor.value = '';
    updateTranscriptPreview();
    refs.timedPreview.textContent = 'No transcript yet.';
    renderAll();
    return;
  }

  state.file = file;
  state.fileKind = validation.kind;
  state.fileSource = sourceLabel || (validation.kind === 'video' ? 'FFmpeg ready' : 'browser audio decode');
  state.normalizedAudio = null;
  state.normalizedSampleRate = 16_000;
  state.segments = [];
  state.transcriptText = '';
  state.transcriptNotice = '';
  state.outputs = { txt: '', srt: '', vtt: '', preview: '' };
  state.durationSeconds = initialDurationSeconds;
  refs.fileInput.value = '';
  refs.transcriptEditor.value = '';
  updateTranscriptPreview();
  refs.timedPreview.textContent = 'No transcript yet.';
  if (!preserveRecordingPreview) {
    clearRecordingPreview();
  }
  setStatus(`Selected ${file.name}. Reload Whisper / Export to continue.`);
  persistSessionDraft();
  renderAll();

  if (state.settings.serverCopy) {
    void uploadServerCopy(file);
  }
}

async function transcribeCurrentFile() {
  if (!state.file) {
    setStatus('Choose an audio file first.');
    return;
  }

  if (!state.runtimeReady || !state.whisperClient || !state.formatterClient) {
    setStatus('Reload Whisper / Export before transcribing.');
    return;
  }

  state.transcribing = true;
  state.currentJobId += 1;
  const jobId = state.currentJobId;
  renderAll();
  state.transcriptNotice = '';
  setStatus(`Preparing ${state.file.name}...`);
  refs.cancelButton.hidden = false;

  await new Promise((resolve) => window.setTimeout(resolve, 500));
  if (jobId !== state.currentJobId) {
    return;
  }

  try {
    if (state.settings.serverCopy && !state.serverBackup) {
      await uploadServerCopy(state.file);
    }

    const audio = await extractNormalizedAudio(state.file, {
      targetSampleRate: state.normalizedSampleRate,
      preferFfmpeg: state.fileKind === 'video'
    });
    state.normalizedAudio = audio.samples;
    state.normalizedSampleRate = audio.sampleRate;
    state.durationSeconds = audio.durationSeconds;
    state.fileSource = audio.source;

    setStatus(`Transcribing ${state.file.name}...`);
    const audioForWorker = state.normalizedAudio.slice();
    const whisperRequest = buildWhisperTranscriptionRequest({
      modelId: selectedModel().modelId,
      task: state.settings.task,
      language: state.settings.language
    });

    if (whisperRequest.task !== state.settings.task) {
      state.settings.task = whisperRequest.task;
      refs.taskSelect.value = whisperRequest.task;
    }

    const whisperResponse = await state.whisperClient.request({
      type: 'transcribe',
      modelId: selectedModel().modelId,
      device: state.runtimeDevice || preferredDevice(),
      ...whisperRequest.options,
      durationSeconds: state.durationSeconds,
      audio: audioForWorker
    }, [audioForWorker.buffer]);

    if (jobId !== state.currentJobId) {
      return;
    }

    const result = whisperResponse.result ?? {};
    const normalizedSegments = normalizeSegments(result, state.durationSeconds);
    state.segments = applySpeakerLabels(
      normalizedSegments,
      state.settings.speakerMode,
      state.settings.speakerNames
    );
    state.transcriptText = state.settings.cleanup
      ? cleanupTranscript(result.text || buildPlainTranscript(state.segments))
      : String(result.text ?? buildPlainTranscript(state.segments)).trim();
    refs.transcriptEditor.value = state.transcriptText;
    state.transcriptNotice = state.settings.task === 'translate' ? ' (translated)' : '';
    updateTranscriptPreview();

    const formatted = await rerenderFormatter();
    if (jobId !== state.currentJobId) {
      return;
    }

    state.outputs = {
      txt: state.transcriptText,
      srt: formatted.srt || buildSrt(state.segments, formatterOptions()),
      vtt: formatted.vtt || buildVtt(state.segments, formatterOptions()),
      preview: formatted.preview || buildTimestampPreview(state.segments, formatterOptions())
    };
    refs.timedPreview.textContent = state.outputs.preview || 'No transcript yet.';

    const seconds = Number(result.processingSeconds) || 0;
    const segmentCount = state.segments.length;
    setStatus(`Finished in ${seconds.toFixed(1)} seconds. ${segmentCount} segment${segmentCount === 1 ? '' : 's'} ready.`);
  } catch (error) {
    if (/cancelled/i.test(String(error?.message || ''))) {
      state.transcriptText = '';
      state.segments = [];
      state.outputs = {
        txt: '',
        srt: '',
        vtt: '',
        preview: 'Transcription cancelled.'
      };
      state.transcriptNotice = 'Transcription cancelled.';
      updateTranscriptPreview();
      refs.timedPreview.textContent = state.outputs.preview;
      setStatus('Transcription cancelled.');
    } else {
      setStatus(`Transcription failed: ${error.message}`);
    }
  } finally {
    state.transcribing = false;
    refs.cancelButton.hidden = true;
    renderAll();
    persistSessionDraft();
  }
}

function cancelTranscription() {
  state.currentJobId += 1;
  state.transcribing = false;
  state.transcriptText = '';
  state.segments = [];
  state.outputs = {
    txt: '',
    srt: '',
    vtt: '',
    preview: 'Transcription cancelled.'
  };
  state.transcriptNotice = 'Transcription cancelled.';
  state.whisperClient?.raw?.postMessage({ type: 'cancel' });
  refs.cancelButton.hidden = true;
  setStatus('Transcription cancelled.');
  renderAll();
}

async function rerenderFormatter() {
  if (!state.formatterClient) {
    const segments = applySpeakerLabels(
      state.segments,
      state.settings.speakerMode,
      state.settings.speakerNames
    );
    return {
      txt: buildPlainTranscript(segments, formatterOptions()),
      srt: buildSrt(segments, formatterOptions()),
      vtt: buildVtt(segments, formatterOptions()),
      preview: buildTimestampPreview(segments, formatterOptions())
    };
  }

  if (!state.segments.length && !state.transcriptText) {
    return {
      txt: '',
      srt: '',
      vtt: '',
      preview: 'No transcript yet.'
    };
  }

  const response = await state.formatterClient.request({
    type: 'render',
    payload: {
      editorText: state.transcriptText,
      segments: state.segments,
      cleanup: state.settings.cleanup,
      speakerMode: state.settings.speakerMode,
      speakerNames: state.settings.speakerNames,
      timestamps: state.settings.timestamps,
      task: state.settings.task
    }
  });

  const result = response.result ?? {};
  if (result.preview) {
    refs.timedPreview.textContent = result.preview;
  }

  return {
    txt: String(result.txt ?? ''),
    srt: String(result.srt ?? ''),
    vtt: String(result.vtt ?? ''),
    preview: String(result.preview ?? '')
  };
}

function formatterOptions() {
  return {
    cleanup: state.settings.cleanup,
    speakerMode: state.settings.speakerMode,
    speakerNames: state.settings.speakerNames,
    includeTimestamps: state.settings.timestamps
  };
}

function renderAll() {
  syncWhisperModelControls();

  refs.runtimeState.textContent = state.runtimeLoading
    ? 'Loading'
    : state.runtimeReady
      ? 'Base ready'
      : 'Not loaded';

  refs.runtimeBadge.textContent = state.runtimeLoading
    ? 'Loading'
    : state.runtimeReady
      ? 'Loaded'
      : 'Idle';

  refs.deviceState.textContent = preferredDevice() === 'webgpu'
    ? 'WebGPU available'
    : 'WASM fallback';

  refs.fileState.textContent = state.file
    ? (state.fileKind === 'video' ? 'Video' : 'Audio')
    : 'No file';

  refs.fileBadge.textContent = state.file
    ? (state.fileKind === 'video' ? 'Video' : 'Audio')
    : 'Waiting';

  refs.outputState.textContent = state.transcribing
    ? 'Transcribing'
    : state.segments.length
      ? 'Ready'
      : 'Waiting';

  refs.runtimeDetail.textContent = state.runtimeReady
    ? `Whisper is ready on ${state.runtimeDevice === 'webgpu' ? 'WebGPU' : 'WASM'}.`
    : state.runtimeLoading
      ? state.runtimeProgressMessage || 'Loading Whisper model files...'
      : 'Whisper is not loaded yet.';

  refs.sourceValue.textContent = state.file
    ? (state.fileSource || 'waiting')
    : 'waiting';

  const toolbarFileLabel = state.recording.active
    ? 'Recording mic'
    : state.file
      ? state.file.name
      : '';
  refs.fileState.textContent = toolbarFileLabel;
  refs.fileState.hidden = !toolbarFileLabel;

  refs.fileSummary.textContent = state.file
    ? `${state.file.name} · ${formatBytes(state.file.size)}${state.durationSeconds ? ` · ${formatDuration(state.durationSeconds)}` : ''}`
    : 'No file selected yet.';

  refs.browserNote.textContent = state.settings.serverCopy
    ? 'Nothing leaves the browser unless you choose host backup.'
    : 'Everything stays local unless you enable host backup.';

  refs.serverBackupState.textContent = state.settings.serverCopy
    ? (state.serverBackup ? `Saved to host: ${state.serverBackup.originalName}` : 'Host backup on')
    : 'Host backup off';

  updateRecordingStatus();
  updateRecordingPreview();

  refs.transcribeButton.textContent = 'Transcribe';
  refs.transcribeButton.disabled = !state.runtimeReady || !state.file || state.runtimeLoading || state.transcribing || state.runtimeDirty || state.recording.active;
  refs.recordButton.textContent = state.recording.active ? 'Stop Recording' : 'Record Mic';
  refs.recordButton.setAttribute('aria-pressed', String(state.recording.active));
  refs.recordButton.disabled = state.runtimeLoading || state.transcribing || !supportsRecording();
  refs.dropZone.disabled = state.runtimeLoading || state.transcribing || state.recording.active;
  refs.dictateButton.disabled = !supportsDictation() || state.runtimeLoading || state.transcribing;
  refs.loadRuntimeButton.disabled = state.runtimeLoading;
  refs.downloadTxtButton.disabled = !state.segments.length && !state.transcriptText;
  refs.downloadSrtButton.disabled = !state.segments.length;
  refs.downloadVttButton.disabled = !state.segments.length;
  refs.downloadZipButton.disabled = !state.file || (!state.segments.length && !state.transcriptText);
  refs.copyButton.disabled = !state.transcriptText;
  refs.cancelButton.hidden = !state.transcribing;
  refs.speakerNames.hidden = !state.settings.speakerMode;
  refs.timedPreview.textContent = state.outputs.preview || transcriptPreviewText();
  updateTranscriptPreview();

  updateRuntimeButtonLabel();
  updateDownloadLabels();
  persistSettings();
}

function syncWhisperModelControls() {
  const model = selectedModel();
  const englishOnly = isEnglishOnlyWhisperModel(model.modelId);
  const translateOption = refs.taskSelect.querySelector('option[value="translate"]');
  const desiredTask = englishOnly ? 'transcribe' : state.settings.task;

  if (translateOption) {
    translateOption.disabled = englishOnly;
  }

  if (state.settings.task !== desiredTask) {
    state.settings.task = desiredTask;
  }

  if (refs.taskSelect.value !== desiredTask) {
    refs.taskSelect.value = desiredTask;
  }

  refs.runtimeHint.textContent = model.note;

  return {
    model,
    englishOnly
  };
}

function renderDownloadState() {
  refs.downloadTxtButton.disabled = !refs.transcriptEditor.value;
  refs.copyButton.disabled = !refs.transcriptEditor.value;
}

function supportsRecording() {
  return Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

function selectedModel() {
  return MODEL_OPTIONS.find((option) => option.key === refs.modelSelect.value) || MODEL_OPTIONS[0];
}

function preferredDevice() {
  return navigator.gpu ? 'webgpu' : 'wasm';
}

function persistSettings() {
  const payload = {
    modelKey: refs.modelSelect.value,
    task: refs.taskSelect.value,
    language: refs.languageSelect.value,
    cleanup: refs.cleanupToggle.checked,
    timestamps: refs.timestampsToggle.checked,
    speakerMode: refs.speakerToggle.checked,
    speakerNames: [
      refs.speakerOne.value || 'Speaker 1',
      refs.speakerTwo.value || 'Speaker 2'
    ],
    serverCopy: refs.serverCopyToggle.checked,
    transcriptText: state.transcriptText
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota and privacy failures on restrictive shared-hosting browsers.
  }
}

function persistSessionDraft() {
  persistSettings();
}

function loadSettings() {
  const defaults = {
    modelKey: 'tiny-en',
    task: 'transcribe',
    language: 'auto',
    cleanup: true,
    timestamps: true,
    speakerMode: false,
    speakerNames: ['Speaker 1', 'Speaker 2'],
    serverCopy: false,
    transcriptText: ''
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      speakerNames: Array.isArray(parsed?.speakerNames) && parsed.speakerNames.length >= 2
        ? [String(parsed.speakerNames[0] || 'Speaker 1'), String(parsed.speakerNames[1] || 'Speaker 2')]
        : defaults.speakerNames
    };
  } catch {
    return defaults;
  }
}

function hydrateFromStorage() {
  refs.modelSelect.value = state.settings.modelKey;
  refs.taskSelect.value = state.settings.task;
  refs.languageSelect.value = state.settings.language;
  refs.cleanupToggle.checked = state.settings.cleanup;
  refs.timestampsToggle.checked = state.settings.timestamps;
  refs.speakerToggle.checked = state.settings.speakerMode;
  refs.speakerOne.value = state.settings.speakerNames[0];
  refs.speakerTwo.value = state.settings.speakerNames[1];
  refs.serverCopyToggle.checked = state.settings.serverCopy;
  state.transcriptText = state.settings.transcriptText || '';
  refs.transcriptEditor.value = state.transcriptText;
  state.transcriptNotice = '';
  updateTranscriptPreview();
  refs.timedPreview.textContent = 'No transcript yet.';
  updateRuntimeButtonLabel();
}

function readConfig() {
  const injected = globalThis.__TRANSCRIBE_CONFIG__ ?? {};
  const uploadLimitBytes = parseInteger(injected.uploadLimitBytes, DEFAULT_SERVER_LIMIT);
  const clientLimitBytes = parseInteger(injected.clientLimitBytes, DEFAULT_CLIENT_LIMIT);

  return {
    appName: String(injected.appName || 'Py Transcribe Studio'),
    uploadEndpoint: String(injected.uploadEndpoint || 'api/upload.php'),
    downloadEndpoint: String(injected.downloadEndpoint || 'api/download.php'),
    csrfToken: String(injected.csrfToken || ''),
    authRequired: Boolean(injected.authRequired),
    uploadLimitBytes,
    clientLimitBytes,
    storageEnabled: Boolean(injected.storageEnabled ?? true)
  };
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function setStatus(message) {
  refs.status.textContent = message;
}

function updateTranscriptEditor() {
  refs.transcriptEditor.value = state.transcriptText;
  updateTranscriptPreview();
}

async function copyTranscript() {
  const text = refs.transcriptEditor.value || state.transcriptText;
  if (!text) {
    setStatus('Nothing to copy yet.');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus('Transcript copied to the clipboard.');
  } catch {
    refs.transcriptEditor.focus();
    refs.transcriptEditor.select();
    document.execCommand('copy');
    setStatus('Transcript copied.');
  }
}

async function downloadText(kind) {
  const available = await ensureRenderedOutputs();
  const names = buildExportNames(state.file?.name || 'transcript', state.settings.task);
  let text = '';
  let fileName = '';

  switch (kind) {
    case 'txt':
      text = refs.transcriptEditor.value || available.txt || state.transcriptText;
      fileName = names.txt;
      break;
    case 'srt':
      text = available.srt || buildSrt(state.segments, formatterOptions());
      fileName = names.srt;
      break;
    case 'vtt':
      text = available.vtt || buildVtt(state.segments, formatterOptions());
      fileName = names.vtt;
      break;
    default:
      throw new Error(`Unsupported download type: ${kind}`);
  }

  if (!text) {
    setStatus('Transcribe a file before downloading.');
    return;
  }

  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), fileName);
  setStatus(`Downloaded ${fileName}.`);
}

async function downloadZip() {
  if (!state.file) {
    setStatus('Choose a file first.');
    return;
  }

  const available = await ensureRenderedOutputs();
  const names = buildExportNames(state.file.name, state.settings.task);
  const zip = new JSZip();
  zip.file(names.txt, refs.transcriptEditor.value || available.txt || state.transcriptText);
  zip.file(names.srt, available.srt || buildSrt(state.segments, formatterOptions()));
  zip.file(names.vtt, available.vtt || buildVtt(state.segments, formatterOptions()));

  if (state.normalizedAudio?.length) {
    zip.file(names.wav, encodeWavBytes(state.normalizedAudio, state.normalizedSampleRate));
  }

  zip.file(state.file.name, await state.file.arrayBuffer());
  if (state.serverBackup?.downloadUrl) {
    zip.file('server-backup.json', JSON.stringify(state.serverBackup, null, 2));
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, names.zip);
  setStatus(`Downloaded ${names.zip}.`);
}

async function ensureRenderedOutputs() {
  if (state.outputs.txt || state.outputs.srt || state.outputs.vtt) {
    return state.outputs;
  }

  const rendered = await rerenderFormatter();
  state.outputs = {
    txt: refs.transcriptEditor.value || rendered.txt || state.transcriptText,
    srt: rendered.srt,
    vtt: rendered.vtt,
    preview: rendered.preview
  };
  return state.outputs;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function uploadServerCopy(file) {
  if (!state.config.storageEnabled || !state.settings.serverCopy || !state.config.uploadEndpoint) {
    return null;
  }

  if (state.serverBackup && state.serverBackup.originalName === file.name && state.serverBackup.size === file.size) {
    return state.serverBackup;
  }

  const form = new FormData();
  form.append('audio', file, file.name);

  const response = await fetch(state.config.uploadEndpoint, {
    method: 'POST',
    headers: {
      'X-CSRF-Token': state.config.csrfToken
    },
    body: form,
    credentials: 'same-origin'
  });

  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Host backup failed.');
  }

  state.serverBackup = payload.file;
  refs.serverBackupState.textContent = `Saved to host: ${payload.file.originalName}`;
  setStatus(`Saved ${file.name} to host storage.`);
  return payload.file;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.register('sw.js').catch(() => {});
}

function supportsDictation() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

async function toggleDictation() {
  if (!supportsDictation()) {
    setStatus('This browser does not support Web Speech dictation.');
    return;
  }

  if (state.dictation.active) {
    stopDictation();
    return;
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = speechLocaleFor(state.settings.language);
  recognition.maxAlternatives = 1;

  state.dictation.active = true;
  state.dictation.recognition = recognition;
  state.dictation.interim = '';
  refs.dictateButton.textContent = 'Stop Dictation';
  setStatus('Listening for speech...');

  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result[0]?.transcript || '';
      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      const separator = refs.transcriptEditor.value ? ' ' : '';
      refs.transcriptEditor.value += `${separator}${finalTranscript.trim()}`;
      state.transcriptText = refs.transcriptEditor.value;
      updateTranscriptPreview();
      persistSessionDraft();
    }

    state.dictation.interim = interimTranscript.trim();
    if (state.dictation.interim) {
      setStatus(`Dictating... ${state.dictation.interim}`);
    }
  };

  recognition.onerror = (event) => {
    setStatus(`Dictation error: ${event.error || 'speech recognition failed'}`);
    stopDictation();
  };

  recognition.onend = () => {
    if (state.dictation.active) {
      stopDictation();
    }
  };

  recognition.start();
}

function stopDictation() {
  state.dictation.active = false;
  state.dictation.interim = '';
  try {
    state.dictation.recognition?.stop();
  } catch {
    // Ignore stop errors when the recognition session has already ended.
  }
  state.dictation.recognition = null;
  refs.dictateButton.textContent = supportsDictation() ? 'Dictate Mic' : 'Dictation unavailable';
  setStatus('Dictation stopped.');
}

async function toggleRecording() {
  if (state.recording.active) {
    stopRecording();
    return;
  }

  if (!supportsRecording()) {
    setStatus('This browser cannot record audio.');
    return;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    setStatus(`Microphone access failed: ${error.message}`);
    return;
  }

  const preferredMimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4'
  ];
  const mimeType = preferredMimeTypes.find((mime) => window.MediaRecorder?.isTypeSupported?.(mime)) || '';
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

  state.recording.active = true;
  state.recording.stream = stream;
  state.recording.recorder = recorder;
  state.recording.chunks = [];
  clearRecordingPreview();
  state.recording.startedAt = performance.now();
  refs.recordButton.textContent = 'Stop Recording';
  setStatus('Recording audio from the microphone...');
  renderAll();
  state.recording.timerId = window.setInterval(() => {
    if (state.recording.active) {
      updateRecordingStatus();
    }
  }, 1000);

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      state.recording.chunks.push(event.data);
    }
  };

  recorder.onstop = async () => {
    const blob = new Blob(state.recording.chunks, { type: recorder.mimeType || 'audio/webm' });
    const extension = String(blob.type).includes('mp4') ? 'm4a' : 'webm';
    const durationSeconds = Math.max(0, (performance.now() - state.recording.startedAt) / 1000);
    const file = new File([blob], `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`, {
      type: blob.type || 'audio/webm',
      lastModified: Date.now()
    });

    finalizeRecording();
    state.recording.previewDurationSeconds = durationSeconds;
    state.recording.previewUrl = URL.createObjectURL(blob);
    updateRecordingPreview();
    updateRecordingStatus();
    await handleFileSelection(file, {
      preserveRecordingPreview: true,
      sourceLabel: 'microphone recording',
      initialDurationSeconds: durationSeconds
    });
    setStatus('Recording saved. Review it before transcribing.');
  };

  recorder.start();
}

function stopRecording() {
  if (!state.recording.active) {
    return;
  }

  state.recording.active = false;
  refs.recordButton.textContent = 'Record Mic';
  renderAll();

  try {
    state.recording.recorder?.stop();
  } catch {
    // Ignore repeated stop attempts.
  }
}

function finalizeRecording() {
  if (state.recording.timerId) {
    window.clearInterval(state.recording.timerId);
    state.recording.timerId = null;
  }
  state.recording.stream?.getTracks?.().forEach((track) => track.stop());
  state.recording.stream = null;
  state.recording.recorder = null;
  state.recording.chunks = [];
  state.recording.active = false;
  refs.recordButton.textContent = 'Record Mic';
}

function speechLocaleFor(language) {
  const locales = {
    auto: 'en-US',
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-PT',
    nl: 'nl-NL',
    ja: 'ja-JP',
    ko: 'ko-KR',
    zh: 'zh-CN',
    hi: 'hi-IN',
    ar: 'ar-SA'
  };

  return locales[String(language || 'auto').toLowerCase()] || 'en-US';
}

function updateRecordingStatus() {
  if (state.recording.active) {
    refs.recordingState.dataset.mode = 'active';
    refs.recordingState.textContent = `Recording ${formatDuration((performance.now() - state.recording.startedAt) / 1000)}`;
    return;
  }

  if (state.recording.previewUrl) {
    refs.recordingState.dataset.mode = 'ready';
    refs.recordingState.textContent = `Ready to review ${formatDuration(state.recording.previewDurationSeconds || 0)}.`;
    return;
  }

  refs.recordingState.dataset.mode = 'idle';
  refs.recordingState.textContent = 'Mic idle';
}

function updateRecordingPreview() {
  const hasPreview = Boolean(state.recording.previewUrl);
  refs.recordingPreview.hidden = !hasPreview;

  if (!hasPreview) {
    refs.recordingPlayer.removeAttribute('src');
    refs.recordingPlayer.load?.();
    return;
  }

  if (refs.recordingPlayer.src !== state.recording.previewUrl) {
    refs.recordingPlayer.src = state.recording.previewUrl;
    refs.recordingPlayer.load?.();
  }
}

function clearRecordingPreview() {
  if (state.recording.previewUrl) {
    URL.revokeObjectURL(state.recording.previewUrl);
  }

  state.recording.previewUrl = '';
  state.recording.previewDurationSeconds = 0;
  updateRecordingPreview();
  updateRecordingStatus();
}
