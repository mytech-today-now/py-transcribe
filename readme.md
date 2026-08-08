# py-transcribe

Local audio transcription with OpenAI Whisper.

Transcribe audio files on your own machine. Your audio stays local, there are no API keys to manage, and you can use the project either from Python or with the bundled Windows executable.

## Highlights

- Runs locally with Whisper
- Supports multiple model sizes: `tiny`, `base`, `small`, `medium`, `large`, `large-v2`, and `large-v3`
- Auto-detects language, or you can force a specific one
- Works in interactive mode or from the command line
- Supports drag-and-drop on Windows through the included shortcut
- Includes a pre-built Windows `.exe` for users who do not want to install Python

## Requirements

- Python 3.8 or newer
- `openai-whisper`
- `ffmpeg` available on your `PATH`

Install Whisper with:

```powershell
python -m pip install -U openai-whisper
```

Note: Whisper downloads model files the first time you use a model, so the initial run may need internet access. After that, transcription runs locally.

## Quick Start

Run the script with no arguments to use the interactive prompts:

```powershell
python transcribe.py
```

You will be asked for the audio file and the output location.

## Command-Line Usage

```powershell
python transcribe.py "C:\audio\interview.mp3"
python transcribe.py --input "C:\audio\interview.mp3" --output "C:\transcripts\interview.txt"
python transcribe.py --input "C:\audio\meeting.m4a" --model medium --language en
```

You can provide the input file either positionally or with `--input`, but not both.

If you omit `--output`, the app suggests a default transcript path next to the audio file and lets you accept it or type a different one.

## Options

| Flag | Description | Default |
| --- | --- | --- |
| `input_file` | Optional positional audio file | Prompted |
| `-i`, `--input` | Path to the audio file | Prompted |
| `-o`, `--output` | Path for the transcript text file | `<input>_transcript.txt` |
| `-m`, `--model` | Whisper model size | `base` |
| `-l`, `--language` | Language code such as `en`, `es`, or `fr` | Auto-detect |
| `--pause` | Wait for Enter before closing the console | Off |

## Windows

For a ready-to-run Windows build:

1. Download the ZIP from `https://mytech.today/tools/downloads/py-transcribe.zip`
2. Extract it
3. Run `transcribe.exe` or use `transcribe.lnk`

The shortcut is useful for drag-and-drop. If you drop an audio file on it, the console stays open after the transcription finishes.

See `windows.md` for the lightweight download landing page used by the packaged build.

## Build From Source

If you want to build the Windows executable yourself:

```powershell
.\build_windows.ps1
```

Build requirements:

- Python 3.12
- PyInstaller
- `ffmpeg` on your `PATH`

The script creates:

- `dist\transcribe.exe`
- `dist\transcribe.lnk`

## Output

Each transcript is saved as plain text and includes:

- Detected language
- Processing time
- The transcription text itself

## Troubleshooting

- If you see an `ffmpeg` error, make sure `ffmpeg.exe` is installed and available on your `PATH`.
- If model loading is slow the first time, Whisper is downloading model files.
- Smaller models are faster; larger models are slower but usually more accurate.

## License

This project is provided as-is.
OpenAI Whisper is released under the MIT License.
