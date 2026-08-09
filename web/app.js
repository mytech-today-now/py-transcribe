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
import {
  OLLAMA_DEFAULT_BASE_URL,
  fetchOllamaModels,
  fetchOllamaModelsFromCandidates,
  chatWithOllama,
  describeLocalAiError,
  LOCAL_AI_PULL_CANDIDATES,
  pullOllamaModelWithProgress,
  resolveBestKimiModel,
  resolvePreferredKimiPullCandidate,
  resolveOllamaBaseUrlCandidates,
  shouldAttemptLocalAiDetection,
  summarizeWithOllama,
  LOCAL_AI_DETAIL_LEVELS,
  normalizeLocalAiDetailLevel,
  normalizeLocalAiModelName
} from './lib/local-ai.js';
import {
  BROWSER_AI_MODEL_CATALOG,
  LOCAL_AI_RUNTIME_MODES,
  buildBrowserStorageWarning,
  createBrowserAiRuntime,
  describeBrowserAiError,
  estimateBrowserStorageQuota,
  formatBrowserAiModelLabel,
  getBrowserAiModelById,
  normalizeBrowserAiModel,
  normalizeLocalAiRuntimeMode,
  resolvePreferredBrowserAiModel,
  supportsBrowserLocalAi
} from './lib/browser-ai.js';
import JSZip from './lib/jszip.js';
import { createWorkerClient } from './lib/worker-rpc.js';
import {
  readPersistedSession,
  requestPersistentStorage,
  writePersistedSession
} from './lib/persistence.js';
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
const SESSION_FALLBACK_KEY = 'py-transcribe:shared-hosting-session';
const DEFAULT_CLIENT_LIMIT = 128 * 1024 * 1024;
const DEFAULT_SERVER_LIMIT = 16 * 1024 * 1024;
const LOCAL_AI_CHAT_HISTORY_LIMIT = 16;
const LOCAL_AI_PROXY_BASE_URL = 'api/ollama';
const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';
const LOCAL_AI_STATUS_MESSAGES = {
  connecting: 'Connecting to local Ollama...',
  idle: 'Ollama detected',
  checking: 'Checking Ollama...',
  downloading: 'Downloading Kimi model...',
  ready: 'Model ready',
  summarizing: 'Summarizing...',
  browserLoading: 'Falling back to browser WASM...',
  browserReady: 'Browser model ready',
  browserLoadingModel: 'Loading browser model...',
  unavailable: 'Local AI unavailable'
};

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
  serverBackupNotice: '',
  localAi: {
    supported: shouldAttemptLocalAiDetection() || supportsBrowserLocalAi(),
    ollamaSupported: shouldAttemptLocalAiDetection(),
    browserSupported: supportsBrowserLocalAi(),
    runtimeMode: normalizeLocalAiRuntimeMode('auto'),
    runtimeKind: '',
    available: false,
    status: 'idle',
    message: '',
    detail: '',
    baseUrl: '',
    modelName: '',
    modelId: '',
    progress: null,
    progressText: '',
    checking: false,
    pulling: false,
    summarizing: false,
    installedModels: [],
    browser: {
      modelId: '',
      modelName: '',
      modelRepo: '',
      modelFile: '',
      modelQuantization: '',
      modelSizeLabel: '',
      modelApproxBytes: 0,
      modelNote: '',
      loading: false,
      ready: false,
      status: 'idle',
      message: '',
      detail: '',
      progress: null,
      progressText: '',
      warning: '',
      error: '',
      cached: false,
      loadedAt: '',
      storageWarning: '',
      storageUsage: 0,
      storageQuota: 0,
      storageSupported: false,
      runtime: null,
      loadRequestId: 0
    },
    summaryText: '',
    summaryExpanded: false,
    summaryDirty: false,
    summaryWarning: '',
    summarySourceChars: 0,
    summaryDetailLevel: 'standard',
    summaryModelName: '',
    summaryContextSignature: '',
    summaryError: '',
    checkRequestId: 0,
    summarizeRequestId: 0,
    chatRequestId: 0,
    activeController: null,
    lastSuccessfulCheckAt: '',
    cachedModelName: '',
    chat: {
      messages: [],
      draft: '',
      sending: false,
      status: 'idle',
      message: '',
      detail: '',
      error: '',
      stale: false,
      contextSignature: '',
      requestId: 0
    }
  },
  readme: {
    status: 'idle',
    html: '',
    error: '',
    requestId: 0
  },
  durationSeconds: 0,
  currentJobId: 0
};

let modalScrollLockY = 0;
let modalScrollLockActive = false;
let sessionPersistTimerId = 0;
let sessionPersistPending = false;
let sessionPersistWritePromise = Promise.resolve();
let restoreRuntimeAfterHydration = false;
let lastPersistedSettings = '';

const refs = {};
if (globalThis.__PY_TRANSCRIBE_TEST_HOOKS__) {
  globalThis.__PY_TRANSCRIBE_APP_STATE__ = state;
}

document.addEventListener('DOMContentLoaded', bootstrap);

async function bootstrap() {
  bindRefs();
  populateSelectors();
  registerEvents();
  registerServiceWorker();
  void requestPersistentStorage();
  setStatus('Restoring saved session...');
  await hydrateFromStorage();
  renderAll();
  const shouldRestoreRuntime = restoreRuntimeAfterHydration;
  setStatus(shouldRestoreRuntime
    ? 'Restoring Whisper / Python from storage...'
    : state.runtimeReady
      ? 'Ready. Your saved Whisper session is active.'
      : 'Ready. Load Whisper / Python, then choose a file.');
  void initializeLocalAi({
    forceRefresh: state.localAi.supported && state.config.localAiAutoDownload !== false
  });
  if (shouldRestoreRuntime && !state.runtimeReady && !state.runtimeLoading) {
    restoreRuntimeAfterHydration = false;
    void loadRuntime();
  }
}

function bindRefs() {
  const ids = [
    'hero-title',
    'browserNote',
    'promoButton',
    'readmeButton',
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
    'aiModelSelect',
    'aiModelMeta',
    'checkAiButton',
    'summarizeButton',
    'cancelAiButton',
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
    'aiState',
    'aiDetail',
    'aiProgress',
    'aiProgressBar',
    'aiProgressText',
    'summaryPanel',
    'summaryPanelTitle',
    'summaryMeta',
    'summaryContent',
    'summaryCopyButton',
    'summaryExpandButton',
    'summaryDismissButton',
    'aiRuntimeSelect',
    'aiRuntimeMeta',
    'summaryDetailBrief',
    'summaryDetailStandard',
    'summaryDetailDetailed',
    'chatPanel',
    'chatPanelTitle',
    'chatMeta',
    'chatStatus',
    'chatHistory',
    'chatForm',
    'chatInput',
    'chatSendButton',
    'chatNewSessionButton',
    'chatClearButton',
    'promoDialog',
    'readmeDialog',
    'readmeStatus',
    'readmeContent',
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
  if (refs.aiRuntimeSelect) {
    refs.aiRuntimeSelect.value = state.settings.localAiRuntimeMode;
  }
  refs.summaryDetailBrief.checked = state.settings.summaryDetail === 'brief';
  refs.summaryDetailStandard.checked = state.settings.summaryDetail === 'standard';
  refs.summaryDetailDetailed.checked = state.settings.summaryDetail === 'detailed';
  refs.speakerNames.hidden = !state.settings.speakerMode;
  const dictationSupported = supportsDictation();
  refs.dictateButton.hidden = !dictationSupported;
  refs.dictateButton.parentElement.hidden = !dictationSupported;
  refs.cancelButton.hidden = true;
  refs.cancelAiButton.hidden = true;
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
  refs.promoButton.addEventListener('click', () => {
    openPromoDialog();
  });

  refs.readmeButton.addEventListener('click', () => {
    void openReadmeDialog();
  });

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

  refs.aiModelSelect.addEventListener('change', () => {
    updateLocalAiModelSelection(refs.aiModelSelect.value);
  });

  if (refs.aiRuntimeSelect) {
    refs.aiRuntimeSelect.addEventListener('change', () => {
      updateLocalAiRuntimeMode(refs.aiRuntimeSelect.value);
      void initializeLocalAi({ forceRefresh: true });
    });
  }

  refs.checkAiButton.addEventListener('click', () => {
    void initializeLocalAi({ forceRefresh: true });
  });

  refs.summarizeButton.addEventListener('click', () => {
    void summarizeCurrentTranscript();
  });

  refs.cancelAiButton.addEventListener('click', () => {
    cancelLocalAiWork();
  });

  refs.summaryCopyButton.addEventListener('click', () => {
    void copySummary();
  });

  refs.summaryExpandButton.addEventListener('click', () => {
    toggleSummaryExpanded();
  });

  refs.summaryDismissButton.addEventListener('click', () => {
    dismissSummary();
  });

  refs.chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void sendChatMessage();
  });

  refs.chatInput.addEventListener('input', () => {
    state.localAi.chat.draft = refs.chatInput.value;
    persistSessionDraft();
    renderLocalAiState();
  });

  refs.chatNewSessionButton.addEventListener('click', () => {
    startLocalChatSession();
  });

  refs.chatClearButton.addEventListener('click', () => {
    clearLocalChatSession();
  });

  refs.summaryDetailBrief.addEventListener('change', () => {
    if (refs.summaryDetailBrief.checked) {
      setSummaryDetail('brief');
    }
  });

  refs.summaryDetailStandard.addEventListener('change', () => {
    if (refs.summaryDetailStandard.checked) {
      setSummaryDetail('standard');
    }
  });

  refs.summaryDetailDetailed.addEventListener('change', () => {
    if (refs.summaryDetailDetailed.checked) {
      setSummaryDetail('detailed');
    }
  });

  refs.modelSelect.addEventListener('change', () => {
    state.settings.modelKey = refs.modelSelect.value;
    state.runtimeDirty = true;
    state.runtimeReady = false;
    syncWhisperModelControls();
    persistSettings();
    updateRuntimeButtonLabel();
    setStatus('Model changed. Loading the new runtime...');
    renderAll();
    void loadRuntime();
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
    state.serverBackupNotice = '';
    persistSettings();
    renderAll();
  });

  refs.transcriptEditor.addEventListener('input', () => {
    state.transcriptText = refs.transcriptEditor.value;
    state.outputs = {
      txt: state.transcriptText,
      srt: '',
      vtt: '',
      preview: ''
    };
    markSummaryDirty();
    renderLocalAiState();
    updateTranscriptPreview();
    persistSettings();
    persistSessionDraft();
    renderDownloadState();
  });

  bindDialogDismiss(refs.promoDialog);
  bindDialogDismiss(refs.readmeDialog);
  window.addEventListener('pagehide', () => {
    cancelLocalAiWork({ silent: true });
    persistSessionDraft({ immediate: true });
  });
  window.addEventListener('beforeunload', () => {
    cancelLocalAiWork({ silent: true });
    persistSessionDraft({ immediate: true });
  });
  syncModalScrollLock();
}

function preventDefaults(event) {
  event.preventDefault();
  event.stopPropagation();
}

function bindDialogDismiss(dialog) {
  if (!dialog) {
    return;
  }

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
  dialog.addEventListener('close', syncModalScrollLock);
}

function updateRuntimeButtonLabel() {
  refs.loadRuntimeButton.textContent = 'Load Whisper / Python';
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

function normalizeLocalAiText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function buildLocalAiTextSignature(...parts) {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part || '').replace(/\r\n/g, '\n');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    hash ^= 0x1f;
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function buildLocalAiContextSignature(transcriptText, summaryText) {
  return buildLocalAiTextSignature(transcriptText, '\u0000', summaryText);
}

function sanitizeLocalAiChatMessages(messages) {
  if (!Array.isArray(messages) || !messages.length) {
    return [];
  }

  return messages
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      role: String(entry.role || '').toLowerCase(),
      content: normalizeLocalAiText(entry.content),
      pending: Boolean(entry.pending),
      error: Boolean(entry.error)
    }))
    .filter((entry) => (entry.role === 'user' || entry.role === 'assistant') && entry.content && !entry.pending)
    .slice(-LOCAL_AI_CHAT_HISTORY_LIMIT)
    .map(({ role, content, error }) => ({
      role,
      content,
      ...(error ? { error: true } : {})
    }));
}

function isInstalledLocalAiModel(modelName) {
  const normalized = normalizeLocalAiText(modelName).toLowerCase();
  if (!normalized) {
    return false;
  }

  return state.localAi.installedModels.some((model) => normalizeLocalAiModelName(model).toLowerCase() === normalized);
}

function isLocalAiPullCandidate(modelName) {
  const normalized = normalizeLocalAiText(modelName).toLowerCase();
  if (!normalized) {
    return false;
  }

  return LOCAL_AI_PULL_CANDIDATES.some((candidate) => candidate.name.toLowerCase() === normalized);
}

function formatLocalAiModelLabel(model) {
  const name = normalizeLocalAiModelName(model);
  if (!name) {
    return 'Unnamed model';
  }

  const details = [];
  const family = String(model?.details?.family || '').trim();
  const parameterSize = String(model?.details?.parameter_size || '').trim();

  if (family) {
    details.push(family);
  }
  if (parameterSize) {
    details.push(parameterSize);
  }

  return details.length ? `${name} · ${details.join(' · ')}` : name;
}

function resolveCurrentLocalAiRuntimeKind() {
  const requestedMode = normalizeLocalAiRuntimeMode(state.settings.localAiRuntimeMode || state.localAi.runtimeMode || 'auto');
  if (requestedMode === LOCAL_AI_RUNTIME_MODES.browser) {
    return 'browser';
  }

  if (requestedMode === LOCAL_AI_RUNTIME_MODES.local) {
    return 'ollama';
  }

  if (state.localAi.runtimeKind === 'ollama' || state.localAi.checking || state.localAi.pulling || state.localAi.summarizing) {
    return 'ollama';
  }

  if (state.localAi.runtimeKind === 'browser' || state.localAi.browser.loading || state.localAi.browser.ready) {
    return 'browser';
  }

  return 'ollama';
}

