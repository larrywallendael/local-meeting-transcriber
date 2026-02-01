import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Job, JobOptions } from './types';
import { FileManager } from './fileManager';
import { getWhisperPath, getModelPath, getFfmpegPath, getModelPathByName, getResourcesPath } from './paths';

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
    if (duration > 0) {
      this.emit('duration', { jobId: job.id, duration });
    }

    // Create transcript file
    await fs.writeFile(outputPath, '', 'utf-8');

    // Prepare whisper.cpp command arguments
    // whisper.cpp format: whisper.exe -m model.bin -f input.wav -of output.txt --output-txt
    const args = [
      '-m', modelPath,
      '-f', inputPath,
      '-of', outputPath.replace('.txt', ''), // whisper.cpp adds .txt extension
      '--output-srt',
      '--print-progress',
      '-l', 'auto',
    ];
    if (options.language && options.language !== 'auto') {
      args.push('-l', options.language);
    }
    if (options.vad) {
      const vadModelPath = await this.findVadModelPath();
      if (!vadModelPath) {
        throw new Error('VAD is enabled but no VAD model was found in resources/vad.');
      }
      args.push('--vad', '--vad-model', vadModelPath);
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
    const startTime = Date.now();
    let lastProgressEmitAt = 0;

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
          const fullTimestampMatch = line.match(/\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]/);
          const shortTimestampMatch = line.match(/\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]/);
          if (fullTimestampMatch) {
            const hours = parseInt(fullTimestampMatch[5], 10);
            const minutes = parseInt(fullTimestampMatch[6], 10);
            const seconds = parseInt(fullTimestampMatch[7], 10);
            const milliseconds = parseInt(fullTimestampMatch[8], 10);
            lastTimestamp = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
          } else if (shortTimestampMatch) {
            const hours = parseInt(shortTimestampMatch[1], 10);
            const minutes = parseInt(shortTimestampMatch[2], 10);
            const seconds = parseInt(shortTimestampMatch[3], 10);
            const milliseconds = parseInt(shortTimestampMatch[4], 10);
            lastTimestamp = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
          }

          if (duration > 0 && lastTimestamp > 0) {
            const progress = Math.min(100, (lastTimestamp / duration) * 100);
            const remaining = Math.max(0, duration - lastTimestamp);
            const elapsed = Math.max(1, Date.now() - startTime);
            const rate = lastTimestamp / (elapsed / 1000);
            const eta = rate > 0 ? remaining / rate : undefined;
            const now = Date.now();

            if (now - lastProgressEmitAt >= 2000 || progress >= 100) {
              lastProgressEmitAt = now;
              this.emit('progress', {
                jobId: job.id,
                progress,
                eta: eta && isFinite(eta) ? Math.max(0, eta) : undefined,
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
        try {
          const srtPath = outputPath.replace(/\.txt$/i, '.srt');
          const srtContent = await fs.readFile(srtPath, 'utf-8');
          const converted = this.convertSrtToTxt(srtContent);
          await fs.writeFile(outputPath, converted, 'utf-8');
          if (converted.trim().length === 0) {
            await this.logJob(job.id, 'Transcript is empty after completion');
            this.emit('error', {
              jobId: job.id,
              error: 'Transcript is empty. Whisper produced no output.',
            });
            return;
          }
          await fs.unlink(srtPath).catch(() => {});
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
    // Keep timestamped lines exactly as whisper outputs them
    if (line.includes('-->') && line.includes('[')) {
      await this.fileManager.appendFile(outputPath, `${line.trim()}\n`);
      return;
    }

    if (!line.includes('%') && line.trim() && !line.startsWith('whisper')) {
      await this.fileManager.appendFile(outputPath, `${line.trim()}\n`);
    }
  }

  private async findVadModelPath(): Promise<string | null> {
    const vadDir = path.join(getResourcesPath(), 'vad');
    try {
      const entries = await fs.readdir(vadDir, { withFileTypes: true });
      const model = entries.find((entry) => entry.isFile());
      if (!model) return null;
      return path.join(vadDir, model.name);
    } catch {
      return null;
    }
  }

  private convertSrtToTxt(content: string): string {
    const blocks = content.split(/\r?\n\r?\n/).map((block) => block.trim()).filter(Boolean);
    const lines: string[] = [];

    for (const block of blocks) {
      const parts = block.split(/\r?\n/);
      if (parts.length < 2) continue;
      const timestampLine = parts[1];
      const text = parts.slice(2).join(' ').trim();
      if (!text) continue;
      const normalizedTimestamp = timestampLine.replace(/,/g, '.');
      lines.push(`[${normalizedTimestamp}] ${text}`);
    }

    return lines.join('\n') + (lines.length > 0 ? '\n' : '');
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

  async getAudioDuration(audioPath: string): Promise<number> {
    const ffmpegPath = getFfmpegPath();
    try {
      await fs.access(ffmpegPath);
    } catch {
      return 0;
    }

    const parseDuration = (text: string): number => {
      const match = text.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (!match) return 0;
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      const centiseconds = parseInt(match[4], 10);
      return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
    };

    return await new Promise<number>((resolve) => {
      const ffmpeg = spawn(ffmpegPath, ['-i', audioPath], { windowsHide: true });
      let stderr = '';

      ffmpeg.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      ffmpeg.on('close', () => {
        const duration = parseDuration(stderr);
        resolve(duration);
      });

      ffmpeg.on('error', () => resolve(0));
    });
  }
}
