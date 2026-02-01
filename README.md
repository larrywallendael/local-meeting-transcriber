# LocalScribe

A local-first Windows desktop application that transcribes meeting recordings entirely on your computer, without any cloud processing.

## Features

- **100% Local Processing**: All transcription happens on your computer - no cloud, no network calls
- **Offline Operation**: Works completely offline - no internet required
- **Job Queue**: Add multiple files and process them sequentially
- **Progress Tracking**: Real-time progress updates with estimated time remaining
- **Job History**: View completed, cancelled, and failed jobs
- **Incremental Output**: Partial transcripts are preserved even if a job is cancelled or crashes
- **Installer**: Standard Windows installer with clean uninstall

## Requirements

- Windows 10 or later
- x64 architecture

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Download whisper.cpp Binary

Download the pre-built Windows x64 whisper.cpp executable and place it in `resources/whisper/`:

- Download from: https://github.com/ggerganov/whisper.cpp/releases
- Extract `whisper.exe` (or `whisper-cli.exe`) to `resources/whisper/whisper.exe`

### 3. Download FFmpeg (required for M4A/MP3/etc)

Whisper.cpp reads WAV inputs. For M4A/MP3/OGG/etc, we convert to WAV using FFmpeg.

- Download a static Windows build from: https://www.gyan.dev/ffmpeg/builds/
- Extract the archive
- Copy `bin/ffmpeg.exe` to `resources/ffmpeg/ffmpeg.exe`

### 4. Download Whisper Model

Download the Whisper medium model in GGUF format and place it in `resources/models/`:

- Model: `ggml-medium.bin` or `ggml-medium.gguf`
- Download from: https://huggingface.co/ggerganov/whisper.cpp
- Place the model file as `resources/models/ggml-medium.bin`

### 5. Development

```bash
# Run in development mode
npm run dev
```

### 6. Build Installer (NSIS)

```bash
# Build the application
npm run build

# Package as installer .exe
npm run package:win
```

The installer executable will be created in `dist-electron/`.

## Release Checklist (Short)

1. Update `CHANGELOG.md` with the new version notes.
2. Run `npm run release:v1`.
3. Find the installer in `release/1.0.0/` with a date-stamped filename.

## Project Structure

```
local-meeting-transcriber/
├── src/
│   ├── main/              # Electron main process
│   ├── renderer/          # React UI
│   └── shared/            # Shared types
├── resources/
│   ├── whisper/           # whisper.cpp binaries
│   └── models/            # Whisper model files
├── dist/                  # Build output
└── dist-electron/         # Packaged executable
```

## Application Data

The application stores data in:
- `%APPDATA%/LocalScribe/`
  - `jobs.json` - Job queue and history
  - `transcripts/` - Output transcript files
  - `audio/` - Copied audio files
  - `logs/` - Per-job log files
  - `temp/` - Temporary processing files

## Supported Audio Formats

- WAV
- MP3
- M4A
- OGG
- FLAC
- AAC

## Technical Stack

- **Electron** 28+ - Desktop application framework
- **React** 18+ - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **whisper.cpp** - Local transcription engine

## Manual Test Checklist

Use short test files from `C:\Users\vanwallendael.larry\AppData\Roaming\LocalScribe\audio` (FR/ENG).

- Settings persistence across restart
- Model dropdown lists available files
- Reset to defaults works
- Drag & drop accepts supported formats and rejects others
- Progress bar and ETA move during transcription
- Audio length shows in queue and history
- Transcript keeps timestamps end-to-end
- Audio and transcript file names match original base name
- Open transcript, open folder, open audio buttons work
- Completion notification appears with filename

## Smoke Test (Optional)

Run `npm run smoke-test` to validate that whisper produces non-empty transcripts with timestamps for short FR/ENG files in the test audio folder. Override the folder with `TEST_AUDIO_DIR`.

## License

MIT
