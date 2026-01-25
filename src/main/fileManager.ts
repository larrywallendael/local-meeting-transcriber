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

  constructor() {
    this.appDataDir = APP_DATA_DIR;
    this.jobsFile = path.join(this.appDataDir, 'jobs.json');
    this.transcriptsDir = path.join(this.appDataDir, 'transcripts');
    this.audioDir = path.join(this.appDataDir, 'audio');
    this.logsDir = path.join(this.appDataDir, 'logs');
    this.tempDir = path.join(this.appDataDir, 'temp');
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
  }

  async copyAudioFile(originalPath: string, jobId: string): Promise<string> {
    const ext = path.extname(originalPath);
    const localPath = path.join(this.audioDir, `${jobId}${ext}`);
    await fs.copyFile(originalPath, localPath);
    return localPath;
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

  async deleteJobFiles(jobId: string): Promise<void> {
    try {
      // Delete transcript
      const transcriptPath = this.getTranscriptPath(jobId);
      await fs.unlink(transcriptPath).catch(() => {}); // Ignore if doesn't exist

      // Delete audio file
      const audioFiles = await fs.readdir(this.audioDir);
      const audioFile = audioFiles.find(f => f.startsWith(jobId));
      if (audioFile) {
        await fs.unlink(path.join(this.audioDir, audioFile)).catch(() => {});
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
}
