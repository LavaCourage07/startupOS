import { BrowserWindow, dialog } from 'electron';

interface UpdateInfo {
  version?: string;
  releaseDate?: string;
  releaseNotes?: string | null;
}

interface UpdaterModule {
  autoUpdater: {
    autoDownload: boolean;
    autoInstallOnAppQuit: boolean;
    logger?: unknown;
    on: (event: string, listener: (...args: unknown[]) => void) => void;
    checkForUpdates: () => Promise<unknown>;
    downloadUpdate: () => Promise<unknown>;
    quitAndInstall: () => void;
  };
}

interface LoggerModule {
  default?: unknown;
}

export class AutoUpdaterManager {
  private mainWindow: BrowserWindow | null = null;
  private updater: UpdaterModule['autoUpdater'] | null = null;
  private isChecking = false;
  private isAvailable = false;

  async initialize(): Promise<void> {
    const updaterModule = await this.loadOptionalModule<UpdaterModule>('electron-updater');
    if (!updaterModule?.autoUpdater) {
      console.warn('[auto-updater] electron-updater not installed, skipping initialization');
      return;
    }

    this.updater = updaterModule.autoUpdater;
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = true;

    const loggerModule = await this.loadOptionalModule<LoggerModule>('electron-log');
    if (loggerModule?.default) {
      this.updater.logger = loggerModule.default;
    }

    this.bindEvents();
    this.isAvailable = true;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  async checkForUpdates(): Promise<void> {
    if (!this.updater || this.isChecking) {
      return;
    }

    this.isChecking = true;
    try {
      await this.updater.checkForUpdates();
    } catch (error) {
      console.error('[auto-updater] Check failed:', error);
      this.sendStatus('error', {
        message: error instanceof Error ? error.message : 'Failed to check for updates',
      });
    } finally {
      this.isChecking = false;
    }
  }

  private bindEvents(): void {
    if (!this.updater) {
      return;
    }

    this.updater.on('checking-for-update', () => {
      this.sendStatus('checking-for-update');
    });

    this.updater.on('update-available', async (...args: unknown[]) => {
      const info = (args[0] ?? {}) as UpdateInfo;
      this.sendStatus('update-available', info);
      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: '发现新版本',
        message: `OriginOS CE ${info.version ?? ''} 可用`,
        detail: typeof info.releaseNotes === 'string' ? info.releaseNotes : '是否现在下载更新？',
        buttons: ['下载更新', '稍后提醒'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) {
        await this.updater?.downloadUpdate();
      }
    });

    this.updater.on('update-not-available', () => {
      this.sendStatus('update-not-available');
    });

    this.updater.on('download-progress', (progress: unknown) => {
      this.sendStatus('download-progress', progress);
    });

    this.updater.on('update-downloaded', async (...args: unknown[]) => {
      const info = (args[0] ?? {}) as UpdateInfo;
      this.sendStatus('update-downloaded', info);
      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: '更新已下载',
        message: `OriginOS CE ${info.version ?? ''} 已准备就绪`,
        detail: '是否立即重启安装更新？',
        buttons: ['立即重启', '稍后重启'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) {
        this.updater?.quitAndInstall();
      }
    });

    this.updater.on('error', (error: unknown) => {
      console.error('[auto-updater] Runtime error:', error);
      this.sendStatus('error', {
        message: error instanceof Error ? error.message : 'Auto updater error',
      });
    });
  }

  private sendStatus(status: string, payload?: unknown): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    this.mainWindow.webContents.send('update-status', {
      status,
      payload,
      available: this.isAvailable,
    });
  }

  private async loadOptionalModule<T>(specifier: string): Promise<T | null> {
    try {
      return (await import(specifier)) as T;
    } catch {
      return null;
    }
  }
}
