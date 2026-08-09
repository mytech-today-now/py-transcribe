export function isEnglishOnlyWhisperModel(modelId) {
  return String(modelId || '').toLowerCase().endsWith('.en');
}

export function buildWhisperTranscriptionRequest({
  modelId,
  task = 'transcribe',
  language = 'auto'
} = {}) {
  const englishOnly = isEnglishOnlyWhisperModel(modelId);
  const normalizedTask = englishOnly
    ? 'transcribe'
    : String(task || 'transcribe') === 'translate'
      ? 'translate'
      : 'transcribe';
  const normalizedLanguage = englishOnly
    ? 'auto'
    : String(language || 'auto').toLowerCase();

  const options = {
    return_timestamps: true
  };

  if (normalizedTask === 'translate') {
    options.task = 'translate';
  }

  if (!englishOnly && normalizedLanguage !== 'auto') {
    options.language = normalizedLanguage;
  }

  return {
    englishOnly,
    task: normalizedTask,
    language: normalizedLanguage,
    options
  };
}
