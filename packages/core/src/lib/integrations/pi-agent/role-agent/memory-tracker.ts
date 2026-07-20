/**
 * Memory Tracker（Story R.5）
 *
 * 在 turn_end 后记录记忆条目，达到 N 轮阈值时自动刷盘到 Memory.md。
 * 运行记忆由 pi-agent 消息历史承载，Memory.md 仅做定期持久化。
 *
 * Story R.7: 新增 JSONL 历史存储 + Dream cursor 支持。
 * Story C.9: 新增 Memory Block 模式（Letta 三元记忆）+ Recall 检索。
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import {
  MemoryBlock,
  DEFAULT_BLOCKS,
} from '../../../../lib/integrations/pi-agent/cognitive/types';
import { MemoryCore } from '../../../../modules/memory-core';

/** 单轮记忆条目 */
export interface MemoryEntry {
  turnNumber: number;
  summary: string;
  keyInfo: string[];
  timestamp: number;
}

/** MemoryTracker 内部状态 */
export interface MemoryTrackerState {
  entries: MemoryEntry[];
  turnCount: number;
  flushThreshold: number;
}

export class MemoryTracker {
  private readonly agentDir: string;
  private readonly historyFilePath: string;
  private readonly dreamCursorPath: string;
  private entries: MemoryEntry[] = [];
  private _turnCount = 0;
  readonly flushThreshold: number;

  constructor(agentDir: string, threshold?: number) {
    this.agentDir = agentDir;
    this.historyFilePath = path.join(agentDir, 'memory', 'history.jsonl');
    this.dreamCursorPath = path.join(agentDir, '.dream_cursor');
    this.flushThreshold = threshold ?? 50;

    this.ensureHistoryDir();
  }

  /** 当前累计轮数 */
  get turnCount(): number {
    return this._turnCount;
  }

  /**
   * turn_end 后调用，记录本轮交互记忆。
   * 使用简单的启发式提取摘要（截取前 200 字符）。
   */
  recordTurn(userMessage: string, turnNumber: number): void {
    this._turnCount++;

    const summary = userMessage.length > 200
      ? userMessage.slice(0, 200) + '...'
      : userMessage;

    const keyInfo = userMessage
      .split(/[.!?\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 10 && s.length <= 100)
      .slice(0, 3);

    const entry: MemoryEntry = {
      turnNumber,
      summary,
      keyInfo,
      timestamp: Date.now(),
    };

    this.entries.push(entry);

    // R.7: 追加写入 JSONL 历史
    this.appendHistoryEntry(JSON.stringify(entry));
  }

  shouldFlush(): boolean {
    return this._turnCount >= this.flushThreshold;
  }

  async flushMemory(_existingContent: string | null): Promise<void> {
    if (this.entries.length === 0) return;

    const core = new MemoryCore(this.agentDir);
    await core.initialize();
    await core.shutdown();

    this.entries = [];
    this._turnCount = 0;
  }

  async forceFlush(existingContent: string | null): Promise<void> {
    await this.flushMemory(existingContent);
  }

  getState(): MemoryTrackerState {
    return {
      entries: [...this.entries],
      turnCount: this._turnCount,
      flushThreshold: this.flushThreshold,
    };
  }
  // ==========================================================================
  // R.7: JSONL 历史存储 + Dream cursor
  // ==========================================================================

  /** 确保 memory/ 目录存在 */
  private ensureHistoryDir(): void {
    const memoryDir = path.join(this.agentDir, 'memory');
    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true });
    }
  }

  /** 追加 JSONL 历史条目 */
  private appendHistoryEntry(entry: string): void {
    try {
      writeFileSync(this.historyFilePath, entry + '\n', { flag: 'a' });
    } catch (err) {
      console.error('[MemoryTracker] Failed to append history entry:', err);
    }
  }

  /**
   * 读取自指定 cursor 以来的增量历史。
   *
   * @param sinceCursor 上次处理的行号（从 1 开始，0 表示从头开始）
   * @returns 增量历史文本
   */
  readRecentHistory(sinceCursor: number): string {
    if (!existsSync(this.historyFilePath)) return '';

    try {
      const content = readFileSync(this.historyFilePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      if (sinceCursor <= 0 || sinceCursor >= lines.length) {
        // 没有新数据
        return '';
      }

      // 从 cursor 开始读取
      const recentLines = lines.slice(sinceCursor);
      return recentLines.join('\n');
    } catch (err) {
      console.error('[MemoryTracker] Failed to read recent history:', err);
      return '';
    }
  }

  /** 获取 Dream cursor（上次处理到的行号） */
  getDreamCursor(): number {
    if (!existsSync(this.dreamCursorPath)) return 0;

    try {
      const content = readFileSync(this.dreamCursorPath, 'utf-8').trim();
      return parseInt(content, 10) || 0;
    } catch {
      return 0;
    }
  }

  /** 设置 Dream cursor */
  setDreamCursor(cursor: number): void {
    try {
      writeFileSync(this.dreamCursorPath, String(cursor), 'utf-8');
    } catch (err) {
      console.error('[MemoryTracker] Failed to set dream cursor:', err);
    }
  }
}

