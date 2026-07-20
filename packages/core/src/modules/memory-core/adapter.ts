/**
 * MemoryAdapter — 兼容旧 MemoryTracker/MemoryBlockManager API。
 *
 * Story M.6: 让新 MemoryCore 通过 adapter 兼容所有现有调用方，
 * 确保现有代码无需修改即可使用新模块。
 */

import { MemoryCore } from './core/memory-core';
import type { MemoryBlock } from '../../lib/shared/cognitive';

export class MemoryAdapter {
  private core: MemoryCore;

  constructor(core: MemoryCore) {
    this.core = core;
  }

  // --- MemoryTracker 兼容 ---

  recordTurn(userMessage: string, turnNumber: number): void {
    this.core.recall.recordTurn({ turnNumber, userMessage });
  }

  getDreamCursor(): number {
    return this.core.recall.getDreamCursor();
  }

  setDreamCursor(cursor: number): void {
    this.core.recall.setDreamCursor(cursor);
  }

  readRecentHistory(sinceCursor: number): string {
    return this.core.recall.readRecentHistory(sinceCursor);
  }

  // --- MemoryBlockManager 兼容 ---

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

  setBlock(label: string, value: string): void {
    this.core.memory.setBlock(label, value);
  }

  appendBlock(label: string, content: string): void {
    this.core.memory.appendBlock(label, content);
  }

  replaceBlock(label: string, old: string, replacement: string): boolean {
    return this.core.memory.replaceBlock(label, old, replacement);
  }

  getCoreMemory(): string {
    return this.core.memory.compile({ format: 'markdown' });
  }

  // --- Recall search 兼容 ---

  searchHistoryFromPath(
    _historyFilePath: string,
    query: string,
    maxResults = 5,
  ): string {
    const semantic = this.core.recall.searchKeyword(query, maxResults);
    if (semantic.length > 0) {
      return semantic.map((r) => `- Turn #${r.turnNumber}: ${r.summary}`).join('\n');
    }
    return '';
  }
}