function updateLocalAiRuntimeMode(mode, { persist = true } = {}) {
  const normalized = normalizeLocalAiRuntimeMode(mode);
  state.localAi.runtimeMode = normalized;
  state.settings.localAiRuntimeMode = normalized;
  if (normalized === LOCAL_AI_RUNTIME_MODES.browser) {
    state.localAi.runtimeKind = 'browser';
    if (!state.localAi.browser.modelId) {
      const preferred = resolvePreferredBrowserAiModel({
        selectedModelId: state.settings.localAiBrowserModelId || '',
        cachedModelId: state.settings.localAiBrowserModelId || '',
        deviceMemory: navigator.deviceMemory || 0,
        hardwareConcurrency: navigator.hardwareConcurrency || 0
      }).model;
      if (preferred) {
        state.localAi.browser.modelId = preferred.id;
        state.localAi.browser.modelName = preferred.label;
        state.localAi.browser.modelRepo = preferred.repo;
        state.localAi.browser.modelFile = preferred.file;
        state.localAi.browser.modelQuantization = preferred.quantization;
        state.localAi.browser.modelSizeLabel = preferred.sizeLabel;
        state.localAi.browser.modelApproxBytes = preferred.approxSizeBytes;
        state.localAi.browser.modelNote = preferred.note;
        state.localAi.modelId = preferred.id;
        state.localAi.modelName = preferred.label;
      }
    }
  }

  if (persist) {
    persistSettings();
    renderAll();
  }
}

function renderLocalAiModelSelect() {
  if (!refs.aiModelSelect) {
    return;
  }

  const runtimeKind = resolveCurrentLocalAiRuntimeKind();
  if (runtimeKind === 'browser') {
    const selectedModelId = normalizeLocalAiText(
      state.localAi.browser.modelId
        || state.settings.localAiBrowserModelId
        || resolvePreferredBrowserAiModel({
          selectedModelId: state.settings.localAiBrowserModelId || '',
          cachedModelId: state.localAi.browser.modelId || '',
          deviceMemory: navigator.deviceMemory || 0,
          hardwareConcurrency: navigator.hardwareConcurrency || 0
        }).model?.id
    );
    const fragment = document.createDocumentFragment();
    const selectedModel = getBrowserAiModelById(selectedModelId) || resolvePreferredBrowserAiModel({
      selectedModelId,
      cachedModelId: state.localAi.browser.modelId || '',
      deviceMemory: navigator.deviceMemory || 0,
      hardwareConcurrency: navigator.hardwareConcurrency || 0
    }).model;
    const browserModel = selectedModel || BROWSER_AI_MODEL_CATALOG[0] || null;

    for (const optionModel of BROWSER_AI_MODEL_CATALOG) {
      fragment.appendChild(optionNode(
        optionModel.id,
        formatBrowserAiModelLabel(optionModel),
        optionModel.id === browserModel?.id
      ));
    }

    refs.aiModelSelect.replaceChildren(fragment);
    refs.aiModelSelect.value = browserModel?.id || refs.aiModelSelect.value || '';
    if (refs.aiModelMeta) {
      const storageWarning = state.localAi.browser.storageWarning
        || buildBrowserStorageWarning({
          usage: state.localAi.browser.storageUsage,
          quota: state.localAi.browser.storageQuota
        });
      refs.aiModelMeta.textContent = [
        browserModel ? `Browser model: ${formatBrowserAiModelLabel(browserModel)}.` : 'Choose a browser model to load into the WASM runtime.',
        state.localAi.browser.ready
          ? 'Loaded from the browser cache.'
          : 'The selected model will download into browser storage on first use.',
        state.localAi.browser.cached
          ? 'Cached in OPFS.'
          : '',
        storageWarning
      ].filter(Boolean).join(' ');
    }

    return;
  }

  const selectedModelName = normalizeLocalAiText(state.localAi.modelName || state.settings.localAiModelName);
  const installedModels = [];
  const seen = new Set();

  for (const model of state.localAi.installedModels) {
    const modelName = normalizeLocalAiModelName(model);
    if (!modelName || seen.has(modelName.toLowerCase())) {
      continue;
    }
    seen.add(modelName.toLowerCase());
    installedModels.push({
      name: modelName,
      label: formatLocalAiModelLabel(model)
    });
  }

  const installedNames = new Set(installedModels.map((model) => model.name.toLowerCase()));
  const candidateModels = LOCAL_AI_PULL_CANDIDATES
    .filter((candidate) => !installedNames.has(candidate.name.toLowerCase()))
    .map((candidate) => ({
      name: candidate.name,
      label: `${candidate.label} (download)`
    }));

  const fragment = document.createDocumentFragment();

  if (installedModels.length) {
    const installedGroup = document.createElement('optgroup');
    installedGroup.label = 'Installed models';
    for (const model of installedModels) {
      const option = document.createElement('option');
      option.value = model.name;
      option.textContent = model.label;
      option.selected = model.name.toLowerCase() === selectedModelName.toLowerCase();
      installedGroup.appendChild(option);
    }
    fragment.appendChild(installedGroup);
  } else {
    const selectedIsCandidate = Boolean(selectedModelName)
      && candidateModels.some((candidate) => candidate.name.toLowerCase() === selectedModelName.toLowerCase());
    const option = document.createElement('option');
    option.value = selectedIsCandidate ? '' : (selectedModelName || '');
    option.textContent = selectedModelName && !selectedIsCandidate
      ? `${selectedModelName} (selected, not installed)`
      : 'No Kimi models installed yet';
    option.selected = !selectedIsCandidate;
    option.disabled = !selectedModelName || selectedIsCandidate;
    fragment.appendChild(option);
  }

  if (selectedModelName && !installedNames.has(selectedModelName.toLowerCase()) && !candidateModels.some((candidate) => candidate.name.toLowerCase() === selectedModelName.toLowerCase())) {
    const customOption = document.createElement('option');
    customOption.value = selectedModelName;
    customOption.textContent = `${selectedModelName} (selected, not installed)`;
    customOption.selected = true;
    fragment.insertBefore(customOption, fragment.firstChild);
  }

  if (candidateModels.length) {
    const candidateGroup = document.createElement('optgroup');
    candidateGroup.label = 'Kimi downloads';
    for (const candidate of candidateModels) {
      const option = document.createElement('option');
      option.value = candidate.name;
      option.textContent = candidate.label;
      option.selected = candidate.name.toLowerCase() === selectedModelName.toLowerCase();
      candidateGroup.appendChild(option);
    }
    fragment.appendChild(candidateGroup);
  }

  refs.aiModelSelect.replaceChildren(fragment);
  refs.aiModelSelect.value = selectedModelName || refs.aiModelSelect.value || '';

  if (refs.aiModelMeta) {
    const installedCount = installedModels.length;
    const selectedLabel = selectedModelName
      ? (installedNames.has(selectedModelName.toLowerCase())
        ? `Selected ${selectedModelName} is installed.`
        : `${selectedModelName} is not installed yet.`)
      : 'Choose an installed model or download the latest Kimi variant.';
    refs.aiModelMeta.textContent = installedCount
      ? `${selectedLabel} ${installedCount.toLocaleString()} installed model${installedCount === 1 ? '' : 's'} available.`
      : selectedLabel;
  }
}

function syncLocalAiChatContext() {
  const transcriptText = normalizeLocalAiText(refs.transcriptEditor.value || state.transcriptText);
  const summaryText = normalizeLocalAiText(state.localAi.summaryText);
  const currentSignature = buildLocalAiContextSignature(transcriptText, summaryText);
  const chat = state.localAi.chat;
  const sessionHasDraft = Boolean(normalizeLocalAiText(chat.draft));
  const sessionHasMessages = chat.messages.length > 0;

  if (!chat.contextSignature && transcriptText) {
    chat.contextSignature = currentSignature;
  }

  const contextChanged = Boolean(chat.contextSignature && chat.contextSignature !== currentSignature);
  chat.stale = contextChanged && (sessionHasMessages || sessionHasDraft);
  if (!chat.stale && !sessionHasMessages && !sessionHasDraft && transcriptText) {
    chat.contextSignature = currentSignature;
  }

  if (chat.stale) {
    chat.status = 'stale';
    chat.message = 'This chat session is out of date.';
    chat.detail = 'Start a new session to anchor the current transcript and summary.';
  } else if (chat.sending) {
    chat.status = 'thinking';
    chat.message = 'Thinking...';
    chat.detail = 'Ollama is streaming a reply locally.';
  } else if (chat.error) {
    chat.status = 'error';
    chat.message = 'Chat failed.';
    chat.detail = chat.error;
  } else if (sessionHasMessages) {
    chat.status = 'ready';
    chat.message = 'Conversation ready.';
    chat.detail = state.localAi.summaryText
      ? 'This chat is anchored to the current transcript and summary.'
      : 'This chat is anchored to the current transcript.';
  } else if (transcriptText) {
    chat.status = 'ready';
    chat.message = 'Ask a follow-up question.';
    chat.detail = state.localAi.summaryText
      ? 'The current transcript and summary are fixed context for this session.'
      : 'The current transcript is fixed context for this session.';
  } else {
    chat.status = 'idle';
    chat.message = 'Add a transcript to start chatting.';
    chat.detail = 'Chat becomes available after a transcript exists.';
  }

  return {
    transcriptText,
    summaryText,
    currentSignature
  };
}

function updateLocalAiModelSelection(modelName, { persist = true } = {}) {
  const nextValue = normalizeLocalAiText(modelName);
  const runtimeKind = state.localAi.runtimeKind === 'browser' || normalizeLocalAiRuntimeMode(state.settings.localAiRuntimeMode) === 'browser'
    ? 'browser'
    : 'ollama';

  if (runtimeKind === 'browser') {
    const nextModel = getBrowserAiModelById(nextValue) || resolvePreferredBrowserAiModel({
      selectedModelId: state.settings.localAiBrowserModelId || state.localAi.browser.modelId || '',
      cachedModelId: state.settings.localAiBrowserModelId || state.localAi.browser.modelId || '',
      deviceMemory: navigator.deviceMemory || 0,
      hardwareConcurrency: navigator.hardwareConcurrency || 0
    }).model;

    if (nextModel) {
      state.localAi.browser.modelId = nextModel.id;
      state.localAi.browser.modelName = nextModel.label;
      state.localAi.browser.modelRepo = nextModel.repo;
      state.localAi.browser.modelFile = nextModel.file;
      state.localAi.browser.modelQuantization = nextModel.quantization;
      state.localAi.browser.modelSizeLabel = nextModel.sizeLabel;
      state.localAi.browser.modelApproxBytes = nextModel.approxSizeBytes;
      state.localAi.browser.modelNote = nextModel.note;
      state.localAi.modelId = nextModel.id;
      state.localAi.modelName = nextModel.label;
      state.localAi.cachedModelName = nextModel.label;
      state.settings.localAiBrowserModelId = nextModel.id;
      state.settings.localAiBrowserModelName = nextModel.label;
      state.settings.localAiBrowserModelRepo = nextModel.repo;
      state.settings.localAiBrowserModelFile = nextModel.file;
      state.settings.localAiBrowserModelQuantization = nextModel.quantization;
      state.settings.localAiBrowserModelSizeLabel = nextModel.sizeLabel;
      state.settings.localAiBrowserModelApproxBytes = nextModel.approxSizeBytes;
      state.settings.localAiBrowserModelNote = nextModel.note;
    }

    state.localAi.available = Boolean(state.localAi.browser.ready);
    state.localAi.runtimeKind = 'browser';
    state.localAi.status = state.localAi.browser.ready
      ? 'ready'
      : state.localAi.browser.loading
        ? 'checking'
        : 'idle';
    state.localAi.message = state.localAi.browser.ready
      ? LOCAL_AI_STATUS_MESSAGES.browserReady
      : state.localAi.browser.loading
        ? LOCAL_AI_STATUS_MESSAGES.browserLoadingModel
        : LOCAL_AI_STATUS_MESSAGES.browserLoading;
    state.localAi.detail = state.localAi.browser.ready
      ? `Using ${state.localAi.browser.modelName || nextValue || 'the browser model'} for summaries and chat.`
      : state.localAi.browser.modelName
        ? `Selected ${state.localAi.browser.modelName} will load in the browser runtime.`
        : 'Choose a browser model to load into the WASM runtime.';
    state.localAi.summaryError = '';
    state.localAi.chat.error = '';
  } else {
    const nextModelName = normalizeLocalAiText(nextValue);
    if (nextModelName) {
      state.localAi.modelName = nextModelName;
      state.localAi.modelId = nextModelName;
      state.settings.localAiModelName = nextModelName;
      state.localAi.cachedModelName = nextModelName;
    }

    const installed = isInstalledLocalAiModel(state.localAi.modelName);
    state.localAi.runtimeKind = 'ollama';
    state.localAi.available = installed;
    state.localAi.status = installed ? 'ready' : 'idle';
    state.localAi.message = installed
      ? LOCAL_AI_STATUS_MESSAGES.ready
      : LOCAL_AI_STATUS_MESSAGES.idle;
    state.localAi.detail = installed
      ? `Using ${state.localAi.modelName} for summaries and chat.`
      : state.localAi.modelName
        ? `Selected ${state.localAi.modelName} is not installed yet. Click Download selected model to pull it from Ollama.`
        : 'Choose an installed model or download the latest Kimi variant.';
    state.localAi.summaryError = '';
    state.localAi.chat.error = '';
  }

  if (persist) {
    persistSettings();
    renderAll();
  }
}

