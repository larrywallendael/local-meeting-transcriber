# Resources Directory

This directory contains bundled resources that will be included in the final executable.

## whisper/

Place the whisper.cpp Windows x64 executable here:
- `whisper.exe` (or `whisper-cli.exe`)

Download from: https://github.com/ggerganov/whisper.cpp/releases

## ffmpeg/

Place a static `ffmpeg.exe` here to enable non-WAV inputs (M4A/MP3/etc).

**Required file:**
- `ffmpeg.exe`

**Instructions:**
1. Download a static Windows build from: https://www.gyan.dev/ffmpeg/builds/
2. Extract the archive
3. Copy `bin/ffmpeg.exe` into this folder

## models/

Place the Whisper model file here:
- `ggml-medium.bin` (or `ggml-medium.gguf`)

Download from: https://huggingface.co/ggerganov/whisper.cpp

Note: The model file is large (~1.4GB). It should be added to `.gitignore` and downloaded separately.
