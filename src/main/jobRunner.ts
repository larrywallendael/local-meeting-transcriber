import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Job, JobOptions } from './types';
import { FileManager } from './fileManager';
import { getWhisperPath, getModelPath, getFfmpegPath, getModelPathByName } from './paths';

export class JobRunner extends EventEmitter {
  private fileManager: FileManager;
  private runningProcesses: Map<string, ChildProcess> = new Map();
  private audioDurations: Map<string, number> = new Map();

  constructor(fileManager: FileManager) {
    super();
    this.fileManager = fileManager;
  }

  async run(job: Job): Promise<void> {
    const whisperPath = getWhisperPath();
    const options = this.resolveOptions(job.options);
    let modelPath = options.modelName
      ? getModelPathByName(options.modelName)
      : getModelPath();
    const outputPath = job.transcriptPath;

    // Check if whisper executable exists
    try {
      await fs.access(whisperPath);
    } catch {
      const error = 'Whisper executable not found. Please ensure whisper.cpp is properly bundled.';
      await this.logError(job.id, error);
      throw new Error(error);
    }

    // Check if model exists
    try {
      await fs.access(modelPath);
    } catch {
      throw new Error('Whisper model not found. Please ensure the model file is properly bundled.');
    }

    // Prepare audio input (convert to wav if needed)
    const { inputPath, cleanupTemp } = await this.prepareAudioInput(job.id, job.localAudioPath);
    await this.logJob(job.id, `Input audio path: ${inputPath}`);

    // Get audio duration for progress calculation
    const duration = await this.getAudioDuration(inputPath);
    this.audioDurations.set(job.id, duration);

    // Create transcript file
    await fs.writeFile(outputPath, '', 'utf-8');

    // Prepare whisper.cpp command arguments
    // whisper.cpp format: whisper.exe -m model.bin -f input.wav -of output.txt --output-txt
    const args = [
      '-m', modelPath,
      '-f', inputPath,
      '-of', outputPath.replace('.txt', ''), // whisper.cpp adds .txt extension
      '--output-txt',
      '--print-progress',
      '-l', 'auto',
    ];
    if (options.language && options.language !== 'auto') {
      args.push('-l', options.language);
    }
    if (options.vad) {
      args.push('--vad');
    }
    if (typeof options.beamSize === 'number') {
      args.push('-bs', String(options.beamSize));
    }
    if (typeof options.bestOf === 'number') {
      args.push('-bo', String(options.bestOf));
    }
    if (options.noFallback) {
      args.push('-nf');
    }
    if (typeof options.threads === 'number') {
      args.push('-t', String(options.threads));
    }
    await this.logJob(job.id, `Whisper args: ${args.join(' ')}`);

    // Spawn whisper.cpp process
    const process = spawn(whisperPath, args, {
      cwd: path.dirname(whisperPath),
    });

    this.runningProcesses.set(job.id, process);

    // Set up log file
    const logPath = this.fileManager.getLogPath(job.id);
    const logStream = await fs.open(logPath, 'w');

    let lastProgress = 0;
    let lastTimestamp = 0;
    let buffer = '';

    // Handle stdout (transcription output and progress)
    process.stdout.on('data', async (data: Buffer) => {
      const text = data.toString('utf-8');
      buffer += text;
      
      // Write to log
      await logStream.writeFile(text).catch(() => {});

      // Parse lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          await this.parseOutputLine(job.id, line, outputPath, duration);
          
          // Try to extract progress from whisper output
          const progressMatch = line.match(/(\d+)%/);
          if (progressMatch) {
            lastProgress = parseInt(progressMatch[1], 10);
            this.emit('progress', {
              jobId: job.id,
              progress: lastProgress,
            });
          }

          // Try to extract timestamp for more accurate progress
          const timestampMatch = line.match(/\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]/);
          if (timestampMatch) {
            const hours = parseInt(timestampMatch[1], 10);
            const minutes = parseInt(timestampMatch[2], 10);
            const seconds = parseInt(timestampMatch[3], 10);
            const milliseconds = parseInt(timestampMatch[4], 10);
            lastTimestamp = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
            
            if (duration > 0) {
              const progress = Math.min(100, (lastTimestamp / duration) * 100);
              const remaining = duration - lastTimestamp;
              const elapsed = Date.now() - job.createdAt;
              const rate = lastTimestamp / (elapsed / 1000);
              const eta = remaining / rate;

              this.emit('progress', {
                jobId: job.id,
                progress,
                eta: Math.max(0, eta),
              });
            }
          }
        }
      }
    });

    // Handle stderr
    process.stderr.on('data', async (data: Buffer) => {
      const text = data.toString('utf-8');
      await logStream.writeFile(`[STDERR] ${text}`).catch(() => {});
      console.error(`[Whisper stderr for ${job.id}]:`, text);
    });

    // Handle process completion
    process.on('close', async (code) => {
      await logStream.close();
      this.runningProcesses.delete(job.id);
      this.audioDurations.delete(job.id);
      await cleanupTemp();

      if (code === 0) {
        // Process completed successfully
        // Read the final output file (whisper.cpp writes to output.txt)
        const finalOutputPath = outputPath.replace('.txt', '.txt');
        try {
          const finalContent = await fs.readFile(finalOutputPath, 'utf-8');
          await fs.writeFile(outputPath, finalContent, 'utf-8');
          if (finalContent.trim().length === 0) {
            await this.logJob(job.id, 'Transcript is empty after completion');
            this.emit('error', {
              jobId: job.id,
              error: 'Transcript is empty. Whisper produced no output.',
            });
            return;
          }
          // Clean up whisper.cpp's output file if different
          if (finalOutputPath !== outputPath) {
            await fs.unlink(finalOutputPath).catch(() => {});
          }
        } catch (error) {
          console.error('Error reading final output:', error);
          this.emit('error', {
            jobId: job.id,
            error: 'Failed to read transcript output.',
          });
          return;
        }

        this.emit('complete', job.id);
      } else {
        // Process failed
        this.emit('error', {
          jobId: job.id,
          error: `Whisper process exited with code ${code}`,
        });
      }
    });

    // Handle process errors
    process.on('error', async (error) => {
      await logStream.close();
      this.runningProcesses.delete(job.id);
      this.audioDurations.delete(job.id);
      await cleanupTemp();
      
      this.emit('error', {
        jobId: job.id,
        error: error.message,
      });
    });
  }

  private async prepareAudioInput(jobId: string, sourcePath: string): Promise<{ inputPath: string; cleanupTemp: () => Promise<void> }> {
    const ext = path.extname(sourcePath).toLowerCase();
    if (ext === '.wav') {
      return { inputPath: sourcePath, cleanupTemp: async () => {} };
    }

    const ffmpegPath = getFfmpegPath();
    try {
      await fs.access(ffmpegPath);
    } catch {
      const error = 'FFmpeg is required to process non-WAV files. Please add ffmpeg.exe to resources/ffmpeg.';
      await this.logError(jobId, error);
      throw new Error(error);
    }

    const tempDir = await this.fileManager.ensureTempDir(jobId);
    const wavPath = path.join(tempDir, `${jobId}.wav`);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, ['-y', '-i', sourcePath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wavPath], {
        windowsHide: true,
      });

      let stderr = '';
      ffmpeg.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed (${code}): ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => reject(error));
    });

    return {
      inputPath: wavPath,
      cleanupTemp: async () => {
        await fs.unlink(wavPath).catch(() => {});
      },
    };
  }

  async cancel(jobId: string): Promise<void> {
    const childProcess = this.runningProcesses.get(jobId);
    if (childProcess) {
      // Kill the process
      if (process.platform === 'win32') {
        // Windows: use taskkill for more reliable termination
        if (childProcess.pid) {
          spawn('taskkill', ['/pid', childProcess.pid.toString(), '/f', '/t'], {
            stdio: 'ignore',
          });
        }
      } else {
        childProcess.kill('SIGTERM');
        // Force kill after timeout
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill('SIGKILL');
          }
        }, 5000);
      }

      this.runningProcesses.delete(jobId);
      this.audioDurations.delete(jobId);
    }
  }

  private async parseOutputLine(
    jobId: string,
    line: string,
    outputPath: string,
    duration: number
  ): Promise<void> {
    // Parse whisper.cpp output format
    // Format: [HH:MM:SS.mmm] --> text
    const timestampRegex = /\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]\s*-->\s*(.+)/;
    const match = line.match(timestampRegex);

    if (match) {
      const text = match[5].trim();
      if (text) {
        // Append to transcript file incrementally
        await this.fileManager.appendFile(outputPath, `${text}\n`);
      }
    } else if (!line.includes('%') && line.trim() && !line.startsWith('whisper')) {
      // Some lines might not have timestamps, append them anyway
      await this.fileManager.appendFile(outputPath, `${line.trim()}\n`);
    }
  }

  private async logError(jobId: string, error: string): Promise<void> {
    const logPath = this.fileManager.getLogPath(jobId);
    try {
      await fs.appendFile(logPath, `[ERROR] ${new Date().toISOString()}: ${error}\n`, 'utf-8');
    } catch {
      // Ignore logging errors
    }
  }

  private async logJob(jobId: string, message: string): Promise<void> {
    const logPath = this.fileManager.getLogPath(jobId);
    try {
      await fs.appendFile(logPath, `[INFO] ${new Date().toISOString()}: ${message}\n`, 'utf-8');
    } catch {
      // Ignore logging errors
    }
  }

  private resolveOptions(options?: JobOptions): JobOptions {
    return {
      modelName: options?.modelName || 'ggml-medium.bin',
      language: options?.language || 'auto',
      vad: options?.vad ?? false,
      beamSize: typeof options?.beamSize === 'number' ? options!.beamSize : 5,
      bestOf: typeof options?.bestOf === 'number' ? options!.bestOf : 5,
      noFallback: options?.noFallback ?? false,
      threads: typeof options?.threads === 'number' ? options!.threads : undefined,
    };
  }

  private async getAudioDuration(audioPath: string): Promise<number> {
    // For now, return 0 - we'll estimate from whisper output
    // In a production app, you might use ffprobe or a Node.js audio library
    // For V1, we'll rely on whisper.cpp's progress output
    return 0;
  }
}