function renderLocalAiState() {
  if (!refs.aiState || !refs.summaryPanel) {
    return;
  }

  const transcriptState = syncLocalAiChatContext();
  const transcriptPresent = Boolean(normalizeLocalAiText(transcriptState.transcriptText));
  const runtimeKind = resolveCurrentLocalAiRuntimeKind();
  const browserWorking = state.localAi.browser.loading;
  const isWorking = state.localAi.checking || state.localAi.pulling || state.localAi.summarizing || state.localAi.chat.sending || browserWorking;
  const hasSummary = Boolean(state.localAi.summaryText);
  const hasError = Boolean(state.localAi.summaryError);
  const shouldShowSummary = hasSummary || hasError;
  const detailLevel = LOCAL_AI_DETAIL_LEVELS[selectedSummaryDetail()];
  const selectedModelName = normalizeLocalAiText(runtimeKind === 'browser'
    ? state.localAi.browser.modelName || state.settings.localAiBrowserModelName || state.localAi.modelName
    : state.localAi.modelName || state.settings.localAiModelName);
  const modelIsInstalled = runtimeKind === 'browser'
    ? Boolean(state.localAi.browser.ready)
    : selectedModelName
      ? isInstalledLocalAiModel(selectedModelName)
      : false;
  const summarySignature = state.localAi.summaryContextSignature || '';
  const transcriptSignature = buildLocalAiTextSignature(transcriptState.transcriptText);
  const browserStorageWarning = state.localAi.browser.storageWarning || buildBrowserStorageWarning({
    usage: state.localAi.browser.storageUsage,
    quota: state.localAi.browser.storageQuota
  });

  state.localAi.summaryDirty = Boolean(hasSummary && summarySignature && summarySignature !== transcriptSignature);
  const summaryIsStale = Boolean(state.localAi.summaryText && state.localAi.summaryDirty);
  if (summaryIsStale) {
    state.localAi.chat.stale = true;
    state.localAi.chat.status = 'stale';
    state.localAi.chat.message = 'Summary is out of date.';
    state.localAi.chat.detail = 'Regenerate the summary before starting a chat session.';
  }

  refs.aiState.textContent = browserWorking
    ? state.localAi.browser.message || state.localAi.message || LOCAL_AI_STATUS_MESSAGES.browserLoading
    : state.localAi.message || (state.localAi.supported ? 'Not checked yet' : LOCAL_AI_STATUS_MESSAGES.unavailable);
  refs.aiDetail.textContent = browserWorking || runtimeKind === 'browser'
    ? state.localAi.browser.detail || state.localAi.detail || 'Load a browser model into the WASM runtime.'
    : state.localAi.detail || (state.localAi.supported
      ? 'Check Ollama to download the latest Kimi model.'
      : `Install Ollama from ${OLLAMA_DOWNLOAD_URL} to enable summaries and chat.`);
  renderLocalAiModelSelect();
  if (refs.aiRuntimeMeta) {
    const runtimeMode = normalizeLocalAiRuntimeMode(state.settings.localAiRuntimeMode || state.localAi.runtimeMode || 'auto');
    refs.aiRuntimeMeta.textContent = runtimeMode === LOCAL_AI_RUNTIME_MODES.browser
      ? 'Browser-only mode uses the cached Kimi GGUF model in OPFS.'
      : runtimeMode === LOCAL_AI_RUNTIME_MODES.local
        ? 'Local-only mode prefers Ollama and does not switch to the browser model cache.'
        : 'Auto mode checks local Ollama first, then falls back to the browser WASM model if needed.';
    if (browserStorageWarning) {
      refs.aiRuntimeMeta.textContent = `${refs.aiRuntimeMeta.textContent} ${browserStorageWarning}`;
    }
  }
  refs.checkAiButton.textContent = runtimeKind === 'browser'
    ? browserWorking
      ? 'Loading browser model...'
      : modelIsInstalled
        ? 'Refresh browser model'
        : 'Load browser model'
    : state.localAi.status === 'unavailable'
      ? 'Retry Ollama'
      : state.localAi.checking
        ? 'Checking...'
        : state.localAi.pulling
          ? 'Downloading...'
          : modelIsInstalled
            ? 'Refresh local AI'
            : selectedModelName && isLocalAiPullCandidate(selectedModelName)
              ? 'Download selected model'
              : 'Download latest Kimi model';
  refs.checkAiButton.disabled = !state.localAi.supported || isWorking;
  refs.summarizeButton.textContent = state.localAi.summarizing ? 'Summarizing...' : 'Summarize transcript';
  refs.summarizeButton.disabled = !state.localAi.supported
    || !state.localAi.available
    || !state.localAi.modelName
    || !transcriptPresent
    || isWorking;
  refs.cancelAiButton.hidden = !isWorking;
  refs.cancelAiButton.disabled = !isWorking;
  refs.aiProgress.hidden = !state.localAi.pulling && !browserWorking;

  if (state.localAi.pulling) {
    const progressValue = Number(state.localAi.progress);
    if (Number.isFinite(progressValue)) {
      refs.aiProgressBar.value = Math.max(0, Math.min(100, progressValue));
    } else {
      refs.aiProgressBar.removeAttribute('value');
    }
    refs.aiProgressText.textContent = state.localAi.progressText || 'Downloading Kimi model...';
  } else if (browserWorking) {
    const progressValue = Number(state.localAi.browser.progress);
    if (Number.isFinite(progressValue)) {
      refs.aiProgressBar.value = Math.max(0, Math.min(100, progressValue));
    } else {
      refs.aiProgressBar.removeAttribute('value');
    }
    refs.aiProgressText.textContent = state.localAi.browser.progressText || state.localAi.browser.detail || 'Loading browser model...';
  } else {
    refs.aiProgressBar.removeAttribute('value');
    refs.aiProgressText.textContent = state.localAi.progressText || state.localAi.detail || '';
  }

  refs.summaryDetailBrief.disabled = isWorking;
  refs.summaryDetailStandard.disabled = isWorking;
  refs.summaryDetailDetailed.disabled = isWorking;

  refs.summaryPanel.hidden = !shouldShowSummary;
  refs.summaryPanel.classList.toggle('is-dirty', state.localAi.summaryDirty);
  refs.summaryPanel.classList.toggle('is-expanded', Boolean(state.localAi.summaryExpanded));
  refs.summaryPanel.classList.toggle('has-error', hasError);
  refs.summaryPanelTitle.textContent = hasError
    ? 'Summary unavailable'
    : state.localAi.summaryDirty
      ? 'Summary out of date'
      : 'Local AI summary';
  refs.summaryMeta.textContent = hasError
    ? 'Check Ollama and try again.'
    : hasSummary
      ? [
          state.localAi.summaryModelName ? `Model: ${state.localAi.summaryModelName}` : '',
          `${LOCAL_AI_DETAIL_LEVELS[state.localAi.summaryDetailLevel || selectedSummaryDetail()]?.label || 'Standard'} detail`,
          state.localAi.summarySourceChars ? `${state.localAi.summarySourceChars.toLocaleString()} transcript chars` : '',
          state.localAi.summaryWarning || '',
          state.localAi.summaryDirty ? 'Transcript changed since this summary was generated.' : ''
        ].filter(Boolean).join(' · ')
      : state.localAi.summaryDirty
        ? 'Transcript changed since this summary was generated.'
        : '';
  refs.summaryContent.textContent = hasError
    ? state.localAi.summaryError
    : hasSummary
      ? state.localAi.summaryText
      : 'No summary yet.';
  refs.summaryContent.classList.toggle('is-empty', !hasSummary && !hasError);
  refs.summaryContent.classList.toggle('is-collapsed', hasSummary && !state.localAi.summaryExpanded);
  refs.summaryExpandButton.hidden = !hasSummary;
  refs.summaryExpandButton.disabled = !hasSummary;
  refs.summaryExpandButton.textContent = state.localAi.summaryExpanded ? 'Collapse' : 'Expand';
  refs.summaryCopyButton.disabled = !hasSummary;
  refs.summaryDismissButton.disabled = !hasSummary && !hasError && !state.localAi.summaryDirty;
  refs.checkAiButton.title = runtimeKind === 'browser'
    ? modelIsInstalled
      ? 'Reload the browser model from OPFS.'
      : 'Download the selected browser model into OPFS.'
    : modelIsInstalled
      ? 'Refresh the installed Kimi model list from Ollama.'
      : selectedModelName && isLocalAiPullCandidate(selectedModelName)
        ? 'Download the selected Kimi model from Ollama.'
        : state.localAi.status === 'unavailable'
          ? `Retry Ollama after installing it from ${OLLAMA_DOWNLOAD_URL} on this desktop browser.`
          : 'Check Ollama and download the latest Kimi model.';
  refs.summarizeButton.title = transcriptPresent
    ? `${detailLevel.label} summaries stay local to this browser.`
    : 'Add a transcript before summarizing.';

  refs.aiModelSelect.disabled = isWorking || !state.localAi.supported;
  refs.chatPanel.hidden = !transcriptPresent;
  refs.chatPanelTitle.textContent = state.localAi.chat.stale ? 'Chat session out of date' : 'Local transcript chat';
  refs.chatMeta.textContent = transcriptPresent
    ? (summaryIsStale
      ? 'Regenerate the summary before chatting.'
      : state.localAi.summaryText
        ? 'Chat uses the current transcript and summary as fixed context.'
        : 'Chat uses the current transcript as fixed context.')
    : 'Add a transcript before chatting.';
  refs.chatStatus.textContent = state.localAi.chat.message || (state.localAi.chat.stale
    ? 'This session is out of date.'
    : transcriptPresent
      ? 'Ask a follow-up question about the transcript.'
      : 'Add a transcript to start chatting.');
  refs.chatInput.value = state.localAi.chat.draft || '';
  refs.chatInput.disabled = !transcriptPresent || isWorking || state.localAi.chat.stale || summaryIsStale || !state.localAi.available || !state.localAi.modelName;
  refs.chatSendButton.disabled = !transcriptPresent
    || isWorking
    || state.localAi.chat.stale
    || summaryIsStale
    || !state.localAi.chat.draft.trim()
    || !state.localAi.available
    || !state.localAi.modelName;
  refs.chatNewSessionButton.disabled = !transcriptPresent || isWorking || summaryIsStale;
  refs.chatClearButton.disabled = isWorking || (!state.localAi.chat.messages.length && !normalizeLocalAiText(state.localAi.chat.draft));
  refs.chatPanel.classList.toggle('is-stale', state.localAi.chat.stale || summaryIsStale);
  refs.chatPanel.classList.toggle('has-history', state.localAi.chat.messages.length > 0);
  refs.chatPanel.classList.toggle('is-working', state.localAi.chat.sending);
  refs.chatPanel.classList.toggle('has-error', Boolean(state.localAi.chat.error));

  const chatItems = [];
  if (state.localAi.chat.messages.length) {
    state.localAi.chat.messages.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = `chat-message chat-message--${entry.role}`;
      if (entry.pending) {
        item.classList.add('is-pending');
      }
      if (entry.error) {
        item.classList.add('is-error');
      }
      item.dataset.role = entry.role;
      item.dataset.index = String(index);

      const label = document.createElement('p');
      label.className = 'chat-message-label';
      label.textContent = entry.role === 'user' ? 'You' : 'Assistant';

      const body = document.createElement('p');
      body.className = 'chat-message-body';
      body.textContent = entry.content || (entry.pending ? 'Thinking...' : '');

      item.append(label, body);
      chatItems.push(item);
    });
  } else {
    const item = document.createElement('li');
    item.className = 'chat-empty';
    item.textContent = transcriptPresent
      ? 'Ask about decisions, names, action items, or missing context.'
      : 'Add a transcript to start a chat session.';
    chatItems.push(item);
  }
  refs.chatHistory.replaceChildren(...chatItems);
  if (state.localAi.chat.sending || state.localAi.chat.messages.length > 0) {
    refs.chatHistory.scrollTop = refs.chatHistory.scrollHeight;
  }
}

function selectedSummaryDetail() {
  if (refs.summaryDetailBrief.checked) {
    return 'brief';
  }

  if (refs.summaryDetailDetailed.checked) {
    return 'detailed';
  }

  return 'standard';
}

function setSummaryDetail(detailLevel, { persist = true } = {}) {
  const normalized = normalizeLocalAiDetailLevel(detailLevel);
  refs.summaryDetailBrief.checked = normalized === 'brief';
  refs.summaryDetailStandard.checked = normalized === 'standard';
  refs.summaryDetailDetailed.checked = normalized === 'detailed';
  state.settings.summaryDetail = normalized;
  if (persist) {
    persistSettings();
    renderAll();
  }
}

function markSummaryDirty() {
  if (state.localAi.summarizing) {
    return;
  }

  if (state.localAi.summaryText) {
    state.localAi.summaryDirty = true;
  }
}

function clearLocalSummary({ keepExpanded = false, keepDetailLevel = false } = {}) {
  state.localAi.summaryText = '';
  state.localAi.summaryWarning = '';
  state.localAi.summaryDirty = false;
  state.localAi.summarySourceChars = 0;
  state.localAi.summaryDetailLevel = 'standard';
  state.localAi.summaryModelName = '';
  state.localAi.summaryContextSignature = '';
  state.localAi.summaryError = '';
  if (!keepExpanded) {
    state.localAi.summaryExpanded = false;
  }
}

function cancelLocalAiWork({ silent = false } = {}) {
  if (state.localAi.activeController) {
    state.localAi.activeController.abort();
  }

  const hadCheck = state.localAi.checking || state.localAi.pulling;
  const hadSummary = state.localAi.summarizing;
  const hadChat = state.localAi.chat.sending;
  state.localAi.checking = false;
  state.localAi.pulling = false;
  state.localAi.summarizing = false;
  state.localAi.chat.sending = false;
  state.localAi.progress = null;
  state.localAi.progressText = '';
  state.localAi.activeController = null;

  if (hadChat) {
    const lastMessage = state.localAi.chat.messages[state.localAi.chat.messages.length - 1];
    if (lastMessage?.pending) {
      state.localAi.chat.messages.pop();
    }
    if (!silent) {
      state.localAi.chat.status = state.localAi.chat.stale ? 'stale' : 'ready';
      state.localAi.chat.message = state.localAi.chat.stale
        ? 'This chat session is out of date.'
        : 'Chat cancelled.';
      state.localAi.chat.detail = 'The chat request was cancelled.';
    }
  }

  if (hadSummary && !silent) {
    state.localAi.status = state.localAi.available ? 'ready' : 'idle';
    state.localAi.message = state.localAi.available
      ? LOCAL_AI_STATUS_MESSAGES.ready
      : LOCAL_AI_STATUS_MESSAGES.unavailable;
    state.localAi.detail = 'Summarization cancelled.';
  } else if (hadCheck && !silent) {
    state.localAi.status = state.localAi.available ? 'ready' : 'idle';
    state.localAi.message = state.localAi.available
      ? LOCAL_AI_STATUS_MESSAGES.ready
      : LOCAL_AI_STATUS_MESSAGES.unavailable;
    state.localAi.detail = 'Local AI check cancelled.';
  }

  renderAll();
}

