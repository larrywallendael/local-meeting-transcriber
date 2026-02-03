import { IPC_CHANNELS } from '../../shared/types';
import { IPCResponse, JobOptions } from '../../shared/types';

const getApi = () => {
  if (!window.electronAPI) {
    throw new Error('Electron preload is not available. Please restart the app.');
  }
  return window.electronAPI;
};

export const isAvailable = () => typeof window !== 'undefined' && !!window.electronAPI;

export async function showOpenDialog(options: { properties?: string[]; filters?: any[] }): Promise<{ canceled: boolean; filePaths: string[] }> {
  return await getApi().showOpenDialog(options);
}

export async function addJob(filePath: string, options?: JobOptions): Promise<IPCResponse> {
  return await getApi().addJob({ filePath, options });
}

export async function getQueue(): Promise<IPCResponse> {
  return await getApi().getQueue();
}

export async function cancelJob(jobId: string): Promise<IPCResponse> {
  return await getApi().cancelJob(jobId);
}

export async function getHistory(): Promise<IPCResponse> {
  return await getApi().getHistory();
}

export async function deleteJob(jobId: string): Promise<IPCResponse> {
  return await getApi().deleteJob(jobId);
}

export async function readTranscript(jobId: string): Promise<IPCResponse<string>> {
  return await getApi().readTranscript(jobId);
}

export async function openExternal(url: string): Promise<IPCResponse> {
  return await getApi().openExternal(url);
}

export async function openTranscript(jobId: string): Promise<IPCResponse> {
  return await getApi().openTranscript(jobId);
}

export async function openTranscriptFolder(jobId: string): Promise<IPCResponse> {
  return await getApi().openTranscriptFolder(jobId);
}

export async function openAudio(jobId: string): Promise<IPCResponse> {
  return await getApi().openAudio(jobId);
}

export async function getModels(): Promise<IPCResponse<string[]>> {
  return await getApi().getModels();
}

export async function getSettings(): Promise<IPCResponse<any>> {
  return await getApi().getSettings();
}

export async function setSettings(settings: any): Promise<IPCResponse> {
  return await getApi().setSettings(settings);
}

export async function windowMinimize(): Promise<IPCResponse> {
  return await getApi().windowMinimize();
}

export async function windowToggleMaximize(): Promise<IPCResponse> {
  return await getApi().windowToggleMaximize();
}

export async function windowClose(): Promise<IPCResponse> {
  return await getApi().windowClose();
}

export function onJobProgress(callback: (data: any) => void): void {
  getApi().onJobProgress(callback);
}

export function onJobStatusUpdate(callback: (data: any) => void): void {
  getApi().onJobStatusUpdate(callback);
}

export function removeAllListeners(channel: string): void {
  getApi().removeAllListeners(channel);
}
