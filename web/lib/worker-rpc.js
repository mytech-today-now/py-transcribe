export function createWorkerClient(workerUrl, { onMessage } = {}) {
  const worker = new Worker(workerUrl, { type: 'module' });
  const pending = new Map();
  let nextId = 0;

  const handleMessage = (event) => {
    const message = event.data ?? {};

    if (typeof onMessage === 'function') {
      onMessage(message);
    }

    if (message.id == null || !pending.has(message.id)) {
      return;
    }

    if (!['ready', 'result', 'error'].includes(String(message.type))) {
      return;
    }

    const entry = pending.get(message.id);
    pending.delete(message.id);

    if (message.type === 'error') {
      entry.reject(deserializeError(message.error));
      return;
    }

    entry.resolve(message);
  };

  const handleError = (event) => {
    const error = event?.error instanceof Error
      ? event.error
      : new Error(event?.message || 'Worker error');

    for (const entry of pending.values()) {
      entry.reject(error);
    }
    pending.clear();
  };

  worker.addEventListener('message', handleMessage);
  worker.addEventListener('error', handleError);

  return {
    request(message, transfer = []) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, ...message }, transfer);
      });
    },

    terminate() {
      for (const entry of pending.values()) {
        entry.reject(new Error('Worker terminated.'));
      }
      pending.clear();
      worker.terminate();
    },

    raw: worker
  };
}

function deserializeError(error) {
  if (!error) {
    return new Error('Worker error.');
  }

  if (error instanceof Error) {
    return error;
  }

  const message = typeof error === 'string'
    ? error
    : String(error.message || 'Worker error.');
  const wrapped = new Error(message);
  if (error.name) {
    wrapped.name = error.name;
  }
  return wrapped;
}