function setLocalAiUnavailable(detail, { keepModel = false } = {}) {
  state.localAi.runtimeKind = 'ollama';
  state.localAi.available = false;
  state.localAi.checking = false;
  state.localAi.pulling = false;
  state.localAi.summarizing = false;
  state.localAi.status = 'unavailable';
  state.localAi.message = LOCAL_AI_STATUS_MESSAGES.unavailable;
  state.localAi.detail = detail || `Install Ollama from ${OLLAMA_DOWNLOAD_URL} to enable summaries and chat.`;
  state.localAi.progress = null;
  state.localAi.progressText = '';
  state.localAi.summaryError = '';
  state.localAi.activeController = null;
  state.localAi.baseUrl = '';
  if (!keepModel) {
    state.localAi.modelName = state.settings.localAiModelName || state.localAi.cachedModelName || '';
  }
  renderAll();
}

function setLocalAiReady(model, { source = 'installed', checkedAt = new Date().toISOString() } = {}) {
  const modelName = normalizeLocalAiModelName(model);
  state.localAi.available = true;
  state.localAi.runtimeKind = 'ollama';
  state.localAi.checking = false;
  state.localAi.pulling = false;
  state.localAi.summarizing = false;
  state.localAi.status = 'ready';
  state.localAi.message = LOCAL_AI_STATUS_MESSAGES.ready;
  state.localAi.detail = source === 'pulled'
    ? `${modelName} was downloaded and is ready for summaries and chat.`
    : `${modelName} is ready for summaries and chat.`;
  state.localAi.progress = null;
  state.localAi.progressText = '';
  state.localAi.summaryError = '';
  state.localAi.activeController = null;
  state.localAi.browser.loading = false;
  state.localAi.browser.ready = false;
  state.localAi.browser.status = 'idle';
  state.localAi.browser.message = '';
  state.localAi.browser.detail = '';
  state.localAi.browser.progress = null;
  state.localAi.browser.progressText = '';
  if (state.localAi.browser.runtime?.dispose) {
    void state.localAi.browser.runtime.dispose().catch(() => {});
  }
  state.localAi.browser.runtime = null;
  state.localAi.modelName = modelName;
  state.localAi.cachedModelName = modelName;
  state.localAi.lastSuccessfulCheckAt = checkedAt;
  state.settings.localAiModelName = modelName;
  state.settings.localAiLastSuccessfulCheckAt = checkedAt;
  persistSettings();
  renderAll();
}

async function setBrowserLocalAiLoading(model, { requestId = 0, forceRefresh = false } = {}) {
  const selectedModel = normalizeBrowserAiModel(model) || resolvePreferredBrowserAiModel({
    selectedModelId: state.settings.localAiBrowserModelId || '',
    cachedModelId: state.localAi.browser.modelId || '',
    deviceMemory: navigator.deviceMemory || 0,
    hardwareConcurrency: navigator.hardwareConcurrency || 0
  }).model;

  if (!selectedModel) {
    throw new Error('No browser AI model is available.');
  }

  state.localAi.runtimeKind = 'browser';
  state.localAi.available = false;
  state.localAi.checking = false;
  state.localAi.pulling = false;
  state.localAi.summarizing = false;
  state.localAi.status = 'checking';
  state.localAi.message = LOCAL_AI_STATUS_MESSAGES.browserLoading;
  state.localAi.detail = forceRefresh
    ? `Reloading ${formatBrowserAiModelLabel(selectedModel)} into the browser runtime.`
    : `Loading ${formatBrowserAiModelLabel(selectedModel)} into the browser runtime.`;
  state.localAi.progress = null;
  state.localAi.progressText = 'Preparing browser model...';
  state.localAi.summaryError = '';
  state.localAi.browser.modelId = selectedModel.id;
  state.localAi.browser.modelName = selectedModel.label;
  state.localAi.browser.modelRepo = selectedModel.repo;
  state.localAi.browser.modelFile = selectedModel.file;
  state.localAi.browser.modelQuantization = selectedModel.quantization;
  state.localAi.browser.modelSizeLabel = selectedModel.sizeLabel;
  state.localAi.browser.modelApproxBytes = selectedModel.approxSizeBytes;
  state.localAi.browser.modelNote = selectedModel.note;
  state.localAi.browser.loading = true;
  state.localAi.browser.ready = false;
  state.localAi.browser.status = 'loading';
  state.localAi.browser.message = LOCAL_AI_STATUS_MESSAGES.browserLoading;
  state.localAi.browser.detail = forceRefresh
    ? `Reloading ${formatBrowserAiModelLabel(selectedModel)} from the browser cache.`
    : `Loading ${formatBrowserAiModelLabel(selectedModel)} into the browser cache.`;
  state.localAi.browser.progress = null;
  state.localAi.browser.progressText = 'Preparing browser model...';
  state.localAi.browser.error = '';
  state.localAi.browser.warning = '';
  state.localAi.browser.loadRequestId = requestId;
  state.localAi.browser.runtime = null;
  state.localAi.modelId = selectedModel.id;
  state.localAi.modelName = selectedModel.label;
  state.settings.localAiBrowserModelId = selectedModel.id;
  state.settings.localAiBrowserModelName = selectedModel.label;
  state.settings.localAiBrowserModelRepo = selectedModel.repo;
  state.settings.localAiBrowserModelFile = selectedModel.file;
  state.settings.localAiBrowserModelQuantization = selectedModel.quantization;
  state.settings.localAiBrowserModelSizeLabel = selectedModel.sizeLabel;
  state.settings.localAiBrowserModelApproxBytes = selectedModel.approxSizeBytes;
  state.settings.localAiBrowserModelNote = selectedModel.note;
  renderAll();

  const storage = await estimateBrowserStorageQuota();
  state.localAi.browser.storageSupported = storage.supported;
  state.localAi.browser.storageUsage = storage.usage;
  state.localAi.browser.storageQuota = storage.quota;
  state.localAi.browser.storageWarning = storage.warning;
  if (storage.warning) {
    state.localAi.browser.warning = storage.warning;
  }

  renderAll();
  return selectedModel;
}

function updateBrowserLocalAiProgress(progress, { model } = {}) {
  const selectedModel = normalizeBrowserAiModel(model) || getBrowserAiModelById(state.localAi.browser.modelId);
  const progressValue = Number.isFinite(progress?.progress)
    ? Math.round(progress.progress)
    : Number.isFinite(progress?.loaded) && Number.isFinite(progress?.total) && progress.total > 0
      ? Math.round((progress.loaded / progress.total) * 100)
      : null;
  state.localAi.runtimeKind = 'browser';
  state.localAi.available = false;
  state.localAi.status = 'checking';
  state.localAi.message = progressValue == null
    ? LOCAL_AI_STATUS_MESSAGES.browserLoading
    : `${LOCAL_AI_STATUS_MESSAGES.browserLoading} (${progressValue}%)`;
  state.localAi.detail = progress?.message
    ? String(progress.message)
    : selectedModel
      ? `Loading ${formatBrowserAiModelLabel(selectedModel)} into the browser cache.`
      : 'Loading the browser model into the WASM runtime.';
  state.localAi.progress = progressValue;
  state.localAi.progressText = progress?.message || state.localAi.detail || '';
  state.localAi.browser.loading = true;
  state.localAi.browser.ready = false;
  state.localAi.browser.status = 'loading';
  state.localAi.browser.message = state.localAi.message;
  state.localAi.browser.detail = state.localAi.detail;
  state.localAi.browser.progress = progressValue;
  state.localAi.browser.progressText = progress?.message || state.localAi.detail || '';
  if (selectedModel) {
    state.localAi.browser.modelId = selectedModel.id;
    state.localAi.browser.modelName = selectedModel.label;
    state.localAi.browser.modelRepo = selectedModel.repo;
    state.localAi.browser.modelFile = selectedModel.file;
    state.localAi.browser.modelQuantization = selectedModel.quantization;
    state.localAi.browser.modelSizeLabel = selectedModel.sizeLabel;
    state.localAi.browser.modelApproxBytes = selectedModel.approxSizeBytes;
    state.localAi.browser.modelNote = selectedModel.note;
    state.localAi.modelId = selectedModel.id;
    state.localAi.modelName = selectedModel.label;
  }
  renderAll();
}

function setBrowserLocalAiReady(model, { cached = true, loadedAt = new Date().toISOString() } = {}) {
  const selectedModel = normalizeBrowserAiModel(model) || getBrowserAiModelById(state.localAi.browser.modelId);
  if (!selectedModel) {
    throw new Error('No browser AI model is available.');
  }

  state.localAi.runtimeKind = 'browser';
  state.localAi.available = true;
  state.localAi.checking = false;
  state.localAi.pulling = false;
  state.localAi.summarizing = false;
  state.localAi.status = 'ready';
  state.localAi.message = LOCAL_AI_STATUS_MESSAGES.browserReady;
  state.localAi.detail = `Using ${formatBrowserAiModelLabel(selectedModel)} for summaries and chat.`;
  state.localAi.progress = null;
  state.localAi.progressText = '';
  state.localAi.summaryError = '';
  state.localAi.activeController = null;
  state.localAi.modelId = selectedModel.id;
  state.localAi.modelName = selectedModel.label;
  state.localAi.cachedModelName = selectedModel.label;
  state.localAi.browser.modelId = selectedModel.id;
  state.localAi.browser.modelName = selectedModel.label;
  state.localAi.browser.modelRepo = selectedModel.repo;
  state.localAi.browser.modelFile = selectedModel.file;
  state.localAi.browser.modelQuantization = selectedModel.quantization;
  state.localAi.browser.modelSizeLabel = selectedModel.sizeLabel;
  state.localAi.browser.modelApproxBytes = selectedModel.approxSizeBytes;
  state.localAi.browser.modelNote = selectedModel.note;
  state.localAi.browser.loading = false;
  state.localAi.browser.ready = true;
  state.localAi.browser.status = 'ready';
  state.localAi.browser.message = LOCAL_AI_STATUS_MESSAGES.browserReady;
  state.localAi.browser.detail = `Using ${formatBrowserAiModelLabel(selectedModel)} for summaries and chat.`;
  state.localAi.browser.progress = null;
  state.localAi.browser.progressText = '';
  state.localAi.browser.error = '';
  state.localAi.browser.cached = Boolean(cached);
  state.localAi.browser.loadedAt = loadedAt;
  state.localAi.browser.runtime = state.localAi.browser.runtime || null;
  state.settings.localAiBrowserModelId = selectedModel.id;
  state.settings.localAiBrowserModelName = selectedModel.label;
  state.settings.localAiBrowserModelRepo = selectedModel.repo;
  state.settings.localAiBrowserModelFile = selectedModel.file;
  state.settings.localAiBrowserModelQuantization = selectedModel.quantization;
  state.settings.localAiBrowserModelSizeLabel = selectedModel.sizeLabel;
  state.settings.localAiBrowserModelApproxBytes = selectedModel.approxSizeBytes;
  state.settings.localAiBrowserModelNote = selectedModel.note;
  state.settings.localAiModelName = selectedModel.label;
  state.settings.localAiLastSuccessfulCheckAt = loadedAt;
  persistSettings();
  renderAll();
}

function setBrowserLocalAiUnavailable(detail, { keepModel = false } = {}) {
  state.localAi.runtimeKind = 'browser';
  state.localAi.available = false;
  state.localAi.checking = false;
  state.localAi.pulling = false;
  state.localAi.summarizing = false;
  state.localAi.status = 'unavailable';
  state.localAi.message = LOCAL_AI_STATUS_MESSAGES.unavailable;
  state.localAi.detail = detail || 'The browser model could not be loaded.';
  state.localAi.progress = null;
  state.localAi.progressText = '';
  state.localAi.summaryError = '';
  state.localAi.activeController = null;
  state.localAi.browser.loading = false;
  state.localAi.browser.ready = false;
  state.localAi.browser.status = 'unavailable';
  state.localAi.browser.message = LOCAL_AI_STATUS_MESSAGES.unavailable;
  state.localAi.browser.detail = detail || 'The browser model could not be loaded.';
  state.localAi.browser.progress = null;
  state.localAi.browser.progressText = '';
  state.localAi.browser.error = detail || '';
  state.localAi.browser.runtime = null;
  if (!keepModel) {
    state.localAi.modelId = state.localAi.browser.modelId || '';
    state.localAi.modelName = state.localAi.browser.modelName || '';
  }
  renderAll();
}

function updateLocalAiDownloadProgress(progress) {
  const percent = Number.isFinite(progress?.progress) ? Math.round(progress.progress) : null;
  state.localAi.status = 'downloading';
  state.localAi.message = percent == null
    ? LOCAL_AI_STATUS_MESSAGES.downloading
    : `${LOCAL_AI_STATUS_MESSAGES.downloading} (${percent}%)`;
  state.localAi.detail = progress?.status
    ? `Pulling ${state.localAi.cachedModelName || state.localAi.modelName || 'the Kimi model'}.`
    : 'Downloading the latest Kimi model from Ollama.';
  state.localAi.progress = percent;
  state.localAi.progressText = percent == null
    ? progress?.status || 'Downloading Kimi model...'
    : `${progress?.status || 'Downloading Kimi model...'} (${percent}%)`;
  renderAll();
}

