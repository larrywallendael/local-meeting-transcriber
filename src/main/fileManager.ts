import * as fs from 'fs/promises';
import * as path from 'path';
import { getAppDataPath } from './paths';
import { v4 as uuidv4 } from 'uuid';

const APP_DATA_DIR = getAppDataPath();

export class FileManager {
  private appDataDir: string;
  private jobsFile: string;
  private transcriptsDir: string;
  private audioDir: string;
  private logsDir: string;
  private tempDir: string;
  private settingsFile: string;

  constructor() {
    this.appDataDir = APP_DATA_DIR;
    this.jobsFile = path.join(this.appDataDir, 'jobs.json');
    this.transcriptsDir = path.join(this.appDataDir, 'transcripts');
    this.audioDir = path.join(this.appDataDir, 'audio');
    this.logsDir = path.join(this.appDataDir, 'logs');
    this.tempDir = path.join(this.appDataDir, 'temp');
    this.settingsFile = path.join(this.appDataDir, 'settings.json');
  }

  async initialize(): Promise<void> {
    // Create all required directories
    await fs.mkdir(this.appDataDir, { recursive: true });
    await fs.mkdir(this.transcriptsDir, { recursive: true });
    await fs.mkdir(this.audioDir, { recursive: true });
    await fs.mkdir(this.logsDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });

    // Initialize jobs.json if it doesn't exist
    try {
      await fs.access(this.jobsFile);
    } catch {
      await fs.writeFile(this.jobsFile, JSON.stringify([], null, 2));
    }

    // Initialize settings.json if it doesn't exist
    try {
      await fs.access(this.settingsFile);
    } catch {
      await fs.writeFile(this.settingsFile, JSON.stringify({}, null, 2));
    }
  }

  private sanitizeBaseName(baseName: string): string {
    const trimmed = baseName.trim();
    const safe = trimmed.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    return safe.length > 0 ? safe : 'audio';
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async createJobFilePaths(originalPath: string, jobId: string): Promise<{ localAudioPath: string; transcriptPath: string }> {
    const ext = path.extname(originalPath);
    const rawBase = path.basename(originalPath, ext);
    const base = this.sanitizeBaseName(rawBase);

    let index = 1;
    while (true) {
      const suffix = index === 1 ? '' : `__${index}`;
      const audioName = `${base}__audio${suffix}${ext}`;
      const transcriptName = `${base}__transcript${suffix}.txt`;

      const audioPath = path.join(this.audioDir, audioName);
      const transcriptPath = path.join(this.transcriptsDir, transcriptName);
      const exists = await this.pathExists(audioPath) || await this.pathExists(transcriptPath);

      if (!exists) {
        return { localAudioPath: audioPath, transcriptPath };
      }
      index += 1;
    }
  }

  async copyAudioFile(originalPath: string, localPath: string): Promise<void> {
    await fs.copyFile(originalPath, localPath);
  }

  getTranscriptPath(jobId: string): string {
    return path.join(this.transcriptsDir, `${jobId}.txt`);
  }

  getLogPath(jobId: string): string {
    return path.join(this.logsDir, `${jobId}.log`);
  }

  getTempDir(jobId: string): string {
    return path.join(this.tempDir, jobId);
  }

  async ensureTempDir(jobId: string): Promise<string> {
    const tempDir = this.getTempDir(jobId);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  async deleteJobFiles(jobId: string, localAudioPath?: string, transcriptPath?: string): Promise<void> {
    try {
      // Delete transcript
      if (transcriptPath) {
        await fs.unlink(transcriptPath).catch(() => {});
      }

      // Delete audio file
      if (localAudioPath) {
        await fs.unlink(localAudioPath).catch(() => {});
      }

      // Delete log file
      const logPath = this.getLogPath(jobId);
      await fs.unlink(logPath).catch(() => {});

      // Delete temp directory
      const tempDir = this.getTempDir(jobId);
      await fs.rmdir(tempDir, { recursive: true }).catch(() => {});
    } catch (error) {
      console.error(`Error deleting job files for ${jobId}:`, error);
      // Don't throw - cleanup is best effort
    }
  }

  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async appendFile(filePath: string, content: string): Promise<void> {
    await fs.appendFile(filePath, content, 'utf-8');
  }

  generateJobId(): string {
    return uuidv4();
  }

  getJobsFilePath(): string {
    return this.jobsFile;
  }

  getSettingsFilePath(): string {
    return this.settingsFile;
  }

  async readSettings<T = any>(): Promise<T> {
    try {
      const content = await fs.readFile(this.settingsFile, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return {} as T;
    }
  }

  async writeSettings(settings: any): Promise<void> {
    await fs.writeFile(this.settingsFile, JSON.stringify(settings, null, 2), 'utf-8');
  }
}
