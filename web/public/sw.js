const CACHE_NAME = 'py-transcribe-shell-v2';
const SHELL_URL = new URL('./', self.registration.scope).href;
const INDEX_HTML_URL = new URL('./index.html', self.registration.scope).href;
const INDEX_PHP_URL = new URL('./index.php', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await warmShellCache(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => (key === CACHE_NAME ? Promise.resolve(false) : caches.delete(key))));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function warmShellCache(cache) {
  for (const url of [SHELL_URL, INDEX_HTML_URL, INDEX_PHP_URL]) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        await cache.put(url, response.clone());
      }
    } catch {
      // Keep going. Shared hosts can block individual shell URLs depending on setup.
    }
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await matchCachedShell(cache, request);
    if (cached) {
      return cached;
    }

    return offlineShell();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}

async function matchCachedShell(cache, request) {
  const candidates = [
    request,
    SHELL_URL,
    INDEX_HTML_URL,
    INDEX_PHP_URL
  ];

  for (const candidate of candidates) {
    const cached = await cache.match(candidate);
    if (cached) {
      return cached;
    }
  }

  return null;
}

function offlineShell() {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Py Transcribe Studio</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #f3ede3; color: #162235; }
      .card { max-width: 42rem; margin: 4rem auto; padding: 2rem; background: rgba(255,255,255,.9); border-radius: 1.25rem; box-shadow: 0 18px 40px rgba(14,28,44,.12); }
      h1 { margin-top: 0; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Py Transcribe Studio</h1>
      <p>The app shell is offline right now. Reconnect, then try again.</p>
    </main>
  </body>
</html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    }
  );
}
