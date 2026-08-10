# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 10-regression.spec.js >> Visual regression >> shows the loaded filename in the toolbar
- Location: tests\e2e\10-regression.spec.js:54:3

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('.toolbar')
Timeout: 5000ms
  Timeout 5000ms exceeded.

  Snapshot: toolbar-loaded.png

Call log:
  - Expect "toHaveScreenshot(toolbar-loaded.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('.toolbar')
    - locator resolved to <article class="toolbar card" aria-labelledby="runtime-title">…</article>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - Timeout 5000ms exceeded.

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
        - status [ref=e42]: Selected snapshot.wav. Load Whisper / Export to continue.
      - list [ref=e43]:
        - listitem [ref=e44]:
          - generic [ref=e45]: Selected snapshot.wav. Load Whisper / Export to continue.
        - listitem [ref=e46]:
          - generic [ref=e47]: "Using local model: qwen3.6:latest."
        - listitem [ref=e48]:
          - generic [ref=e49]: Checking Ollama...
        - listitem [ref=e50]:
          - generic [ref=e51]: Ready. Load Whisper / Python, then choose a file.
        - listitem [ref=e52]:
          - generic [ref=e53]: Restoring saved session...
    - paragraph [ref=e54]: Local model inference runs in the browser. PHP only stores optional backups and serves the shell.
  - generic [ref=e55]:
    - strong [ref=e56]: WebGPU available
    - strong [ref=e57]: Waiting
    - strong [ref=e58]: Idle
    - strong [ref=e59]: Audio
    - generic [ref=e60]: snapshot.wav
  - generic [ref=e61]:
    - complementary [ref=e62]:
      - generic [ref=e63]:
        - heading "Source" [level=2] [ref=e64]
        - paragraph [ref=e65]: Drop media or record a clip, tune the model, and keep backup storage compact.
      - generic [ref=e66]:
        - button "Drop WAV, MP3, MP4, WEBM, or OGG here Click to choose a file from this device, or drag one in." [active] [ref=e67] [cursor=pointer]:
          - generic [ref=e68]: Drop WAV, MP3, MP4, WEBM, or OGG here
          - generic [ref=e69]: Click to choose a file from this device, or drag one in.
        - generic [ref=e70]:
          - button "Record Mic" [ref=e71] [cursor=pointer]
          - status [ref=e72]: Mic idle
      - paragraph [ref=e73]: Press Enter or Space to open a file picker, or drag and drop media here.
      - generic [ref=e74]:
        - generic [ref=e75]: Whisper model
        - combobox "Whisper model" [ref=e76]:
          - option "Tiny English" [selected]
          - option "Tiny multilingual"
          - option "Small multilingual"
        - paragraph [ref=e77]: Fastest option for English audio. Transcribe only.
      - generic [ref=e78]:
        - generic [ref=e79]:
          - text: Task
          - combobox "Task" [ref=e80]:
            - option "Transcribe" [selected]
            - option "Translate to English" [disabled]
        - generic [ref=e81]:
          - text: Language
          - combobox "Language" [ref=e82]:
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
      - generic [ref=e83]:
        - generic [ref=e84]:
          - checkbox "Cleanup punctuation" [checked] [ref=e85]
          - generic [ref=e86]: Cleanup punctuation
        - generic [ref=e87]:
          - checkbox "Show timestamps" [checked] [ref=e88]
          - generic [ref=e89]: Show timestamps
        - generic [ref=e90]:
          - checkbox "Speaker labels" [ref=e91]
          - generic [ref=e92]: Speaker labels
      - button "Dictate Mic" [ref=e94] [cursor=pointer]
      - generic [ref=e95]:
        - paragraph [ref=e96]: snapshot.wav · 31.3 KB
        - paragraph [ref=e97]:
          - text: "Source:"
          - strong [ref=e98]: browser audio decode
        - paragraph [ref=e99]:
          - text: "Runtime detail:"
          - strong [ref=e100]: Whisper is not loaded yet.
        - paragraph [ref=e101]:
          - text: "Host storage:"
          - strong [ref=e102]: Host backup off
    - generic [ref=e103]:
      - generic [ref=e104]:
        - generic [ref=e105]:
          - heading "Transcript" [level=2] [ref=e106]
          - paragraph [ref=e107]: Edit the transcript, then copy or export it when it’s ready.
        - button "Copy transcript" [disabled] [ref=e108]
      - generic [ref=e109]:
        - button "Download transcript.txt" [disabled] [ref=e110]
        - button "Download transcript.srt" [disabled] [ref=e111]
        - button "Download transcript.vtt" [disabled] [ref=e112]
        - button "Download transcript.zip" [disabled] [ref=e113]
      - region [ref=e114]:
        - generic [ref=e115]:
          - generic [ref=e116]:
            - heading "Local AI summary" [level=3] [ref=e117]
            - paragraph [ref=e118]: Auto mode checks Ollama first, then falls back to the browser WASM model cache when needed.
          - generic [ref=e119]:
            - button "Refresh local AI" [ref=e120] [cursor=pointer]
            - button "Summarize transcript" [disabled] [ref=e121]
        - generic [ref=e122]:
          - paragraph [ref=e123]:
            - strong [ref=e124]: Model ready
          - paragraph [ref=e125]: "Using local model: qwen3.6:latest."
        - generic [ref=e126]:
          - generic [ref=e127]: Runtime mode
          - combobox "Runtime mode" [ref=e128]:
            - option "Auto - Ollama first, browser fallback" [selected]
            - option "Local only - Ollama"
            - option "AI-Powered providers"
            - option "Browser only - WASM cache"
          - paragraph [ref=e129]: "Auto mode checks local Ollama first, then falls back to the browser WASM model if needed. Ollama endpoint: http://127.0.0.1:11434. Last successful runtime: Local Ollama."
        - generic [ref=e130]:
          - generic [ref=e131]: Local AI model
          - combobox "Local AI model" [ref=e132]:
            - option "qwen3.6:latest · qwen35moe · 36.0B · Q4_K_M · 22.3 GB" [selected]
            - option "qwen2.5-coder:latest · qwen2 · 7.6B · Q4_K_M · 4.36 GB"
            - option "llama3.2:latest · llama · 3.2B · Q4_K_M · 1.88 GB"
            - option "phi4:latest · phi3 · 14.7B · Q4_K_M · 8.43 GB"
            - option "qwen2.5-coder:7b · qwen2 · 7.6B · Q4_K_M · 4.36 GB"
            - option "Kimi K3 (cloud) (download)"
            - option "Kimi K2.7 Code (cloud) (download)"
            - option "Kimi K2.6 (cloud) (download)"
            - option "Kimi-VL-A3B-Thinking (download)"
            - option "Kimi K2.5 local (download)"
            - option "Kimi K2-Instruct (download)"
          - paragraph [ref=e133]: Selected qwen3.6:latest is installed. Auto-selected via the ranking heuristic. 5 installed models available.
        - group "Summary detail" [ref=e134]:
          - generic [ref=e136]:
            - generic [ref=e137] [cursor=pointer]:
              - radio "Brief" [ref=e138]
              - generic [ref=e139]: Brief
            - generic [ref=e140] [cursor=pointer]:
              - radio "Standard" [checked] [ref=e141]
              - generic [ref=e142]: Standard
            - generic [ref=e143] [cursor=pointer]:
              - radio "Detailed" [ref=e144]
              - generic [ref=e145]: Detailed
      - generic [ref=e146]:
        - generic [ref=e147]:
          - generic [ref=e148]: Plain transcript
          - generic [ref=e149]: No transcript yet.
        - generic [ref=e150]:
          - generic [ref=e151]: Editable transcript
          - textbox "Editable transcript" [ref=e152]:
            - /placeholder: Your transcript appears here. You can edit it before copying or exporting.
        - generic [ref=e153]:
          - generic [ref=e154]: Timestamped preview
          - generic [ref=e155]: No transcript yet.
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
> 58  |     await expect(page.locator('.toolbar')).toHaveScreenshot('toolbar-loaded.png', {
      |                                            ^ Error: expect(locator).toHaveScreenshot(expected) failed
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
  77  |     await page.locator('#summarizeButton').click();
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