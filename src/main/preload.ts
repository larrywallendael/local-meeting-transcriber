import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File selection
  showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),
  
  // Job management
  addJob: (payload: string | { filePath: string; options?: any }) => ipcRenderer.invoke(IPC_CHANNELS.ADD_JOB, payload),
  getQueue: () => ipcRenderer.invoke(IPC_CHANNELS.GET_QUEUE),
  cancelJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.CANCEL_JOB, jobId),
  getHistory: () => ipcRenderer.invoke(IPC_CHANNELS.GET_HISTORY),
  deleteJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_JOB, jobId),
  
  // File operations
  readTranscript: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.READ_TRANSCRIPT, jobId),
  openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL, url),
  openTranscript: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_TRANSCRIPT, jobId),
  openTranscriptFolder: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_TRANSCRIPT_FOLDER, jobId),
  openAudio: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_AUDIO, jobId),
  getModels: () => ipcRenderer.invoke(IPC_CHANNELS.GET_MODELS),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  setSettings: (settings: any) => ipcRenderer.invoke(IPC_CHANNELS.SET_SETTINGS, settings),
  windowMinimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  windowToggleMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE),
  windowClose: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  
  // Event listeners
  onJobProgress: (callback: (data: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.JOB_PROGRESS, (_event, data) => callback(data));
  },
  onJobStatusUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.JOB_STATUS_UPDATE, (_event, data) => callback(data));
  },
  
  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
