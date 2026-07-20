"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalFileSystem = void 0;
const electron_1 = require("electron");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const paths_1 = require("./paths");
const ipc_protocol_1 = require("./ipc-protocol");
const IMAGE_EXTENSIONS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'avif',
]);
const MIME_TYPE_MAP = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    avif: 'image/avif',
};
function isImageExtension(ext) {
    return IMAGE_EXTENSIONS.has(ext.toLowerCase());
}
class LocalFileSystem {
    constructor() {
        this.watchers = new Map();
        this.registerIpcHandlers();
    }
    registerIpcHandlers() {
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.FS_READ, async (_event, filePath) => {
            return this.readFile(filePath);
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.FS_WRITE, async (_event, filePath, content) => {
            console.log('[IPC] FS_WRITE', filePath);
            return this.writeFile(filePath, content);
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.FS_LIST, async (_event, dirPath) => {
            console.log('[IPC] FS_LIST', dirPath);
            return this.listFiles(dirPath);
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.FS_DELETE, async (_event, filePath) => {
            console.log('[IPC] FS_DELETE', filePath);
            return this.deleteFile(filePath);
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.FS_WATCH, async (_event, filePath) => {
            this.watchPath(filePath);
            return true;
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.FS_UNWATCH, async (_event, filePath) => {
            this.unwatchPath(filePath);
            return true;
        });
    }
    assertAllowed(targetPath) {
        // 相对路径基于数据根目录解析（打包后为 ~/Library/Application Support/...）
        const resolved = node_path_1.default.isAbsolute(targetPath) ? node_path_1.default.normalize(targetPath) : node_path_1.default.normalize(node_path_1.default.join((0, paths_1.getDataRoot)(), targetPath));
        const allowedBases = [
            (0, paths_1.getDataRoot)(),
            node_path_1.default.join((0, paths_1.getMonorepoRoot)(), 'skills'),
            node_path_1.default.join((0, paths_1.getMonorepoRoot)(), 'tmp'),
        ].map((base) => node_path_1.default.normalize(base));
        if (!allowedBases.some((base) => resolved === base || resolved.startsWith(base + node_path_1.default.sep))) {
            throw new Error('Access denied: path outside allowed directories');
        }
        return resolved;
    }
    async readFile(filePath) {
        const fullPath = this.assertAllowed(filePath);
        const ext = node_path_1.default.extname(fullPath).slice(1);
        if (isImageExtension(ext)) {
            const buffer = await promises_1.default.readFile(fullPath);
            const mimeType = MIME_TYPE_MAP[ext.toLowerCase()] ?? 'application/octet-stream';
            return {
                content: `data:${mimeType};base64,${buffer.toString('base64')}`,
                encoding: 'base64',
                contentType: mimeType,
            };
        }
        return {
            content: await promises_1.default.readFile(fullPath, 'utf-8'),
            encoding: 'utf-8',
        };
    }
    async writeFile(filePath, content) {
        const fullPath = this.assertAllowed(filePath);
        await promises_1.default.mkdir(node_path_1.default.dirname(fullPath), { recursive: true });
        await promises_1.default.writeFile(fullPath, content, 'utf-8');
    }
    async listFiles(dirPath) {
        const fullPath = this.assertAllowed(dirPath);
        const items = await this.scanDirectory(fullPath);
        return items.sort((a, b) => a.path.localeCompare(b.path));
    }
    async deleteFile(filePath) {
        const fullPath = this.assertAllowed(filePath);
        await promises_1.default.unlink(fullPath);
    }
    watchPath(targetPath) {
        const fullPath = this.assertAllowed(targetPath);
        if (this.watchers.has(fullPath)) {
            return;
        }
        const watcher = (0, node_fs_1.watch)(fullPath, { recursive: false }, (_eventType, filename) => {
            electron_1.BrowserWindow.getAllWindows().forEach((window) => {
                window.webContents.send(ipc_protocol_1.IPC_CHANNELS.FS_CHANGED, {
                    path: filename ? node_path_1.default.join(fullPath, filename.toString()) : fullPath,
                });
            });
        });
        this.watchers.set(fullPath, watcher);
    }
    async scanDirectory(dirPath) {
        const entries = await promises_1.default.readdir(dirPath, { withFileTypes: true });
        const items = [];
        for (const entry of entries) {
            const entryPath = node_path_1.default.join(dirPath, entry.name);
            const stats = await promises_1.default.stat(entryPath);
            items.push({
                name: entry.name,
                path: entryPath,
                isDirectory: entry.isDirectory(),
                size: stats.size,
                modifiedAt: stats.mtime.toISOString(),
                createdAt: stats.birthtime.toISOString(),
            });
            if (entry.isDirectory()) {
                items.push(...await this.scanDirectory(entryPath));
            }
        }
        return items;
    }
    unwatchPath(targetPath) {
        const fullPath = this.assertAllowed(targetPath);
        const watcher = this.watchers.get(fullPath);
        if (!watcher) {
            return;
        }
        watcher.close();
        this.watchers.delete(fullPath);
    }
    dispose() {
        for (const watcher of this.watchers.values()) {
            watcher.close();
        }
        this.watchers.clear();
    }
}
exports.LocalFileSystem = LocalFileSystem;
