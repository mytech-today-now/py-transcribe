# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transcribe.spec.js >> 5. Runtime Loading and Model State >> loads the runtime and creates both workers
- Location: playwright\tests\transcribe.spec.js:226:3

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

Expected: ArrayContaining ["whisper", "python"]
Received: ["unknown", "unknown"]
```

# Page snapshot

```yaml
- main [ref=e2]:
  - generic [ref=e3]:
    - generic "Py Transcribe" [ref=e4]:
      - generic [ref=e5]: PT
      - generic [ref=e6]:
        - strong [ref=e7]: Py Transcribe
        - generic [ref=e8]: Whisper in the browser
    - navigation "Primary" [ref=e9]:
      - link "Workspace" [ref=e10] [cursor=pointer]:
        - /url: "#workspace"
      - link "Downloads" [ref=e11] [cursor=pointer]:
        - /url: "#downloads"
      - link "Guide" [ref=e12] [cursor=pointer]:
        - /url: ./guide.html
  - region [ref=e13]:
    - generic [ref=e14]:
      - paragraph [ref=e15]: Browser-only transcription
      - heading "Drop media, load Whisper, and export everything on-device." [level=1] [ref=e17]
      - paragraph [ref=e18]: Load the runtime once, then transcribe audio or video locally and download TXT, SRT, VTT, WAV, or ZIP files without a backend.
      - generic "Quick status" [ref=e19]:
        - article [ref=e20]:
          - generic [ref=e21]: Runtime
          - strong [ref=e22]: Base ready
          - generic [ref=e23]: Base Whisper is ready on wasm.
        - article [ref=e24]:
          - generic [ref=e25]: Device
          - strong [ref=e26]: WASM
          - generic [ref=e27]: The browser will stay on WASM / CPU and remain fully local.
        - article [ref=e28]:
          - generic [ref=e29]: File
          - strong [ref=e30]: No file
          - generic [ref=e31]: Drop an audio or video file to begin.
        - article [ref=e32]:
          - generic [ref=e33]: Outputs
          - strong [ref=e34]: Waiting
          - generic [ref=e35]: TXT, SRT, VTT, and ZIP are generated client-side.
      - paragraph [ref=e36]:
        - strong [ref=e37]: "Privacy:"
        - text: nothing is uploaded. Whisper falls back to WASM locally.
  - region [ref=e38]:
    - generic [ref=e39]:
      - article [ref=e40]:
        - generic [ref=e41]:
          - generic [ref=e42]:
            - paragraph [ref=e43]: 1. Load runtime
            - heading "Start the browser engines" [level=2] [ref=e44]
            - paragraph [ref=e45]: This loads Pyodide in a module worker and Whisper in a separate inference worker. The first load downloads model files, then the browser cache keeps them warm for future sessions.
          - generic [ref=e46]: Loaded
        - generic [ref=e47]:
          - button "Reload Python / Whisper" [ref=e48] [cursor=pointer]
          - button "Reset session" [ref=e49] [cursor=pointer]
        - generic "Runtime progress" [ref=e50]:
          - generic [ref=e52]:
            - generic [ref=e53]: Runtime load
            - strong [ref=e54]: 100%
          - generic [ref=e58]:
            - generic [ref=e59]: Transcription
            - strong [ref=e60]: Idle
      - article [ref=e62]:
        - generic [ref=e63]:
          - generic [ref=e64]:
            - paragraph [ref=e65]: 2. Upload
            - heading "Drop in audio or video" [level=2] [ref=e66]
            - paragraph [ref=e67]: Common formats are accepted, including MP3, WAV, M4A, FLAC, OGG, MP4, WebM, MOV, MKV, and AVI. The app validates size and format locally before any processing starts.
          - generic [ref=e68]: Waiting
        - button "File drop zone. Press Enter or Space to browse files, or drag a file here." [ref=e69] [cursor=pointer]:
          - generic [ref=e75]:
            - paragraph [ref=e76]: Drop a file here
            - paragraph [ref=e77]: or browse to pick media from your device.
          - button "Browse files" [ref=e79]
        - button "Choose File" [ref=e80]
        - paragraph [ref=e82]: No file selected yet.
      - article [ref=e83]:
        - generic [ref=e84]:
          - generic [ref=e85]:
            - paragraph [ref=e86]: 3. Configure
            - heading "Tune the model and export format" [level=2] [ref=e87]
            - paragraph [ref=e88]: The defaults are balanced for privacy and speed. Larger models are more accurate but require more time and memory. Subtitle output is generated from the Whisper timestamps.
          - generic [ref=e89]: Base
        - generic [ref=e90]:
          - generic [ref=e91]:
            - generic [ref=e92]: Model size
            - combobox "Model size Balanced default for most clips. Good speed with solid accuracy." [ref=e93]:
              - option "Tiny"
              - option "Base" [selected]
              - option "Small"
              - option "Medium"
              - option "Large v3"
              - option "Turbo"
            - generic [ref=e94]: Balanced default for most clips. Good speed with solid accuracy.
          - generic [ref=e95]:
            - generic [ref=e96]: Task
            - combobox "Task Translate forces English output when the model supports it." [ref=e97]:
              - option "Transcribe" [selected]
              - option "Translate to English"
            - generic [ref=e98]: Translate forces English output when the model supports it.
          - generic [ref=e99]:
            - generic [ref=e100]: Language
            - combobox "Language Leave it on auto for Whisper language detection." [ref=e101]:
              - option "Auto detect" [selected]
              - option "English"
              - option "Spanish"
              - option "French"
              - option "German"
              - option "Italian"
              - option "Portuguese"
              - option "Japanese"
              - option "Korean"
              - option "Chinese"
              - option "Arabic"
            - generic [ref=e102]: Leave it on auto for Whisper language detection.
          - generic [ref=e103]:
            - generic [ref=e104]: Subtitle format
            - combobox "Subtitle format All exports stay local and are packaged into the ZIP." [ref=e105]:
              - option "TXT + SRT + VTT" [selected]
              - option "TXT + SRT"
              - option "TXT + VTT"
              - option "TXT only"
            - generic [ref=e106]: All exports stay local and are packaged into the ZIP.
          - generic [ref=e107]:
            - generic [ref=e108]: Chunk length
            - combobox "Chunk length Shorter chunks update progress more often; longer chunks use less overhead." [ref=e109]:
              - option "15 seconds"
              - option "30 seconds" [selected]
              - option "45 seconds"
              - option "60 seconds"
            - generic [ref=e110]: Shorter chunks update progress more often; longer chunks use less overhead.
          - generic [ref=e111]:
            - generic [ref=e112]: Stride overlap
            - combobox "Stride overlap Overlap helps preserve words that cross chunk boundaries." [ref=e113]:
              - option "No overlap"
              - option "2 seconds"
              - option "5 seconds" [selected]
              - option "8 seconds"
            - generic [ref=e114]: Overlap helps preserve words that cross chunk boundaries.
    - complementary [ref=e115]:
      - article [ref=e116]:
        - generic [ref=e118]:
          - paragraph [ref=e119]: 4. Transcribe
          - heading "Run Whisper locally" [level=2] [ref=e120]
          - paragraph [ref=e121]: The model and audio stay on-device. You get live logs, progress updates, and a cancel button for long runs.
        - generic [ref=e122]:
          - button "Transcribe media" [disabled] [ref=e123]
          - button "Cancel" [disabled] [ref=e124]
        - generic [ref=e125]:
          - generic [ref=e126]:
            - generic [ref=e127]: Duration
            - strong [ref=e128]: Unknown
          - generic [ref=e129]:
            - generic [ref=e130]: Estimated time
            - strong [ref=e131]: Waiting
          - generic [ref=e132]:
            - generic [ref=e133]: Source
            - strong [ref=e134]: None
        - generic "Process log" [ref=e135]:
          - generic [ref=e136]:
            - generic [ref=e137]: Log console
            - button "Clear" [ref=e138] [cursor=pointer]
          - log [ref=e139]:
            - generic [ref=e140]:
              - generic [ref=e141]: 03:24:40 PM
              - generic [ref=e142]: Ready. Load the runtime to start the local transcription pipeline.
            - generic [ref=e143]:
              - generic [ref=e144]: 03:24:40 PM
              - generic [ref=e145]: Service worker registered for offline caching.
            - generic [ref=e146]:
              - generic [ref=e147]: 03:24:40 PM
              - generic [ref=e148]: Persistent storage granted for cached models and runtime files.
            - generic [ref=e149]:
              - generic [ref=e150]: 03:24:40 PM
              - generic [ref=e151]: Loading runtime with Base on wasm.
            - generic [ref=e152]:
              - generic [ref=e153]: 03:24:40 PM
              - generic [ref=e154]: Preparing Python formatter.
            - generic [ref=e155]:
              - generic [ref=e156]: 03:24:40 PM
              - generic [ref=e157]: Preparing Python formatter.
            - generic [ref=e158]:
              - generic [ref=e159]: 03:24:40 PM
              - generic [ref=e160]: "Runtime ready: Base on wasm."
      - article [ref=e161]:
        - generic [ref=e162]:
          - generic [ref=e163]:
            - paragraph [ref=e164]: 5. Download
            - heading "Save the artifacts" [level=2] [ref=e165]
            - paragraph [ref=e166]: After transcription finishes, you can download each artifact separately or grab one ZIP that always includes the source media, transcript, and subtitles.
          - generic [ref=e167]: Waiting
        - generic [ref=e168]:
          - button "Download TXT" [disabled] [ref=e169]
          - button "Download SRT" [disabled] [ref=e170]
          - button "Download VTT" [disabled] [ref=e171]
          - button "Download original" [disabled] [ref=e172]
          - button "Download cleaned WAV" [disabled] [ref=e173]
          - button "Download ZIP" [disabled] [ref=e174]
        - tablist "Transcript views" [ref=e175]:
          - button "Text" [ref=e176] [cursor=pointer]
          - button "SRT" [ref=e177] [cursor=pointer]
          - button "VTT" [ref=e178] [cursor=pointer]
        - generic [ref=e179]: No transcript yet.
  - status [ref=e180]: Pyodide and Base Whisper are ready.
