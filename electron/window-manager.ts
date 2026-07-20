import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import { IPC_CHANNELS } from './ipc-protocol';

export interface NativeWindowConfig {
  id: string;
  title: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  minWidth?: number;
  minHeight?: number;
  route?: string;
  query?: Record<string, string>;
}

export class ElectronWindowManager {
  private readonly windows = new Map<string, BrowserWindow>();
  private mainWindow: BrowserWindow | null = null;
  private dockWindow: BrowserWindow | null = null;
  private readonly preloadPath: string;
  private readonly rendererUrl: string;

  constructor(options?: { preloadPath?: string; rendererUrl?: string }) {
    this.preloadPath = options?.preloadPath ?? path.join(__dirname, 'preload.js');
    this.rendererUrl = options?.rendererUrl ?? process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:3000';
    this.registerIpcHandlers();
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private registerIpcHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.WINDOW_CREATE, (_event, config: NativeWindowConfig) => {
      return this.createWindow(config);
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, (_event, windowId: string) => {
      this.closeWindow(windowId);
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW_FOCUS, (_event, windowId: string) => {
      this.focusWindow(windowId);
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, (_event, windowId: string) => {
      this.minimizeWindow(windowId);
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, (_event, windowId: string) => {
      this.maximizeWindow(windowId);
    });
  }

  private buildWindowUrl(config: NativeWindowConfig): string {
    const baseUrl = new URL(this.rendererUrl);
    const route = config.route && config.route.startsWith('/') ? config.route : '/';
    const targetUrl = new URL(route, baseUrl);

    targetUrl.searchParams.set('nativeWindowId', config.id);
    targetUrl.searchParams.set('nativeWindow', '1');

    for (const [key, value] of Object.entries(config.query ?? {})) {
      targetUrl.searchParams.set(key, value);
    }

    return targetUrl.toString();
  }

  createWindow(config: NativeWindowConfig): string {
    const existing = this.windows.get(config.id);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return config.id;
    }

    const width = Math.max(config.width ?? 960, config.minWidth ?? 400);
    const height = Math.max(config.height ?? 720, config.minHeight ?? 300);
    const workArea = screen.getPrimaryDisplay().workAreaSize;
    const x = config.x ?? Math.round((workArea.width - width) / 2);
    const y = config.y ?? Math.round((workArea.height - height) / 2);

    const isMac = process.platform === 'darwin';

    const window = new BrowserWindow({
      width,
      height,
      x,
      y,
      minWidth: config.minWidth ?? 400,
      minHeight: config.minHeight ?? 300,
      title: config.title,
      frame: false,
      titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
      trafficLightPosition: { x: 12, y: 12 },
      vibrancy: isMac ? 'under-window' : undefined,
      visualEffectState: isMac ? 'active' : undefined,
      transparent: !isMac,
      backgroundColor: isMac ? '#00000000' : '#f8fafc',
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    void window.loadURL(this.buildWindowUrl(config)).catch((error: unknown) => {
      console.error('[electron-window-manager] Failed to load native window URL', error);
    });

    if (!app.isPackaged) {
      window.webContents.openDevTools({ mode: 'detach' });
    }

    window.on('closed', () => {
      this.windows.delete(config.id);
      this.notifyMainWindow(IPC_CHANNELS.WINDOW_CLOSED, config.id);
    });

    this.windows.set(config.id, window);
    return config.id;
  }

  closeWindow(windowId: string): void {
    this.windows.get(windowId)?.close();
  }

  focusWindow(windowId: string): void {
    this.windows.get(windowId)?.focus();
  }

  minimizeWindow(windowId: string): void {
    this.windows.get(windowId)?.minimize();
  }

  maximizeWindow(windowId: string): void {
    const window = this.windows.get(windowId);
    if (!window) return;

    if (window.isMaximized()) {
      window.unmaximize();
      return;
    }

    window.maximize();
  }

  closeAllWindows(): void {
    for (const window of this.windows.values()) {
      window.close();
    }
    this.windows.clear();
    this.dockWindow?.close();
    this.dockWindow = null;
  }

  createDockWindow(): void {
    if (this.dockWindow && !this.dockWindow.isDestroyed()) return;

    const DOCK_HEIGHT = 80;
    const HOT_ZONE = 4;
    const WINDOW_HEIGHT = DOCK_HEIGHT + HOT_ZONE;

    const { width, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    const win = new BrowserWindow({
      width,
      height: WINDOW_HEIGHT,
      x: 0,
      y: screenHeight - HOT_ZONE,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      focusable: true,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    const dockUrl = new URL('/dock', this.rendererUrl);
    dockUrl.searchParams.set('nativeWindow', '1');
    void win.loadURL(dockUrl.toString()).catch((err: unknown) => {
      console.error('[ElectronWindowManager] Failed to load dock URL', err);
    });

    if (!app.isPackaged) {
      win.webContents.openDevTools({ mode: 'detach' });
    }

    // 用 IPC 通知渲染进程切换 CSS 动画，而不是移动窗口位置（避免跳动）
    ipcMain.handle(IPC_CHANNELS.DOCK_SHOW, () => {
      if (!this.dockWindow || this.dockWindow.isDestroyed()) return;
      this.dockWindow.webContents.send('dock:animate', 'show');
    });

    ipcMain.handle(IPC_CHANNELS.DOCK_HIDE, () => {
      if (!this.dockWindow || this.dockWindow.isDestroyed()) return;
      this.dockWindow.webContents.send('dock:animate', 'hide');
    });

    // Dock 点击动作转发给主窗口
    ipcMain.handle(IPC_CHANNELS.DOCK_ACTION, (_event, detail: unknown) => {
      this.notifyMainWindow(IPC_CHANNELS.DOCK_ACTION, detail);
    });

    this.dockWindow = win;
  }

  private notifyMainWindow(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
