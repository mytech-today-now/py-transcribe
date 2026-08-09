let bridgePromise = null;

function toFloat32Array(value) {
  if (value instanceof Float32Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Float32Array(value.slice(0));
  }

  if (ArrayBuffer.isView(value)) {
    return new Float32Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }

  return new Float32Array();
}

async function loadBridge() {
  const hooks = globalThis.__PY_TRANSCRIBE_TEST_HOOKS__;

  if (hooks?.createFFmpeg) {
    const ffmpeg = hooks.createFFmpeg();
    if (typeof ffmpeg.load === 'function') {
      await ffmpeg.load();
    }

    return {
      ffmpeg,
      fetchFile: hooks.fetchFile ?? (async (file) => new Uint8Array(await file.arrayBuffer()))
    };
  }

  const [{ FFmpeg }, util] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util')
  ]);
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();

  return {
    ffmpeg,
    fetchFile: util.fetchFile
  };
}

async function getBridge() {
  if (!bridgePromise) {
    bridgePromise = loadBridge().catch((error) => {
      bridgePromise = null;
      throw error;
    });
  }

  return bridgePromise;
}

export async function extractAudioWithFfmpeg(file) {
  const { ffmpeg, fetchFile } = await getBridge();
  const extension = guessExtension(file);
  const inputName = `input.${extension}`;
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.exec([
    '-i', inputName,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-f', 'f32le',
    'audio.f32'
  ]);

  const output = await ffmpeg.readFile('audio.f32');
  return toFloat32Array(output);
}

function guessExtension(file) {
  const name = String(file?.name ?? 'audio').toLowerCase();
  const match = name.match(/\.([a-z0-9]+)$/);
  if (match?.[1]) {
    return match[1];
  }

  const mime = String(file?.type ?? '').toLowerCase();
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('quicktime')) return 'mov';
  return 'bin';
}
