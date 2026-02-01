import { app } from 'electron';
import path from 'path';

// Set app name
const APP_NAME = 'LocalScribe';

export function getAppDataPath(): string {
  return path.join(app.getPath('appData'), APP_NAME);
}

export function getResourcesPath(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return path.resolve(app.getAppPath(), 'resources');
}

export function getWhisperPath(): string {
  const resourcesPath = getResourcesPath();
  const whisperExe = process.platform === 'win32' ? 'whisper.exe' : 'whisper';
  return path.join(resourcesPath, 'whisper', whisperExe);
}

export function getModelPath(): string {
  const resourcesPath = getResourcesPath();
  // Try both .bin and .gguf extensions
  const binPath = path.join(resourcesPath, 'models', 'ggml-medium.bin');
  const ggufPath = path.join(resourcesPath, 'models', 'ggml-medium.gguf');
  // Return .bin first, fallback to .gguf
  return binPath;
}

export function getModelPathByName(modelName: string): string {
  const resourcesPath = getResourcesPath();
  return path.join(resourcesPath, 'models', modelName);
}

export function getFfmpegPath(): string {
  const resourcesPath = getResourcesPath();
  const ffmpegExe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  return path.join(resourcesPath, 'ffmpeg', ffmpegExe);
}
