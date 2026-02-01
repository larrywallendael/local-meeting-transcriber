import { app, BrowserWindow, Notification, Menu } from 'electron';
import path from 'path';
import { FileManager } from './fileManager';
import { JobStore } from './jobStore';
import { JobQueue } from './jobQueue';
import { JobRunner } from './jobRunner';
import { setupIpcHandlers } from './ipcHandlers';
import { IPC_CHANNELS } from './types';

let mainWindow: BrowserWindow | null = null;
let jobQueue: JobQueue | null = null;

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
