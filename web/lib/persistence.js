const DATABASE_NAME = 'py-transcribe-session';
const DATABASE_VERSION = 1;
const STORE_NAME = 'snapshots';
const STORE_KEY = 'current';

let databasePromise = null;

export async function requestPersistentStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false;
  }

  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function readPersistedSession() {
  const database = await openDatabase();
  if (!database) {
    return null;
  }

  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(STORE_KEY);

    request.onsuccess = () => {
      resolve(request.result ?? null);
    };
    request.onerror = () => {
      reject(request.error || new Error('Failed to read the persisted session.'));
    };
    transaction.onabort = () => {
      reject(transaction.error || new Error('Persisted session read was aborted.'));
    };
    transaction.onerror = () => {
      reject(transaction.error || new Error('Persisted session read failed.'));
    };
  }).catch(() => null);
}

export async function writePersistedSession(snapshot) {
  const database = await openDatabase();
  if (!database) {
    return false;
  }

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(snapshot, STORE_KEY);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error || new Error('Failed to persist the current session.'));
    };
    transaction.onabort = () => {
      reject(transaction.error || new Error('Persisted session write was aborted.'));
    };
    transaction.onerror = () => {
      reject(transaction.error || new Error('Persisted session write failed.'));
    };
  });

  return true;
}

export async function clearPersistedSession() {
  const database = await openDatabase();
  if (!database) {
    return false;
  }

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(STORE_KEY);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error || new Error('Failed to clear the persisted session.'));
    };
    transaction.onabort = () => {
      reject(transaction.error || new Error('Persisted session clear was aborted.'));
    };
    transaction.onerror = () => {
      reject(transaction.error || new Error('Persisted session clear failed.'));
    };
  });

  return true;
}

async function openDatabase() {
  if (typeof indexedDB === 'undefined') {
    return null;
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
        };
        resolve(database);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open the persistence database.'));
      };

      request.onblocked = () => {
        reject(new Error('The persistence database is blocked.'));
      };
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}
