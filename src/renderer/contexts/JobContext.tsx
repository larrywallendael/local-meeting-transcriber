import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Job, IPC_CHANNELS, JobOptions } from '../../shared/types';
import * as ipc from '../utils/ipc';

interface JobContextType {
  queue: Job[];
  history: Job[];
  loading: boolean;
  error: string | null;
  folders: string[];
  jobFolders: Record<string, string | undefined>;
  trashedJobs: Record<string, { trashedAt: number; previousFolder?: string }>;
  addFolder: (folderName: string) => void;
  refreshQueue: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  addJob: (filePath: string, options?: JobOptions) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  openTranscript: (jobId: string) => Promise<void>;
  openTranscriptFolder: (jobId: string) => Promise<void>;
  openAudio: (jobId: string) => Promise<void>;
  setJobFolder: (jobId: string, folderName: string) => void;
  removeJobFolder: (jobId: string) => void;
  moveToTrash: (jobId: string) => void;
  restoreFromTrash: (jobId: string) => void;
  deletePermanently: (jobId: string) => Promise<void>;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export function JobProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Job[]>([]);
  const [history, setHistory] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>(['ADP', 'ETL']);
  const [jobFolders, setJobFolders] = useState<Record<string, string | undefined>>({});
  const [trashedJobs, setTrashedJobs] = useState<Record<string, { trashedAt: number; previousFolder?: string }>>({});

  const saveAppSettings = useCallback(async (
    nextFolders?: string[],
    nextJobFolders?: Record<string, string | undefined>,
    nextTrashedJobs?: Record<string, { trashedAt: number; previousFolder?: string }>
  ) => {
    try {
      if (!ipc.isAvailable()) {
        return;
      }
      const response = await ipc.getSettings();
      const existing = response.success && response.data ? response.data : {};
      const payload = {
        ...existing,
        transcriptFolders: nextFolders ?? folders,
        transcriptJobFolders: nextJobFolders ?? jobFolders,
        transcriptTrash: nextTrashedJobs ?? trashedJobs,
      };
      await ipc.setSettings(payload);
    } catch (err) {
      console.error('Failed to persist folder settings:', err);
    }
  }, [folders, jobFolders, trashedJobs]);

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

  const openAudio = useCallback(async (jobId: string) => {
    try {
      await ipc.openAudio(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open audio file');
    }
  }, []);

  const setJobFolder = useCallback((jobId: string, folderName: string) => {
    setJobFolders((prev) => {
      const next = { ...prev, [jobId]: folderName };
      void saveAppSettings(undefined, next, undefined);
      return next;
    });
  }, [saveAppSettings]);

  const removeJobFolder = useCallback((jobId: string) => {
    setJobFolders((prev) => {
      const next = { ...prev };
      delete next[jobId];
      void saveAppSettings(undefined, next, undefined);
      return next;
    });
  }, [saveAppSettings]);

  const addFolder = useCallback((folderName: string) => {
    const trimmed = folderName.trim();
    if (!trimmed) {
      return;
    }
    setFolders((prev) => {
      if (prev.includes(trimmed)) {
        return prev;
      }
      const next = [...prev, trimmed];
      void saveAppSettings(next, undefined, undefined);
      return next;
    });
  }, [saveAppSettings]);

  const moveToTrash = useCallback((jobId: string) => {
    setTrashedJobs((prev) => {
      const next = {
        ...prev,
        [jobId]: {
          trashedAt: Date.now(),
          previousFolder: jobFolders[jobId],
        },
      };
      void saveAppSettings(undefined, undefined, next);
      return next;
    });
  }, [jobFolders, saveAppSettings]);

  const restoreFromTrash = useCallback((jobId: string) => {
    setTrashedJobs((prev) => {
      const next = { ...prev };
      delete next[jobId];
      void saveAppSettings(undefined, undefined, next);
      return next;
    });
  }, [saveAppSettings]);

  const deletePermanently = useCallback(async (jobId: string) => {
    await deleteJob(jobId);
    setTrashedJobs((prev) => {
      const next = { ...prev };
      delete next[jobId];
      void saveAppSettings(undefined, undefined, next);
      return next;
    });
    setJobFolders((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  }, [deleteJob, saveAppSettings]);

  useEffect(() => {
    const loadFolderSettings = async () => {
      if (!ipc.isAvailable()) {
        return;
      }
      const response = await ipc.getSettings();
      if (response.success && response.data) {
        const savedFolders = Array.isArray(response.data.transcriptFolders)
          ? response.data.transcriptFolders
          : undefined;
        const savedJobFolders = response.data.transcriptJobFolders;
        const savedTrash = response.data.transcriptTrash;
        if (savedFolders && savedFolders.length > 0) {
          setFolders(savedFolders);
        }
        if (savedJobFolders && typeof savedJobFolders === 'object') {
          setJobFolders(savedJobFolders);
        }
        if (savedTrash && typeof savedTrash === 'object') {
          setTrashedJobs(savedTrash);
        }
      }
    };
    loadFolderSettings();
  }, []);

  useEffect(() => {
    const purgeOldTrash = async () => {
      const now = Date.now();
      const cutoff = 30 * 24 * 60 * 60 * 1000;
      const toDelete = Object.entries(trashedJobs)
        .filter(([, value]) => now - value.trashedAt > cutoff)
        .map(([jobId]) => jobId);
      if (toDelete.length === 0) return;
      for (const jobId of toDelete) {
        await deletePermanently(jobId);
      }
    };
    purgeOldTrash();
  }, [trashedJobs, deletePermanently]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      const waitForElectronAPI = async () => {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          if (ipc.isAvailable()) {
            return true;
          }
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        return false;
      };

      const available = await waitForElectronAPI();
      if (!available) {
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
        folders,
        jobFolders,
        trashedJobs,
        addFolder,
        refreshQueue,
        refreshHistory,
        addJob,
        cancelJob,
        deleteJob,
        openTranscript,
        openTranscriptFolder,
        openAudio,
        setJobFolder,
        removeJobFolder,
        moveToTrash,
        restoreFromTrash,
        deletePermanently,
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
