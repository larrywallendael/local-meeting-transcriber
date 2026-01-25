import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Job, IPC_CHANNELS, JobOptions } from '../../shared/types';
import * as ipc from '../utils/ipc';

interface JobContextType {
  queue: Job[];
  history: Job[];
  loading: boolean;
  error: string | null;
  refreshQueue: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  addJob: (filePath: string, options?: JobOptions) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  openTranscript: (jobId: string) => Promise<void>;
  openTranscriptFolder: (jobId: string) => Promise<void>;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export function JobProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Job[]>([]);
  const [history, setHistory] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshQueue = useCallback(async () => {
    try {
      const response = await ipc.getQueue();
      if (response.success && response.data) {
        setQueue(response.data);
      } else {
        setError(response.error || 'Failed to load queue');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await ipc.getHistory();
      if (response.success && response.data) {
        setHistory(response.data);
      } else {
        setError(response.error || 'Failed to load history');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    }
  }, []);

  const addJob = useCallback(async (filePath: string, options?: JobOptions) => {
    try {
      const response = await ipc.addJob(filePath, options);
      if (response.success) {
        await refreshQueue();
      } else {
        setError(response.error || 'Failed to add job');
        throw new Error(response.error || 'Failed to add job');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add job');
      throw err;
    }
  }, [refreshQueue]);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      const response = await ipc.cancelJob(jobId);
      if (response.success) {
        await refreshQueue();
      } else {
        setError(response.error || 'Failed to cancel job');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
    }
  }, [refreshQueue]);

  const deleteJob = useCallback(async (jobId: string) => {
    try {
      const response = await ipc.deleteJob(jobId);
      if (response.success) {
        await refreshHistory();
      } else {
        setError(response.error || 'Failed to delete job');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete job');
    }
  }, [refreshHistory]);

  const openTranscript = useCallback(async (jobId: string) => {
    try {
      await ipc.openTranscript(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open transcript');
    }
  }, []);

  const openTranscriptFolder = useCallback(async (jobId: string) => {
    try {
      await ipc.openTranscriptFolder(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open folder');
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      if (!ipc.isAvailable()) {
        setError('Electron preload is not available. Please restart the app.');
        setLoading(false);
        return;
      }
      setLoading(true);
      await Promise.all([refreshQueue(), refreshHistory()]);
      setLoading(false);
    };
    loadData();
  }, [refreshQueue, refreshHistory]);

  // Listen for job progress updates
  useEffect(() => {
    if (!ipc.isAvailable()) {
      return;
    }
    ipc.onJobProgress((data: { jobId: string; progress: number; eta?: number }) => {
      setQueue(prev => prev.map(job => 
        job.id === data.jobId 
          ? { ...job, progress: data.progress, estimatedTimeRemaining: data.eta }
          : job
      ));
    });

    ipc.onJobStatusUpdate(() => {
      refreshQueue();
      refreshHistory();
    });

    return () => {
      ipc.removeAllListeners(IPC_CHANNELS.JOB_PROGRESS);
      ipc.removeAllListeners(IPC_CHANNELS.JOB_STATUS_UPDATE);
    };
  }, [refreshQueue, refreshHistory]);

  return (
    <JobContext.Provider
      value={{
        queue,
        history,
        loading,
        error,
        refreshQueue,
        refreshHistory,
        addJob,
        cancelJob,
        deleteJob,
        openTranscript,
        openTranscriptFolder,
      }}
    >
      {children}
      {error && (
        <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground p-4 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-destructive-foreground hover:opacity-80"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </JobContext.Provider>
  );
}

export function useJobs() {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
}
