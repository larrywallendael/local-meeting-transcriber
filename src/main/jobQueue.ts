import { EventEmitter } from 'events';
import { Job, JobOptions, JobStatus } from './types';
import { JobStore } from './jobStore';
import { JobRunner } from './jobRunner';
import { FileManager } from './fileManager';

export class JobQueue extends EventEmitter {
  private jobStore: JobStore;
  private jobRunner: JobRunner;
  private fileManager: FileManager;
  private isProcessing: boolean = false;

  constructor(jobStore: JobStore, jobRunner: JobRunner, fileManager: FileManager) {
    super();
    this.jobStore = jobStore;
    this.jobRunner = jobRunner;
    this.fileManager = fileManager;

    // Listen to job runner events
    this.jobRunner.on('progress', (data: { jobId: string; progress: number; eta?: number }) => {
      this.emit('job-progress', data);
    });

    this.jobRunner.on('duration', async (data: { jobId: string; duration: number }) => {
      await this.jobStore.updateJob(data.jobId, { audioDurationSeconds: data.duration });
      this.emit('job-status-update', { jobId: data.jobId, type: 'duration' });
    });

    this.jobRunner.on('complete', async (jobId: string) => {
      await this.onJobComplete(jobId);
    });

    this.jobRunner.on('error', async (data: { jobId: string; error: string }) => {
      await this.onJobError(data.jobId, data.error);
    });
  }

  async initialize(): Promise<void> {
    await this.jobStore.load();
    // Start processing if there are waiting jobs
    await this.processNext();
  }

  async addJob(originalAudioPath: string, options?: JobOptions): Promise<Job> {
    const jobId = this.fileManager.generateJobId();
    const { localAudioPath, transcriptPath } = await this.fileManager.createJobFilePaths(originalAudioPath, jobId);
    await this.fileManager.copyAudioFile(originalAudioPath, localAudioPath);

    const job: Job = {
      id: jobId,
      status: JobStatus.WAITING,
      originalAudioPath,
      localAudioPath,
      transcriptPath,
      createdAt: Date.now(),
      options,
    };

    await this.jobStore.addJob(job);
    this.emit('job-added', job);

    // Start processing if not already processing
    if (!this.isProcessing) {
      await this.processNext();
    }

    return job;
  }

  async deleteJob(jobId: string): Promise<void> {
    await this.jobStore.deleteJob(jobId);
    this.emit('job-deleted', jobId);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.jobStore.getJob(jobId);
    if (!job) {
      return false;
    }

    if (job.status === JobStatus.RUNNING) {
      // Cancel the running job
      await this.jobRunner.cancel(jobId);
      await this.jobStore.updateJob(jobId, {
        status: JobStatus.CANCELLED,
        completedAt: Date.now(),
      });
      this.isProcessing = false;
      this.emit('job-cancelled', jobId);
      
      // Process next job
      await this.processNext();
      return true;
    } else if (job.status === JobStatus.WAITING) {
      // Remove from queue
      await this.jobStore.updateJob(jobId, {
        status: JobStatus.CANCELLED,
        completedAt: Date.now(),
      });
      this.emit('job-cancelled', jobId);
      return true;
    }

    return false;
  }

  async getQueue(): Promise<Job[]> {
    return await this.jobStore.getQueueJobs();
  }

  async getHistory(): Promise<Job[]> {
    return await this.jobStore.getHistoryJobs();
  }

  async getJob(jobId: string): Promise<Job | undefined> {
    return await this.jobStore.getJob(jobId);
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    const waitingJobs = await this.jobStore.getWaitingJobs();
    if (waitingJobs.length === 0) {
      return;
    }

    // Get the oldest waiting job
    const nextJob = waitingJobs.sort((a, b) => a.createdAt - b.createdAt)[0];

    this.isProcessing = true;
    await this.jobStore.updateJob(nextJob.id, {
      status: JobStatus.RUNNING,
    });

    this.emit('job-started', nextJob);

    // Start the job
    try {
      await this.jobRunner.run(nextJob);
    } catch (error) {
      console.error('Error running job:', error);
      await this.onJobError(nextJob.id, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async onJobComplete(jobId: string): Promise<void> {
    await this.jobStore.updateJob(jobId, {
      status: JobStatus.DONE,
      completedAt: Date.now(),
      progress: 100,
    });

    this.isProcessing = false;
    this.emit('job-complete', jobId);

    // Process next job
    await this.processNext();
  }

  private async onJobError(jobId: string, errorMessage: string): Promise<void> {
    await this.jobStore.updateJob(jobId, {
      status: JobStatus.FAILED,
      errorMessage,
      completedAt: Date.now(),
    });

    this.isProcessing = false;
    this.emit('job-error', { jobId, errorMessage });

    // Process next job
    await this.processNext();
  }
}