```

# Test source

```ts
  136 |     await dropZone.focus();
  137 |     const [chooser] = await Promise.all([
  138 |       page.waitForEvent('filechooser'),
  139 |       page.keyboard.press('Space')
  140 |     ]);
  141 |     await chooser.setFiles([WAV_AUDIO]);
  142 | 
  143 |     await expect(page.locator('#status')).toContainText(/Selected sample\.wav/i);
  144 |     await expect(page.locator('#fileSummary')).toContainText(/sample\.wav/i);
  145 |   });
  146 | });
  147 | 
  148 | test.describe('3. Drag-and-drop Upload', () => {
  149 |   test.describe.configure({ timeout: 120000 });
  150 | 
  151 |   test('highlights the drop zone while an audio file is dragged over it', async ({ page }) => {
  152 |     await bootApp(page);
  153 | 
  154 |     await dragOverFiles(page, '#dropZone', [WAV_AUDIO]);
  155 |     await expect(page.locator('#dropZone')).toHaveClass(/is-dragover/);
  156 |     await expect(page.locator('#dropZone')).toHaveScreenshot('dropzone-dragover.png');
  157 | 
  158 |     await dropFiles(page, '#dropZone', [WAV_AUDIO]);
  159 |     await expect(page.locator('#status')).toContainText(/Selected sample\.wav/i);
  160 |     await expect(page.locator('#dropZone')).not.toHaveClass(/is-dragover/);
  161 |   });
  162 | 
  163 |   test('drops a video file and marks it as video media', async ({ page }) => {
  164 |     await bootApp(page);
  165 | 
  166 |     await dropFiles(page, '#dropZone', [MP4_VIDEO]);
  167 | 
  168 |     await expect(page.locator('#fileBadge')).toHaveText('Video');
  169 |     await expect(page.locator('#fileSummary')).toContainText(/FFmpeg extraction/i);
  170 |     await expect(page.locator('#status')).toContainText(/Selected sample\.mp4/i);
  171 |   });
  172 | 
  173 |   test('keeps the first file when multiple files are dropped', async ({ page }) => {
  174 |     await bootApp(page);
  175 | 
  176 |     await dropFiles(page, '#dropZone', [WAV_AUDIO, MP4_VIDEO]);
  177 | 
  178 |     await expect(page.locator('#fileSummary')).toContainText(/sample\.wav/i);
  179 |     await expect(page.locator('#logConsole')).toContainText(/Multiple files were dropped/i);
  180 |   });
  181 | });
  182 | 
  183 | matrixDescribe('4. File Validation and Boundaries', [
  184 |   {
  185 |     title: 'rejects zero-length files',
  186 |     run: async (page) => {
  187 |       await bootApp(page);
  188 |       await selectFileViaButton(page, EMPTY_AUDIO);
  189 |       await expect(page.locator('#status')).toContainText(/empty/i);
  190 |       await expect(page.locator('#fileSummary')).toContainText(/No file selected yet\./i);
  191 |     }
  192 |   },
  193 |   {
  194 |     title: 'rejects unsupported file types',
  195 |     run: async (page) => {
  196 |       await bootApp(page);
  197 |       await selectFileViaButton(page, UNSUPPORTED_FILE);
  198 |       await expect(page.locator('#status')).toContainText(/Unsupported file type/i);
  199 |       await expect(page.locator('#fileSummary')).toContainText(/No file selected yet\./i);
  200 |     }
  201 |   },
  202 |   {
  203 |     title: 'warns on large files that are still under the hard limit',
  204 |     run: async (page) => {
  205 |       await bootApp(page);
  206 |       await selectFileViaButton(page, LARGE_WARNING_AUDIO);
  207 |       await expect(page.locator('#status')).toContainText(/Selected warn\.wav/i);
  208 |       await expect(page.locator('#logConsole')).toContainText(/large file/i);
  209 |       await expect(page.locator('#fileBadge')).toHaveText('Audio');
  210 |     }
  211 |   },
  212 |   {
  213 |     title: 'rejects files over the configured hard limit',
  214 |     run: async (page) => {
  215 |       await bootApp(page);
  216 |       await selectFileViaButton(page, LARGE_REJECT_AUDIO);
  217 |       await expect(page.locator('#status')).toContainText(/too large/i);
  218 |       await expect(page.locator('#fileSummary')).toContainText(/No file selected yet\./i);
  219 |     }
  220 |   }
  221 | ], 2);
  222 | 
  223 | test.describe('5. Runtime Loading and Model State', () => {
  224 |   test.describe.configure({ timeout: 120000 });
  225 | 
  226 |   test('loads the runtime and creates both workers', async ({ page }) => {
  227 |     await bootApp(page);
  228 |     await loadRuntime(page);
  229 | 
  230 |     await expect(page.locator('#runtimeState')).toHaveText('Base ready');
  231 |     await expect(page.locator('#runtimeBadge')).toHaveText('Loaded');
  232 |     await expect(page.locator('#runtimeDetail')).toContainText(/Base Whisper is ready on wasm/i);
  233 | 
  234 |     const snapshot = await readHarnessSnapshot(page);
  235 |     expect(snapshot.instances).toHaveLength(2);
> 236 |     expect(snapshot.instances.map((instance) => instance.kind)).toEqual(expect.arrayContaining(['whisper', 'python']));
      |                                                                 ^ Error: expect(received).toEqual(expected) // deep equality
  237 |     expect(snapshot.instances[0].requests[0]).toMatchObject({
  238 |       type: 'init',
  239 |       modelId: 'onnx-community/whisper-base',
  240 |       device: 'wasm'
  241 |     });
  242 |     expect(snapshot.serviceWorkerCalls).toHaveLength(1);
  243 |     expect(snapshot.storagePersistCalls).toBe(1);
  244 |   });
  245 | 
  246 |   test('ignores rapid duplicate clicks on the load button', async ({ page }) => {
  247 |     await bootApp(page);
  248 | 
  249 |     await page.evaluate(() => {
  250 |       const button = document.getElementById('loadRuntimeButton');
  251 |       button.click();
  252 |       button.click();
  253 |       button.click();
  254 |     });
  255 | 
  256 |     await expect(page.locator('#status')).toContainText(/Pyodide and Base Whisper are ready\./i);
  257 | 
  258 |     const snapshot = await readHarnessSnapshot(page);
  259 |     expect(snapshot.instances).toHaveLength(2);
  260 |   });
  261 | 
  262 |   test('changing the model invalidates the loaded runtime', async ({ page }) => {
  263 |     await bootApp(page);
  264 |     await loadRuntime(page);
  265 | 
  266 |     await page.selectOption('#modelSelect', 'small');
  267 | 
  268 |     await expect(page.locator('#runtimeState')).toHaveText('Model change pending');
  269 |     await expect(page.locator('#runtimeBadge')).toHaveText('Idle');
  270 |     await expect(page.locator('#status')).toContainText(/Model changed\. Load Python \/ Whisper again/i);
  271 |     await expect(page.getByRole('button', { name: /Transcribe media/i })).toBeDisabled();
  272 |   });
  273 | });
  274 | 
  275 | test.describe('6. Runtime Failure and Retry', () => {
  276 |   test.describe.configure({ timeout: 120000 });
  277 | 
  278 |   test('surfaces a Whisper bootstrap failure', async ({ page }) => {
  279 |     await bootApp(page, {
  280 |       workerMode: {
  281 |         whisperInitMode: 'error'
  282 |       }
  283 |     });
  284 | 
  285 |     await page.getByRole('button', { name: /Load Python \/ Whisper/i }).click();
  286 | 
  287 |     await expect(page.locator('#status')).toContainText(/Failed to load runtime: Whisper worker bootstrap failed\./i);
  288 |     await expect(page.locator('#runtimeBadge')).toHaveText('Idle');
  289 | 
  290 |     const snapshot = await readHarnessSnapshot(page);
  291 |     expect(snapshot.instances).toHaveLength(2);
  292 |     expect(snapshot.instances.every((instance) => instance.terminated)).toBe(true);
  293 |   });
  294 | 
  295 |   test('surfaces a Python bootstrap failure', async ({ page }) => {
  296 |     await bootApp(page, {
  297 |       workerMode: {
  298 |         pythonInitMode: 'error'
  299 |       }
  300 |     });
  301 | 
  302 |     await page.getByRole('button', { name: /Load Python \/ Whisper/i }).click();
  303 | 
  304 |     await expect(page.locator('#status')).toContainText(/Failed to load runtime: Python worker bootstrap failed\./i);
  305 |     await expect(page.locator('#runtimeBadge')).toHaveText('Idle');
  306 | 
  307 |     const snapshot = await readHarnessSnapshot(page);
  308 |     expect(snapshot.instances).toHaveLength(2);
  309 |     expect(snapshot.instances.every((instance) => instance.terminated)).toBe(true);
  310 |   });
  311 | 
  312 |   test('retries cleanly after a failure', async ({ page }) => {
  313 |     await bootApp(page, {
  314 |       workerMode: {
  315 |         whisperInitMode: 'error'
  316 |       }
  317 |     });
  318 | 
  319 |     await page.getByRole('button', { name: /Load Python \/ Whisper/i }).click();
  320 |     await expect(page.locator('#status')).toContainText(/Failed to load runtime/i);
  321 | 
  322 |     await page.evaluate(() => {
  323 |       window.__pwTranscribeHarness.setWorkerMode({
  324 |         whisperInitMode: 'ready',
  325 |         pythonInitMode: 'ready'
  326 |       });
  327 |     });
  328 | 
  329 |     await loadRuntime(page);
  330 | 
  331 |     const snapshot = await readHarnessSnapshot(page);
  332 |     expect(snapshot.instances).toHaveLength(4);
  333 |     expect(snapshot.instances.slice(0, 2).every((instance) => instance.terminated)).toBe(true);
  334 |     expect(snapshot.instances.slice(2).every((instance) => !instance.terminated)).toBe(true);
  335 |   });
  336 | });
```