import { appendFileSync, mkdirSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export type LogChannel = 'desktop' | 'llm';

export interface DailyLogWriterOptions {
  logsDir: string;
  now?: () => Date;
  appendFile?: (filePath: string, content: string) => void;
  ensureDirectory?: (directoryPath: string) => void;
}

function formatLocalDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class DailyLogWriter {
  private readonly logsDir: string;
  private readonly now: () => Date;
  private readonly appendFile: (filePath: string, content: string) => void;
  private readonly ensureDirectory: (directoryPath: string) => void;

  constructor(options: DailyLogWriterOptions) {
    this.logsDir = path.resolve(options.logsDir);
    this.now = options.now ?? (() => new Date());
    this.appendFile =
      options.appendFile ??
      ((filePath, content) => {
        appendFileSync(filePath, content, 'utf8');
      });
    this.ensureDirectory =
      options.ensureDirectory ??
      ((directoryPath) => {
        mkdirSync(directoryPath, { recursive: true });
      });
  }

  resolvePath(channel: LogChannel, at: Date = this.now()): string {
    return path.join(this.logsDir, `${channel}-${formatLocalDate(at)}.log`);
  }

  append(channel: LogChannel, line: string): boolean {
    if (!line) {
      return true;
    }

    try {
      this.ensureDirectory(this.logsDir);
      this.appendFile(this.resolvePath(channel), line);
      return true;
    } catch {
      return false;
    }
  }
}

export interface BufferedDailyLogWriterOptions {
  logsDir: string;
  now?: () => Date;
  flushDelayMs?: number;
  maxBytes?: number;
  appendFile?: (filePath: string, content: string) => Promise<void>;
  ensureDirectory?: (directoryPath: string) => Promise<void>;
  setTimer?: (callback: () => void, delayMs: number) => NodeJS.Timeout;
  clearTimer?: (timer: NodeJS.Timeout) => void;
}

export class BufferedDailyLogWriter {
  private readonly resolver: DailyLogWriter;
  private readonly logsDir: string;
  private readonly flushDelayMs: number;
  private readonly maxBytes: number;
  private readonly appendFile: (filePath: string, content: string) => Promise<void>;
  private readonly ensureDirectory: (directoryPath: string) => Promise<void>;
  private readonly setTimer: (callback: () => void, delayMs: number) => NodeJS.Timeout;
  private readonly clearTimer: (timer: NodeJS.Timeout) => void;
  private readonly pending = new Map<string, string[]>();
  private pendingBytes = 0;
  private timer: NodeJS.Timeout | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(options: BufferedDailyLogWriterOptions) {
    this.logsDir = path.resolve(options.logsDir);
    this.resolver = new DailyLogWriter({
      logsDir: this.logsDir,
      now: options.now,
    });
    this.flushDelayMs = options.flushDelayMs ?? 100;
    this.maxBytes = options.maxBytes ?? 64 * 1024;
    this.appendFile = options.appendFile ?? ((filePath, content) => appendFile(filePath, content, 'utf8'));
    this.ensureDirectory = options.ensureDirectory ?? (async directoryPath => {
      await mkdir(directoryPath, { recursive: true });
    });
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
  }

  resolvePath(channel: LogChannel, at?: Date): string {
    return this.resolver.resolvePath(channel, at);
  }

  append(channel: LogChannel, line: string): boolean {
    if (this.disposed || !line) {
      return !this.disposed;
    }

    const filePath = this.resolvePath(channel);
    const chunks = this.pending.get(filePath) ?? [];
    chunks.push(line);
    this.pending.set(filePath, chunks);
    this.pendingBytes += Buffer.byteLength(line, 'utf8');

    if (this.pendingBytes >= this.maxBytes) {
      void this.flush();
    } else if (!this.timer) {
      this.timer = this.setTimer(() => {
        void this.flush();
      }, this.flushDelayMs);
      this.timer.unref?.();
    }
    return true;
  }

  flush(): Promise<void> {
    if (this.timer) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    if (this.pending.size === 0) {
      return this.writeChain;
    }

    const batch = Array.from(this.pending, ([filePath, chunks]) => ({
      filePath,
      content: chunks.join(''),
    }));
    this.pending.clear();
    this.pendingBytes = 0;
    this.writeChain = this.writeChain
      .then(async () => {
        await this.ensureDirectory(this.logsDir);
        for (const entry of batch) {
          await this.appendFile(entry.filePath, entry.content);
        }
      })
      .catch(() => undefined);
    return this.writeChain;
  }

  async dispose(): Promise<void> {
    await this.flush();
    this.disposed = true;
  }
}
