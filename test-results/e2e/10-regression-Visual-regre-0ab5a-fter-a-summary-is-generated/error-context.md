# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 10-regression.spec.js >> Visual regression >> keeps the local AI panel stable after a summary is generated
- Location: tests\e2e\10-regression.spec.js:63:3

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
Call log:
  - waiting for locator('#summarizeButton')
    - locator resolved to <button type="button" id="summarizeButton" class="button button-accent" title="Standard summaries stay local to this browser.">Summarize transcript</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable

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
          - strong [ref=e31]: Base ready
      - generic [ref=e33]:
        - checkbox "Save a local copy" [ref=e34]
        - generic [ref=e35]: Save a local copy
      - button "Transcribe" [ref=e37] [cursor=pointer]
  - generic [ref=e38]:
    - group [ref=e39]:
      - generic "Event log" [ref=e40] [cursor=pointer]:
        - status [ref=e42]: Finished in 0.3 seconds. 1 segment ready.
      - list [ref=e43]:
        - listitem [ref=e44]:
          - generic [ref=e45]: Finished in 0.3 seconds. 1 segment ready.
        - listitem [ref=e46]:
          - generic [ref=e47]: Transcribing local-ai-panel.wav...
        - listitem [ref=e48]:
          - generic [ref=e49]: Preparing local-ai-panel.wav...
        - listitem [ref=e50]:
          - generic [ref=e51]: Pyodide and base Whisper are ready.
        - listitem [ref=e52]:
          - generic [ref=e53]: Loading Pyodide and base Whisper...
        - listitem [ref=e54]:
          - generic [ref=e55]: Selected local-ai-panel.wav. Load Whisper / Export to continue.
        - listitem [ref=e56]:
          - generic [ref=e57]: "Using local model: rubenftenorio/kimi-k25-local."
        - listitem [ref=e58]:
          - generic [ref=e59]: Checking Ollama...
        - listitem [ref=e60]:
          - generic [ref=e61]: Ready. Load Whisper / Python, then choose a file.
        - listitem [ref=e62]:
          - generic [ref=e63]: Restoring saved session...
    - paragraph [ref=e64]: Local model inference runs in the browser. PHP only stores optional backups and serves the shell.
  - generic [ref=e65]:
    - strong [ref=e66]: WebGPU available
    - strong [ref=e67]: Ready
    - strong [ref=e68]: Loaded
    - strong [ref=e69]: Audio
    - generic [ref=e70]: local-ai-panel.wav
  - generic [ref=e71]:
    - complementary [ref=e72]:
      - generic [ref=e73]:
        - heading "Source" [level=2] [ref=e74]
        - paragraph [ref=e75]: Drop media or record a clip, tune the model, and keep backup storage compact.
      - generic [ref=e76]:
        - button "Drop WAV, MP3, MP4, WEBM, or OGG here Click to choose a file from this device, or drag one in." [ref=e77] [cursor=pointer]:
          - generic [ref=e78]: Drop WAV, MP3, MP4, WEBM, or OGG here
          - generic [ref=e79]: Click to choose a file from this device, or drag one in.
        - generic [ref=e80]:
          - button "Record Mic" [ref=e81] [cursor=pointer]
          - status [ref=e82]: Mic idle
      - paragraph [ref=e83]: Press Enter or Space to open a file picker, or drag and drop media here.
      - generic [ref=e84]:
        - generic [ref=e85]: Whisper model
        - combobox "Whisper model" [ref=e86]:
          - option "Tiny English" [selected]
          - option "Tiny multilingual"
          - option "Small multilingual"
        - paragraph [ref=e87]: Fastest option for English audio. Transcribe only.
      - generic [ref=e88]:
        - generic [ref=e89]:
          - text: Task
          - combobox "Task" [ref=e90]:
            - option "Transcribe" [selected]
            - option "Translate to English" [disabled]
        - generic [ref=e91]:
          - text: Language
          - combobox "Language" [ref=e92]:
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
      - generic [ref=e93]:
        - generic [ref=e94]:
          - checkbox "Cleanup punctuation" [checked] [ref=e95]
          - generic [ref=e96]: Cleanup punctuation
        - generic [ref=e97]:
          - checkbox "Show timestamps" [checked] [ref=e98]
          - generic [ref=e99]: Show timestamps
        - generic [ref=e100]:
          - checkbox "Speaker labels" [ref=e101]
          - generic [ref=e102]: Speaker labels
      - button "Dictate Mic" [ref=e104] [cursor=pointer]
      - generic [ref=e105]:
        - paragraph [ref=e106]: local-ai-panel.wav · 31.3 KB · 0:01
        - paragraph [ref=e107]:
          - text: "Source:"
          - strong [ref=e108]: browser audio decode
        - paragraph [ref=e109]:
          - text: "Runtime detail:"
          - strong [ref=e110]: Whisper is ready on WebGPU.
        - paragraph [ref=e111]:
          - text: "Host storage:"
          - strong [ref=e112]: Host backup off
    - generic [ref=e113]:
      - generic [ref=e114]:
        - generic [ref=e115]:
          - heading "Transcript" [level=2] [ref=e116]
          - paragraph [ref=e117]: Edit the transcript, then copy or export it when it’s ready.
        - button "Copy transcript" [ref=e118] [cursor=pointer]
      - generic [ref=e119]:
        - button "Download transcript.txt" [ref=e120] [cursor=pointer]
        - button "Download transcript.srt" [ref=e121] [cursor=pointer]
        - button "Download transcript.vtt" [ref=e122] [cursor=pointer]
        - button "Download transcript.zip" [ref=e123] [cursor=pointer]
      - region [ref=e124]:
        - generic [ref=e125]:
          - generic [ref=e126]:
            - heading "Local AI summary" [level=3] [ref=e127]
            - paragraph [ref=e128]: Auto mode checks Ollama first, then falls back to the browser WASM model cache when needed.
          - generic [ref=e129]:
            - button "Refresh local AI" [ref=e130] [cursor=pointer]
            - button "Summarize transcript" [ref=e131] [cursor=pointer]
        - generic [ref=e132]:
          - paragraph [ref=e133]:
            - strong [ref=e134]: Model ready
          - paragraph [ref=e135]: "Using local model: rubenftenorio/kimi-k25-local."
        - generic [ref=e136]:
          - generic [ref=e137]: Runtime mode
          - combobox "Runtime mode" [ref=e138]:
            - option "Auto - Ollama first, browser fallback" [selected]
            - option "Local only - Ollama"
            - option "AI-Powered providers"
            - option "Browser only - WASM cache"
          - paragraph [ref=e139]: "Auto mode checks local Ollama first, then falls back to the browser WASM model if needed. Ollama endpoint: same-origin PHP bridge. Last successful runtime: Local Ollama."
        - generic [ref=e140]:
          - generic [ref=e141]: Local AI model
          - combobox "Local AI model" [ref=e142]:
            - option "rubenftenorio/kimi-k25-local · Kimi · 2.5B" [selected]
            - option "Kimi K3 (cloud) (download)"
            - option "Kimi K2.7 Code (cloud) (download)"
            - option "Kimi K2.6 (cloud) (download)"
            - option "Kimi-VL-A3B-Thinking (download)"
            - option "Kimi K2-Instruct (download)"
          - paragraph [ref=e143]: Selected rubenftenorio/kimi-k25-local is installed. Auto-selected via the ranking heuristic. 1 installed model available.
        - group "Summary detail" [ref=e144]:
          - generic [ref=e146]:
            - generic [ref=e147] [cursor=pointer]:
              - radio "Brief" [ref=e148]
              - generic [ref=e149]: Brief
            - generic [ref=e150] [cursor=pointer]:
              - radio "Standard" [checked] [ref=e151]
              - generic [ref=e152]: Standard
            - generic [ref=e153] [cursor=pointer]:
              - radio "Detailed" [ref=e154]
              - generic [ref=e155]: Detailed
        - region [ref=e156]:
          - generic [ref=e157]:
            - generic [ref=e158]:
              - paragraph [ref=e159]: Context aware
              - heading "Local transcript chat" [level=4] [ref=e160]
            - paragraph [ref=e161]: Chat uses the current transcript as fixed context.
          - status [ref=e162]: Ask a follow-up question.
          - list [ref=e163]:
            - listitem [ref=e164]: Ask about decisions, names, action items, or missing context.
          - generic [ref=e165]:
            - generic [ref=e166]: Ask a follow-up question
            - textbox "Ask a follow-up question" [ref=e167]:
              - /placeholder: Ask about action items, decisions, or missing context.
            - generic [ref=e168]:
              - button "Send" [disabled] [ref=e169]
              - button "Start new session" [ref=e170] [cursor=pointer]
              - button "Clear chat" [disabled] [ref=e171]
      - generic [ref=e172]:
        - generic [ref=e173]:
          - generic [ref=e174]: Plain transcript
          - generic [ref=e175]: Transcript from local Whisper
        - generic [ref=e176]:
          - generic [ref=e177]: Editable transcript
          - textbox "Editable transcript" [ref=e178]:
            - /placeholder: Your transcript appears here. You can edit it before copying or exporting.
            - text: Transcript from local Whisper
        - generic [ref=e179]:
          - generic [ref=e180]: Timestamped preview
          - generic [ref=e181]: "[00:00:00.000 - 00:00:01.000] Transcript from local Whisper"
