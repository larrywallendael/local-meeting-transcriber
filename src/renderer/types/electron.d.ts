import { IPC_CHANNELS } from '../../shared/types';
import { IPCResponse } from '../../shared/types';

// Type definitions for the Electron API exposed via preload
export interface ElectronAPI {
  showOpenDialog: (options: { properties?: string[]; filters?: any[] }) => Promise<{ canceled: boolean; filePaths: string[] }>;
  addJob: (payload: string | { filePath: string; options?: any }) => Promise<IPCResponse>;
  getQueue: () => Promise<IPCResponse>;
  cancelJob: (jobId: string) => Promise<IPCResponse>;
  getHistory: () => Promise<IPCResponse>;
  deleteJob: (jobId: string) => Promise<IPCResponse>;
  openTranscript: (jobId: string) => Promise<IPCResponse>;
  openTranscriptFolder: (jobId: string) => Promise<IPCResponse>;
  openAudio: (jobId: string) => Promise<IPCResponse>;
  getModels: () => Promise<IPCResponse>;
  getSettings: () => Promise<IPCResponse>;
  setSettings: (settings: any) => Promise<IPCResponse>;
  onJobProgress: (callback: (data: any) => void) => void;
  onJobStatusUpdate: (callback: (data: any) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