// ============================================================================
// C.9: Memory Block Manager（Letta 三元记忆）
// ============================================================================

/** Memory.md 中单个 block 的元数据解析结果 */
interface BlockMeta {
  description: string;
  limit: number;
  readOnly: boolean;
}

/**
 * Memory Block 管理器。
 *
 * 负责 Memory.md 的 block 结构解析、生成和 CRUD 操作。
 * Memory.md 格式：
 *
 * ## {label}
 * {description: xxx}
 * {limit: N}
 * {readOnly: true}
 *
 * block content...
 */
export class MemoryBlockManager {
  private readonly core: MemoryCore;
  private initialized = false;

  constructor(agentDir: string) {
    this.core = new MemoryCore(agentDir);
    this.initialized = true;
  }

  /** 获取指定 block */
  getBlock(label: string): MemoryBlock | null {
    const block = this.core.memory.getBlock(label);
    if (!block) return null;
    return {
      label: block.label,
      value: block.value,
      limit: block.limit,
      description: block.description,
      metadata: block.metadata as Record<string, unknown>,
      readOnly: block.readOnly,
    };
  }

  /** 设置 block 内容 */
  setBlock(label: string, value: string): void {
    const existing = this.core.memory.getBlock(label);
    if (existing) {
      this.core.memory.setBlock(label, value);
      return;
    }

    this.core.memory.createBlock(
      {
        label,
        description: 'Custom block',
        limit: 2000,
      },
      value,
    );
  }

  /** 追加内容到 block */
  appendBlock(label: string, content: string): void {
    const block = this.core.memory.getBlock(label);
    if (!block || block.readOnly) return;
    this.core.memory.appendBlock(label, content);
  }

  /** 精确替换 block 中的内容 */
  replaceBlock(label: string, oldContent: string, newContent: string): boolean {
    const block = this.core.memory.getBlock(label);
    if (!block || block.readOnly) return false;
    return this.core.memory.replaceBlock(label, oldContent, newContent);
  }

  /** 删除 block */
  deleteBlock(label: string): void {
    this.core.memory.deleteBlock(label);
  }

  /** 列出所有 blocks */
  listBlocks(): MemoryBlock[] {
    return this.core.memory.listBlocks().map((block) => ({
      label: block.label,
      value: block.value,
      limit: block.limit,
      description: block.description,
      metadata: block.metadata as Record<string, unknown>,
      readOnly: block.readOnly,
    }));
  }

  /** 检查 block 是否接近上限 */
  nearLimit(label: string, threshold = 0.8): boolean {
    const block = this.core.memory.getBlock(label);
    if (!block) return false;
    return block.value.length >= block.limit * threshold;
  }

  /** 是否已初始化 */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /** 获取 Core Memory 全文（用于 prompt 注入） */
  getCoreMemory(): string {
    return this.core.memory.compile({ format: 'markdown' });
  }
}

// ============================================================================
// C.9: Recall 检索（基于 JSONL 历史）
// ============================================================================

/**
 * 从 JSONL 历史中检索相关 turn。
 *
 * @param historyFilePath JSONL 历史文件路径
 * @param sinceCursor 上次处理的行号（从 1 开始，0 表示从头开始）
 * @returns 增量历史文本
 */
