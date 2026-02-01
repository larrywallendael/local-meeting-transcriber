import * as fs from 'fs/promises';
import { Job, JobStatus } from './types';
import { FileManager } from './fileManager';

export class JobStore {
  private fileManager: FileManager;
  private jobs: Job[] = [];
  private jobsFile: string;

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager;
    this.jobsFile = fileManager.getJobsFilePath();
  }

  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.jobsFile, 'utf-8');
      this.jobs = JSON.parse(content);
      
      // Mark any running jobs as failed (app was restarted)
      this.jobs.forEach(job => {
        if (job.status === JobStatus.RUNNING) {
          job.status = JobStatus.FAILED;
          job.errorMessage = 'Application was restarted during processing';
          job.completedAt = Date.now();
        }
      });
      
      // Save the updated state
      await this.save();
    } catch (error) {
      console.error('Error loading jobs:', error);
      // If file doesn't exist or is corrupted, start with empty array
      this.jobs = [];
      await this.save();
    }
  }

  async save(): Promise<void> {
    try {
      await fs.writeFile(this.jobsFile, JSON.stringify(this.jobs, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving jobs:', error);
      throw new Error('Failed to save jobs');
    }
  }

  async addJob(job: Job): Promise<void> {
    this.jobs.push(job);
    await this.save();
  }

  async updateJob(jobId: string, updates: Partial<Job>): Promise<void> {
    const index = this.jobs.findIndex(j => j.id === jobId);
    if (index !== -1) {
      this.jobs[index] = { ...this.jobs[index], ...updates };
      await this.save();
    }
  }

  async getJob(jobId: string): Promise<Job | undefined> {
    return this.jobs.find(j => j.id === jobId);
  }

  async getAllJobs(): Promise<Job[]> {
    return [...this.jobs];
  }

  async getQueueJobs(): Promise<Job[]> {
    return this.jobs.filter(j => 
      j.status === JobStatus.WAITING || j.status === JobStatus.RUNNING
    );
  }

  async getHistoryJobs(): Promise<Job[]> {
    return this.jobs.filter(j => 
      j.status === JobStatus.DONE || 
      j.status === JobStatus.CANCELLED || 
      j.status === JobStatus.FAILED
    );
  }

  async deleteJob(jobId: string): Promise<void> {
    const index = this.jobs.findIndex(j => j.id === jobId);
    if (index !== -1) {
      const job = this.jobs[index];
      this.jobs.splice(index, 1);
      await this.save();
      // Clean up files
      await this.fileManager.deleteJobFiles(jobId, job.localAudioPath, job.transcriptPath);
    }
  }

  async getRunningJob(): Promise<Job | undefined> {
    return this.jobs.find(j => j.status === JobStatus.RUNNING);
  }

  async getWaitingJobs(): Promise<Job[]> {
    return this.jobs.filter(j => j.status === JobStatus.WAITING);
  }
}
