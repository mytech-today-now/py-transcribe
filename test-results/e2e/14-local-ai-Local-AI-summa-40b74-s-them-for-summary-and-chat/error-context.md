# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 14-local-ai.spec.js >> Local AI summary flows >> integration: loads AI-Powered models from the same-origin bridge and uses them for summary and chat
- Location: tests\e2e\14-local-ai.spec.js:65:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('#aiModelMeta')
Expected pattern: /same-origin bridge/i
Received string:  "Selected Anthropic · Claude Sonnet 4. Auto-selected via the AI-Powered ranking heuristic. 2 provider models available across 2 providers and 1 endpoint. Endpoint: same-origin PHP bridge."
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('#aiModelMeta')
    12 × locator resolved to <p class="hint" id="aiModelMeta">Selected Anthropic · Claude Sonnet 4. Auto-select…</p>
       - unexpected value "Selected Anthropic · Claude Sonnet 4. Auto-selected via the AI-Powered ranking heuristic. 2 provider models available across 2 providers and 1 endpoint. Endpoint: same-origin PHP bridge."

```

```yaml
- paragraph: "Selected Anthropic · Claude Sonnet 4. Auto-selected via the AI-Powered ranking heuristic. 2 provider models available across 2 providers and 1 endpoint. Endpoint: same-origin PHP bridge."
```

# Test source

```ts
  1   | import { test, expect } from './fixtures.js';
  2   | import {
  3   |   AI_POWERED_NGROK_BASE_URL,
  4   |   buildAiPoweredSelectionKey
  5   | } from '../../web/lib/ai-powered.js';
  6   | import {
  7   |   createAudioFile,
  8   |   installAiPoweredRoutes,
  9   |   installLocalAiRoutes,
  10  |   loadRuntime,
  11  |   openApp,
  12  |   selectFilesViaButton,
  13  |   transcribeCurrentFile
  14  | } from './helpers.js';
  15  | 
  16  | test.describe('Local AI summary flows', () => {
  17  |   test('integration: uses the same-origin Ollama bridge before loopback candidates, then summarizes and chats locally', async ({ page }) => {
  18  |     const requests = await installLocalAiRoutes(page, {
  19  |       models: [
  20  |         {
  21  |           name: 'rubenftenorio/kimi-k25-local',
  22  |           details: { family: 'Kimi', parameter_size: '2.5B' }
  23  |         }
  24  |       ],
  25  |       directCors: false
  26  |     });
  27  | 
  28  |     await openApp(page);
  29  | 
  30  |     await expect(page.locator('#aiRuntimeSelect')).toHaveValue('auto');
  31  |     await expect(page.locator('#aiRuntimeMeta')).toContainText(/auto mode checks local ollama first/i);
  32  |     await expect(page.locator('#aiRuntimeMeta')).toContainText(/ollama endpoint: same-origin php bridge/i);
  33  |     await expect(page.locator('#aiState')).toContainText(/model ready/i);
  34  |     await expect(page.locator('#checkAiButton')).toHaveText(/refresh local ai/i);
  35  |     expect(requests.tags).toHaveLength(1);
  36  |     expect(requests.tags[0].kind).toBe('proxy');
  37  |     expect(requests.tags[0].url).toContain('/api/ollama/tags.php');
  38  | 
  39  |     await selectFilesViaButton(page, [createAudioFile({ name: 'browser-fallback.wav' })]);
  40  |     await loadRuntime(page);
  41  |     await transcribeCurrentFile(page);
  42  | 
  43  |     await expect(page.locator('#summarizeButton')).toBeEnabled();
  44  |     await page.locator('#summaryDetailDetailed').check();
  45  |     await page.locator('#summarizeButton').click();
  46  | 
  47  |     await expect(page.locator('#summaryPanel')).toBeVisible();
  48  |     await expect(page.locator('#summaryPanelTitle')).toHaveText('Local AI summary');
  49  |     await expect(page.locator('#summaryContent')).toContainText('Local summary.');
  50  |     await expect(page.locator('#summaryContent')).toContainText('Action item.');
  51  |     await expect(page.locator('#summaryMeta')).toContainText('Model: rubenftenorio/kimi-k25-local');
  52  | 
  53  |     await page.locator('#chatInput').fill('What action items were mentioned?');
  54  |     await page.locator('#chatSendButton').click();
  55  | 
  56  |     await expect(page.locator('#chatHistory')).toContainText('Local summary.');
  57  |     await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
  58  |     expect(requests.chat).toHaveLength(2);
  59  |     expect(requests.chat.every((request) => request.kind === 'proxy')).toBe(true);
  60  | 
  61  |     const browserState = await page.evaluate(() => window.__pyTranscribeTestState.browserAi);
  62  |     expect(browserState.loadCalls).toBe(0);
  63  |   });
  64  | 
  65  |   test('integration: loads AI-Powered models from the same-origin bridge and uses them for summary and chat', async ({ page }) => {
  66  |     const requests = await installAiPoweredRoutes(page);
  67  | 
  68  |     await openApp(page, {
  69  |       initialSettings: {
  70  |         localAiRuntimeMode: 'ai-powered'
  71  |       }
  72  |     });
  73  | 
  74  |     await expect(page.locator('#aiRuntimeSelect')).toHaveValue('ai-powered');
  75  |     await expect(page.locator('#aiRuntimeMeta')).toContainText(/ai-powered mode uses the local bridge/i);
  76  |     await expect(page.locator('#aiRuntimeMeta')).toContainText(/ai-powered endpoint: same-origin php bridge/i);
  77  |     await expect(page.locator('#aiState')).toContainText(/ai-powered detected/i);
  78  |     await expect(page.locator('#aiModelLabel')).toHaveText('AI-Powered provider/model');
  79  |     await expect(page.locator('#aiModelSelect')).toHaveValue(buildAiPoweredSelectionKey({
  80  |       baseUrl: 'api/ai-powered',
  81  |       providerId: 'anthropic',
  82  |       modelId: 'anthropic/claude-sonnet-4'
  83  |     }));
  84  |     await expect(page.locator('#aiModelMeta')).toContainText(/Anthropic/i);
> 85  |     await expect(page.locator('#aiModelMeta')).toContainText(/same-origin bridge/i);
      |                                                ^ Error: expect(locator).toContainText(expected) failed
  86  |     await expect(page.locator('#checkAiButton')).toHaveText(/refresh ai-powered providers/i);
  87  |     expect(requests.health.some((request) => request.kind === 'proxy')).toBe(true);
  88  |     expect(requests.providers).toHaveLength(1);
  89  |     expect(requests.models).toHaveLength(2);
  90  |     expect(requests.providers[0].kind).toBe('proxy');
  91  |     expect(requests.models.every((request) => request.kind === 'proxy')).toBe(true);
  92  | 
  93  |     await selectFilesViaButton(page, [createAudioFile({ name: 'ai-powered.wav' })]);
  94  |     await loadRuntime(page);
  95  |     await transcribeCurrentFile(page);
  96  | 
  97  |     await expect(page.locator('#summarizeButton')).toBeEnabled();
  98  |     await page.locator('#summaryDetailDetailed').check();
  99  |     await page.locator('#summarizeButton').click();
  100 | 
  101 |     await expect(page.locator('#summaryPanel')).toBeVisible();
  102 |     await expect(page.locator('#summaryContent')).toContainText('AI-Powered summary.');
  103 |     await expect(page.locator('#summaryContent')).toContainText('Action item.');
  104 |     await expect(page.locator('#summaryMeta')).toContainText('Model: Claude Sonnet 4');
  105 | 
  106 |     await page.locator('#chatInput').fill('What action items were mentioned?');
  107 |     await page.locator('#chatSendButton').click();
  108 | 
  109 |     await expect(page.locator('#chatHistory')).toContainText('AI-Powered reply.');
  110 |     await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
  111 |     expect(requests.stream).toHaveLength(2);
  112 |     expect(requests.stream[0].phase).toBe('summary');
  113 |     expect(requests.stream[1].phase).toBe('chat');
  114 |     expect(requests.stream.every((request) => request.kind === 'proxy' && request.postData.provider === 'anthropic')).toBe(true);
  115 | 
  116 |     const browserState = await page.evaluate(() => window.__pyTranscribeTestState.browserAi);
  117 |     expect(browserState.loadCalls).toBe(0);
  118 |   });
  119 | 
  120 |   test('integration: surfaces ngrok AI-Powered providers and can summarize/chat through the remote catalog', async ({ page }) => {
  121 |     const requests = await installAiPoweredRoutes(page, {
  122 |       ngrokHealthStatus: 200,
  123 |       ngrokModels: [
  124 |         {
  125 |           id: 'xai/grok-4',
  126 |           name: 'Grok 4',
  127 |           capabilities: ['text', 'structured'],
  128 |           providerId: 'xai',
  129 |           providerName: 'xAI / Grok'
  130 |         },
  131 |         {
  132 |           id: 'openrouter/qwen-3-coder',
  133 |           name: 'Qwen 3 Coder',
  134 |           capabilities: ['text'],
  135 |           providerId: 'openrouter',
  136 |           providerName: 'OpenRouter'
  137 |         }
  138 |       ],
  139 |       ngrokSummaryChunks: [
  140 |         'Ngrok summary.',
  141 |         '\n- Remote provider.',
  142 |         '\n- Action item.'
  143 |       ],
  144 |       ngrokChatChunks: [
  145 |         'Ngrok reply.',
  146 |         '\n- Remote provider.'
  147 |       ]
  148 |     });
  149 | 
  150 |     await openApp(page, {
  151 |       initialSettings: {
  152 |         localAiRuntimeMode: 'ai-powered'
  153 |       }
  154 |     });
  155 | 
  156 |     const groupLabels = await page.locator('#aiModelSelect optgroup').evaluateAll((groups) => groups.map((group) => group.label));
  157 |     expect(groupLabels).toEqual(expect.arrayContaining(['same-origin bridge', 'ngrok tunnel']));
  158 |     await expect(page.locator('#aiModelSelect')).toContainText(/OpenRouter/i);
  159 |     await expect(page.locator('#aiModelSelect')).toContainText(/xAI \/ Grok/i);
  160 | 
  161 |     const remoteSelectionKey = buildAiPoweredSelectionKey({
  162 |       baseUrl: AI_POWERED_NGROK_BASE_URL,
  163 |       providerId: 'openrouter',
  164 |       modelId: 'openrouter/qwen-3-coder'
  165 |     });
  166 |     await page.locator('#aiModelSelect').selectOption(remoteSelectionKey);
  167 |     await expect(page.locator('#aiModelMeta')).toContainText(/OpenRouter/i);
  168 |     await expect(page.locator('#aiModelMeta')).toContainText(/ngrok tunnel/i);
  169 | 
  170 |     await selectFilesViaButton(page, [createAudioFile({ name: 'ngrok-ai-powered.wav' })]);
  171 |     await loadRuntime(page);
  172 |     await transcribeCurrentFile(page);
  173 | 
  174 |     await expect(page.locator('#summarizeButton')).toBeEnabled();
  175 |     await page.locator('#summaryDetailDetailed').check();
  176 |     await page.locator('#summarizeButton').click();
  177 | 
  178 |     await expect(page.locator('#summaryContent')).toContainText('Ngrok summary.');
  179 |     await expect(page.locator('#summaryMeta')).toContainText('Model: Qwen 3 Coder');
  180 | 
  181 |     await page.locator('#chatInput').fill('What remote provider was used?');
  182 |     await page.locator('#chatSendButton').click();
  183 | 
  184 |     await expect(page.locator('#chatHistory')).toContainText('Ngrok reply.');
  185 |     expect(requests.providers.some((request) => request.source === 'ngrok tunnel')).toBe(true);
```