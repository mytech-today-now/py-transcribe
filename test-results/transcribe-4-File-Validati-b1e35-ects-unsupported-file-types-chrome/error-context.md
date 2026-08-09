# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transcribe.spec.js >> 4. File Validation and Boundaries >> batch 1 >> rejects unsupported file types
- Location: playwright\tests\transcribe.spec.js:44:11

# Error details

```
Error: locator.click: Error: strict mode violation: getByRole('button', { name: /Browse files/i }) resolved to 2 elements:
    1) <div tabindex="0" id="dropZone" role="button" class="dropzone" aria-describedby="dropHelp" aria-label="File drop zone. Press Enter or Space to browse files, or drag a file here.">…</div> aka getByRole('button', { name: 'File drop zone. Press Enter' })
    2) <button class="ghost" type="button" id="browseButton">Browse files</button> aka getByRole('button', { name: 'Browse files', exact: true })

Call log:
  - waiting for getByRole('button', { name: /Browse files/i })

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
          - strong [ref=e22]: Not loaded
          - generic [ref=e23]: Pyodide and Whisper are idle.
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
          - generic [ref=e46]: Idle
        - generic [ref=e47]:
          - button "Load Python / Whisper" [ref=e48] [cursor=pointer]
          - button "Reset session" [ref=e49] [cursor=pointer]
        - generic "Runtime progress" [ref=e50]:
          - generic [ref=e52]:
            - generic [ref=e53]: Runtime load
            - strong [ref=e54]: 0%
          - generic [ref=e57]:
            - generic [ref=e58]: Transcription
            - strong [ref=e59]: Idle
      - article [ref=e61]:
        - generic [ref=e62]:
          - generic [ref=e63]:
            - paragraph [ref=e64]: 2. Upload
            - heading "Drop in audio or video" [level=2] [ref=e65]
            - paragraph [ref=e66]: Common formats are accepted, including MP3, WAV, M4A, FLAC, OGG, MP4, WebM, MOV, MKV, and AVI. The app validates size and format locally before any processing starts.
          - generic [ref=e67]: Waiting
        - button "File drop zone. Press Enter or Space to browse files, or drag a file here." [ref=e68] [cursor=pointer]:
          - generic [ref=e74]:
            - paragraph [ref=e75]: Drop a file here
            - paragraph [ref=e76]: or browse to pick media from your device.
          - button "Browse files" [ref=e78]
        - button "Choose File" [ref=e79]
        - paragraph [ref=e81]: No file selected yet.
      - article [ref=e82]:
        - generic [ref=e83]:
          - generic [ref=e84]:
            - paragraph [ref=e85]: 3. Configure
            - heading "Tune the model and export format" [level=2] [ref=e86]
            - paragraph [ref=e87]: The defaults are balanced for privacy and speed. Larger models are more accurate but require more time and memory. Subtitle output is generated from the Whisper timestamps.
          - generic [ref=e88]: Base
        - generic [ref=e89]:
          - generic [ref=e90]:
            - generic [ref=e91]: Model size
            - combobox "Model size Balanced default for most clips. Good speed with solid accuracy." [ref=e92]:
              - option "Tiny"
              - option "Base" [selected]
              - option "Small"
              - option "Medium"
              - option "Large v3"
              - option "Turbo"
            - generic [ref=e93]: Balanced default for most clips. Good speed with solid accuracy.
          - generic [ref=e94]:
            - generic [ref=e95]: Task
            - combobox "Task Translate forces English output when the model supports it." [ref=e96]:
              - option "Transcribe" [selected]
              - option "Translate to English"
            - generic [ref=e97]: Translate forces English output when the model supports it.
          - generic [ref=e98]:
            - generic [ref=e99]: Language
            - combobox "Language Leave it on auto for Whisper language detection." [ref=e100]:
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
            - generic [ref=e101]: Leave it on auto for Whisper language detection.
          - generic [ref=e102]:
            - generic [ref=e103]: Subtitle format
            - combobox "Subtitle format All exports stay local and are packaged into the ZIP." [ref=e104]:
              - option "TXT + SRT + VTT" [selected]
              - option "TXT + SRT"
              - option "TXT + VTT"
              - option "TXT only"
            - generic [ref=e105]: All exports stay local and are packaged into the ZIP.
          - generic [ref=e106]:
            - generic [ref=e107]: Chunk length
            - combobox "Chunk length Shorter chunks update progress more often; longer chunks use less overhead." [ref=e108]:
              - option "15 seconds"
              - option "30 seconds" [selected]
              - option "45 seconds"
              - option "60 seconds"
            - generic [ref=e109]: Shorter chunks update progress more often; longer chunks use less overhead.
          - generic [ref=e110]:
            - generic [ref=e111]: Stride overlap
            - combobox "Stride overlap Overlap helps preserve words that cross chunk boundaries." [ref=e112]:
              - option "No overlap"
              - option "2 seconds"
              - option "5 seconds" [selected]
              - option "8 seconds"
            - generic [ref=e113]: Overlap helps preserve words that cross chunk boundaries.
    - complementary [ref=e114]:
      - article [ref=e115]:
        - generic [ref=e117]:
          - paragraph [ref=e118]: 4. Transcribe
          - heading "Run Whisper locally" [level=2] [ref=e119]
          - paragraph [ref=e120]: The model and audio stay on-device. You get live logs, progress updates, and a cancel button for long runs.
        - generic [ref=e121]:
          - button "Transcribe media" [disabled] [ref=e122]
          - button "Cancel" [disabled] [ref=e123]
        - generic [ref=e124]:
          - generic [ref=e125]:
            - generic [ref=e126]: Duration
            - strong [ref=e127]: Unknown
          - generic [ref=e128]:
            - generic [ref=e129]: Estimated time
            - strong [ref=e130]: Waiting
          - generic [ref=e131]:
            - generic [ref=e132]: Source
            - strong [ref=e133]: None
        - generic "Process log" [ref=e134]:
          - generic [ref=e135]:
            - generic [ref=e136]: Log console
            - button "Clear" [ref=e137] [cursor=pointer]
          - log [ref=e138]:
            - generic [ref=e139]:
              - generic [ref=e140]: 03:24:38 PM
              - generic [ref=e141]: Ready. Load the runtime to start the local transcription pipeline.
            - generic [ref=e142]:
              - generic [ref=e143]: 03:24:38 PM
              - generic [ref=e144]: Service worker registered for offline caching.
            - generic [ref=e145]:
              - generic [ref=e146]: 03:24:38 PM
              - generic [ref=e147]: Persistent storage granted for cached models and runtime files.
      - article [ref=e148]:
        - generic [ref=e149]:
          - generic [ref=e150]:
            - paragraph [ref=e151]: 5. Download
            - heading "Save the artifacts" [level=2] [ref=e152]
            - paragraph [ref=e153]: After transcription finishes, you can download each artifact separately or grab one ZIP that always includes the source media, transcript, and subtitles.
          - generic [ref=e154]: Waiting
        - generic [ref=e155]:
          - button "Download TXT" [disabled] [ref=e156]
          - button "Download SRT" [disabled] [ref=e157]
          - button "Download VTT" [disabled] [ref=e158]
          - button "Download original" [disabled] [ref=e159]
          - button "Download cleaned WAV" [disabled] [ref=e160]
          - button "Download ZIP" [disabled] [ref=e161]
        - tablist "Transcript views" [ref=e162]:
          - button "Text" [ref=e163] [cursor=pointer]
          - button "SRT" [ref=e164] [cursor=pointer]
          - button "VTT" [ref=e165] [cursor=pointer]
        - generic [ref=e166]: No transcript yet.
  - status [ref=e167]: Ready. Load the runtime, then choose a file.
```