async function initializeLocalAi({ forceRefresh = false } = {}) {
  const runtimeMode = normalizeLocalAiRuntimeMode(state.settings.localAiRuntimeMode || state.localAi.runtimeMode || 'auto');
  state.localAi.runtimeMode = runtimeMode;
  const browserCapable = supportsBrowserLocalAi() && state.localAi.browserSupported;

  if (runtimeMode === LOCAL_AI_RUNTIME_MODES.browser) {
    await initializeBrowserLocalAi({ forceRefresh });
    return;
  }

  if (!state.localAi.ollamaSupported) {
    if (browserCapable && runtimeMode !== LOCAL_AI_RUNTIME_MODES.local) {
      await initializeBrowserLocalAi({ forceRefresh });
      return;
    }

    setLocalAiUnavailable('Local AI unavailable – install Ollama to enable summaries and chat.');
    return;
  }

  if (state.localAi.checking || state.localAi.pulling || state.localAi.summarizing) {
    cancelLocalAiWork({ silent: true });
  }

  const requestId = state.localAi.checkRequestId + 1;
  state.localAi.checkRequestId = requestId;
  const controller = new AbortController();
  state.localAi.activeController = controller;
  state.localAi.available = false;
  state.localAi.checking = true;
  state.localAi.pulling = false;
  state.localAi.summarizing = false;
  state.localAi.status = 'checking';
  state.localAi.message = LOCAL_AI_STATUS_MESSAGES.checking;
  state.localAi.detail = 'Probing Ollama for installed models.';
  state.localAi.progress = null;
  state.localAi.progressText = '';
  state.localAi.summaryError = '';
  state.localAi.baseUrl = '';
  renderAll();

  try {
    const { baseUrl, models } = await fetchOllamaModelsFromCandidates({
      baseUrls: resolveOllamaBaseUrlCandidates(state.config.localAiBaseUrl),
      signal: controller.signal
    });
    if (controller.signal.aborted || requestId !== state.localAi.checkRequestId) {
      return;
    }

    state.localAi.baseUrl = baseUrl;
    state.localAi.installedModels = Array.isArray(models) ? models : [];

    const selectedModelName = normalizeLocalAiText(state.localAi.modelName || state.settings.localAiModelName);
    const installedModel = selectedModelName
      ? state.localAi.installedModels.find((model) => normalizeLocalAiModelName(model).toLowerCase() === selectedModelName.toLowerCase())
      : null;
    const bestInstalled = resolveBestKimiModel(state.localAi.installedModels, {
      cachedModelName: selectedModelName || state.localAi.cachedModelName || state.settings.localAiModelName
    });

    if (installedModel) {
      setLocalAiReady(installedModel, {
        source: 'installed'
      });
      return;
    }

    if (!selectedModelName && bestInstalled) {
      setLocalAiReady(bestInstalled.model || bestInstalled, {
        source: 'installed'
      });
      return;
    }

    if (!forceRefresh) {
      if (browserCapable && runtimeMode !== LOCAL_AI_RUNTIME_MODES.local) {
        state.localAi.checking = false;
        state.localAi.pulling = false;
        state.localAi.summarizing = false;
        state.localAi.activeController = null;
        await initializeBrowserLocalAi({
          forceRefresh,
          reason: 'ollama-no-model'
        });
        return;
      }

      state.localAi.available = false;
      state.localAi.checking = false;
      state.localAi.pulling = false;
      state.localAi.summarizing = false;
      state.localAi.status = 'idle';
      state.localAi.message = LOCAL_AI_STATUS_MESSAGES.idle;
      state.localAi.detail = selectedModelName
        ? `${selectedModelName} is not installed yet. Click Download selected model to fetch it from Ollama.`
        : 'Ollama responded, but no Kimi model is installed yet. Click Download latest Kimi model to fetch the recommended model.';
      state.localAi.progress = null;
      state.localAi.progressText = '';
      state.localAi.summaryError = '';
      state.localAi.activeController = null;
      if (!selectedModelName) {
        const candidate = resolvePreferredKimiPullCandidate({
          cachedModelName: state.localAi.cachedModelName || state.settings.localAiModelName
        });
        state.localAi.modelName = candidate?.name || state.localAi.cachedModelName || state.settings.localAiModelName || '';
        state.settings.localAiModelName = state.localAi.modelName;
      } else {
        state.localAi.modelName = selectedModelName;
        state.settings.localAiModelName = selectedModelName;
      }
      renderAll();
      return;
    }

    const candidate = selectedModelName
      ? LOCAL_AI_PULL_CANDIDATES.find((entry) => entry.name.toLowerCase() === selectedModelName.toLowerCase())
        || resolvePreferredKimiPullCandidate({
          cachedModelName: selectedModelName || state.localAi.cachedModelName || state.settings.localAiModelName
        })
      : resolvePreferredKimiPullCandidate({
        cachedModelName: state.localAi.cachedModelName || state.settings.localAiModelName
      });
    if (!candidate) {
      throw new Error('No Kimi pull candidate was available.');
    }

    state.localAi.modelName = candidate.name;
    state.settings.localAiModelName = candidate.name;
    state.localAi.cachedModelName = candidate.name;
    renderAll();

    state.localAi.checking = false;
    state.localAi.pulling = true;
    state.localAi.status = 'downloading';
    state.localAi.message = LOCAL_AI_STATUS_MESSAGES.downloading;
    state.localAi.detail = `Downloading ${candidate.label} from Ollama.`;
    state.localAi.progress = null;
    state.localAi.progressText = 'Downloading Kimi model...';
    renderAll();

    await pullOllamaModelWithProgress({
      modelName: candidate.name,
      baseUrl: resolveLocalAiBaseUrl(),
      signal: controller.signal,
      onProgress: updateLocalAiDownloadProgress
    });

    if (controller.signal.aborted || requestId !== state.localAi.checkRequestId) {
      return;
    }

    const refreshedModels = await fetchOllamaModels({
      baseUrl: resolveLocalAiBaseUrl(),
      signal: controller.signal
    });
    if (controller.signal.aborted || requestId !== state.localAi.checkRequestId) {
      return;
    }

    state.localAi.installedModels = Array.isArray(refreshedModels) ? refreshedModels : state.localAi.installedModels;
    const resolved = resolveBestKimiModel(refreshedModels, {
      cachedModelName: candidate.name
    });
    setLocalAiReady(resolved?.model || resolved || { name: candidate.name }, {
      source: 'pulled'
    });
  } catch (error) {
    if (controller.signal.aborted || requestId !== state.localAi.checkRequestId) {
      return;
    }

    if (browserCapable && runtimeMode !== LOCAL_AI_RUNTIME_MODES.local) {
      state.localAi.checking = false;
      state.localAi.pulling = false;
      state.localAi.summarizing = false;
      state.localAi.activeController = null;
      await initializeBrowserLocalAi({
        forceRefresh,
        reason: 'ollama-error'
      });
      return;
    }

    const wasPulling = state.localAi.pulling;
    state.localAi.available = false;
    state.localAi.checking = false;
    state.localAi.pulling = false;
    state.localAi.summarizing = false;
    state.localAi.status = 'unavailable';
    state.localAi.message = LOCAL_AI_STATUS_MESSAGES.unavailable;
    if (!wasPulling && Array.isArray(error?.attempts) && error.attempts.length > 0) {
      const attemptedBaseUrls = error.attempts.map((attempt) => attempt.baseUrl).filter(Boolean);
      state.localAi.detail = attemptedBaseUrls.length
        ? `Tried ${attemptedBaseUrls.join(', ')} but Ollama did not answer. Make sure Ollama is running on this device, then click Retry.`
        : 'Ollama did not answer. Make sure Ollama is running on this device, then click Retry.';
    } else {
      state.localAi.detail = describeLocalAiError(error, {
        phase: wasPulling ? 'pull' : 'connect',
        baseUrl: state.localAi.baseUrl || OLLAMA_DEFAULT_BASE_URL
      });
    }
    state.localAi.progress = null;
    state.localAi.progressText = '';
    state.localAi.activeController = null;
    renderAll();
  } finally {
    if (requestId === state.localAi.checkRequestId) {
      state.localAi.checking = false;
      state.localAi.pulling = false;
      state.localAi.activeController = null;
      renderAll();
    }
  }
}

async function initializeBrowserLocalAi({ forceRefresh = false, reason = 'fallback' } = {}) {
  if (!state.localAi.browserSupported) {
    setBrowserLocalAiUnavailable('Browser WASM local AI is not supported in this browser.');
    return;
  }

  if (state.localAi.checking || state.localAi.pulling || state.localAi.summarizing || state.localAi.browser.loading) {
    cancelLocalAiWork({ silent: true });
  }

  const selection = resolvePreferredBrowserAiModel({
    selectedModelId: state.settings.localAiBrowserModelId || state.localAi.browser.modelId || '',
    cachedModelId: state.localAi.browser.cached
      ? state.localAi.browser.modelId || ''
      : state.settings.localAiBrowserModelId || state.localAi.browser.modelId || '',
    deviceMemory: navigator.deviceMemory || 0,
    hardwareConcurrency: navigator.hardwareConcurrency || 0
  });

  if (!selection.model) {
    setBrowserLocalAiUnavailable('No browser model is available.');
    return;
  }

  const requestId = state.localAi.browser.loadRequestId + 1;
  state.localAi.browser.loadRequestId = requestId;
  const controller = new AbortController();
  state.localAi.activeController = controller;
  let runtime = null;

  try {
    await setBrowserLocalAiLoading(selection.model, {
      requestId,
      forceRefresh
    });

    runtime = await createBrowserAiRuntime({
      model: selection.model,
      onStatus: (status) => {
        if (controller.signal.aborted || requestId !== state.localAi.browser.loadRequestId) {
          return;
        }

        if (status?.message) {
          state.localAi.browser.message = String(status.message);
          state.localAi.message = String(status.message);
        }
        if (status?.detail) {
          state.localAi.browser.detail = String(status.detail);
          state.localAi.detail = String(status.detail);
        }
        renderAll();
      },
      onProgress: (progress) => {
        if (controller.signal.aborted || requestId !== state.localAi.browser.loadRequestId) {
          return;
        }

        updateBrowserLocalAiProgress(progress, {
          model: selection.model
        });
      }
    });

    state.localAi.browser.runtime = runtime;
    const ready = await runtime.ensureReady({
      model: selection.model,
      forceRefresh,
      signal: controller.signal
    });

    if (controller.signal.aborted || requestId !== state.localAi.browser.loadRequestId) {
      return;
    }

    state.localAi.browser.cached = Boolean(ready?.cached);
    setBrowserLocalAiReady(selection.model, {
      cached: Boolean(ready?.cached),
      loadedAt: new Date().toISOString()
    });
    state.localAi.browser.warning = state.localAi.browser.storageWarning || '';
    setStatus(`Browser model ready: ${formatBrowserAiModelLabel(selection.model)}.`);
    renderAll();
  } catch (error) {
    if (runtime?.dispose) {
      await runtime.dispose().catch(() => {});
    }
    if (state.localAi.browser.runtime === runtime) {
      state.localAi.browser.runtime = null;
    }
    if (controller.signal.aborted || requestId !== state.localAi.browser.loadRequestId) {
      return;
    }

    const detail = describeBrowserAiError(error, {
      phase: 'connect',
      modelName: selection.model.label
    });
    setBrowserLocalAiUnavailable(detail);
    state.localAi.browser.error = detail;
    setStatus(detail);
  } finally {
    if (requestId === state.localAi.browser.loadRequestId) {
      state.localAi.browser.loading = false;
      state.localAi.activeController = null;
      renderAll();
    }
  }
}

async function summarizeCurrentTranscript() {
  const transcript = (refs.transcriptEditor.value || state.transcriptText || '').trim();
  if (!transcript) {
    setStatus('Add a transcript before summarizing.');
    return;
  }

  if (!state.localAi.supported || !state.localAi.available || !state.localAi.modelName) {
    setStatus(LOCAL_AI_STATUS_MESSAGES.unavailable);
    return;
  }

  if (state.localAi.checking || state.localAi.pulling) {
    setStatus('Wait for the Kimi model to finish loading.');
    return;
  }

  if (state.localAi.summarizing) {
    cancelLocalAiWork({ silent: true });
  }

  const detailLevel = selectedSummaryDetail();
  const requestId = state.localAi.summarizeRequestId + 1;
  state.localAi.summarizeRequestId = requestId;
  const controller = new AbortController();
  state.localAi.activeController = controller;
  state.localAi.summarizing = true;
  state.localAi.status = 'summarizing';
  state.localAi.message = LOCAL_AI_STATUS_MESSAGES.summarizing;
  state.localAi.detail = `Using ${state.localAi.modelName} at ${LOCAL_AI_DETAIL_LEVELS[detailLevel].label} detail.`;
  state.localAi.summaryError = '';
  state.localAi.summaryWarning = '';
  state.localAi.summaryDirty = false;
  state.localAi.summarySourceChars = transcript.length;
  state.localAi.summaryContextSignature = buildLocalAiTextSignature(transcript);
  const localAiBaseUrl = resolveLocalAiBaseUrl();
  const runtimeMode = normalizeLocalAiRuntimeMode(state.settings.localAiRuntimeMode || state.localAi.runtimeMode || 'auto');
  const runtimeKind = runtimeMode === LOCAL_AI_RUNTIME_MODES.local
    ? 'ollama'
    : state.localAi.browser.ready && state.localAi.browser.runtime
      ? 'browser'
      : resolveCurrentLocalAiRuntimeKind();
  const activeModelName = runtimeKind === 'browser'
    ? state.localAi.browser.modelName || state.localAi.modelName
    : state.localAi.modelName;
  renderAll();

  try {
    const result = runtimeKind === 'browser'
      ? await state.localAi.browser.runtime.summarize({
        transcriptText: transcript,
        detailLevel,
        signal: controller.signal
      })
      : await summarizeWithOllama({
        modelName: state.localAi.modelName,
        transcriptText: transcript,
        detailLevel,
        baseUrl: localAiBaseUrl,
        signal: controller.signal
      });

    if (controller.signal.aborted || requestId !== state.localAi.summarizeRequestId) {
      return;
    }

    state.localAi.summaryText = result.summary;
    state.localAi.summaryWarning = result.preparedTranscript.truncated
      ? result.preparedTranscript.warning
      : '';
    state.localAi.summaryError = '';
    state.localAi.summaryExpanded = false;
    state.localAi.summaryDirty = false;
    state.localAi.summarySourceChars = transcript.length;
    state.localAi.summaryDetailLevel = detailLevel;
    state.localAi.summaryModelName = activeModelName;
    state.localAi.summaryContextSignature = buildLocalAiTextSignature(transcript);
    state.localAi.summarizing = false;
    state.localAi.status = 'ready';
    state.localAi.message = runtimeKind === 'browser'
      ? LOCAL_AI_STATUS_MESSAGES.browserReady
      : LOCAL_AI_STATUS_MESSAGES.ready;
    state.localAi.detail = runtimeKind === 'browser'
      ? `Summarized with ${activeModelName} in the browser runtime at ${LOCAL_AI_DETAIL_LEVELS[detailLevel].label} detail.`
      : `Summarized with ${state.localAi.modelName} at ${LOCAL_AI_DETAIL_LEVELS[detailLevel].label} detail.`;
    state.localAi.activeController = null;
    setStatus(`Summary ready with ${activeModelName}.`);
    renderAll();
  } catch (error) {
    if (controller.signal.aborted || requestId !== state.localAi.summarizeRequestId) {
      return;
    }

    state.localAi.summarizing = false;
    state.localAi.activeController = null;
    state.localAi.status = 'ready';
    state.localAi.message = runtimeKind === 'browser'
      ? LOCAL_AI_STATUS_MESSAGES.browserReady
      : LOCAL_AI_STATUS_MESSAGES.ready;
    state.localAi.detail = runtimeKind === 'browser'
      ? 'Browser summarization failed. You can retry with a smaller browser model or a different detail level.'
      : 'Summarization failed. You can retry with a different detail level.';
    state.localAi.summaryError = runtimeKind === 'browser'
      ? describeBrowserAiError(error, {
        phase: 'summary',
        modelName: activeModelName
      })
      : describeLocalAiError(error, {
        phase: 'summary',
        baseUrl: resolveLocalAiBaseUrl()
      });
    setStatus(`Summarization failed: ${state.localAi.summaryError}`);
    renderAll();
  } finally {
    if (requestId === state.localAi.summarizeRequestId) {
      state.localAi.summarizing = false;
      state.localAi.activeController = null;
      renderAll();
    }
  }
}

