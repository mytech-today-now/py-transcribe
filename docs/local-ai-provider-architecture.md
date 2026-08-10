# Local AI Provider Architecture

`py-transcribe` stays browser-first for transcription and uses a layered local-AI selector for summary and chat.

## What Runs Where

- Whisper transcription remains fully client-side in the browser.
- Ollama model discovery, pulls, summaries, and chat go through the same-origin PHP bridge under `/api/ollama/*`.
- AI-Powered provider discovery, model listing, and streaming go through the same-origin PHP bridge under `/api/ai-powered/*`.
- Browser WASM is the fallback runtime when local services are unavailable or when the user explicitly selects browser mode.

## Provider Selection Model

The UI now exposes one unified selector for:

1. Local Ollama models
2. Browser WASM models
3. AI-Powered providers and models
4. ngrok-exposed AI-Powered providers and models

Runtime mode still controls the top-level behavior:

- `auto` tries local Ollama first, then browser WASM.
- `local` stays on Ollama and does not fall back to browser WASM.
- `ai-powered` uses the AI-Powered provider/model catalog.
- `browser` stays entirely in the browser runtime.

## CORS Strategy

The browser no longer talks directly to localhost or ngrok endpoints for AI provider calls.

Instead, absolute upstreams are rewritten to same-origin PHP proxy URLs such as:

- `/api/ollama/tags.php?upstream=127.0.0.1`
- `/api/ollama/chat.php?upstream=localhost`
- `/api/ai-powered/providers.php?upstream=ngrok`
- `/api/ai-powered/stream.php?upstream=local`

That keeps production-origin requests same-origin and avoids browser CORS failures while still letting the backend proxy reach loopback or remote upstreams.

## Failure Handling

The current flow degrades gracefully when:

- Cloudflare Insights beacons are blocked
- WebGPU warns about ignored `powerPreference`
- the AI-Powered bridge returns 500
- local loopback health checks fail
- ngrok is unreachable or its stream endpoint preflight fails

When local AI is unavailable, the app either falls back to browser WASM or stays unavailable, depending on the selected runtime mode.

## Environment Variables

These settings are honored by the PHP bridge:

- `OLLAMA_BASE_URL`
- `AI_POWERED_BASE_URL`
- `AI_POWERED_NGROK_BASE_URL`

If you do not set them, the bridge falls back to the common loopback defaults and the built-in ngrok URL used by the test harness.

## Test Coverage

The regression suite covers:

- provider detection and model listing
- proxy URL rewriting
- fallback paths for Ollama, AI-Powered, and browser WASM
- ngrok provider discovery
- resilience when the bridge or upstream services are unhealthy

## Migration / Deployment

1. Serve the app and the PHP bridge from the same production origin.
2. Make sure the PHP runtime has outbound HTTP support enabled, including cURL if available.
3. Deploy the `/api/ollama/*` and `/api/ai-powered/*` proxy endpoints with the static app.
4. If you run a local `ai-powered` server, expose it on the same host and let the bridge proxy to it.
5. If you expose remote AI-Powered providers through ngrok, set `AI_POWERED_NGROK_BASE_URL` if you need a different tunnel URL.
6. Verify the app by running the unit suite and the Playwright local-AI and resilience specs.

## Quick Verification

```bash
npm test
npx playwright test tests/e2e/08-resilience.spec.js
npx playwright test tests/e2e/14-local-ai.spec.js
```

