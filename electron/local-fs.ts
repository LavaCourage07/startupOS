import { BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { IPC_CHANNELS } from './ipc-protocol';

export interface ElectronFileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  createdAt: string;
}

export interface ReadFileResult {
  content: string;
  encoding: 'utf-8' | 'base64';
  contentType?: string;
}

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'avif',
]);

const MIME_TYPE_MAP: Record<string, string> = {
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

function isImageExtension(ext: string): boolean {
  return IMAGE_EXTENSIONS.has(ext.toLowerCase());
}

export class LocalFileSystem {
  private readonly watchers = new Map<string, FSWatcher>();

  constructor() {
    this.registerIpcHandlers();
  }

  private registerIpcHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.FS_READ, async (_event, filePath: string) => {
      return this.readFile(filePath);
    });

    ipcMain.handle(IPC_CHANNELS.FS_WRITE, async (_event, filePath: string, content: string) => {
      return this.writeFile(filePath, content);
    });

    ipcMain.handle(IPC_CHANNELS.FS_LIST, async (_event, dirPath: string) => {
      return this.listFiles(dirPath);
    });

    ipcMain.handle(IPC_CHANNELS.FS_DELETE, async (_event, filePath: string) => {
      return this.deleteFile(filePath);
    });

    ipcMain.handle(IPC_CHANNELS.FS_WATCH, async (_event, filePath: string) => {
      this.watchPath(filePath);
      return true;
    });

    ipcMain.handle(IPC_CHANNELS.FS_UNWATCH, async (_event, filePath: string) => {
      this.unwatchPath(filePath);
      return true;
    });
  }

  private assertAllowed(targetPath: string): string {
    const resolved = path.isAbsolute(targetPath) ? path.normalize(targetPath) : path.normalize(path.join(process.cwd(), targetPath));
    const allowedBases = [
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), 'skills'),
      path.join(process.cwd(), 'tmp'),
    ].map((base) => path.normalize(base));

    if (!allowedBases.some((base) => resolved === base || resolved.startsWith(base + path.sep))) {
      throw new Error('Access denied: path outside allowed directories');
    }

    return resolved;
  }

  async readFile(filePath: string): Promise<ReadFileResult> {
    const fullPath = this.assertAllowed(filePath);
    const ext = path.extname(fullPath).slice(1);

    if (isImageExtension(ext)) {
      const buffer = await fs.readFile(fullPath);
      const mimeType = MIME_TYPE_MAP[ext.toLowerCase()] ?? 'application/octet-stream';
      return {
        content: `data:${mimeType};base64,${buffer.toString('base64')}`,
        encoding: 'base64',
        contentType: mimeType,
      };
    }

    return {
      content: await fs.readFile(fullPath, 'utf-8'),
      encoding: 'utf-8',
    };
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.assertAllowed(filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async listFiles(dirPath: string): Promise<ElectronFileEntry[]> {
    const fullPath = this.assertAllowed(dirPath);
    const items = await this.scanDirectory(fullPath);
    return items.sort((a, b) => a.path.localeCompare(b.path));
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = this.assertAllowed(filePath);
    await fs.unlink(fullPath);
  }

  private watchPath(targetPath: string): void {
    const fullPath = this.assertAllowed(targetPath);
    if (this.watchers.has(fullPath)) {
      return;
    }

    const watcher = watch(fullPath, { recursive: false }, (_eventType, filename) => {
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send(IPC_CHANNELS.FS_CHANGED, {
          path: filename ? path.join(fullPath, filename.toString()) : fullPath,
        });
      });
    });

    this.watchers.set(fullPath, watcher);
  }

  private async scanDirectory(dirPath: string): Promise<ElectronFileEntry[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items: ElectronFileEntry[] = [];

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      const stats = await fs.stat(entryPath);

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

  private unwatchPath(targetPath: string): void {
    const fullPath = this.assertAllowed(targetPath);
    const watcher = this.watchers.get(fullPath);
    if (!watcher) {
      return;
    }

    watcher.close();
    this.watchers.delete(fullPath);
  }

  dispose(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }
}