function dismissSummary() {
  clearLocalSummary();
  state.localAi.summaryError = '';
  state.localAi.summaryWarning = '';
  state.localAi.summaryDirty = false;
  setStatus('Summary dismissed.');
  renderAll();
}

async function copySummary() {
  const text = state.localAi.summaryText || '';
  if (!text) {
    setStatus('Nothing to copy yet.');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus('Summary copied to the clipboard.');
  } catch {
    const temporary = document.createElement('textarea');
    temporary.value = text;
    temporary.setAttribute('readonly', '');
    temporary.style.position = 'fixed';
    temporary.style.left = '-9999px';
    document.body.appendChild(temporary);
    temporary.focus();
    temporary.select();
    document.execCommand('copy');
    temporary.remove();
    setStatus('Summary copied.');
  }
}

function toggleSummaryExpanded() {
  if (!state.localAi.summaryText) {
    return;
  }

  state.localAi.summaryExpanded = !state.localAi.summaryExpanded;
  renderAll();
}

function startLocalChatSession({ keepDraft = true } = {}) {
  if (state.localAi.activeController || state.localAi.chat.sending || state.localAi.checking || state.localAi.pulling || state.localAi.summarizing) {
    cancelLocalAiWork({ silent: true });
  }

  const { transcriptText, summaryText, currentSignature } = syncLocalAiChatContext();
  state.localAi.chat.contextSignature = transcriptText ? currentSignature : '';
  state.localAi.chat.messages = [];
  state.localAi.chat.stale = false;
  state.localAi.chat.sending = false;
  state.localAi.chat.requestId += 1;
  state.localAi.chat.error = '';
  state.localAi.chat.status = transcriptText ? 'ready' : 'idle';
  state.localAi.chat.message = transcriptText
    ? 'New chat session ready.'
    : 'Add a transcript to start chatting.';
  state.localAi.chat.detail = transcriptText
    ? (summaryText
      ? 'The current transcript and summary are fixed context for this session.'
      : 'The current transcript is fixed context for this session.')
    : 'Chat becomes available after a transcript exists.';
  if (!keepDraft) {
    state.localAi.chat.draft = '';
  }
  setStatus('New chat session started.');
  persistSessionDraft();
  renderAll();
}

function clearLocalChatSession() {
  if (state.localAi.activeController || state.localAi.chat.sending || state.localAi.checking || state.localAi.pulling || state.localAi.summarizing) {
    cancelLocalAiWork({ silent: true });
  }

  state.localAi.chat.contextSignature = '';
  state.localAi.chat.messages = [];
  state.localAi.chat.draft = '';
  state.localAi.chat.stale = false;
  state.localAi.chat.sending = false;
  state.localAi.chat.requestId += 1;
  state.localAi.chat.error = '';
  state.localAi.chat.status = 'idle';
  state.localAi.chat.message = 'Chat cleared.';
  state.localAi.chat.detail = 'Start a new session to ask follow-up questions.';
  setStatus('Chat cleared.');
  persistSessionDraft();
  renderAll();
}

async function sendChatMessage() {
  const transcriptText = normalizeLocalAiText(refs.transcriptEditor.value || state.transcriptText);
  const summaryText = normalizeLocalAiText(state.localAi.summaryText);
  const userMessage = normalizeLocalAiText(refs.chatInput.value || state.localAi.chat.draft);

  if (!transcriptText) {
    setStatus('Add a transcript before chatting.');
    return;
  }

  if (!state.localAi.supported || !state.localAi.available || !state.localAi.modelName) {
    setStatus(state.localAi.detail || LOCAL_AI_STATUS_MESSAGES.unavailable);
    return;
  }

  if (state.localAi.chat.stale) {
    setStatus('Start a new chat session after the transcript or summary changes.');
    return;
  }

  if (!userMessage) {
    setStatus('Add a question before starting the chat.');
    return;
  }

  if (state.localAi.chat.sending) {
    return;
  }

  const requestId = state.localAi.chat.requestId + 1;
  state.localAi.chat.requestId = requestId;
  const controller = new AbortController();
  state.localAi.activeController = controller;
  state.localAi.chat.sending = true;
  state.localAi.chat.status = 'thinking';
  state.localAi.chat.message = 'Thinking...';
  state.localAi.chat.detail = 'Ollama is streaming a reply locally.';
  state.localAi.chat.error = '';
  state.localAi.chat.contextSignature = buildLocalAiContextSignature(transcriptText, summaryText);
  state.localAi.chat.messages.push(
    {
      role: 'user',
      content: userMessage
    },
    {
      role: 'assistant',
      content: '',
      pending: true
    }
  );
  state.localAi.chat.draft = '';
  renderAll();

  let chatFailed = false;
  const runtimeMode = normalizeLocalAiRuntimeMode(state.settings.localAiRuntimeMode || state.localAi.runtimeMode || 'auto');
  const runtimeKind = runtimeMode === LOCAL_AI_RUNTIME_MODES.local
    ? 'ollama'
    : state.localAi.browser.ready && state.localAi.browser.runtime
      ? 'browser'
      : resolveCurrentLocalAiRuntimeKind();
  const activeModelName = runtimeKind === 'browser'
    ? state.localAi.browser.modelName || state.localAi.modelName
    : state.localAi.modelName;
  try {
    const history = sanitizeLocalAiChatMessages(state.localAi.chat.messages.slice(0, -2));
    const localAiBaseUrl = resolveLocalAiBaseUrl();
    const result = runtimeKind === 'browser'
      ? await state.localAi.browser.runtime.chat({
        transcriptText,
        summaryText,
        history,
        userMessage,
        signal: controller.signal,
        onChunk: (reply) => {
          if (controller.signal.aborted || requestId !== state.localAi.chat.requestId) {
            return;
          }

          const lastMessage = state.localAi.chat.messages[state.localAi.chat.messages.length - 1];
          if (lastMessage) {
            lastMessage.content = reply;
            lastMessage.pending = true;
          }
          renderAll();
        }
      })
      : await chatWithOllama({
        modelName: state.localAi.modelName,
        transcriptText,
        summaryText,
        history,
        userMessage,
        baseUrl: localAiBaseUrl,
        signal: controller.signal,
        onChunk: (reply) => {
          if (controller.signal.aborted || requestId !== state.localAi.chat.requestId) {
            return;
          }

          const lastMessage = state.localAi.chat.messages[state.localAi.chat.messages.length - 1];
          if (lastMessage) {
            lastMessage.content = reply;
            lastMessage.pending = true;
          }
          renderAll();
        }
      });

    if (controller.signal.aborted || requestId !== state.localAi.chat.requestId) {
      return;
    }

    const lastMessage = state.localAi.chat.messages[state.localAi.chat.messages.length - 1];
    if (lastMessage) {
      lastMessage.content = result.reply;
      lastMessage.pending = false;
      delete lastMessage.error;
    }
    state.localAi.chat.sending = false;
    state.localAi.chat.status = 'ready';
    state.localAi.chat.message = 'Conversation ready.';
    state.localAi.chat.detail = runtimeKind === 'browser'
      ? `Reply generated with ${activeModelName} in the browser runtime.`
      : `Reply generated with ${state.localAi.modelName}.`;
    state.localAi.chat.error = '';
    state.localAi.activeController = null;
    setStatus('Chat reply ready.');
    persistSessionDraft();
    renderAll();
  } catch (error) {
    if (controller.signal.aborted || requestId !== state.localAi.chat.requestId) {
      return;
    }

    const detail = runtimeKind === 'browser'
      ? describeBrowserAiError(error, {
        phase: 'chat',
        modelName: activeModelName
      })
      : describeLocalAiError(error, {
        phase: 'chat',
        baseUrl: resolveLocalAiBaseUrl()
      });
    const lastMessage = state.localAi.chat.messages[state.localAi.chat.messages.length - 1];
    if (lastMessage) {
      lastMessage.content = detail;
      lastMessage.pending = false;
      lastMessage.error = true;
    }
    state.localAi.chat.sending = false;
    state.localAi.chat.status = 'error';
    state.localAi.chat.message = 'Chat failed.';
    state.localAi.chat.detail = detail;
    state.localAi.chat.error = detail;
    state.localAi.activeController = null;
    chatFailed = true;
    setStatus(detail);
    persistSessionDraft();
    renderAll();
  } finally {
    if (requestId === state.localAi.chat.requestId) {
      state.localAi.chat.sending = false;
      if (!chatFailed && !state.localAi.chat.stale && state.localAi.chat.messages.length) {
        state.localAi.chat.status = 'ready';
        state.localAi.chat.message = 'Conversation ready.';
      }
      state.localAi.activeController = null;
      renderAll();
    }
  }
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
    teardownWorkers();
  } finally {
    state.runtimeLoading = false;
    state.runtimeProgressMessage = '';
    refs.loadRuntimeButton.disabled = false;
    updateRuntimeButtonLabel();
    renderAll();
    persistSessionDraft({ immediate: true });
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
    state.serverBackup = null;
    state.serverBackupNotice = '';
    state.outputs = { txt: '', srt: '', vtt: '', preview: '' };
    state.durationSeconds = 0;
    clearLocalSummary({ keepDetailLevel: true });
    if (!preserveRecordingPreview) {
      clearRecordingPreview();
    }
    setStatus(validation.message);
    refs.transcriptEditor.value = '';
    updateTranscriptPreview();
    refs.timedPreview.textContent = 'No transcript yet.';
    renderAll();
    persistSessionDraft({ immediate: true });
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
  state.serverBackupNotice = '';
  if (!state.serverBackup || state.serverBackup.originalName !== file.name || state.serverBackup.size !== file.size) {
    state.serverBackup = null;
  }
  state.outputs = { txt: '', srt: '', vtt: '', preview: '' };
  state.durationSeconds = initialDurationSeconds;
  clearLocalSummary({ keepDetailLevel: true });
  refs.fileInput.value = '';
  refs.transcriptEditor.value = '';
  updateTranscriptPreview();
  refs.timedPreview.textContent = 'No transcript yet.';
  if (!preserveRecordingPreview) {
    clearRecordingPreview();
  }
  setStatus(`Selected ${file.name}. Load Whisper / Export to continue.`);
  persistSessionDraft({ immediate: true });
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
    setStatus('Load Whisper / Export before transcribing.');
    return;
  }

  state.transcribing = true;
  state.currentJobId += 1;
  const jobId = state.currentJobId;
  renderAll();
  state.transcriptNotice = '';
  clearLocalSummary({ keepDetailLevel: true });
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
    persistSessionDraft({ immediate: true });
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
  clearLocalSummary({ keepDetailLevel: true });
  state.whisperClient?.raw?.postMessage({ type: 'cancel' });
  refs.cancelButton.hidden = true;
  setStatus('Transcription cancelled.');
  renderAll();
  persistSessionDraft({ immediate: true });
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
    ? (
      state.serverBackupNotice
        || (state.serverBackup ? `Saved to host: ${state.serverBackup.originalName}` : 'Host backup on')
    )
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
  renderLocalAiState();

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

function buildSettingsSnapshot() {
  return {
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
    summaryDetail: refs.summaryDetailBrief.checked
      ? 'brief'
      : refs.summaryDetailDetailed.checked
        ? 'detailed'
        : 'standard',
    localAiRuntimeMode: normalizeLocalAiRuntimeMode(state.settings.localAiRuntimeMode || state.localAi.runtimeMode || 'auto'),
    localAiModelName: state.localAi.modelName || '',
    localAiLastSuccessfulCheckAt: state.localAi.lastSuccessfulCheckAt || '',
    localAiBrowserModelId: state.settings.localAiBrowserModelId || state.localAi.browser.modelId || '',
    localAiBrowserModelName: state.settings.localAiBrowserModelName || state.localAi.browser.modelName || '',
    localAiBrowserModelRepo: state.settings.localAiBrowserModelRepo || state.localAi.browser.modelRepo || '',
    localAiBrowserModelFile: state.settings.localAiBrowserModelFile || state.localAi.browser.modelFile || '',
    localAiBrowserModelQuantization: state.settings.localAiBrowserModelQuantization || state.localAi.browser.modelQuantization || '',
    localAiBrowserModelSizeLabel: state.settings.localAiBrowserModelSizeLabel || state.localAi.browser.modelSizeLabel || '',
    localAiBrowserModelApproxBytes: state.settings.localAiBrowserModelApproxBytes || state.localAi.browser.modelApproxBytes || 0,
    localAiBrowserModelNote: state.settings.localAiBrowserModelNote || state.localAi.browser.modelNote || '',
    localAiSummaryText: state.localAi.summaryText || '',
    localAiSummaryWarning: state.localAi.summaryWarning || '',
    localAiSummarySourceChars: state.localAi.summarySourceChars || 0,
    localAiSummaryDetailLevel: state.localAi.summaryDetailLevel || 'standard',
    localAiSummaryModelName: state.localAi.summaryModelName || '',
    localAiSummaryExpanded: Boolean(state.localAi.summaryExpanded),
    localAiSummaryContextSignature: state.localAi.summaryContextSignature || '',
    localAiChat: {
      contextSignature: state.localAi.chat.contextSignature || '',
      draft: state.localAi.chat.draft || '',
      error: state.localAi.chat.error || '',
      messages: sanitizeLocalAiChatMessages(state.localAi.chat.messages)
    },
    transcriptText: state.transcriptText || ''
  };
}

