(function () {
  const DEFAULT_STATUS = 'Ready. Choose a file or drag one into the zone.';
  const PROCESSING_STATUS = 'Processing...';
  const DOWNLOAD_RESET_DELAY_MS = 1400;
  const OBJECT_URL_REVOKE_DELAY_MS = 4000;
  const PREVIEW_BYTE_LIMIT = 128;

  const TEXT_EXTENSIONS = new Set([
    'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'log', 'xml', 'html', 'htm',
    'css', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'yml', 'yaml', 'ini', 'cfg', 'conf',
    'env', 'sql', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'sh', 'bat',
    'cmd', 'ps1', 'toml', 'properties', 'diff', 'patch', 'srt', 'vtt', 'svg'
  ]);

  const IMAGE_EXTENSIONS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'ico', 'tif', 'tiff', 'heic', 'heif'
  ]);

  const TEXT_MIME_TYPES = new Set([
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/tab-separated-values',
    'text/html',
    'text/css',
    'text/javascript',
    'text/xml',
    'application/json',
    'application/ld+json',
    'application/xml',
    'application/xhtml+xml',
    'application/javascript',
    'application/ecmascript',
    'application/x-javascript',
    'application/yaml',
    'application/x-yaml',
    'application/sql',
    'image/svg+xml'
  ]);

  const state = {
    file: null,
    profile: null,
    busy: false,
    dragDepth: 0,
    resetTimer: null
  };

  const refs = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    refs.main = document.querySelector('main');
    refs.dropZone = document.getElementById('dropZone');
    refs.browseButton = document.getElementById('browseButton');
    refs.fileInput = document.getElementById('fileInput');
    refs.generateButton = document.getElementById('generateButton');
    refs.status = document.getElementById('status');
    refs.fileSummary = document.getElementById('fileSummary');
    refs.fileKindBadge = document.getElementById('fileKindBadge');
    refs.outputHint = document.getElementById('outputHint');

    if (
      !refs.main ||
      !refs.dropZone ||
      !refs.browseButton ||
      !refs.fileInput ||
      !refs.generateButton ||
      !refs.status ||
      !refs.fileSummary ||
      !refs.fileKindBadge ||
      !refs.outputHint
    ) {
      return;
    }

    bindEvents();
    renderIdleState();
  }

  function bindEvents() {
    refs.browseButton.addEventListener('click', (event) => {
      event.stopPropagation();
      openFilePicker();
    });

    refs.dropZone.addEventListener('click', () => {
      openFilePicker();
    });

    refs.dropZone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openFilePicker();
      }
    });

    refs.fileInput.addEventListener('change', () => {
      handleSelectedFiles(refs.fileInput.files);
    });

    refs.generateButton.addEventListener('click', () => {
      processCurrentFile();
    });

    refs.dropZone.addEventListener('dragenter', handleDragEnter);
    refs.dropZone.addEventListener('dragover', handleDragOver);
    refs.dropZone.addEventListener('dragleave', handleDragLeave);
    refs.dropZone.addEventListener('drop', handleDrop);

    document.addEventListener('dragover', (event) => {
      event.preventDefault();
    });

    document.addEventListener('drop', (event) => {
      event.preventDefault();
    });

    window.addEventListener('dragend', resetDragState);
  }

  function openFilePicker() {
    if (state.busy) {
      return;
    }

    refs.fileInput.value = '';
    refs.fileInput.click();
  }

  function handleDragEnter(event) {
    if (state.busy) {
      return;
    }

    event.preventDefault();
    state.dragDepth += 1;
    refs.dropZone.classList.add('is-dragover');
  }

  function handleDragOver(event) {
    if (state.busy) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    refs.dropZone.classList.add('is-dragover');
  }

  function handleDragLeave(event) {
    if (state.busy) {
      return;
    }

    event.preventDefault();
    state.dragDepth = Math.max(0, state.dragDepth - 1);
    if (state.dragDepth === 0) {
      refs.dropZone.classList.remove('is-dragover');
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    resetDragState();

    if (state.busy) {
      return;
    }

    handleSelectedFiles(event.dataTransfer ? event.dataTransfer.files : null);
  }

  function resetDragState() {
    state.dragDepth = 0;
    refs.dropZone.classList.remove('is-dragover');
  }

  function handleSelectedFiles(fileList) {
    if (state.busy) {
      return;
    }

    const files = Array.from(fileList || []);
    if (!files.length) {
      return;
    }

    if (state.resetTimer) {
      window.clearTimeout(state.resetTimer);
      state.resetTimer = null;
    }

    const file = files[0];
    state.file = file;
    state.profile = classifyFile(file);

    refs.dropZone.classList.add('has-file');
    refs.dropZone.classList.remove('is-dragover');
    setKindBadge(state.profile.badgeTone, state.profile.kindLabel);
    updateOutputHint(buildOutputName(file.name));
    renderSummary(file, state.profile);
    setButtonEnabled(true);
    setStatus(
      files.length > 1
        ? 'Multiple files were dropped. Using the first one.'
        : `File selected. Ready to create ${buildOutputName(file.name)}.`,
      'success'
    );
    refs.generateButton.focus({ preventScroll: true });
  }

  function processCurrentFile() {
    if (state.busy || !state.file || !state.profile) {
      return;
    }

    if (state.resetTimer) {
      window.clearTimeout(state.resetTimer);
      state.resetTimer = null;
    }

    const file = state.file;
    const profile = state.profile;
    const outputName = buildOutputName(file.name);

    setBusy(true);
    setStatus(`Processing ${cleanDisplayName(file.name)}...`, 'processing');
    setButtonLabel('Creating...');

    window.requestAnimationFrame(() => {
      buildReport(file, profile, outputName)
        .then((report) => {
          downloadTextFile(report, outputName);
          setStatus(`File ready. Download started: ${outputName}.`, 'success');
          state.resetTimer = window.setTimeout(resetAfterSuccess, DOWNLOAD_RESET_DELAY_MS);
        })
        .catch(() => {
          setButtonLabel('Create and download .txt');
          setStatus('Unsupported file or unable to read this file. Please choose another one.', 'error');
          setBusy(false);
          refs.generateButton.focus({ preventScroll: true });
        });
    });
  }

  function resetAfterSuccess() {
    if (state.resetTimer) {
      window.clearTimeout(state.resetTimer);
      state.resetTimer = null;
    }

    state.file = null;
    state.profile = null;
    state.dragDepth = 0;
    refs.fileInput.value = '';
    refs.dropZone.classList.remove('has-file');
    refs.dropZone.classList.remove('is-dragover');
    setKindBadge('idle', 'Waiting');
    renderIdleState();
    updateOutputHint('filename-processed.txt');
    setButtonLabel('Create and download .txt');
    setBusy(false);
    setStatus(DEFAULT_STATUS, 'idle');
    refs.dropZone.focus({ preventScroll: true });
  }

  function renderIdleState() {
    clearElement(refs.fileSummary);
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No file selected yet.';
    refs.fileSummary.appendChild(empty);
    updateOutputHint('filename-processed.txt');
    setKindBadge('idle', 'Waiting');
    setButtonLabel('Create and download .txt');
    setButtonEnabled(false);
    setBusy(false);
    setStatus(DEFAULT_STATUS, 'idle');
  }

  function renderSummary(file, profile) {
    clearElement(refs.fileSummary);

    const details = document.createElement('dl');
    details.className = 'summary__list';

    details.append(
      createDetailRow('Name', cleanDisplayName(file.name)),
      createDetailRow('Size', `${formatBytes(file.size)} (${formatNumber(file.size)} bytes)`),
      createDetailRow('Type', file.type || 'Unknown'),
      createDetailRow('Last modified', formatLastModified(file.lastModified)),
      createDetailRow('Output name', buildOutputName(file.name)),
      createDetailRow('Processing mode', profile.modeLabel)
    );

    const note = document.createElement('p');
    note.className = 'summary__note';
    note.textContent = `${profile.summaryNote} This selection stays on your device.`;

    refs.fileSummary.append(details, note);
  }

  function createDetailRow(label, value) {
    const row = document.createElement('div');
    row.className = 'summary__row';

    const term = document.createElement('dt');
    term.className = 'summary__label';
    term.textContent = label;

    const definition = document.createElement('dd');
    definition.className = 'summary__value';
    definition.textContent = value;

    row.append(term, definition);
    return row;
  }

  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function setBusy(isBusy) {
    state.busy = isBusy;
    refs.main.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    refs.dropZone.classList.toggle('is-busy', isBusy);
    refs.dropZone.setAttribute('aria-disabled', isBusy ? 'true' : 'false');
    refs.browseButton.disabled = isBusy;
    refs.fileInput.disabled = isBusy;
    refs.generateButton.disabled = isBusy || !state.file;
  }

  function setButtonEnabled(isEnabled) {
    refs.generateButton.disabled = !isEnabled || state.busy;
  }

  function setButtonLabel(label) {
    refs.generateButton.textContent = label;
  }

  function setStatus(message, tone) {
    refs.status.textContent = message;
    refs.status.className = `status status--${tone}`;
    refs.status.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
    refs.status.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  }

  function setKindBadge(tone, label) {
    refs.fileKindBadge.className = `panel__badge panel__badge--${tone}`;
    refs.fileKindBadge.textContent = label;
  }

  function updateOutputHint(name) {
    refs.outputHint.textContent = name;
  }

  function cleanDisplayName(name) {
    const cleaned = String(name || 'untitled')
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || 'untitled';
  }

  function getExtension(name) {
    const value = cleanDisplayName(name).toLowerCase();
    const lastDot = value.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === value.length - 1) {
      return '';
    }
    return value.slice(lastDot + 1);
  }

  function buildOutputName(name) {
    let base = cleanDisplayName(name)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    const lastDot = base.lastIndexOf('.');
    if (lastDot > 0) {
      base = base.slice(0, lastDot);
    }

    base = base.replace(/^\.+/, '').replace(/[. ]+$/g, '').trim();
    return `${base || 'untitled'}-processed.txt`;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat().format(value);
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return 'Unknown size';
    }

    if (bytes === 0) {
      return '0 bytes';
    }

    const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    if (index === 0) {
      return `${bytes} bytes`;
    }

    const value = bytes / Math.pow(1024, index);
    const decimals = value >= 10 ? 1 : 2;
    return `${value.toFixed(decimals)} ${units[index]}`;
  }

  function formatLastModified(value) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return 'Unavailable';
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  }

  function normalizeText(text) {
    return String(text || '').replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  }

  function countLines(text) {
    if (!text) {
      return 0;
    }
    return text.split('\n').length;
  }

  function countWords(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      return 0;
    }

    const matches = trimmed.match(/\S+/g);
    return matches ? matches.length : 0;
  }

  function isLikelyTextFile(file) {
    const name = cleanDisplayName(file.name).toLowerCase();
    const extension = getExtension(name);
    const mime = (file.type || '').toLowerCase();

    if (TEXT_MIME_TYPES.has(mime) || mime.startsWith('text/')) {
      return true;
    }

    if (TEXT_EXTENSIONS.has(extension)) {
      return true;
    }

    if (
      name === 'makefile' ||
      name === 'dockerfile' ||
      name === 'readme' ||
      name === 'license' ||
      name === 'changelog' ||
      name === 'procfile' ||
      name === 'gemfile' ||
      name === 'rakefile' ||
      name === 'vagrantfile'
    ) {
      return true;
    }

    if (name.startsWith('.') && name.indexOf('.', 1) === -1 && !mime) {
      return true;
    }

    return false;
  }

  function isLikelyImageFile(file) {
    const name = cleanDisplayName(file.name).toLowerCase();
    const extension = getExtension(name);
    const mime = (file.type || '').toLowerCase();

    return (mime.startsWith('image/') && mime !== 'image/svg+xml') || IMAGE_EXTENSIONS.has(extension);
  }

  function classifyFile(file) {
    const mime = (file.type || '').toLowerCase();
    const extension = getExtension(file.name);
    const jsonLike = mime === 'application/json' || mime === 'application/ld+json' || extension === 'json' || extension === 'jsonl';

    if (isLikelyTextFile(file)) {
      return {
        kind: 'text',
        badgeTone: 'text',
        kindLabel: 'Text file',
        modeLabel: jsonLike ? 'Formatted JSON text' : 'Full text extraction',
        summaryNote: jsonLike
          ? 'JSON is pretty-printed when possible.'
          : 'The file will be decoded as text and included in full.',
        reportIntro: jsonLike
          ? 'The JSON content was pretty-printed for readability.'
          : 'The file was decoded as text and included in full.',
        isJson: jsonLike
      };
    }

    if (isLikelyImageFile(file)) {
      return {
        kind: 'image',
        badgeTone: 'image',
        kindLabel: 'Image file',
        modeLabel: 'Dimensions + byte preview',
        summaryNote: 'The browser can read image dimensions without uploading the file.',
        reportIntro: 'The report includes image dimensions, a byte preview, and basic metadata. OCR is not used in this browser-only version.'
      };
    }

    if (mime === 'application/pdf' || extension === 'pdf') {
      return {
        kind: 'pdf',
        badgeTone: 'pdf',
        kindLabel: 'PDF document',
        modeLabel: 'Metadata + byte preview',
        summaryNote: 'PDF text extraction is not built into this browser-only version.',
        reportIntro: 'The report uses metadata and a byte preview because browser-only PDF text extraction is not available.'
      };
    }

    return {
      kind: 'binary',
      badgeTone: 'binary',
      kindLabel: 'Binary file',
      modeLabel: 'Metadata + byte preview',
      summaryNote: 'The report includes metadata and a short byte preview.',
      reportIntro: 'This file is treated as binary content, so the report includes metadata and a byte preview.'
    };
  }

  async function buildReport(file, profile, outputName) {
    const generatedAt = formatDateTime(new Date());
    const lines = [];

    lines.push('FILE REPORT');
    lines.push(`Generated: ${generatedAt}`);
    lines.push('');
    lines.push('SOURCE FILE');
    lines.push(`Name: ${cleanDisplayName(file.name)}`);
    lines.push(`Output name: ${outputName}`);
    lines.push(`MIME type: ${file.type || 'Unknown'}`);
    lines.push(`Size: ${formatBytes(file.size)} (${formatNumber(file.size)} bytes)`);
    lines.push(`Last modified: ${formatLastModified(file.lastModified)}`);
    lines.push(`Detected kind: ${profile.kindLabel}`);
    lines.push(`Processing mode: ${profile.modeLabel}`);
    lines.push('');
    lines.push('SUMMARY');
    lines.push(profile.reportIntro);
    lines.push('');

    if (profile.kind === 'text') {
      const text = normalizeText(await readTextFile(file));
      let bodyText = text;
      let jsonFormatted = false;

      if (profile.isJson) {
        try {
          bodyText = JSON.stringify(JSON.parse(text), null, 2);
          jsonFormatted = true;
        } catch (error) {
          jsonFormatted = false;
        }
      }

      lines.push('TEXT DETAILS');
      lines.push(`Character count: ${bodyText.length}`);
      lines.push(`Line count: ${countLines(bodyText)}`);
      lines.push(`Word count: ${countWords(bodyText)}`);
      if (profile.isJson) {
        lines.push(jsonFormatted
          ? 'Note: JSON was pretty-printed for readability.'
          : 'Note: The file did not parse cleanly as JSON, so the original text is preserved.');
      }
      lines.push('');
      lines.push('EXTRACTED TEXT');
      lines.push(bodyText || '[The file is empty.]');
      lines.push('');
    } else if (profile.kind === 'image') {
      try {
        const dimensions = await readImageDimensions(file);
        lines.push('IMAGE DETAILS');
        lines.push(`Dimensions: ${dimensions.width} x ${dimensions.height}`);
        lines.push(`Orientation: ${getOrientation(dimensions.width, dimensions.height)}`);
        lines.push(`Aspect ratio: ${formatAspectRatio(dimensions.width, dimensions.height)}`);
        lines.push(`Pixel count: ${formatNumber(dimensions.width * dimensions.height)}`);
      } catch (error) {
        lines.push('IMAGE DETAILS');
        lines.push('The browser could not read the image dimensions, so a byte preview is included instead.');
      }

      lines.push('');
      lines.push('BYTE PREVIEW');
      appendBytePreview(lines, await buildBytePreview(file, PREVIEW_BYTE_LIMIT));
      lines.push('');
    } else {
      lines.push('BYTE PREVIEW');
      appendBytePreview(lines, await buildBytePreview(file, PREVIEW_BYTE_LIMIT));
      lines.push('');
    }

    lines.push('SOURCE NOTE');
    lines.push('Created entirely in the browser. No file was uploaded to a server.');

    return lines.join('\n');
  }

  function appendBytePreview(lines, preview) {
    lines.push(`Preview size: first ${preview.previewLength} bytes`);
    lines.push('Hex preview:');
    lines.push(preview.hex || '[No bytes available.]');
    lines.push('');
    lines.push('ASCII preview:');
    lines.push(preview.ascii || '[No bytes available.]');
  }

  async function readTextFile(file) {
    if (typeof file.text === 'function') {
      return file.text();
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Unable to read file as text.'));
      reader.readAsText(file);
    });
  }

  async function readArrayBuffer(file) {
    if (typeof file.arrayBuffer === 'function') {
      return file.arrayBuffer();
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Unable to read file data.'));
      reader.readAsArrayBuffer(file);
    });
  }

  async function buildBytePreview(file, byteLimit) {
    const buffer = await readArrayBuffer(file.slice(0, byteLimit));
    const bytes = new Uint8Array(buffer || new ArrayBuffer(0));

    return {
      previewLength: bytes.length,
      hex: bytesToHexLines(bytes),
      ascii: bytesToAscii(bytes)
    };
  }

  function bytesToHexLines(bytes) {
    if (!bytes.length) {
      return '';
    }

    const lines = [];
    for (let offset = 0; offset < bytes.length; offset += 16) {
      const slice = bytes.slice(offset, offset + 16);
      lines.push(
        Array.from(slice, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')
      );
    }
    return lines.join('\n');
  }

  function bytesToAscii(bytes) {
    if (!bytes.length) {
      return '';
    }

    return Array.from(bytes, (byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')).join('');
  }

  async function readImageDimensions(file) {
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file);
        const dimensions = {
          width: bitmap.width,
          height: bitmap.height
        };

        if (typeof bitmap.close === 'function') {
          bitmap.close();
        }

        return dimensions;
      } catch (error) {
        // Fall through to the Image element approach.
      }
    }

    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight
        });
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to read image dimensions.'));
      };

      image.src = objectUrl;
    });
  }

  function getOrientation(width, height) {
    if (width === height) {
      return 'Square';
    }
    return width > height ? 'Landscape' : 'Portrait';
  }

  function formatAspectRatio(width, height) {
    const divisor = greatestCommonDivisor(width, height) || 1;
    return `${width / divisor}:${height / divisor}`;
  }

  function greatestCommonDivisor(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);

    while (y) {
      const temp = y;
      y = x % y;
      x = temp;
    }

    return x || 1;
  }

  function formatDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unavailable';
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  function downloadTextFile(text, fileName) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, OBJECT_URL_REVOKE_DELAY_MS);
  }

  function renderIdleState() {
    clearElement(refs.fileSummary);

    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No file selected yet.';
    refs.fileSummary.appendChild(empty);

    updateOutputHint('filename-processed.txt');
    setKindBadge('idle', 'Waiting');
    setButtonLabel('Create and download .txt');
    setButtonEnabled(false);
    setBusy(false);
    setStatus(DEFAULT_STATUS, 'idle');
  }
})();
