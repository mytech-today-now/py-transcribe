# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 14-local-ai.spec.js >> Local AI summary flows >> integration: surfaces ngrok AI-Powered providers and can summarize/chat through the remote catalog
- Location: tests\e2e\14-local-ai.spec.js:120:3

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

Expected: ArrayContaining ["same-origin bridge", "ngrok tunnel"]
Received: ["same-origin PHP bridge"]
```

# Page snapshot

```yaml
- main [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - paragraph [ref=e5]: Shared-hosting edition
      - heading "Local Whisper, editable transcripts, lean PHP." [level=1] [ref=e6]
      - paragraph [ref=e7]: Everything stays local unless you enable host backup.
    - generic "Quick actions" [ref=e8]:
      - button "myTech.Today Open myTech.Today consulting card" [ref=e9] [cursor=pointer]:
        - generic [ref=e14]: myTech.Today
        - generic [ref=e15]: Open myTech.Today consulting card
      - button "README Open the live rendered README" [ref=e16] [cursor=pointer]:
        - generic [ref=e22]: README
        - generic [ref=e23]: Open the live rendered README
  - article [ref=e24]:
    - heading "Runtime controls" [level=2] [ref=e25]
    - generic [ref=e26]:
      - generic [ref=e27]:
        - button "Load Whisper / Python" [ref=e28] [cursor=pointer]
        - generic [ref=e29]:
          - generic [ref=e30]: Runtime
          - strong [ref=e31]: Not loaded
      - generic [ref=e33]:
        - checkbox "Save a local copy" [ref=e34]
        - generic [ref=e35]: Save a local copy
      - button "Transcribe" [disabled] [ref=e37]
  - generic [ref=e38]:
    - group [ref=e39]:
      - generic "Event log" [ref=e40] [cursor=pointer]:
        - status [ref=e42]: "AI-Powered model ready: Claude Sonnet 4 · Anthropic · same-origin bridge · anthropic/claude-sonnet-4 · text · structured."
      - list [ref=e43]:
        - listitem [ref=e44]:
          - generic [ref=e45]: "AI-Powered model ready: Claude Sonnet 4 · Anthropic · same-origin bridge · anthropic/claude-sonnet-4 · text · structured."
        - listitem [ref=e46]:
          - generic [ref=e47]: Connecting to AI-Powered...
        - listitem [ref=e48]:
          - generic [ref=e49]: Ready. Load Whisper / Python, then choose a file.
        - listitem [ref=e50]:
          - generic [ref=e51]: Restoring saved session...
    - paragraph [ref=e52]: Local model inference runs in the browser. PHP only stores optional backups and serves the shell.
  - generic [ref=e53]:
    - strong [ref=e54]: WebGPU available
    - strong [ref=e55]: Waiting
    - strong [ref=e56]: Idle
    - strong [ref=e57]: Waiting
  - generic [ref=e58]:
    - complementary [ref=e59]:
      - generic [ref=e60]:
        - heading "Source" [level=2] [ref=e61]
        - paragraph [ref=e62]: Drop media or record a clip, tune the model, and keep backup storage compact.
      - generic [ref=e63]:
        - button "Drop WAV, MP3, MP4, WEBM, or OGG here Click to choose a file from this device, or drag one in." [ref=e64] [cursor=pointer]:
          - generic [ref=e65]: Drop WAV, MP3, MP4, WEBM, or OGG here
          - generic [ref=e66]: Click to choose a file from this device, or drag one in.
        - generic [ref=e67]:
          - button "Record Mic" [ref=e68] [cursor=pointer]
          - status [ref=e69]: Mic idle
      - paragraph [ref=e70]: Press Enter or Space to open a file picker, or drag and drop media here.
      - generic [ref=e71]:
        - generic [ref=e72]: Whisper model
        - combobox "Whisper model" [ref=e73]:
          - option "Tiny English" [selected]
          - option "Tiny multilingual"
          - option "Small multilingual"
        - paragraph [ref=e74]: Fastest option for English audio. Transcribe only.
      - generic [ref=e75]:
        - generic [ref=e76]:
          - text: Task
          - combobox "Task" [ref=e77]:
            - option "Transcribe" [selected]
            - option "Translate to English" [disabled]
        - generic [ref=e78]:
          - text: Language
          - combobox "Language" [ref=e79]:
            - option "Auto detect" [selected]
            - option "English"
            - option "Spanish"
            - option "French"
            - option "German"
            - option "Italian"
            - option "Portuguese"
            - option "Dutch"
            - option "Japanese"
            - option "Korean"
            - option "Chinese"
            - option "Hindi"
            - option "Arabic"
      - generic [ref=e80]:
        - generic [ref=e81]:
          - checkbox "Cleanup punctuation" [checked] [ref=e82]
          - generic [ref=e83]: Cleanup punctuation
        - generic [ref=e84]:
          - checkbox "Show timestamps" [checked] [ref=e85]
          - generic [ref=e86]: Show timestamps
        - generic [ref=e87]:
          - checkbox "Speaker labels" [ref=e88]
          - generic [ref=e89]: Speaker labels
      - button "Dictate Mic" [ref=e91] [cursor=pointer]
      - generic [ref=e92]:
        - paragraph [ref=e93]: No file selected yet.
        - paragraph [ref=e94]:
          - text: "Source:"
          - strong [ref=e95]: waiting
        - paragraph [ref=e96]:
          - text: "Runtime detail:"
          - strong [ref=e97]: Whisper is not loaded yet.
        - paragraph [ref=e98]:
          - text: "Host storage:"
          - strong [ref=e99]: Host backup off
    - generic [ref=e100]:
      - generic [ref=e101]:
        - generic [ref=e102]:
          - heading "Transcript" [level=2] [ref=e103]
          - paragraph [ref=e104]: Edit the transcript, then copy or export it when it’s ready.
        - button "Copy transcript" [disabled] [ref=e105]
      - generic [ref=e106]:
        - button "Download transcript.txt" [disabled] [ref=e107]
        - button "Download transcript.srt" [disabled] [ref=e108]
        - button "Download transcript.vtt" [disabled] [ref=e109]
        - button "Download transcript.zip" [disabled] [ref=e110]
      - region [ref=e111]:
        - generic [ref=e112]:
          - generic [ref=e113]:
            - heading "Local AI summary" [level=3] [ref=e114]
            - paragraph [ref=e115]: Auto mode checks Ollama first, then falls back to the browser WASM model cache when needed.
          - generic [ref=e116]:
            - button "Refresh AI-Powered providers" [ref=e117] [cursor=pointer]
            - button "Summarize transcript" [disabled] [ref=e118]
        - generic [ref=e119]:
          - paragraph [ref=e120]:
            - strong [ref=e121]: AI-Powered detected
          - paragraph [ref=e122]: Using AI-Powered provider Anthropic with model Claude Sonnet 4.
        - generic [ref=e123]:
          - generic [ref=e124]: Runtime mode
          - combobox "Runtime mode" [ref=e125]:
            - option "Auto - Ollama first, browser fallback"
            - option "Local only - Ollama"
            - option "AI-Powered providers" [selected]
            - option "Browser only - WASM cache"
          - paragraph [ref=e126]: "AI-Powered mode uses the local bridge, plus any reachable provider catalogs, for summaries and chat. AI-Powered endpoint: same-origin PHP bridge. Last successful runtime: AI-Powered."
        - generic [ref=e127]:
          - generic [ref=e128]: AI-Powered provider/model
          - combobox "AI-Powered provider/model" [ref=e129]:
            - option "Anthropic · Claude Sonnet 4" [selected]
            - option "Openai · GPT-4.1 Mini"
          - paragraph [ref=e130]: "Selected Anthropic · Claude Sonnet 4. Auto-selected via the AI-Powered ranking heuristic. 2 provider models available across 2 providers and 1 endpoint. Endpoint: same-origin PHP bridge."
        - group "Summary detail" [ref=e131]:
          - generic [ref=e133]:
            - generic [ref=e134] [cursor=pointer]:
              - radio "Brief" [ref=e135]
              - generic [ref=e136]: Brief
            - generic [ref=e137] [cursor=pointer]:
              - radio "Standard" [checked] [ref=e138]
              - generic [ref=e139]: Standard
            - generic [ref=e140] [cursor=pointer]:
              - radio "Detailed" [ref=e141]
              - generic [ref=e142]: Detailed
      - generic [ref=e143]:
        - generic [ref=e144]:
          - generic [ref=e145]: Plain transcript
          - generic [ref=e146]: No transcript yet.
        - generic [ref=e147]:
          - generic [ref=e148]: Editable transcript
          - textbox "Editable transcript" [ref=e149]:
            - /placeholder: Your transcript appears here. You can edit it before copying or exporting.
        - generic [ref=e150]:
          - generic [ref=e151]: Timestamped preview
          - generic [ref=e152]: No transcript yet.
```

# Test source

```ts
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
  85  |     await expect(page.locator('#aiModelMeta')).toContainText(/same-origin bridge/i);
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
> 157 |     expect(groupLabels).toEqual(expect.arrayContaining(['same-origin bridge', 'ngrok tunnel']));
      |                         ^ Error: expect(received).toEqual(expected) // deep equality
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
  186 |     expect(requests.models.some((request) => request.source === 'ngrok tunnel')).toBe(true);
  187 |     expect(requests.stream.some((request) => request.source === 'ngrok tunnel')).toBe(true);
  188 |     expect(requests.stream.every((request) => request.postData.provider === 'openrouter')).toBe(true);
  189 |   });
  190 | 
  191 |   test('integration: falls back to browser WASM when the Ollama bridge is unavailable, then summarizes and chats locally', async ({ page }) => {
  192 |     const requests = await installLocalAiRoutes(page, {
  193 |       models: [],
  194 |       proxyTagsStatus: 500,
  195 |       directCors: false
  196 |     });
  197 | 
  198 |     await openApp(page);
  199 | 
  200 |     await expect(page.locator('#aiRuntimeSelect')).toHaveValue('auto');
  201 |     await expect(page.locator('#aiRuntimeMeta')).toContainText(/auto mode checks local ollama first/i);
  202 |     await expect(page.locator('#aiRuntimeMeta')).toContainText(/last successful runtime: browser wasm/i);
  203 |     await expect(page.locator('#aiState')).toContainText(/browser model ready/i);
  204 |     await expect(page.locator('#checkAiButton')).toHaveText(/refresh browser model/i);
  205 |     expect(requests.tags[0].kind).toBe('proxy');
  206 |     expect(requests.tags.some((request) => request.kind === 'direct')).toBe(true);
  207 |     expect(requests.tags.length).toBeGreaterThanOrEqual(2);
  208 | 
  209 |     await selectFilesViaButton(page, [createAudioFile({ name: 'browser-fallback.wav' })]);
  210 |     await loadRuntime(page);
  211 |     await transcribeCurrentFile(page);
  212 | 
  213 |     await expect(page.locator('#summarizeButton')).toBeEnabled();
  214 |     await page.locator('#summaryDetailDetailed').check();
  215 |     await page.locator('#summarizeButton').click();
  216 | 
  217 |     await expect(page.locator('#summaryPanel')).toBeVisible();
  218 |     await expect(page.locator('#summaryPanelTitle')).toHaveText('Local AI summary');
  219 |     await expect(page.locator('#summaryContent')).toContainText('Browser summary.');
  220 |     await expect(page.locator('#summaryContent')).toContainText('Action item.');
  221 |     await expect(page.locator('#summaryMeta')).toContainText('Kimi/Opus Distill 2B');
  222 | 
  223 |     await page.locator('#chatInput').fill('What action items were mentioned?');
  224 |     await page.locator('#chatSendButton').click();
  225 | 
  226 |     await expect(page.locator('#chatHistory')).toContainText('Browser reply.');
  227 |     await expect(page.locator('#chatStatus')).toContainText(/conversation ready/i);
  228 | 
  229 |     const browserState = await page.evaluate(() => window.__pyTranscribeTestState.browserAi);
  230 |     expect(browserState.loadCalls).toBeGreaterThan(0);
  231 |     expect(browserState.summarizeCalls).toBe(1);
  232 |     expect(browserState.chatCalls).toBe(1);
  233 |   });
  234 | 
  235 |   test('regression: persists the selected runtime mode across reloads', async ({ page }) => {
  236 |     await openApp(page);
  237 | 
  238 |     await expect(page.locator('#aiRuntimeSelect')).toHaveValue('auto');
  239 | 
  240 |     await page.locator('#aiRuntimeSelect').selectOption('browser');
  241 |     await expect(page.locator('#aiRuntimeMeta')).toContainText(/browser-only mode/i);
  242 |     await expect(page.locator('#aiState')).toContainText(/browser model ready/i);
  243 | 
  244 |     await page.reload();
  245 |     await expect(page.locator('#aiRuntimeSelect')).toHaveValue('browser');
  246 |     await expect(page.locator('#aiRuntimeMeta')).toContainText(/browser-only mode/i);
  247 |     await expect(page.locator('#aiState')).toContainText(/browser model ready/i);
  248 | 
  249 |     await page.locator('#aiRuntimeSelect').selectOption('local');
  250 |     await expect(page.locator('#aiRuntimeMeta')).toContainText(/local-only mode/i);
  251 | 
  252 |     await page.reload();
  253 |     await expect(page.locator('#aiRuntimeSelect')).toHaveValue('local');
  254 |     await expect(page.locator('#aiRuntimeMeta')).toContainText(/local-only mode/i);
  255 |   });
  256 | 
  257 |   test('regression: auto-selects the strongest installed Ollama model when the saved model is missing', async ({ page }) => {
```