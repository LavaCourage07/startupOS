"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoUpdaterManager = void 0;
const electron_1 = require("electron");
const ipc_protocol_1 = require("./ipc-protocol");
function ok(data) {
    return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
    };
}
function fail(code, message) {
    return {
        success: false,
        error: { code, message },
        timestamp: new Date().toISOString(),
    };
}
class AutoUpdaterManager {
    constructor() {
        this.mainWindow = null;
        this.updater = null;
        this.isChecking = false;
        this.handlersRegistered = false;
        this.lastCheckWasManual = false;
        this.lastDownloadWasManual = false;
        this.state = {
            status: electron_1.app.isPackaged ? 'idle' : 'unsupported',
            available: false,
            currentVersion: electron_1.app.getVersion(),
            ...(electron_1.app.isPackaged ? {} : { error: '自动更新仅在已打包桌面应用中可用。' }),
        };
    }
    async initialize() {
        this.registerIpcHandlers();
        // Skip auto-updater in development or when not packaged
        if (!electron_1.app.isPackaged) {
            console.log('[auto-updater] Skipping initialization in development mode');
            this.emitState();
            return;
        }
        const updaterModule = await this.loadOptionalModule('electron-updater');
        if (!updaterModule?.autoUpdater) {
            console.warn('[auto-updater] electron-updater not installed, skipping initialization');
            this.setState({
                status: 'unsupported',
                available: false,
                error: 'electron-updater is not available in this runtime.',
            });
            return;
        }
        this.updater = updaterModule.autoUpdater;
        this.updater.autoDownload = false;
        this.updater.autoInstallOnAppQuit = true;
        const loggerModule = await this.loadOptionalModule('electron-log');
        if (loggerModule?.default) {
            this.updater.logger = loggerModule.default;
        }
        this.bindEvents();
        this.emitState();
    }
    setMainWindow(window) {
        this.mainWindow = window;
    }
    getState() {
        return { ...this.state };
    }
    scheduleAutoCheck(delayMs = 30000) {
        if (!electron_1.app.isPackaged) {
            this.emitState();
            return;
        }
        setTimeout(() => {
            void this.checkForUpdates({ manual: false });
        }, delayMs).unref?.();
    }
    async checkForUpdates(options = {}) {
        if (!electron_1.app.isPackaged) {
            return this.setState({
                status: 'unsupported',
                available: false,
                error: '自动更新仅在已打包桌面应用中可用。',
            });
        }
        if (!this.updater) {
            return this.setState({
                status: 'unsupported',
                available: false,
                error: '自动更新模块尚未初始化。',
            });
        }
        if (this.isChecking) {
            return this.getState();
        }
        this.isChecking = true;
        this.lastCheckWasManual = options.manual === true;
        this.setState({
            status: 'checking',
            available: false,
            error: undefined,
            progress: undefined,
            lastCheckedAt: new Date().toISOString(),
        });
        try {
            await this.updater.checkForUpdates();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to check for updates';
            console.warn('[auto-updater] Check failed (this is expected if no publish config):', errorMessage);
            // Don't show error to user for missing publish config (404 errors)
            this.setState({
                status: 'not-available',
                available: false,
                error: undefined,
            });
        }
        finally {
            this.isChecking = false;
        }
        return this.getState();
    }
    async downloadUpdate(options = {}) {
        if (!this.updater) {
            return this.setState({
                status: 'unsupported',
                error: '自动更新模块尚未初始化。',
            });
        }
        if (!this.state.updateInfo) {
            return this.setState({
                status: 'error',
                error: '当前没有可下载的更新。',
            });
        }
        this.lastDownloadWasManual = options.manual === true;
        this.setState({
            status: 'downloading',
            error: undefined,
        });
        try {
            await this.updater.downloadUpdate();
        }
        catch (error) {
            console.error('[auto-updater] Download failed:', error);
            this.setState({
                status: 'error',
                error: error instanceof Error ? error.message : 'Failed to download update',
            });
        }
        return this.getState();
    }
    installDownloadedUpdate() {
        if (!this.updater || this.state.status !== 'downloaded') {
            return this.setState({
                status: 'error',
                error: '当前没有已下载的更新可安装。',
            });
        }
        setImmediate(() => {
            this.updater?.quitAndInstall(false, true);
        });
        return this.getState();
    }
    registerIpcHandlers() {
        if (this.handlersRegistered) {
            return;
        }
        this.handlersRegistered = true;
        electron_1.ipcMain.removeHandler(ipc_protocol_1.IPC_CHANNELS.UPDATE_STATUS);
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.UPDATE_STATUS, async () => ok(this.getState()));
        electron_1.ipcMain.removeHandler(ipc_protocol_1.IPC_CHANNELS.UPDATE_CHECK);
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.UPDATE_CHECK, async () => ok(await this.checkForUpdates({ manual: true })));
        electron_1.ipcMain.removeHandler(ipc_protocol_1.IPC_CHANNELS.UPDATE_DOWNLOAD);
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.UPDATE_DOWNLOAD, async () => ok(await this.downloadUpdate({ manual: true })));
        electron_1.ipcMain.removeHandler(ipc_protocol_1.IPC_CHANNELS.UPDATE_INSTALL);
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.UPDATE_INSTALL, async () => {
            const state = this.installDownloadedUpdate();
            if (state.status === 'error') {
                return fail('UPDATE_NOT_READY', state.error ?? 'No downloaded update is ready to install.');
            }
            return ok(state);
        });
    }
    bindEvents() {
        if (!this.updater) {
            return;
        }
        this.updater.on('checking-for-update', () => {
            this.setState({
                status: 'checking',
                error: undefined,
                lastCheckedAt: new Date().toISOString(),
            });
        });
        this.updater.on('update-available', (...args) => {
            const info = (args[0] ?? {});
            this.setState({
                status: 'available',
                available: true,
                updateInfo: info,
                progress: undefined,
                error: undefined,
            });
            if (!this.lastCheckWasManual) {
                void this.promptDownload(info);
            }
        });
        this.updater.on('update-not-available', (...args) => {
            const info = (args[0] ?? {});
            this.setState({
                status: 'not-available',
                available: false,
                updateInfo: info,
                progress: undefined,
                error: undefined,
            });
        });
        this.updater.on('download-progress', (progress) => {
            this.setState({
                status: 'downloading',
                progress: progress,
                error: undefined,
            });
        });
        this.updater.on('update-downloaded', (...args) => {
            const info = (args[0] ?? this.state.updateInfo ?? {});
            this.setState({
                status: 'downloaded',
                available: true,
                updateInfo: info,
                progress: undefined,
                error: undefined,
            });
            if (!this.lastDownloadWasManual) {
                void this.promptInstall(info);
            }
            this.lastDownloadWasManual = false;
        });
        this.updater.on('error', (error) => {
            console.error('[auto-updater] Runtime error:', error);
            this.setState({
                status: 'error',
                error: error instanceof Error ? error.message : 'Auto updater error',
            });
        });
    }
    async promptDownload(info) {
        const options = {
            type: 'info',
            title: '发现新版本',
            message: `OriginOS CE ${info.version ?? ''} 可用`,
            detail: this.formatReleaseNotes(info) ?? '是否现在下载更新？',
            buttons: ['下载更新', '稍后提醒'],
            defaultId: 0,
            cancelId: 1,
        };
        const { response } = this.mainWindow && !this.mainWindow.isDestroyed()
            ? await electron_1.dialog.showMessageBox(this.mainWindow, options)
            : await electron_1.dialog.showMessageBox(options);
        if (response === 0) {
            await this.downloadUpdate({ manual: false });
        }
    }
    async promptInstall(info) {
        const options = {
            type: 'info',
            title: '更新已下载',
            message: `OriginOS CE ${info.version ?? ''} 已准备就绪`,
            detail: '是否立即重启安装更新？',
            buttons: ['立即重启', '稍后重启'],
            defaultId: 0,
            cancelId: 1,
        };
        const { response } = this.mainWindow && !this.mainWindow.isDestroyed()
            ? await electron_1.dialog.showMessageBox(this.mainWindow, options)
            : await electron_1.dialog.showMessageBox(options);
        if (response === 0) {
            this.installDownloadedUpdate();
        }
    }
    setState(patch) {
        this.state = {
            ...this.state,
            ...patch,
            currentVersion: electron_1.app.getVersion(),
        };
        this.emitState();
        return this.getState();
    }
    emitState() {
        for (const window of electron_1.BrowserWindow.getAllWindows()) {
            if (!window.isDestroyed()) {
                window.webContents.send(ipc_protocol_1.IPC_CHANNELS.UPDATE_EVENT, this.getState());
            }
        }
    }
    formatReleaseNotes(info) {
        if (typeof info.releaseNotes === 'string') {
            return info.releaseNotes;
        }
        if (Array.isArray(info.releaseNotes)) {
            return info.releaseNotes
                .map((item) => item.note)
                .filter((note) => Boolean(note))
                .join('\n\n');
        }
        return undefined;
    }
    async loadOptionalModule(specifier) {
        try {
            return (await Promise.resolve(`${specifier}`).then(s => __importStar(require(s))));
        }
        catch {
            return null;
        }
    }
}
exports.AutoUpdaterManager = AutoUpdaterManager;
