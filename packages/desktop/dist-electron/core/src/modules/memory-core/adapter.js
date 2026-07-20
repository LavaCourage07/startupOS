"use strict";
/**
 * MemoryAdapter — 兼容旧 MemoryTracker/MemoryBlockManager API。
 *
 * Story M.6: 让新 MemoryCore 通过 adapter 兼容所有现有调用方，
 * 确保现有代码无需修改即可使用新模块。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryAdapter = void 0;
class MemoryAdapter {
    constructor(core) {
        this.core = core;
    }
    // --- MemoryTracker 兼容 ---
    recordTurn(userMessage, turnNumber) {
        this.core.recall.recordTurn({ turnNumber, userMessage });
    }
    getDreamCursor() {
        return this.core.recall.getDreamCursor();
    }
    setDreamCursor(cursor) {
        this.core.recall.setDreamCursor(cursor);
    }
    readRecentHistory(sinceCursor) {
        return this.core.recall.readRecentHistory(sinceCursor);
    }
    // --- MemoryBlockManager 兼容 ---
    getBlock(label) {
        const block = this.core.memory.getBlock(label);
        if (!block)
            return null;
        return {
            label: block.label,
            value: block.value,
            limit: block.limit,
            description: block.description,
            metadata: block.metadata,
            readOnly: block.readOnly,
        };
    }
    setBlock(label, value) {
        this.core.memory.setBlock(label, value);
    }
    appendBlock(label, content) {
        this.core.memory.appendBlock(label, content);
    }
    replaceBlock(label, old, replacement) {
        return this.core.memory.replaceBlock(label, old, replacement);
    }
    getCoreMemory() {
        return this.core.memory.compile({ format: 'markdown' });
    }
    // --- Recall search 兼容 ---
    searchHistoryFromPath(_historyFilePath, query, maxResults = 5) {
        const semantic = this.core.recall.searchKeyword(query, maxResults);
        if (semantic.length > 0) {
            return semantic.map((r) => `- Turn #${r.turnNumber}: ${r.summary}`).join('\n');
        }
        return '';
    }
}
exports.MemoryAdapter = MemoryAdapter;