export function readRecentHistoryFromPath(historyFilePath: string, sinceCursor: number): string {
  if (!existsSync(historyFilePath)) return '';

  try {
    const content = readFileSync(historyFilePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    if (sinceCursor <= 0 || sinceCursor >= lines.length) return '';

    return lines.slice(sinceCursor).join('\n');
  } catch {
    return '';
  }
}

/**
 * 基于关键词从 JSONL 历史中搜索相关 turn。
 * 简单实现：关键词匹配 summary + keyInfo。
 *
 * @param historyFilePath JSONL 历史文件路径
 * @param query 搜索关键词
 * @param maxResults 最大返回结果数
 * @returns 匹配结果文本
 */
export function searchHistoryFromPath(
  historyFilePath: string,
  query: string,
  maxResults = 5,
): string {
  if (!existsSync(historyFilePath)) return '';

  try {
    const content = readFileSync(historyFilePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const queryLower = query.toLowerCase();

    // 关键词分词（按空格和中文字符边界）
    const keywords = queryLower.split(/[\s,，]+/).filter(Boolean);

    const results: Array<{ turn: number; score: number; text: string }> = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const text = `${entry.summary ?? ''} ${(entry.keyInfo ?? []).join(' ')}`.toLowerCase();

        // 简单评分：匹配关键词数量
        let score = 0;
        for (const kw of keywords) {
          if (text.includes(kw)) score++;
        }
        if (score > 0) {
          results.push({
            turn: entry.turnNumber ?? 0,
            score,
            text: entry.summary ?? '',
          });
        }
      } catch {
        continue; // 跳过无效行
      }
    }

    // 按评分降序，取 top-N
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, maxResults);

    if (topResults.length === 0) return '';

    const lines_out: string[] = ['**Search Results:**\n'];
    for (const r of topResults) {
      lines_out.push(`- Turn #${r.turn}: ${r.text}`);
    }
    return lines_out.join('\n');
  } catch {
    return '';
  }
}

// ============================================================================
// Block 解析/序列化
// ============================================================================

/** 解析 Block 元数据行，如 `{description: xxx}` */
function parseMetaLine(line: string): Partial<BlockMeta> {
  const trimmed = line.trim();
  const descMatch = trimmed.match(/^\{description:\s*(.+?)\}$/);
  const limitMatch = trimmed.match(/^\{limit:\s*(\d+)\}$/);
  const readOnlyMatch = trimmed.match(/^\{readOnly:\s*(true|false)\}$/);

  const meta: Partial<BlockMeta> = {};
  if (descMatch) meta.description = descMatch[1] ?? meta.description ?? '';
  if (limitMatch) meta.limit = parseInt(limitMatch[1] ?? '0', 10);
  if (readOnlyMatch) meta.readOnly = readOnlyMatch[1] === 'true';
  return meta;
}

/** 从 Memory.md 内容解析出所有 blocks */
export function parseBlocksFromMarkdown(content: string): Map<string, MemoryBlock> {
  const blocks = new Map<string, MemoryBlock>();
  const lines = content.split('\n');

  let currentLabel: string | null = null;
  let currentValue = '';
  let currentMeta: Partial<BlockMeta> = {};
  let inMetaSection = false;

  function saveCurrent(): void {
    if (currentLabel) {
      const def = DEFAULT_BLOCKS.find(d => d.label === currentLabel);
      blocks.set(currentLabel, {
        label: currentLabel,
        value: currentValue.trim(),
        limit: currentMeta.limit ?? def?.limit ?? 2000,
        description: currentMeta.description ?? def?.description ?? '',
        metadata: {},
        readOnly: currentMeta.readOnly ?? def?.readOnly ?? false,
      });
    }
  }

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);

    if (headingMatch) {
      // 保存上一个 block
      saveCurrent();

      // 开始新 block
      currentLabel = headingMatch[1]?.trim() ?? null;
      currentValue = '';
      currentMeta = {};
      inMetaSection = true;
      continue;
    }

    if (currentLabel && inMetaSection) {
      if (/^\{.+?\}$/.test(line.trim())) {
        const parsed = parseMetaLine(line);
        Object.assign(currentMeta, parsed);
        continue;
      } else if (line.trim() === '') {
        // 空行结束元数据区
        inMetaSection = false;
        continue;
      } else {
        // 非元数据行，结束元数据区
        inMetaSection = false;
      }
    }

    if (currentLabel) {
      currentValue += line + '\n';
    }
  }

  // 保存最后一个 block
  saveCurrent();

  return blocks;
}

/** 将 blocks 序列化为 Memory.md 格式 */
export function serializeBlocksToMarkdown(blocks: Map<string, MemoryBlock>): string {
  const lines: string[] = ['# Memory\n'];

  for (const [label, block] of blocks) {
    lines.push(`## ${label}`);
    lines.push(`{description: ${block.description}}`);
    lines.push(`{limit: ${block.limit}}`);
    lines.push(`{readOnly: ${block.readOnly}}`);
    lines.push('');
    if (block.value) {
      lines.push(block.value);
    }
    lines.push('');
  }

  return lines.join('\n');
}