```

# Test source

```ts
  1   | import { test, expect } from './fixtures.js';
  2   | import {
  3   |   createAudioFile,
  4   |   installLocalAiRoutes,
  5   |   openApp,
  6   |   selectFilesViaButton,
  7   |   loadRuntime,
  8   |   transcribeCurrentFile
  9   | } from './helpers.js';
  10  | 
  11  | test.describe('Visual regression', () => {
  12  |   test('keeps the hero compact and punchy', async ({ page }) => {
  13  |     await openApp(page);
  14  | 
  15  |     await expect(page.locator('header.hero')).toHaveScreenshot('hero-compact.png', {
  16  |       animations: 'disabled'
  17  |     });
  18  |   });
  19  | 
  20  |   test('stacks the runtime toolbar and splits the source controls', async ({ page }) => {
  21  |     await openApp(page);
  22  | 
  23  |     const [runtimeBox, copyBox, actionBox, dropBox, recordCardBox, recordButtonBox] = await Promise.all([
  24  |       page.locator('.toolbar-runtime-row').boundingBox(),
  25  |       page.locator('.toolbar-copy-row').boundingBox(),
  26  |       page.locator('.toolbar-action-row').boundingBox(),
  27  |       page.locator('#dropZone').boundingBox(),
  28  |       page.locator('.source-record').boundingBox(),
  29  |       page.locator('#recordButton').boundingBox()
  30  |     ]);
  31  | 
  32  |     expect(runtimeBox).not.toBeNull();
  33  |     expect(copyBox).not.toBeNull();
  34  |     expect(actionBox).not.toBeNull();
  35  |     expect(dropBox).not.toBeNull();
  36  |     expect(recordCardBox).not.toBeNull();
  37  |     expect(recordButtonBox).not.toBeNull();
  38  | 
  39  |     expect(copyBox.y).toBeGreaterThan(runtimeBox.y + runtimeBox.height - 2);
  40  |     expect(actionBox.y).toBeGreaterThan(copyBox.y + copyBox.height - 2);
  41  |     expect(recordCardBox.x).toBeGreaterThan(dropBox.x + dropBox.width * 0.4);
  42  |     expect(Math.abs(dropBox.y - recordCardBox.y)).toBeLessThan(8);
  43  |     expect(recordButtonBox.y).toBeGreaterThan(recordCardBox.y);
  44  |   });
  45  | 
  46  |   test('keeps the source and transcript grid stable', async ({ page }) => {
  47  |     await openApp(page);
  48  | 
  49  |     await expect(page.locator('section.grid')).toHaveScreenshot('workspace-grid-idle.png', {
  50  |       animations: 'disabled'
  51  |     });
  52  |   });
  53  | 
  54  |   test('shows the loaded filename in the toolbar', async ({ page }) => {
  55  |     await openApp(page);
  56  |     await selectFilesViaButton(page, [createAudioFile({ name: 'snapshot.wav' })]);
  57  | 
  58  |     await expect(page.locator('.toolbar')).toHaveScreenshot('toolbar-loaded.png', {
  59  |       animations: 'disabled'
  60  |     });
  61  |   });
  62  | 
  63  |   test('keeps the local AI panel stable after a summary is generated', async ({ page }) => {
  64  |     await installLocalAiRoutes(page, {
  65  |       models: [
  66  |         {
  67  |           name: 'rubenftenorio/kimi-k25-local',
  68  |           details: { family: 'Kimi', parameter_size: '2.5B' }
  69  |         }
  70  |       ]
  71  |     });
  72  | 
  73  |     await openApp(page);
  74  |     await selectFilesViaButton(page, [createAudioFile({ name: 'local-ai-panel.wav' })]);
  75  |     await loadRuntime(page);
  76  |     await transcribeCurrentFile(page);
> 77  |     await page.locator('#summarizeButton').click();
      |                                            ^ Error: locator.click: Test timeout of 120000ms exceeded.
  78  | 
  79  |     await expect(page.locator('.local-ai-panel')).toHaveScreenshot('local-ai-panel-ready.png', {
  80  |       animations: 'disabled'
  81  |     });
  82  |   });
  83  | 
  84  |   test('keeps the transcript rows stable after transcription', async ({ page }) => {
  85  |     await openApp(page);
  86  |     await selectFilesViaButton(page, [createAudioFile({ name: 'snapshot.wav' })]);
  87  |     await loadRuntime(page);
  88  |     await transcribeCurrentFile(page);
  89  | 
  90  |     await expect(page.locator('.transcript-panel')).toHaveScreenshot('transcript-panel-ready.png', {
  91  |       animations: 'disabled'
  92  |     });
  93  |   });
  94  | 
  95  |   test('keeps the transcript downloads above the editable transcript area', async ({ page }) => {
  96  |     await openApp(page);
  97  |     await selectFilesViaButton(page, [createAudioFile({ name: 'snapshot.wav' })]);
  98  |     await loadRuntime(page);
  99  |     await transcribeCurrentFile(page);
  100 | 
  101 |     const [downloadBox, rowsBox] = await Promise.all([
  102 |       page.locator('.download-row').boundingBox(),
  103 |       page.locator('.transcript-rows').boundingBox()
  104 |     ]);
  105 | 
  106 |     expect(downloadBox).not.toBeNull();
  107 |     expect(rowsBox).not.toBeNull();
  108 |     expect(downloadBox.y).toBeLessThan(rowsBox.y);
  109 |   });
  110 | });
  111 | 
```