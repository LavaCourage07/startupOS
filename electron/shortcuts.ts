import { BrowserWindow, globalShortcut } from 'electron';

export class ShortcutManager {
  initialize(): void {
    globalShortcut.register('CmdOrCtrl+Shift+O', () => {
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
