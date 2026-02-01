import { app, BrowserWindow, Notification, Menu } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { FileManager } from './fileManager';
import { JobStore } from './jobStore';
import { JobQueue } from './jobQueue';
import { JobRunner } from './jobRunner';
import { setupIpcHandlers } from './ipcHandlers';
import { IPC_CHANNELS } from './types';
import { getFfmpegPath, getResourcesPath, getWhisperPath } from './paths';

let mainWindow: BrowserWindow | null = null;
let jobQueue: JobQueue | null = null;

const REQUIRED_MODELS = ['ggml-medium-q5_0.bin', 'ggml-small-q8_0.bin'];

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getMissingBundledAssets(): Promise<string[]> {
  const missing: string[] = [];
  const resourcesPath = getResourcesPath();

  const whisperExePath = getWhisperPath();
  if (!(await fileExists(whisperExePath))) {
    missing.push('resources/whisper/whisper.exe');
  }

  const whisperDir = path.join(resourcesPath, 'whisper');
  try {
    const entries = await fs.readdir(whisperDir);
    const dlls = entries.filter((entry) => entry.toLowerCase().endsWith('.dll'));
    if (dlls.length === 0) {
      missing.push('resources/whisper/*.dll');
    }
  } catch {
    missing.push('resources/whisper/*.dll');
  }

  const ffmpegPath = getFfmpegPath();
  if (!(await fileExists(ffmpegPath))) {
    missing.push('resources/ffmpeg/ffmpeg.exe');
  }

  for (const model of REQUIRED_MODELS) {
    const modelPath = path.join(resourcesPath, 'models', model);
    if (!(await fileExists(modelPath))) {
      missing.push(`resources/models/${model}`);
    }
  }

  return missing;
}

function createMissingDepsWindow(missing: string[]) {
  const details = missing.map((item) => `<li>${item}</li>`).join('');
  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>LocalScribe - Missing Files</title>
        <style>
          body { font-family: "Segoe UI", sans-serif; background: #f4efe6; color: #2c2c2c; margin: 0; }
          .wrap { max-width: 720px; margin: 48px auto; padding: 0 24px; }
          h1 { font-size: 22px; margin-bottom: 12px; }
          p { font-size: 14px; margin: 8px 0; }
          ul { padding-left: 18px; }
          li { margin: 6px 0; font-size: 14px; }
          .card { background: #fff; border: 1px solid #e5ded3; border-radius: 12px; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <h1>LocalScribe could not start</h1>
            <p>Required runtime files are missing. Please reinstall LocalScribe or contact your provider.</p>
            <p>Missing files:</p>
            <ul>${details}</ul>
          </div>
        </div>
      </body>
    </html>
  `;

  const errorWindow = new BrowserWindow({
    width: 900,
    height: 600,
    resizable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  errorWindow.setMenuBarVisibility(false);
  errorWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
}

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[main] preload path:', preloadPath);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(app.getAppPath(), 'assets', 'icon.png'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);

  // Load the app
  const isDev = !app.isPackaged;
  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    console.log('[main] loading dev URL:', devUrl);
    mainWindow.loadURL(devUrl);
    if (process.env.OPEN_DEVTOOLS !== 'false') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[main] failed to load:', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log('[renderer]', { level, message, line, sourceId });
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      const hasApi = await mainWindow?.webContents.executeJavaScript(
        'typeof window.electronAPI !== "undefined"'
      );
      console.log('[main] electronAPI available in renderer:', hasApi);
    } catch (error) {
      console.error('[main] executeJavaScript failed:', error);
    }
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      const hasApi = await mainWindow?.webContents.executeJavaScript(
        'typeof window.electronAPI !== "undefined"'
      );
      console.log('[main] electronAPI available in renderer:', hasApi);
    } catch (error) {
      console.error('[main] executeJavaScript failed:', error);
    }
  });

  // Set up event forwarding from JobQueue to renderer
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/368470af-c559-4506-9ef3-01546ad20d86',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/main/main.ts:76',message:'createWindow jobQueue check',data:{hasJobQueue:!!jobQueue,hasMainWindow:!!mainWindow},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (jobQueue && mainWindow) {
    jobQueue.on('job-progress', (data: { jobId: string; progress: number; eta?: number }) => {
      mainWindow?.webContents.send(IPC_CHANNELS.JOB_PROGRESS, data);
    });

    jobQueue.on('job-status-update', (data: any) => {
      mainWindow?.webContents.send(IPC_CHANNELS.JOB_STATUS_UPDATE, data);
    });

    jobQueue.on('job-complete', async (jobId: string) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/368470af-c559-4506-9ef3-01546ad20d86',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/main/main.ts:86',message:'job-complete handler entry',data:{jobId,hasJobQueue:!!jobQueue},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Trigger queue refresh
      mainWindow?.webContents.send(IPC_CHANNELS.JOB_STATUS_UPDATE, { type: 'refresh' });

      const queue = jobQueue;
      if (!queue) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/368470af-c559-4506-9ef3-01546ad20d86',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/main/main.ts:92',message:'jobQueue missing in handler',data:{jobId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return;
      }

      const job = await queue.getJob(jobId);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/368470af-c559-4506-9ef3-01546ad20d86',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/main/main.ts:99',message:'job-complete job lookup',data:{jobId,found:!!job},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      const fileName = job?.originalAudioPath ? path.basename(job.originalAudioPath) : 'Audio file';
      if (Notification.isSupported()) {
        new Notification({
          title: 'Transcription ready',
          body: `${fileName} is ready`,
        }).show();
      }
      mainWindow?.flashFrame(true);
    });

    jobQueue.on('job-error', () => {
      mainWindow?.webContents.send(IPC_CHANNELS.JOB_STATUS_UPDATE, { type: 'refresh' });
    });

    jobQueue.on('job-cancelled', () => {
      mainWindow?.webContents.send(IPC_CHANNELS.JOB_STATUS_UPDATE, { type: 'refresh' });
    });
  }
}

async function initializeApp() {
  const missingAssets = await getMissingBundledAssets();
  if (missingAssets.length > 0) {
    createMissingDepsWindow(missingAssets);
    return;
  }

  // Initialize file manager
  const fileManager = new FileManager();
  await fileManager.initialize();

  // Initialize job store
  const jobStore = new JobStore(fileManager);
  await jobStore.load();

  // Initialize job runner
  const jobRunner = new JobRunner(fileManager);

  // Initialize job queue
  jobQueue = new JobQueue(jobStore, jobRunner, fileManager);
  await jobQueue.initialize();
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/368470af-c559-4506-9ef3-01546ad20d86',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/main/main.ts:112',message:'jobQueue initialized',data:{hasJobQueue:!!jobQueue},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  // Set up IPC handlers
  setupIpcHandlers(jobQueue, fileManager);

  // Create window
  createWindow();
}

app.whenReady().then(() => {
  initializeApp();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Cancel any running jobs
  if (jobQueue) {
    const queue = await jobQueue.getQueue();
    for (const job of queue) {
      if (job.status === 'running') {
        await jobQueue.cancelJob(job.id);
      }
    }
  }
});
