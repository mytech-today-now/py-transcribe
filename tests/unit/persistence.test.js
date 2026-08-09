import { afterEach, describe, expect, it, vi } from 'vitest';

function createFakeIndexedDB() {
  const databases = new Map();

  const createRequest = () => ({
    result: null,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    onblocked: null
  });

  const cloneValue = (value) => {
    if (value == null || typeof value !== 'object') {
      return value;
    }

    return JSON.parse(JSON.stringify(value));
  };

  const createStoreApi = (record, storeName) => {
    if (!record.stores.has(storeName)) {
      record.stores.set(storeName, new Map());
    }

    const store = record.stores.get(storeName);

    return {
      get(key) {
        const request = createRequest();
        queueMicrotask(() => {
          request.result = store.has(key) ? cloneValue(store.get(key)) : undefined;
          request.onsuccess?.({ target: request });
        });
        return request;
      },
      put(value, key) {
        const request = createRequest();
        queueMicrotask(() => {
          store.set(key, cloneValue(value));
          request.result = key;
          request.onsuccess?.({ target: request });
        });
        return request;
      },
      delete(key) {
        const request = createRequest();
        queueMicrotask(() => {
          store.delete(key);
          request.result = undefined;
          request.onsuccess?.({ target: request });
        });
        return request;
      }
    };
  };

  const createDatabase = (record) => ({
    version: record.version,
    objectStoreNames: {
      contains(storeName) {
        return record.stores.has(storeName);
      }
    },
    createObjectStore(storeName) {
      if (!record.stores.has(storeName)) {
        record.stores.set(storeName, new Map());
      }

      return createStoreApi(record, storeName);
    },
    transaction(storeName) {
      return {
        error: null,
        onabort: null,
        onerror: null,
        objectStore() {
          return createStoreApi(record, storeName);
        }
      };
    },
    close() {},
    onversionchange: null
  });

  return {
    open(name, version) {
      const request = createRequest();
      queueMicrotask(() => {
        let record = databases.get(name);
        const isUpgrade = !record || Number(version || 1) > record.version;

        if (!record) {
          record = {
            version: Number(version || 1) || 1,
            stores: new Map()
          };
          databases.set(name, record);
        } else if (Number(version || record.version) > record.version) {
          record.version = Number(version || record.version) || record.version;
        }

        const database = createDatabase(record);
        request.result = database;
        if (isUpgrade) {
          request.onupgradeneeded?.({ target: request });
        }
        request.onsuccess?.({ target: request });
      });
      return request;
    }
  };
}

async function loadPersistenceModule() {
  vi.resetModules();
  return await import('../../web/lib/persistence.js');
}

describe('persistence helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('requests persistent storage when the browser exposes it', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', {
      storage: {
        persist
      }
    });

    const { requestPersistentStorage } = await loadPersistenceModule();

    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('writes, reads, and clears persisted sessions through IndexedDB', async () => {
    vi.stubGlobal('indexedDB', createFakeIndexedDB());
    const { writePersistedSession, readPersistedSession, clearPersistedSession } = await loadPersistenceModule();

    const snapshot = {
      version: 1,
      savedAt: '2026-08-09T12:00:00.000Z',
      runtime: {
        loaded: true,
        modelKey: 'tiny-en',
        device: 'wasm'
      },
      file: null,
      recording: {
        previewDurationSeconds: 0
      },
      transcript: {
        text: 'Hello world',
        notice: '',
        segments: [],
        outputs: {
          txt: 'Hello world',
          srt: '',
          vtt: '',
          preview: ''
        },
        durationSeconds: 12,
        normalizedSampleRate: 16_000,
        fileKind: 'audio',
        fileSource: 'upload',
        serverBackup: null,
        serverBackupNotice: ''
      }
    };

    await expect(writePersistedSession(snapshot)).resolves.toBe(true);
    await expect(readPersistedSession()).resolves.toEqual(snapshot);
    await expect(clearPersistedSession()).resolves.toBe(true);
    await expect(readPersistedSession()).resolves.toBeNull();
  });

  it('falls back cleanly when browser persistence APIs are unavailable', async () => {
    const { requestPersistentStorage, readPersistedSession } = await loadPersistenceModule();

    await expect(requestPersistentStorage()).resolves.toBe(false);
    await expect(readPersistedSession()).resolves.toBeNull();
  });
});
