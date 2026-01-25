export enum JobStatus {
  WAITING = 'waiting',
  RUNNING = 'running',
  DONE = 'done',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export interface Job {
  id: string;
  status: JobStatus;
  originalAudioPath: string;
  localAudioPath: string;
  transcriptPath: string;
  createdAt: number;
  completedAt?: number;
  errorMessage?: string;
  progress?: number;
  estimatedTimeRemaining?: number;
  options?: JobOptions;
}

export interface JobOptions {
  modelName?: string;
  language?: string;
  vad?: boolean;
  beamSize?: number;
  bestOf?: number;
  noFallback?: boolean;
  threads?: number;
}

export interface IPCRequest {
  type: string;
  payload?: any;
}

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// IPC Channel names
export const IPC_CHANNELS = {
  ADD_JOB: 'add-job',
  GET_QUEUE: 'get-queue',
  CANCEL_JOB: 'cancel-job',
  GET_HISTORY: 'get-history',
  DELETE_JOB: 'delete-job',
  OPEN_TRANSCRIPT: 'open-transcript',
  OPEN_TRANSCRIPT_FOLDER: 'open-transcript-folder',
  GET_MODELS: 'get-models',
  JOB_PROGRESS: 'job-progress',
  JOB_STATUS_UPDATE: 'job-status-update',
} as const;
