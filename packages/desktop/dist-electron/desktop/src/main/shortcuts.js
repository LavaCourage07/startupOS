"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortcutManager = void 0;
const electron_1 = require("electron");
class ShortcutManager {
    constructor() {
        this.toggleDockCallback = null;
        this.toggleSpotlightCallback = null;
    }
    setDockToggle(callback) {
        this.toggleDockCallback = callback;
    }
    setSpotlightToggle(callback) {
        this.toggleSpotlightCallback = callback;
    }
    initialize() {
        electron_1.globalShortcut.register('CmdOrCtrl+Shift+D', () => {
            this.toggleDockCallback?.();
        });
        electron_1.globalShortcut.register('CmdOrCtrl+K', () => {
            this.toggleSpotlightCallback?.();
        });
        electron_1.globalShortcut.register('CmdOrCtrl+Shift+O', () => {
            this.toggleSpotlightCallback?.();
            const mainWindow = electron_1.BrowserWindow.getAllWindows()[0];
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
    destroy() {
        electron_1.globalShortcut.unregisterAll();
    }
}
exports.ShortcutManager = ShortcutManager;