function buildPersistedFileSnapshot() {
  if (!state.file) {
    return null;
  }

  return {
    file: state.file,
    name: state.file.name,
    type: state.file.type,
    size: state.file.size,
    lastModified: state.file.lastModified,
    kind: state.fileKind,
    source: state.fileSource,
    durationSeconds: state.durationSeconds || 0
  };
}

function buildPersistedSessionSnapshot() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    runtime: {
      loaded: Boolean(state.runtimeReady || state.runtimeLoading || state.whisperClient || state.formatterClient),
      modelKey: state.settings.modelKey,
      device: state.runtimeDevice || ''
    },
    file: buildPersistedFileSnapshot(),
    recording: {
      previewDurationSeconds: state.recording.previewDurationSeconds || 0
    },
    transcript: {
      text: state.transcriptText || '',
      notice: state.transcriptNotice || '',
      segments: state.segments,
      outputs: state.outputs,
      durationSeconds: state.durationSeconds || 0,
      normalizedSampleRate: state.normalizedSampleRate || 16_000,
      fileKind: state.fileKind,
      fileSource: state.fileSource,
      serverBackup: state.serverBackup,
      serverBackupNotice: state.serverBackupNotice || ''
    }
  };
}

function buildSessionFallbackManifest(snapshot = buildPersistedSessionSnapshot()) {
  return {
    version: snapshot.version,
    savedAt: snapshot.savedAt,
    runtime: snapshot.runtime,
    file: snapshot.file
      ? {
          name: snapshot.file.name,
          type: snapshot.file.type,
          size: snapshot.file.size,
          lastModified: snapshot.file.lastModified,
          kind: snapshot.file.kind,
          source: snapshot.file.source,
          durationSeconds: snapshot.file.durationSeconds
        }
      : null,
    recording: snapshot.recording,
    transcript: snapshot.transcript
  };
}

function loadSettings() {
  const injected = globalThis.__TRANSCRIBE_CONFIG__ ?? {};
  const defaults = {
    modelKey: 'tiny-en',
    task: 'transcribe',
    language: 'auto',
    cleanup: true,
    timestamps: true,
    speakerMode: false,
    speakerNames: ['Speaker 1', 'Speaker 2'],
    serverCopy: false,
    summaryDetail: 'standard',
    localAiRuntimeMode: normalizeLocalAiRuntimeMode(injected.localAiRuntimeMode || LOCAL_AI_RUNTIME_MODES.auto),
    localAiModelName: '',
    localAiLastSuccessfulCheckAt: '',
    localAiBrowserModelId: '',
    localAiBrowserModelName: '',
    localAiBrowserModelRepo: '',
    localAiBrowserModelFile: '',
    localAiBrowserModelQuantization: '',
    localAiBrowserModelSizeLabel: '',
    localAiBrowserModelApproxBytes: 0,
    localAiBrowserModelNote: '',
    localAiSummaryText: '',
    localAiSummaryWarning: '',
    localAiSummarySourceChars: 0,
    localAiSummaryDetailLevel: 'standard',
    localAiSummaryModelName: '',
    localAiSummaryExpanded: false,
    localAiSummaryContextSignature: '',
    localAiChat: {
      contextSignature: '',
      draft: '',
      error: '',
      messages: []
    },
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
      summaryDetail: normalizeLocalAiDetailLevel(parsed?.summaryDetail || defaults.summaryDetail),
      localAiRuntimeMode: normalizeLocalAiRuntimeMode(parsed?.localAiRuntimeMode || defaults.localAiRuntimeMode),
      localAiModelName: String(parsed?.localAiModelName || ''),
      localAiLastSuccessfulCheckAt: String(parsed?.localAiLastSuccessfulCheckAt || ''),
      localAiBrowserModelId: String(parsed?.localAiBrowserModelId || ''),
      localAiBrowserModelName: String(parsed?.localAiBrowserModelName || ''),
      localAiBrowserModelRepo: String(parsed?.localAiBrowserModelRepo || ''),
      localAiBrowserModelFile: String(parsed?.localAiBrowserModelFile || ''),
      localAiBrowserModelQuantization: String(parsed?.localAiBrowserModelQuantization || ''),
      localAiBrowserModelSizeLabel: String(parsed?.localAiBrowserModelSizeLabel || ''),
      localAiBrowserModelApproxBytes: Number(parsed?.localAiBrowserModelApproxBytes || 0) || 0,
      localAiBrowserModelNote: String(parsed?.localAiBrowserModelNote || ''),
      localAiSummaryText: String(parsed?.localAiSummaryText || ''),
      localAiSummaryWarning: String(parsed?.localAiSummaryWarning || ''),
      localAiSummarySourceChars: Number(parsed?.localAiSummarySourceChars || 0) || 0,
      localAiSummaryDetailLevel: normalizeLocalAiDetailLevel(parsed?.localAiSummaryDetailLevel || defaults.summaryDetail),
      localAiSummaryModelName: String(parsed?.localAiSummaryModelName || ''),
      localAiSummaryExpanded: Boolean(parsed?.localAiSummaryExpanded),
      localAiSummaryContextSignature: String(parsed?.localAiSummaryContextSignature || ''),
      localAiChat: {
        contextSignature: String(parsed?.localAiChat?.contextSignature || ''),
        draft: String(parsed?.localAiChat?.draft || ''),
        error: String(parsed?.localAiChat?.error || ''),
        messages: sanitizeLocalAiChatMessages(parsed?.localAiChat?.messages)
      },
      speakerNames: Array.isArray(parsed?.speakerNames) && parsed.speakerNames.length >= 2
        ? [String(parsed.speakerNames[0] || 'Speaker 1'), String(parsed.speakerNames[1] || 'Speaker 2')]
        : defaults.speakerNames
    };
  } catch {
    return defaults;
  }
}

function applySettingsSnapshot() {
  state.localAi.runtimeMode = normalizeLocalAiRuntimeMode(state.settings.localAiRuntimeMode || 'auto');
  state.localAi.modelName = state.settings.localAiModelName || '';
  state.localAi.cachedModelName = state.settings.localAiModelName || '';
  state.localAi.lastSuccessfulCheckAt = state.settings.localAiLastSuccessfulCheckAt || '';
  state.localAi.browser.modelId = state.settings.localAiBrowserModelId || '';
  state.localAi.browser.modelName = state.settings.localAiBrowserModelName || '';
  state.localAi.browser.modelRepo = state.settings.localAiBrowserModelRepo || '';
  state.localAi.browser.modelFile = state.settings.localAiBrowserModelFile || '';
  state.localAi.browser.modelQuantization = state.settings.localAiBrowserModelQuantization || '';
  state.localAi.browser.modelSizeLabel = state.settings.localAiBrowserModelSizeLabel || '';
  state.localAi.browser.modelApproxBytes = Number(state.settings.localAiBrowserModelApproxBytes || 0) || 0;
  state.localAi.browser.modelNote = state.settings.localAiBrowserModelNote || '';
  state.localAi.summaryText = state.settings.localAiSummaryText || '';
  state.localAi.summaryWarning = state.settings.localAiSummaryWarning || '';
  state.localAi.summarySourceChars = Number(state.settings.localAiSummarySourceChars || 0) || 0;
  state.localAi.summaryDetailLevel = state.settings.localAiSummaryDetailLevel || 'standard';
  state.localAi.summaryModelName = state.settings.localAiSummaryModelName || '';
  state.localAi.summaryExpanded = Boolean(state.settings.localAiSummaryExpanded);
  state.localAi.summaryContextSignature = state.settings.localAiSummaryContextSignature || '';
  state.localAi.chat.contextSignature = state.settings.localAiChat?.contextSignature || '';
  state.localAi.chat.draft = state.settings.localAiChat?.draft || '';
  state.localAi.chat.error = state.settings.localAiChat?.error || '';
  state.localAi.chat.messages = sanitizeLocalAiChatMessages(state.settings.localAiChat?.messages);
  state.localAi.chat.sending = false;
  state.localAi.chat.status = state.localAi.chat.messages.length ? 'ready' : 'idle';
  state.localAi.chat.message = '';
  state.localAi.chat.detail = '';
  state.localAi.chat.stale = false;

  if (!state.transcriptText && state.settings.transcriptText) {
    state.transcriptText = state.settings.transcriptText;
  }

  if (state.localAi.summaryText && !state.localAi.summaryContextSignature) {
    state.localAi.summaryContextSignature = buildLocalAiTextSignature(state.transcriptText || '');
  }

  if (state.localAi.summaryText && !state.localAi.summaryModelName) {
    state.localAi.summaryModelName = state.localAi.modelName || state.settings.localAiModelName || '';
  }

  if (state.localAi.chat.messages.length && !state.localAi.chat.contextSignature) {
    state.localAi.chat.contextSignature = buildLocalAiContextSignature(state.transcriptText || '', state.localAi.summaryText || '');
  }
}

function persistSettings() {
  const payload = buildSettingsSnapshot();
  const serialized = JSON.stringify(payload);
  if (serialized === lastPersistedSettings) {
    return;
  }

  lastPersistedSettings = serialized;
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Ignore quota and privacy failures on restrictive shared-hosting browsers.
  }
}

function persistSessionDraft({ immediate = false } = {}) {
  sessionPersistPending = true;

  if (sessionPersistTimerId) {
    window.clearTimeout(sessionPersistTimerId);
    sessionPersistTimerId = 0;
  }

  if (immediate) {
    void flushPersistedSession();
    return;
  }

  sessionPersistTimerId = window.setTimeout(() => {
    sessionPersistTimerId = 0;
    void flushPersistedSession();
  }, 250);
}

async function flushPersistedSession() {
  if (!sessionPersistPending) {
    return;
  }

  sessionPersistPending = false;
  const snapshot = buildPersistedSessionSnapshot();
  const fallbackManifest = buildSessionFallbackManifest(snapshot);

  try {
    localStorage.setItem(SESSION_FALLBACK_KEY, JSON.stringify(fallbackManifest));
  } catch {
    // Keep going even if the fallback manifest cannot be stored.
  }

  try {
    await writePersistedSession(snapshot);
  } catch {
    // Keep the localStorage fallback even when IndexedDB is unavailable.
  }
}