# Test source

```ts
  465 | 
  466 |       async writeFile(name, data) {
  467 |         const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  468 |         this.writeCalls.push({ name, length: bytes.length });
  469 |         this.files.set(name, bytes);
  470 |       }
  471 | 
  472 |       async exec(args) {
  473 |         this.execCalls += 1;
  474 |         this.#emit('progress', { progress: 0.5 });
  475 |         const waveform = new Float32Array([0, 0.18, 0.32, 0.18, 0]);
  476 |         this.files.set('audio.f32', new Uint8Array(waveform.buffer.slice(0)));
  477 |         return 0;
  478 |       }
  479 | 
  480 |       async readFile(name) {
  481 |         this.readCalls.push(name);
  482 |         return this.files.get(name) || new Uint8Array();
  483 |       }
  484 | 
  485 |       terminate() {
  486 |         this.terminated = true;
  487 |       }
  488 |     }
  489 | 
  490 |     function defineNavigatorProperty(name, value) {
  491 |       try {
  492 |         Object.defineProperty(navigator, name, {
  493 |           value,
  494 |           configurable: true
  495 |         });
  496 |       } catch {
  497 |         try {
  498 |           navigator[name] = value;
  499 |         } catch {
  500 |           // Ignore browser-specific assignment failures.
  501 |         }
  502 |       }
  503 |     }
  504 | 
  505 |     defineNavigatorProperty('gpu', undefined);
  506 | 
  507 |     const serviceWorker = navigator.serviceWorker || {};
  508 |     serviceWorker.register = async (url, options) => {
  509 |       serviceWorkerCalls.push({
  510 |         url: String(url),
  511 |         options: options || {}
  512 |       });
  513 |       return {
  514 |         update: async () => {},
  515 |         scope: location.origin + '/'
  516 |       };
  517 |     };
  518 |     defineNavigatorProperty('serviceWorker', serviceWorker);
  519 | 
  520 |     const storage = navigator.storage || {};
  521 |     storage.persist = async () => {
  522 |       storagePersistCalls.push(Date.now());
  523 |       return true;
  524 |     };
  525 |     defineNavigatorProperty('storage', storage);
  526 | 
  527 |     Object.defineProperty(window, '__pwTranscribeHarness', {
  528 |       value: harness,
  529 |       configurable: true
  530 |     });
  531 | 
  532 |     Object.defineProperty(window, '__PY_TRANSCRIBE_TEST_HOOKS__', {
  533 |       value: {
  534 |         softSizeWarningBytes: settings.softSizeWarningBytes,
  535 |         hardSizeLimitBytes: settings.hardSizeLimitBytes,
  536 |         maxLogLines: settings.maxLogLines,
  537 |         forceLegacyFileInputClick: settings.forceLegacyFileInputClick,
  538 |         createWorker: (url, options) => new FakeWorker(url, options),
  539 |         createFFmpeg: () => new FakeFFmpeg(),
  540 |         fetchFile: async (file) => new Uint8Array(await file.arrayBuffer()),
  541 |         toBlobURL: async (url) => String(url)
  542 |       },
  543 |       configurable: true
  544 |     });
  545 |   }, hooks);
  546 | }
  547 | 
  548 | export function mergeHooks(testHooks = {}) {
  549 |   const workerMode = {
  550 |     ...DEFAULT_TEST_HOOKS.workerMode,
  551 |     ...(testHooks.workerMode || {})
  552 |   };
  553 | 
  554 |   return {
  555 |     ...DEFAULT_TEST_HOOKS,
  556 |     ...testHooks,
  557 |     workerMode
  558 |   };
  559 | }
  560 | 
  561 | export async function selectFileViaButton(page, fixture) {
  562 |   const button = page.getByRole('button', { name: /Browse files/i });
  563 |   const [chooser] = await Promise.all([
  564 |     page.waitForEvent('filechooser'),
> 565 |     button.click()
      |            ^ Error: locator.click: Error: strict mode violation: getByRole('button', { name: /Browse files/i }) resolved to 2 elements:
  566 |   ]);
  567 | 
  568 |   await chooser.setFiles([fixture]);
  569 | }
  570 | 
  571 | export async function focusDropZoneAndOpenChooser(page, fixture) {
  572 |   const dropZone = page.locator('#dropZone');
  573 |   await dropZone.focus();
  574 |   const [chooser] = await Promise.all([
  575 |     page.waitForEvent('filechooser'),
  576 |     dropZone.press('Enter')
  577 |   ]);
  578 | 
  579 |   await chooser.setFiles([fixture]);
  580 | }
  581 | 
  582 | export async function dropFiles(page, selector, fixtureList) {
  583 |   const payload = fixtureList.map((fixture) => ({
  584 |     name: fixture.name,
  585 |     mimeType: fixture.mimeType,
  586 |     lastModified: fixture.lastModified,
  587 |     base64: Buffer.from(fixture.buffer).toString('base64')
  588 |   }));
  589 | 
  590 |   await page.locator(selector).evaluate((element, files) => {
  591 |     const dataTransfer = new DataTransfer();
  592 | 
  593 |     for (const file of files) {
  594 |       const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
  595 |       const blob = new Blob([bytes], { type: file.mimeType });
  596 |       dataTransfer.items.add(new File([blob], file.name, {
  597 |         type: file.mimeType,
  598 |         lastModified: file.lastModified
  599 |       }));
  600 |     }
  601 | 
  602 |     element.dispatchEvent(new DragEvent('dragenter', {
  603 |       bubbles: true,
  604 |       cancelable: true,
  605 |       dataTransfer
  606 |     }));
  607 |     element.dispatchEvent(new DragEvent('dragover', {
  608 |       bubbles: true,
  609 |       cancelable: true,
  610 |       dataTransfer
  611 |     }));
  612 |     element.dispatchEvent(new DragEvent('drop', {
  613 |       bubbles: true,
  614 |       cancelable: true,
  615 |       dataTransfer
  616 |     }));
  617 |   }, payload);
  618 | }
  619 | 
  620 | export async function dragOverFiles(page, selector, fixtureList) {
  621 |   const payload = fixtureList.map((fixture) => ({
  622 |     name: fixture.name,
  623 |     mimeType: fixture.mimeType,
  624 |     lastModified: fixture.lastModified,
  625 |     base64: Buffer.from(fixture.buffer).toString('base64')
  626 |   }));
  627 | 
  628 |   await page.locator(selector).evaluate((element, files) => {
  629 |     const dataTransfer = new DataTransfer();
  630 | 
  631 |     for (const file of files) {
  632 |       const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
  633 |       const blob = new Blob([bytes], { type: file.mimeType });
  634 |       dataTransfer.items.add(new File([blob], file.name, {
  635 |         type: file.mimeType,
  636 |         lastModified: file.lastModified
  637 |       }));
  638 |     }
  639 | 
  640 |     element.dispatchEvent(new DragEvent('dragenter', {
  641 |       bubbles: true,
  642 |       cancelable: true,
  643 |       dataTransfer
  644 |     }));
  645 |     element.dispatchEvent(new DragEvent('dragover', {
  646 |       bubbles: true,
  647 |       cancelable: true,
  648 |       dataTransfer
  649 |     }));
  650 |   }, payload);
  651 | }
  652 | 
  653 | export async function loadRuntime(page) {
  654 |   const button = page.getByRole('button', { name: /Load Python \/ Whisper/i });
  655 |   await button.click();
  656 |   await expect(page.locator('#status')).toContainText(/Pyodide and .* Whisper are ready\./i);
  657 |   await expect(page.locator('#runtimeBadge')).toHaveText('Loaded');
  658 | }
  659 | 
  660 | export async function transcribe(page) {
  661 |   const button = page.getByRole('button', { name: /Transcribe media/i });
  662 |   await expect(button).toBeEnabled();
  663 |   await button.click();
  664 |   await expect(page.locator('#downloadBadge')).toHaveText('Ready');
  665 |   await expect(page.locator('#status')).toContainText(/ready for download\./i);
```