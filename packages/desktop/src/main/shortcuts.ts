import { BrowserWindow, globalShortcut } from 'electron';

export class ShortcutManager {
  private toggleDockCallback: (() => void) | null = null;
  private toggleSpotlightCallback: (() => void) | null = null;

  setDockToggle(callback: () => void): void {
    this.toggleDockCallback = callback;
  }

  setSpotlightToggle(callback: () => void): void {
    this.toggleSpotlightCallback = callback;
  }

  initialize(): void {
    globalShortcut.register('CmdOrCtrl+Shift+D', () => {
      this.toggleDockCallback?.();
    });

    globalShortcut.register('CmdOrCtrl+K', () => {
      this.toggleSpotlightCallback?.();
    });

    globalShortcut.register('CmdOrCtrl+Shift+O', () => {
      this.toggleSpotlightCallback?.();
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (!mainWindow) {
        return;
      }

      mainWindow.webContents.send('show-quick-launcher');
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    });
  }

  destroy(): void {
    globalShortcut.unregisterAll();
  }
}