function loadSessionFallbackManifest() {
  try {
    const raw = localStorage.getItem(SESSION_FALLBACK_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return normalizePersistedSession(parsed);
  } catch {
    return null;
  }
}

function normalizePersistedSession(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const runtime = snapshot.runtime && typeof snapshot.runtime === 'object'
    ? snapshot.runtime
    : {};
  const file = snapshot.file && typeof snapshot.file === 'object'
    ? snapshot.file
    : null;
  const recording = snapshot.recording && typeof snapshot.recording === 'object'
    ? snapshot.recording
    : {};
  const transcript = snapshot.transcript && typeof snapshot.transcript === 'object'
    ? snapshot.transcript
    : {};

  return {
    version: Number(snapshot.version || 1) || 1,
    savedAt: String(snapshot.savedAt || ''),
    runtime: {
      loaded: Boolean(runtime.loaded),
      modelKey: String(runtime.modelKey || ''),
      device: String(runtime.device || '')
    },
    file: file
      ? {
          ...file,
          file: file.file ?? null
        }
      : null,
    recording: {
      previewDurationSeconds: Number(recording.previewDurationSeconds || 0) || 0
    },
    transcript: {
      text: String(transcript.text || ''),
      notice: String(transcript.notice || ''),
      segments: sanitizePersistedSegments(transcript.segments),
      outputs: {
        txt: String(transcript.outputs?.txt || ''),
        srt: String(transcript.outputs?.srt || ''),
        vtt: String(transcript.outputs?.vtt || ''),
        preview: String(transcript.outputs?.preview || '')
      },
      durationSeconds: Number(transcript.durationSeconds || 0) || 0,
      normalizedSampleRate: Number(transcript.normalizedSampleRate || 16_000) || 16_000,
      fileKind: String(transcript.fileKind || ''),
      fileSource: String(transcript.fileSource || ''),
      serverBackup: transcript.serverBackup && typeof transcript.serverBackup === 'object'
        ? transcript.serverBackup
        : null,
      serverBackupNotice: String(transcript.serverBackupNotice || '')
    }
  };
}

function sanitizePersistedSegments(segments) {
  if (!Array.isArray(segments)) {
    return [];
  }

  return segments
    .filter((segment) => segment && typeof segment === 'object')
    .map((segment) => ({
      ...segment,
      start: Number(segment.start || 0) || 0,
      end: Number(segment.end || 0) || 0,
      text: String(segment.text || '').trim(),
      ...(segment.speakerLabel ? { speakerLabel: String(segment.speakerLabel).trim() } : {})
    }))
    .filter((segment) => segment.text);
}

function rebuildPersistedFile(fileRecord) {
  if (!fileRecord || typeof fileRecord !== 'object') {
    return null;
  }

  const source = fileRecord.file instanceof File || fileRecord.file instanceof Blob
    ? fileRecord.file
    : fileRecord.blob instanceof Blob
      ? fileRecord.blob
      : null;
  if (!source) {
    return null;
  }

  const name = String(fileRecord.name || source.name || 'restored-audio.bin');
  const type = String(fileRecord.type || source.type || 'application/octet-stream');
  const lastModified = Number(fileRecord.lastModified || source.lastModified || Date.now()) || Date.now();

  if (source instanceof File) {
    return source;
  }

  return new File([source], name, {
    type,
    lastModified
  });
}

function applyPersistedSession(snapshot) {
  const normalized = normalizePersistedSession(snapshot);
  if (!normalized) {
    return;
  }

  const runtime = normalized.runtime || {};
  const file = rebuildPersistedFile(normalized.file);
  const transcript = normalized.transcript || {};

  if (runtime.modelKey) {
    state.settings.modelKey = runtime.modelKey;
  }

  state.runtimeDevice = runtime.device || null;
  state.runtimeReady = false;
  state.runtimeLoading = false;
  state.runtimeDirty = false;
  state.whisperClient = null;
  state.formatterClient = null;

  state.file = file;
  if (file) {
    state.fileKind = normalized.file?.kind || classifyMediaFile(file).kind;
    state.fileSource = normalized.file?.source || transcript.fileSource || 'restored session';
    state.durationSeconds = Number(normalized.file?.durationSeconds || transcript.durationSeconds || 0) || 0;
  } else {
    state.fileKind = normalized.file?.kind || transcript.fileKind || 'none';
    state.fileSource = transcript.fileSource || 'restored session';
    state.durationSeconds = Number(transcript.durationSeconds || 0) || 0;
  }

  state.normalizedAudio = null;
  state.normalizedSampleRate = Number(transcript.normalizedSampleRate || 16_000) || 16_000;
  state.segments = sanitizePersistedSegments(transcript.segments);
  state.transcriptText = String(transcript.text || '');
  state.transcriptNotice = String(transcript.notice || '');
  state.outputs = {
    txt: String(transcript.outputs?.txt || state.transcriptText || ''),
    srt: String(transcript.outputs?.srt || ''),
    vtt: String(transcript.outputs?.vtt || ''),
    preview: String(transcript.outputs?.preview || '')
  };
  state.serverBackup = transcript.serverBackup && typeof transcript.serverBackup === 'object'
    ? transcript.serverBackup
    : null;
  state.serverBackupNotice = String(transcript.serverBackupNotice || '');
  state.recording.active = false;
  state.recording.stream = null;
  state.recording.recorder = null;
  state.recording.chunks = [];
  state.recording.timerId = null;
  state.recording.startedAt = 0;
  state.recording.previewDurationSeconds = Number(normalized.recording?.previewDurationSeconds || 0) || 0;
  if (state.recording.previewUrl) {
    URL.revokeObjectURL(state.recording.previewUrl);
  }
  if (file && state.fileSource === 'microphone recording') {
    state.recording.previewUrl = URL.createObjectURL(file);
  } else {
    state.recording.previewUrl = '';
  }

  state.dictation.active = false;
  state.dictation.recognition = null;
  state.dictation.interim = '';

  state.localAi.modelName = state.settings.localAiModelName || state.localAi.cachedModelName || '';
  state.localAi.cachedModelName = state.localAi.modelName;
  state.localAi.lastSuccessfulCheckAt = state.settings.localAiLastSuccessfulCheckAt || '';
  state.localAi.summaryText = state.settings.localAiSummaryText || '';
  state.localAi.summaryWarning = state.settings.localAiSummaryWarning || '';
  state.localAi.summarySourceChars = Number(state.settings.localAiSummarySourceChars || 0) || 0;
  state.localAi.summaryDetailLevel = state.settings.localAiSummaryDetailLevel || 'standard';
  state.localAi.summaryModelName = state.settings.localAiSummaryModelName || '';
  state.localAi.summaryExpanded = Boolean(state.settings.localAiSummaryExpanded);
  state.localAi.summaryContextSignature = state.settings.localAiSummaryContextSignature || '';
  state.localAi.chat.contextSignature = state.settings.localAiChat?.contextSignature || '';
  state.localAi.chat.draft = state.settings.localAiChat?.draft || '';
  state.localAi.chat.error = state.settings.localAiChat?.error || '';
  state.localAi.chat.messages = sanitizeLocalAiChatMessages(state.settings.localAiChat?.messages);
  state.localAi.chat.sending = false;
  state.localAi.chat.status = state.localAi.chat.messages.length ? 'ready' : 'idle';
  state.localAi.chat.message = '';
  state.localAi.chat.detail = '';
  state.localAi.chat.stale = false;

  if (!state.transcriptText && state.settings.transcriptText) {
    state.transcriptText = state.settings.transcriptText;
  }

  if (state.localAi.summaryText && !state.localAi.summaryContextSignature) {
    state.localAi.summaryContextSignature = buildLocalAiTextSignature(state.transcriptText || '');
  }

  if (state.localAi.summaryText && !state.localAi.summaryModelName) {
    state.localAi.summaryModelName = state.localAi.modelName || state.settings.localAiModelName || '';
  }

  if (state.localAi.chat.messages.length && !state.localAi.chat.contextSignature) {
    state.localAi.chat.contextSignature = buildLocalAiContextSignature(state.transcriptText || '', state.localAi.summaryText || '');
  }

  restoreRuntimeAfterHydration = Boolean(runtime.loaded);
}

async function hydrateFromStorage() {
  state.settings = loadSettings();
  applySettingsSnapshot();
  let persistedSession = null;
  try {
    lastPersistedSettings = JSON.stringify(buildSettingsSnapshot());
  } catch {
    lastPersistedSettings = '';
  }

  try {
    persistedSession = await readPersistedSession();
  } catch {
    persistedSession = null;
  }

  if (!persistedSession) {
    persistedSession = loadSessionFallbackManifest();
  }

  if (persistedSession) {
    applyPersistedSession(persistedSession);
  } else if (state.settings.transcriptText) {
    state.transcriptText = state.settings.transcriptText;
    state.transcriptNotice = '';
    state.segments = [];
    state.outputs = {
      txt: state.transcriptText,
      srt: '',
      vtt: '',
      preview: state.transcriptText
    };
    state.file = null;
    state.fileKind = 'none';
    state.fileSource = 'restored transcript';
    state.durationSeconds = 0;
    state.serverBackup = null;
    state.serverBackupNotice = '';
  }

  populateSelectors();
  updateTranscriptPreview();
  refs.timedPreview.textContent = state.outputs.preview || transcriptPreviewText();
  updateRuntimeButtonLabel();

  if (!persistedSession && state.settings.transcriptText) {
    persistSessionDraft({ immediate: true });
  }
}

function readConfig() {
  const injected = globalThis.__TRANSCRIBE_CONFIG__ ?? {};
  const uploadLimitBytes = parseInteger(injected.uploadLimitBytes, DEFAULT_SERVER_LIMIT);
  const clientLimitBytes = parseInteger(injected.clientLimitBytes, DEFAULT_CLIENT_LIMIT);

  return {
    appName: String(injected.appName || 'Py Transcribe Studio'),
    uploadEndpoint: String(injected.uploadEndpoint || 'api/upload.php'),
    downloadEndpoint: String(injected.downloadEndpoint || 'api/download.php'),
    promoUrl: String(injected.promoUrl || 'https://mytech.today'),
    readmeApiUrl: String(injected.readmeApiUrl || 'https://api.github.com/repos/mytech-today-now/py-transcribe/readme?ref=main'),
    readmeSourceUrl: String(injected.readmeSourceUrl || 'https://github.com/mytech-today-now/py-transcribe/blob/main/readme.md'),
    csrfToken: String(injected.csrfToken || ''),
    authRequired: Boolean(injected.authRequired),
    uploadLimitBytes,
    clientLimitBytes,
    storageEnabled: Boolean(injected.storageEnabled ?? true),
    localAiAutoDownload: Boolean(injected.localAiAutoDownload ?? true),
    localAiRuntimeMode: normalizeLocalAiRuntimeMode(injected.localAiRuntimeMode || LOCAL_AI_RUNTIME_MODES.auto),
    localAiBaseUrl: String(injected.localAiBaseUrl || LOCAL_AI_PROXY_BASE_URL)
  };
}

function resolveLocalAiBaseUrl() {
  const selected = String(state.localAi.baseUrl || '').trim().replace(/\/+$/, '');
  if (selected) {
    return selected;
  }

  const configured = String(state.config.localAiBaseUrl || '').trim().replace(/\/+$/, '');
  return configured || LOCAL_AI_PROXY_BASE_URL;
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function setStatus(message) {
  refs.status.textContent = message;
}

function toggleDialog(dialog) {
  if (!dialog) {
    return false;
  }

  if (dialog.open) {
    dialog.close();
    syncModalScrollLock();
    return false;
  }

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }

  syncModalScrollLock();
  return true;
}

function syncModalScrollLock() {
  if (typeof document === 'undefined') {
    return;
  }

  const locked = Boolean(document.querySelector('dialog[open]'));
  document.documentElement.classList.toggle('modal-open', locked);
  if (document.body) {
    document.body.classList.toggle('modal-open', locked);
    if (locked && !modalScrollLockActive) {
      modalScrollLockY = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${modalScrollLockY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      modalScrollLockActive = true;
    } else if (!locked && modalScrollLockActive) {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      modalScrollLockActive = false;
      window.scrollTo(0, modalScrollLockY);
    }
  }
}

function openPromoDialog() {
  toggleDialog(refs.promoDialog);
}

async function openReadmeDialog() {
  if (!toggleDialog(refs.readmeDialog)) {
    return;
  }

  await loadReadme();
}

async function loadReadme() {
  if (state.readme.status === 'loading') {
    return;
  }

  const requestId = state.readme.requestId + 1;
  state.readme.requestId = requestId;
  state.readme.status = 'loading';
  state.readme.error = '';
  renderReadmeState();

  try {
    const response = await fetch(state.config.readmeApiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github.html+json'
      },
      cache: 'no-store',
      credentials: 'omit'
    });

    const html = await response.text();
    if (requestId !== state.readme.requestId) {
      return;
    }

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status} while loading the README.`);
    }

    state.readme.status = 'loaded';
    state.readme.html = html;
    state.readme.error = '';
    renderReadmeState();
  } catch (error) {
    if (requestId !== state.readme.requestId) {
      return;
    }

    state.readme.status = 'error';
    state.readme.html = '';
    state.readme.error = error instanceof Error
      ? error.message
      : 'Could not load the live README.';
    renderReadmeState();
  }
}

function renderReadmeState() {
  if (!refs.readmeDialog || !refs.readmeStatus || !refs.readmeContent) {
    return;
  }

  const loaded = state.readme.status === 'loaded' && Boolean(state.readme.html);
  if (state.readme.status === 'loading') {
    refs.readmeStatus.textContent = 'Loading the rendered README from GitHub...';
  } else if (state.readme.status === 'loaded') {
    refs.readmeStatus.textContent = 'Rendered from GitHub as HTML so the Markdown and embedded HTML stay styled.';
  } else if (state.readme.status === 'error') {
    refs.readmeStatus.textContent = state.readme.error || 'Could not load the live README.';
  } else {
    refs.readmeStatus.textContent = 'Open the README icon to load the rendered version from GitHub.';
  }

  refs.readmeContent.hidden = !loaded;
  if (!loaded) {
    refs.readmeContent.replaceChildren();
    return;
  }

  refs.readmeContent.innerHTML = state.readme.html;
  decorateReadmeContent();
}

function decorateReadmeContent() {
  if (!refs.readmeContent) {
    return;
  }

  refs.readmeContent.querySelectorAll('a').forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
  });

  refs.readmeContent.querySelectorAll('img').forEach((image) => {
    image.loading = 'lazy';
    image.decoding = 'async';
  });
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
  const normalizedAudio = await ensureNormalizedAudio();
  const names = buildExportNames(state.file.name, state.settings.task);
  const zip = new JSZip();
  zip.file(names.txt, refs.transcriptEditor.value || available.txt || state.transcriptText);
  zip.file(names.srt, available.srt || buildSrt(state.segments, formatterOptions()));
  zip.file(names.vtt, available.vtt || buildVtt(state.segments, formatterOptions()));

  if (normalizedAudio?.length) {
    zip.file(names.wav, encodeWavBytes(normalizedAudio, state.normalizedSampleRate));
  }

  zip.file(state.file.name, await state.file.arrayBuffer());
  if (state.serverBackup?.downloadUrl) {
    zip.file('server-backup.json', JSON.stringify(state.serverBackup, null, 2));
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, names.zip);
  setStatus(`Downloaded ${names.zip}.`);
}

async function ensureNormalizedAudio() {
  if (state.normalizedAudio?.length) {
    return state.normalizedAudio;
  }

  if (!state.file) {
    return null;
  }

  const audio = await extractNormalizedAudio(state.file, {
    targetSampleRate: state.normalizedSampleRate,
    preferFfmpeg: state.fileKind === 'video'
  });
  state.normalizedAudio = audio.samples;
  state.normalizedSampleRate = audio.sampleRate;
  state.durationSeconds = audio.durationSeconds;
  state.fileSource = audio.source;
  persistSessionDraft({ immediate: true });
  return state.normalizedAudio;
}

async function ensureRenderedOutputs() {
  if (state.outputs.srt && state.outputs.vtt && state.outputs.preview) {
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
    state.serverBackupNotice = '';
    return state.serverBackup;
  }

  const uploadLimitBytes = Number(state.config.uploadLimitBytes);
  if (Number.isFinite(uploadLimitBytes) && uploadLimitBytes > 0 && file.size > uploadLimitBytes) {
    state.serverBackup = null;
    state.serverBackupNotice = `Host backup skipped: ${file.name} is larger than ${formatBytes(uploadLimitBytes)}.`;
    renderAll();
    return null;
  }

  const form = new FormData();
  form.append('audio', file, file.name);

  try {
    const response = await fetch(state.config.uploadEndpoint, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': state.config.csrfToken
      },
      body: form,
      credentials: 'same-origin'
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      state.serverBackup = null;
      state.serverBackupNotice = payload?.error || `Host backup failed (${response.status}).`;
      renderAll();
      return null;
    }

    state.serverBackup = payload.file;
    state.serverBackupNotice = '';
    renderAll();
    setStatus(`Saved ${file.name} to host storage.`);
    return payload.file;
  } catch {
    state.serverBackup = null;
    state.serverBackupNotice = 'Host backup unavailable.';
    renderAll();
    return null;
  }
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
