import { BrowserWindow, ipcMain, screen, shell, type Rectangle } from 'electron';
import path from 'node:path';
import { IPC_CHANNELS } from './ipc-protocol';
import { attachDevToolsContextMenu } from './devtools-context-menu';

type DockSide = 'left' | 'bottom' | 'right';

function normalizeDockSide(side: unknown): DockSide {
  return side === 'right' || side === 'bottom' || side === 'left' ? side : 'left';
}

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
  private dockVisible = false;
  private dockPinnedByGuide = false;
  private dockSide: DockSide = 'left';
  private readonly preloadPath: string;
  private readonly rendererUrl: string;

  constructor(options?: { preloadPath?: string; rendererUrl?: string }) {
    this.preloadPath = options?.preloadPath ?? path.join(__dirname, 'preload.js');
    this.rendererUrl = options?.rendererUrl ?? process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:3000';
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

  createDockWindow(): void {
    if (this.dockWindow && !this.dockWindow.isDestroyed()) {
      return;
    }

    const bounds = this.getDockBounds('left', false);

    this.dockWindow = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    attachDevToolsContextMenu(this.dockWindow);

    const dockUrl = new URL('/dock', this.rendererUrl);
    dockUrl.searchParams.set('nativeWindow', '1');
    void this.dockWindow.loadURL(dockUrl.toString()).catch((error: unknown) => {
      console.error('[electron-window-manager] Failed to load dock URL', error);
    });

    // Collapsed dock should not block clicks on applications underneath.
    this.dockWindow.setIgnoreMouseEvents(true, { forward: true });

    // Register dock IPC handlers
    ipcMain.handle(IPC_CHANNELS.DOCK_SHOW, (_event, options?: { side?: DockSide }) => {
      if (!this.dockWindow || this.dockWindow.isDestroyed()) return;
      this.dockSide = normalizeDockSide(options?.side);
      this.dockWindow.setIgnoreMouseEvents(false);
      this.dockWindow.setBounds(this.getDockBounds(this.dockSide, true));
      this.dockWindow.webContents.send('dock:animate', 'show');
    });

    ipcMain.handle(IPC_CHANNELS.DOCK_HIDE, (_event, options?: { side?: DockSide }) => {
      if (!this.dockWindow || this.dockWindow.isDestroyed()) return;
      this.dockSide = normalizeDockSide(options?.side);
      if (this.dockPinnedByGuide) return;
      this.dockWindow.webContents.send('dock:animate', 'hide');
      this.dockWindow.setBounds(this.getDockBounds(this.dockSide, false));
      this.dockWindow.setIgnoreMouseEvents(true, { forward: true });
    });

    ipcMain.handle('dock:guide-highlight', (_event, highlighted: boolean, options?: { side?: DockSide }) => {
      if (!this.dockWindow || this.dockWindow.isDestroyed()) return;
      this.dockSide = normalizeDockSide(options?.side);
      this.dockPinnedByGuide = highlighted;

      if (highlighted) {
        this.dockWindow.setIgnoreMouseEvents(false);
        this.dockWindow.setBounds(this.getDockBounds(this.dockSide, true));
        this.dockWindow.webContents.send('dock:animate', 'show');
        this.dockWindow.webContents.send('dock:guide-highlight', true);
        return;
      }

      this.dockWindow.webContents.send('dock:guide-highlight', false);
      this.dockWindow.webContents.send('dock:animate', 'hide');
      this.dockWindow.setBounds(this.getDockBounds(this.dockSide, false));
      this.dockWindow.setIgnoreMouseEvents(true, { forward: true });
    });

    ipcMain.handle(IPC_CHANNELS.DOCK_SET_MOUSE_IGNORE, (_event, ignore: boolean) => {
      if (!this.dockWindow || this.dockWindow.isDestroyed()) return;
      this.dockWindow.setIgnoreMouseEvents(ignore, { forward: true });
    });

    ipcMain.handle(IPC_CHANNELS.DOCK_ACTION, (_event, detail: unknown) => {
      this.notifyMainWindow(IPC_CHANNELS.DOCK_ACTION, detail);
    });

    ipcMain.on(IPC_CHANNELS.DOCK_SYNC_APPS, (_event, apps: unknown) => {
      if (this.dockWindow && !this.dockWindow.isDestroyed()) {
        this.dockWindow.webContents.send(IPC_CHANNELS.DOCK_SYNC_APPS, apps);
      }
    });

    this.dockWindow.on('closed', () => {
      this.dockWindow = null;
      this.dockPinnedByGuide = false;
    });
  }

  private getDockBounds(side: DockSide, expanded: boolean): Rectangle {
    const DOCK_SIZE = 80;
    const TOOLTIP_SIZE = 240;
    const HOT_ZONE = 4;
    const display = screen.getPrimaryDisplay();
    const { x, y, width, height } = display.workArea;
    const collapsedSize = DOCK_SIZE + HOT_ZONE;
    const expandedSize = DOCK_SIZE + TOOLTIP_SIZE + HOT_ZONE;

    if (side === 'bottom') {
      const windowHeight = expanded ? expandedSize : collapsedSize;
      return {
        x,
        y: y + height - windowHeight + HOT_ZONE,
        width,
        height: windowHeight,
      };
    }

    const windowWidth = expanded ? expandedSize : collapsedSize;
    return {
      x: side === 'right' ? x + width - windowWidth + HOT_ZONE : x - HOT_ZONE,
      y,
      width: windowWidth,
      height,
    };
  }

  createWindow(config: NativeWindowConfig): string {
    const existing = this.windows.get(config.id);
    if (existing && !existing.isDestroyed()) {
      console.log('[electron-window-manager] reuse window', {
        id: config.id,
        title: config.title,
        count: this.windows.size,
      });
      existing.setTitle(config.title);
      if (existing.isMinimized()) {
        existing.restore();
      }
      if (!existing.isVisible()) {
        existing.show();
      }
      existing.focus();
      return config.id;
    }

    const width = Math.max(config.width ?? 960, config.minWidth ?? 400);
    const height = Math.max(config.height ?? 720, config.minHeight ?? 300);
    const workArea = screen.getPrimaryDisplay().workAreaSize;
    const x = config.x ?? Math.round((workArea.width - width) / 2);
    const y = config.y ?? Math.round((workArea.height - height) / 2);

    const windowUrl = this.buildWindowUrl(config);
    console.log('[electron-window-manager] create window', {
      id: config.id,
      title: config.title,
      route: config.route ?? '/',
      windowType: config.query?.['windowType'],
      countBefore: this.windows.size,
      url: windowUrl,
    });

    const window = new BrowserWindow({
      width,
      height,
      x,
      y,
      minWidth: config.minWidth ?? 400,
      minHeight: config.minHeight ?? 300,
      title: config.title,
      backgroundColor: process.platform === 'darwin' ? '#00000000' : '#e7edf3',
      titleBarStyle: 'default',
      vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
      visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    attachDevToolsContextMenu(window);

    // Keep native window titles owned by the window manager. Next.js may update
    // document.title after hydration, which would otherwise overwrite config.title.
    window.on('page-title-updated', (e) => {
      e.preventDefault();
      window.setTitle(config.title);
    });

    window.webContents.on('did-finish-load', () => {
      window.setTitle(config.title);
    });

    // Open external links in default browser instead of new Electron window
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http:') || url.startsWith('https:')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    void window.loadURL(windowUrl).catch((error: unknown) => {
      console.error('[electron-window-manager] Failed to load native window URL', error);
    });

    window.on('closed', () => {
      this.windows.delete(config.id);
      console.log('[electron-window-manager] closed window', {
        id: config.id,
        count: this.windows.size,
      });
      this.notifyMainWindow(IPC_CHANNELS.WINDOW_CLOSED, config.id);
    });

    this.windows.set(config.id, window);
    return config.id;
  }

  closeWindow(windowId: string): void {
    this.windows.get(windowId)?.close();
  }

  focusWindow(windowId: string): void {
    const window = this.windows.get(windowId);
    if (!window || window.isDestroyed()) return;

    if (window.isMinimized()) {
      window.restore();
    }
    if (!window.isVisible()) {
      window.show();
    }
    window.focus();
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

  toggleDock(): void {
    if (!this.dockWindow || this.dockWindow.isDestroyed()) return;
    this.dockVisible = !this.dockVisible;
    this.dockWindow.setIgnoreMouseEvents(!this.dockVisible, { forward: true });
    this.dockWindow.setBounds(this.getDockBounds(this.dockSide, this.dockVisible));
    this.dockWindow.webContents.send('dock:animate', this.dockVisible ? 'show' : 'hide');
  }

  closeAllWindows(): void {    for (const window of this.windows.values()) {
      window.close();
    }
    this.windows.clear();
  }

  private notifyMainWindow(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
