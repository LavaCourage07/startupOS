"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElectronWindowManager = void 0;
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const ipc_protocol_1 = require("./ipc-protocol");
const devtools_context_menu_1 = require("./devtools-context-menu");
function normalizeDockSide(side) {
    return side === 'right' || side === 'bottom' || side === 'left' ? side : 'left';
}
class ElectronWindowManager {
    constructor(options) {
        this.windows = new Map();
        this.mainWindow = null;
        this.dockWindow = null;
        this.dockVisible = false;
        this.dockPinnedByGuide = false;
        this.dockSide = 'left';
        this.preloadPath = options?.preloadPath ?? node_path_1.default.join(__dirname, 'preload.js');
        this.rendererUrl = options?.rendererUrl ?? process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:3000';
        this.registerIpcHandlers();
    }
    setMainWindow(window) {
        this.mainWindow = window;
    }
    registerIpcHandlers() {
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.WINDOW_CREATE, (_event, config) => {
            return this.createWindow(config);
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.WINDOW_CLOSE, (_event, windowId) => {
            this.closeWindow(windowId);
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.WINDOW_FOCUS, (_event, windowId) => {
            this.focusWindow(windowId);
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.WINDOW_MINIMIZE, (_event, windowId) => {
            this.minimizeWindow(windowId);
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.WINDOW_MAXIMIZE, (_event, windowId) => {
            this.maximizeWindow(windowId);
        });
    }
    buildWindowUrl(config) {
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
    createDockWindow() {
        if (this.dockWindow && !this.dockWindow.isDestroyed()) {
            return;
        }
        const bounds = this.getDockBounds('left', false);
        this.dockWindow = new electron_1.BrowserWindow({
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
        (0, devtools_context_menu_1.attachDevToolsContextMenu)(this.dockWindow);
        const dockUrl = new URL('/dock', this.rendererUrl);
        dockUrl.searchParams.set('nativeWindow', '1');
        void this.dockWindow.loadURL(dockUrl.toString()).catch((error) => {
            console.error('[electron-window-manager] Failed to load dock URL', error);
        });
        // Collapsed dock should not block clicks on applications underneath.
        this.dockWindow.setIgnoreMouseEvents(true, { forward: true });
        // Register dock IPC handlers
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.DOCK_SHOW, (_event, options) => {
            if (!this.dockWindow || this.dockWindow.isDestroyed())
                return;
            this.dockSide = normalizeDockSide(options?.side);
            this.dockWindow.setIgnoreMouseEvents(false);
            this.dockWindow.setBounds(this.getDockBounds(this.dockSide, true));
            this.dockWindow.webContents.send('dock:animate', 'show');
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.DOCK_HIDE, (_event, options) => {
            if (!this.dockWindow || this.dockWindow.isDestroyed())
                return;
            this.dockSide = normalizeDockSide(options?.side);
            if (this.dockPinnedByGuide)
                return;
            this.dockWindow.webContents.send('dock:animate', 'hide');
            this.dockWindow.setBounds(this.getDockBounds(this.dockSide, false));
            this.dockWindow.setIgnoreMouseEvents(true, { forward: true });
        });
        electron_1.ipcMain.handle('dock:guide-highlight', (_event, highlighted, options) => {
            if (!this.dockWindow || this.dockWindow.isDestroyed())
                return;
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
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.DOCK_SET_MOUSE_IGNORE, (_event, ignore) => {
            if (!this.dockWindow || this.dockWindow.isDestroyed())
                return;
            this.dockWindow.setIgnoreMouseEvents(ignore, { forward: true });
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.DOCK_ACTION, (_event, detail) => {
            this.notifyMainWindow(ipc_protocol_1.IPC_CHANNELS.DOCK_ACTION, detail);
        });
        electron_1.ipcMain.on(ipc_protocol_1.IPC_CHANNELS.DOCK_SYNC_APPS, (_event, apps) => {
            if (this.dockWindow && !this.dockWindow.isDestroyed()) {
                this.dockWindow.webContents.send(ipc_protocol_1.IPC_CHANNELS.DOCK_SYNC_APPS, apps);
            }
        });
        this.dockWindow.on('closed', () => {
            this.dockWindow = null;
            this.dockPinnedByGuide = false;
        });
    }
    getDockBounds(side, expanded) {
        const DOCK_SIZE = 80;
        const TOOLTIP_SIZE = 240;
        const HOT_ZONE = 4;
        const display = electron_1.screen.getPrimaryDisplay();
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
    createWindow(config) {
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
        const workArea = electron_1.screen.getPrimaryDisplay().workAreaSize;
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
        const window = new electron_1.BrowserWindow({
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
        (0, devtools_context_menu_1.attachDevToolsContextMenu)(window);
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
                electron_1.shell.openExternal(url);
            }
            return { action: 'deny' };
        });
        void window.loadURL(windowUrl).catch((error) => {
            console.error('[electron-window-manager] Failed to load native window URL', error);
        });
        window.on('closed', () => {
            this.windows.delete(config.id);
            console.log('[electron-window-manager] closed window', {
                id: config.id,
                count: this.windows.size,
            });
            this.notifyMainWindow(ipc_protocol_1.IPC_CHANNELS.WINDOW_CLOSED, config.id);
        });
        this.windows.set(config.id, window);
        return config.id;
    }
    closeWindow(windowId) {
        this.windows.get(windowId)?.close();
    }
    focusWindow(windowId) {
        const window = this.windows.get(windowId);
        if (!window || window.isDestroyed())
            return;
        if (window.isMinimized()) {
            window.restore();
        }
        if (!window.isVisible()) {
            window.show();
        }
        window.focus();
    }
    minimizeWindow(windowId) {
        this.windows.get(windowId)?.minimize();
    }
    maximizeWindow(windowId) {
        const window = this.windows.get(windowId);
        if (!window)
            return;
        if (window.isMaximized()) {
            window.unmaximize();
            return;
        }
        window.maximize();
    }
    toggleDock() {
        if (!this.dockWindow || this.dockWindow.isDestroyed())
            return;
        this.dockVisible = !this.dockVisible;
        this.dockWindow.setIgnoreMouseEvents(!this.dockVisible, { forward: true });
        this.dockWindow.setBounds(this.getDockBounds(this.dockSide, this.dockVisible));
        this.dockWindow.webContents.send('dock:animate', this.dockVisible ? 'show' : 'hide');
    }
    closeAllWindows() {
        for (const window of this.windows.values()) {
            window.close();
        }
        this.windows.clear();
    }
    notifyMainWindow(channel, data) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
    }
}
exports.ElectronWindowManager = ElectronWindowManager;
