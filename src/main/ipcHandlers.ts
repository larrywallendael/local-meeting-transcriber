import { ipcMain, shell, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { IPC_CHANNELS, IPCResponse, JobOptions } from './types';
import { JobQueue } from './jobQueue';
import { FileManager } from './fileManager';
import { getResourcesPath } from './paths';

export function setupIpcHandlers(
  jobQueue: JobQueue,
  fileManager: FileManager
): void {
  // Show open dialog for file selection
  ipcMain.handle('show-open-dialog', async (_event, options: any): Promise<any> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Audio Files', extensions: ['wav', 'mp3', 'm4a', 'ogg', 'flac', 'aac'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        ...options,
      });
      return result;
    } catch (error) {
      return { canceled: true, filePaths: [] };
    }
  });

  // Add job to queue
  ipcMain.handle(IPC_CHANNELS.ADD_JOB, async (_event, payload: { filePath: string; options?: JobOptions } | string): Promise<IPCResponse> => {
    try {
      const filePath = typeof payload === 'string' ? payload : payload.filePath;
      const options = typeof payload === 'string' ? undefined : payload.options;
      const job = await jobQueue.addJob(filePath, options);
      return { success: true, data: job };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add job',
      };
    }
  });

  // Get current queue
  ipcMain.handle(IPC_CHANNELS.GET_QUEUE, async (): Promise<IPCResponse> => {
    try {
      const queue = await jobQueue.getQueue();
      return { success: true, data: queue };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get queue',
      };
    }
  });

  // Cancel job
  ipcMain.handle(IPC_CHANNELS.CANCEL_JOB, async (_event, jobId: string): Promise<IPCResponse> => {
    try {
      const cancelled = await jobQueue.cancelJob(jobId);
      return { success: cancelled, data: { cancelled } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel job',
      };
    }
  });

  // Get history
  ipcMain.handle(IPC_CHANNELS.GET_HISTORY, async (): Promise<IPCResponse> => {
    try {
      const history = await jobQueue.getHistory();
      return { success: true, data: history };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get history',
      };
    }
  });

  // Delete job
  ipcMain.handle(IPC_CHANNELS.DELETE_JOB, async (_event, jobId: string): Promise<IPCResponse> => {
    try {
      await jobQueue.deleteJob(jobId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete job',
      };
    }
  });

  // Open transcript file
  ipcMain.handle(IPC_CHANNELS.OPEN_TRANSCRIPT, async (_event, jobId: string): Promise<IPCResponse> => {
    try {
      const job = await jobQueue.getJob(jobId);
      if (!job) {
        return { success: false, error: 'Job not found' };
      }
      const transcriptPath = job.transcriptPath;
      await shell.openPath(transcriptPath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open transcript',
      };
    }
  });

  // Open transcript folder
  ipcMain.handle(IPC_CHANNELS.OPEN_TRANSCRIPT_FOLDER, async (_event, jobId: string): Promise<IPCResponse> => {
    try {
      const job = await jobQueue.getJob(jobId);
      if (!job) {
        return { success: false, error: 'Job not found' };
      }
      const folderPath = path.dirname(job.transcriptPath);
      await shell.openPath(folderPath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open folder',
      };
    }
  });

  // Open stored audio file
  ipcMain.handle(IPC_CHANNELS.OPEN_AUDIO, async (_event, jobId: string): Promise<IPCResponse> => {
    try {
      const job = await jobQueue.getJob(jobId);
      if (!job) {
        return { success: false, error: 'Job not found' };
      }
      await shell.openPath(job.localAudioPath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open audio file',
      };
    }
  });

  // List available models
  ipcMain.handle(IPC_CHANNELS.GET_MODELS, async (): Promise<IPCResponse> => {
    try {
      const modelsDir = path.join(getResourcesPath(), 'models');
      const entries = await fs.readdir(modelsDir, { withFileTypes: true });
      const models = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => /\.(bin|gguf)$/i.test(name))
        .sort((a, b) => a.localeCompare(b));

      return { success: true, data: models };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list models',
      };
    }
  });

  // Get persisted settings
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async (): Promise<IPCResponse> => {
    try {
      const settings = await fileManager.readSettings();
      return { success: true, data: settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load settings',
      };
    }
  });

  // Persist settings
  ipcMain.handle(IPC_CHANNELS.SET_SETTINGS, async (_event, settings: any): Promise<IPCResponse> => {
    try {
      await fileManager.writeSettings(settings);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save settings',
      };
    }
  });

  // Set up event forwarding from JobQueue to renderer
  jobQueue.on('job-progress', (data: { jobId: string; progress: number; eta?: number }) => {
    // This will be sent via webContents.send in main.ts
    // We'll set this up in main.ts after window is created
  });

  jobQueue.on('job-status-update', (data: any) => {
    // Forward status updates
  });
}
