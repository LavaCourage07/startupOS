import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { ElectronWindowManager } from './window-manager';
import { LocalFileSystem } from './local-fs';
import { LocalAgentBridge } from './local-agent-bridge';
import { TrayManager } from './tray-manager';
import { ShortcutManager } from './shortcuts';
import { AutoUpdaterManager } from './auto-updater';

let mainWindow: BrowserWindow | null = null;
let windowManager: ElectronWindowManager | null = null;
let localFileSystem: LocalFileSystem | null = null;
let localAgentBridge: LocalAgentBridge | null = null;
let trayManager: TrayManager | null = null;
let shortcutManager: ShortcutManager | null = null;
let autoUpdaterManager: AutoUpdaterManager | null = null;

// 加载项目根目录的 .env 文件，确保 agent worker 子进程继承正确的环境变量
loadDotenv({ path: path.join(__dirname, '..', '.env'), override: true });

function resolvePreloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function resolveRendererUrl(): string {
  const explicitUrl = process.env.ELECTRON_RENDERER_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  if (!app.isPackaged) {
    return 'http://localhost:3000';
  }

  throw new Error(
    'Packaged Electron renderer URL is not configured. Set ELECTRON_RENDERER_URL before launching the packaged app.'
  );
}

async function loadRenderer(window: BrowserWindow): Promise<void> {
  const isDevelopment = !app.isPackaged;
  const rendererUrl = resolveRendererUrl();

  if (isDevelopment) {
    await window.loadURL(rendererUrl);
    window.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await window.loadURL(rendererUrl);
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'OriginOS CE',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  void loadRenderer(window).catch((error: unknown) => {
    console.error('[electron] Failed to load renderer', error);
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  return window;
}

app.whenReady().then(() => {
  const rendererUrl = !app.isPackaged
    ? resolveRendererUrl()
    : process.env.ELECTRON_RENDERER_URL;

  windowManager = new ElectronWindowManager({
    preloadPath: resolvePreloadPath(),
    ...(rendererUrl ? { rendererUrl } : {}),
  });
  localFileSystem = new LocalFileSystem();
  localAgentBridge = new LocalAgentBridge();
  trayManager = new TrayManager();
  shortcutManager = new ShortcutManager();
  autoUpdaterManager = new AutoUpdaterManager();
  mainWindow = createWindow();
  windowManager.setMainWindow(mainWindow);
  windowManager.createDockWindow();
  trayManager.initialize();
  shortcutManager.initialize();
  autoUpdaterManager.setMainWindow(mainWindow);
  void autoUpdaterManager.initialize().then(() => {
    if (app.isPackaged) {
      void autoUpdaterManager?.checkForUpdates();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      windowManager?.setMainWindow(mainWindow);
      if (mainWindow) {
        autoUpdaterManager?.setMainWindow(mainWindow);
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  windowManager?.closeAllWindows();
  localFileSystem?.dispose();
  void localAgentBridge?.shutdown();
  trayManager?.destroy();
  shortcutManager?.destroy();
});
