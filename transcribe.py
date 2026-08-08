import argparse
import os
import sys
import time
from pathlib import Path

def configure_windows_runtime():
    """Make a bundled ffmpeg available when the app is frozen into an exe."""
    if sys.platform != "win32":
        return

    candidate_roots = []
    if getattr(sys, "frozen", False):
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            candidate_roots.append(Path(meipass))
        candidate_roots.append(Path(sys.executable).resolve().parent)

    candidate_roots.append(Path(__file__).resolve().parent)

    for root in candidate_roots:
        for ffmpeg_dir in (root / "ffmpeg", root):
            if (ffmpeg_dir / "ffmpeg.exe").is_file():
                existing_path = os.environ.get("PATH", "")
                os.environ["PATH"] = (
                    f"{ffmpeg_dir}{os.pathsep}{existing_path}"
                    if existing_path
                    else str(ffmpeg_dir)
                )
                return


class AudioTranscriber:
    def __init__(self, model_size="base"):
        """Initialize transcriber with specified Whisper model."""
        configure_windows_runtime()
        try:
            import whisper
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "OpenAI Whisper is not installed for this Python interpreter.\n"
                f'Install it with: "{sys.executable}" -m pip install -U openai-whisper'
            ) from exc

        print(f"Loading Whisper {model_size} model...")
        self.model = whisper.load_model(model_size)
        print("Model loaded successfully!\n")

    def transcribe_file(self, audio_path, language=None):
        """
        Transcribe a single audio file.

        Args:
            audio_path: Path to audio file
            language: Language code ('en', 'es', 'fr', etc.) or None for auto-detect
        """
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        print(f"Transcribing: {audio_path.name}")
        start_time = time.time()

        options = {"language": language} if language else {}
        result = self.model.transcribe(str(audio_path), **options)

        processing_time = time.time() - start_time
        print(f"✓ Completed in {processing_time:.1f} seconds")
        print(f"✓ Detected language: {result['language']}\n")

        return {
            "text": result["text"].strip(),
            "language": result["language"],
            "segments": result.get("segments", []),
            "processing_time": processing_time,
        }

    def save_transcription(self, result, output_path):
        """Save transcription to a text file."""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("=== Transcription Results ===\n")
            f.write(f"Language: {result['language']}\n")
            f.write(f"Processing Time: {result['processing_time']:.1f} seconds\n")
            f.write("=" * 40 + "\n\n")
            f.write(result["text"])

        print(f"✓ Transcription saved to: {output_path}")


def prompt_path(prompt_text, default=None, must_exist=False):
    """Prompt the user for a file path, with optional default and existence check."""
    while True:
        if default:
            user_input = input(f"{prompt_text} [{default}]: ").strip().strip('"')
            path_str = user_input or str(default)
        else:
            path_str = input(f"{prompt_text}: ").strip().strip('"')

        if not path_str:
            print("  Path cannot be empty. Please try again.")
            continue

        path = path_from_text(path_str)
        if must_exist and not path.is_file():
            print(f"  File not found: {path}")
            print("  Please enter a valid path (you can drag-and-drop the file here).")
            continue

        return path


def get_default_output(input_path):
    """Return default output path next to the input file."""
    return input_path.with_name(f"{input_path.stem}_transcript.txt")


def path_from_text(value):
    """Convert a typed, pasted, or drag-and-dropped path into a Path."""
    value = str(value).strip().strip('"')
    return Path(os.path.expandvars(value)).expanduser()


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Transcribe an audio file with OpenAI Whisper.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python transcribe.py
  python transcribe.py "C:\\audio\\interview.mp3"
  python transcribe.py -input "C:\\audio\\interview.mp3"
  python transcribe.py -input interview.mp3 -output "D:\\transcripts\\result.txt"
  python transcribe.py -input interview.mp3 -model medium -language en

You can also drag an audio file onto transcribe.lnk. The transcript defaults to
the input file's folder, and the program lets you enter a different output file.
        """,
    )
    parser.add_argument(
        "input_file",
        nargs="?",
        help="Audio file passed positionally (also used when a file is dropped on the shortcut)",
    )
    parser.add_argument(
        "-input",
        "-i",
        "--input",
        dest="input_path",
        help="Path to the audio file to transcribe",
    )
    parser.add_argument(
        "-output",
        "-o",
        "--output",
        dest="output_path",
        help="Path for the transcript text file (default: same folder as input, with _transcript.txt)",
    )
    parser.add_argument(
        "-model",
        "-m",
        "--model",
        dest="model_size",
        default="base",
        choices=["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"],
        help="Whisper model size (default: base)",
    )
    parser.add_argument(
        "-language",
        "-l",
        "--language",
        dest="language",
        default=None,
        help="Language code (e.g. en, es, fr). Leave blank for auto-detect",
    )
    parser.add_argument(
        "--pause",
        action="store_true",
        help="Wait for Enter before closing (used by transcribe.lnk)",
    )
    args = parser.parse_args(argv)

    if args.input_path and args.input_file:
        parser.error("provide the input file either positionally or with --input, not both")

    return args


def pause_before_close(message):
    """Keep a shortcut-launched console visible, without failing on redirected input."""
    try:
        input(message)
    except (EOFError, KeyboardInterrupt):
        pass


def run():
    """Run the program and honor the shortcut's request to keep its window open."""
    args = parse_args()
    try:
        return main_with_args(args)
    except (EOFError, KeyboardInterrupt):
        print("\nCancelled.")
        return 130
    finally:
        if args.pause:
            print()
            pause_before_close("Press Enter to close...")


def main_with_args(args):
    # Make Windows console handle Unicode better when double-clicked
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    print("=" * 50)
    print("  Whisper Audio Transcriber")
    print("=" * 50)
    print()

    # Resolve input path
    supplied_input = args.input_path or args.input_file
    if supplied_input:
        input_path = path_from_text(supplied_input)
        if not input_path.is_file():
            print(f"Error: Input file not found: {input_path}")
            input_path = prompt_path(
                "Enter path to the audio file (or drag-and-drop it here)",
                must_exist=True,
            )
    else:
        input_path = prompt_path(
            "Enter path to the audio file (or drag-and-drop it here)",
            must_exist=True,
        )

    # Resolve output path
    default_output = get_default_output(input_path)
    if args.output_path:
        output_path = path_from_text(args.output_path)
    else:
        print()
        use_default = input(
            f"Save transcript next to the audio file?\n"
            f"  Default: {default_output}\n"
            f"  Press Enter to accept, or type a different output file: "
        ).strip().strip('"')

        output_path = path_from_text(use_default) if use_default else default_output

    print()
    print(f"Input : {input_path}")
    print(f"Output: {output_path}")
    print(f"Model : {args.model_size}")
    print(f"Lang  : {args.language or 'auto-detect'}")
    print()

    try:
        transcriber = AudioTranscriber(model_size=args.model_size)
        result = transcriber.transcribe_file(input_path, language=args.language)
        transcriber.save_transcription(result, output_path)

        print()
        print("Preview (first 300 characters):")
        print("-" * 40)
        preview = result["text"]
        print(preview[:300] + ("..." if len(preview) > 300 else ""))
        print("-" * 40)
    except Exception as e:
        print(f"\nError: {e}")
        return 1

    return 0


def main():
    """Backward-compatible entry point for callers importing this module."""
    return run()


if __name__ == "__main__":
    sys.exit(run())
