"use strict";
/**
 * Memory Tracker（Story R.5）
 *
 * 在 turn_end 后记录记忆条目，达到 N 轮阈值时自动刷盘到 Memory.md。
 * 运行记忆由 pi-agent 消息历史承载，Memory.md 仅做定期持久化。
 *
 * Story R.7: 新增 JSONL 历史存储 + Dream cursor 支持。
 * Story C.9: 新增 Memory Block 模式（Letta 三元记忆）+ Recall 检索。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryBlockManager = exports.MemoryTracker = void 0;
exports.readRecentHistoryFromPath = readRecentHistoryFromPath;
exports.searchHistoryFromPath = searchHistoryFromPath;
exports.parseBlocksFromMarkdown = parseBlocksFromMarkdown;
exports.serializeBlocksToMarkdown = serializeBlocksToMarkdown;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const types_1 = require("../../../../lib/integrations/pi-agent/cognitive/types");
const memory_core_1 = require("../../../../modules/memory-core");
class MemoryTracker {
    constructor(agentDir, threshold) {
        this.entries = [];
        this._turnCount = 0;
        this.agentDir = agentDir;
        this.historyFilePath = path_1.default.join(agentDir, 'memory', 'history.jsonl');
        this.dreamCursorPath = path_1.default.join(agentDir, '.dream_cursor');
        this.flushThreshold = threshold ?? 50;
        this.ensureHistoryDir();
    }
    /** 当前累计轮数 */
    get turnCount() {
        return this._turnCount;
    }
    /**
     * turn_end 后调用，记录本轮交互记忆。
     * 使用简单的启发式提取摘要（截取前 200 字符）。
     */
    recordTurn(userMessage, turnNumber) {
        this._turnCount++;
        const summary = userMessage.length > 200
            ? userMessage.slice(0, 200) + '...'
            : userMessage;
        const keyInfo = userMessage
            .split(/[.!?\n]/)
            .map(s => s.trim())
            .filter(s => s.length > 10 && s.length <= 100)
            .slice(0, 3);
        const entry = {
            turnNumber,
            summary,
            keyInfo,
            timestamp: Date.now(),
        };
        this.entries.push(entry);
        // R.7: 追加写入 JSONL 历史
        this.appendHistoryEntry(JSON.stringify(entry));
    }
    shouldFlush() {
        return this._turnCount >= this.flushThreshold;
    }
    async flushMemory(_existingContent) {
        if (this.entries.length === 0)
            return;
        const core = new memory_core_1.MemoryCore(this.agentDir);
        await core.initialize();
        await core.shutdown();
        this.entries = [];
        this._turnCount = 0;
    }
    async forceFlush(existingContent) {
        await this.flushMemory(existingContent);
    }
    getState() {
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
    ensureHistoryDir() {
        const memoryDir = path_1.default.join(this.agentDir, 'memory');
        if (!(0, fs_1.existsSync)(memoryDir)) {
            (0, fs_1.mkdirSync)(memoryDir, { recursive: true });
        }
    }
    /** 追加 JSONL 历史条目 */
    appendHistoryEntry(entry) {
        try {
            (0, fs_1.writeFileSync)(this.historyFilePath, entry + '\n', { flag: 'a' });
        }
        catch (err) {
            console.error('[MemoryTracker] Failed to append history entry:', err);
        }
    }
    /**
     * 读取自指定 cursor 以来的增量历史。
     *
     * @param sinceCursor 上次处理的行号（从 1 开始，0 表示从头开始）
     * @returns 增量历史文本
     */
    readRecentHistory(sinceCursor) {
        if (!(0, fs_1.existsSync)(this.historyFilePath))
            return '';
        try {
            const content = (0, fs_1.readFileSync)(this.historyFilePath, 'utf-8');
            const lines = content.split('\n').filter(Boolean);
            if (sinceCursor <= 0 || sinceCursor >= lines.length) {
                // 没有新数据
                return '';
            }
            // 从 cursor 开始读取
            const recentLines = lines.slice(sinceCursor);
            return recentLines.join('\n');
        }
        catch (err) {
            console.error('[MemoryTracker] Failed to read recent history:', err);
            return '';
        }
    }
    /** 获取 Dream cursor（上次处理到的行号） */
    getDreamCursor() {
        if (!(0, fs_1.existsSync)(this.dreamCursorPath))
            return 0;
        try {
            const content = (0, fs_1.readFileSync)(this.dreamCursorPath, 'utf-8').trim();
            return parseInt(content, 10) || 0;
        }
        catch {
            return 0;
        }
    }
    /** 设置 Dream cursor */
    setDreamCursor(cursor) {
        try {
            (0, fs_1.writeFileSync)(this.dreamCursorPath, String(cursor), 'utf-8');
        }
        catch (err) {
            console.error('[MemoryTracker] Failed to set dream cursor:', err);
        }
    }
}
exports.MemoryTracker = MemoryTracker;
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
class MemoryBlockManager {
    constructor(agentDir) {
        this.initialized = false;
        this.core = new memory_core_1.MemoryCore(agentDir);
        this.initialized = true;
    }
    /** 获取指定 block */
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
    /** 设置 block 内容 */
    setBlock(label, value) {
        const existing = this.core.memory.getBlock(label);
        if (existing) {
            this.core.memory.setBlock(label, value);
            return;
        }
        this.core.memory.createBlock({
            label,
            description: 'Custom block',
            limit: 2000,
        }, value);
    }
    /** 追加内容到 block */
    appendBlock(label, content) {
        const block = this.core.memory.getBlock(label);
        if (!block || block.readOnly)
            return;
        this.core.memory.appendBlock(label, content);
    }
    /** 精确替换 block 中的内容 */
    replaceBlock(label, oldContent, newContent) {
        const block = this.core.memory.getBlock(label);
        if (!block || block.readOnly)
            return false;
        return this.core.memory.replaceBlock(label, oldContent, newContent);
    }
    /** 删除 block */
    deleteBlock(label) {
        this.core.memory.deleteBlock(label);
    }
    /** 列出所有 blocks */
    listBlocks() {
        return this.core.memory.listBlocks().map((block) => ({
            label: block.label,
            value: block.value,
            limit: block.limit,
            description: block.description,
            metadata: block.metadata,
            readOnly: block.readOnly,
        }));
    }
    /** 检查 block 是否接近上限 */
    nearLimit(label, threshold = 0.8) {
        const block = this.core.memory.getBlock(label);
        if (!block)
            return false;
        return block.value.length >= block.limit * threshold;
    }
    /** 是否已初始化 */
    get isInitialized() {
        return this.initialized;
    }
    /** 获取 Core Memory 全文（用于 prompt 注入） */
    getCoreMemory() {
        return this.core.memory.compile({ format: 'markdown' });
    }
}
exports.MemoryBlockManager = MemoryBlockManager;
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
function readRecentHistoryFromPath(historyFilePath, sinceCursor) {
    if (!(0, fs_1.existsSync)(historyFilePath))
        return '';
    try {
        const content = (0, fs_1.readFileSync)(historyFilePath, 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        if (sinceCursor <= 0 || sinceCursor >= lines.length)
            return '';
        return lines.slice(sinceCursor).join('\n');
    }
    catch {
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
function searchHistoryFromPath(historyFilePath, query, maxResults = 5) {
    if (!(0, fs_1.existsSync)(historyFilePath))
        return '';
    try {
        const content = (0, fs_1.readFileSync)(historyFilePath, 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        const queryLower = query.toLowerCase();
        // 关键词分词（按空格和中文字符边界）
        const keywords = queryLower.split(/[\s,，]+/).filter(Boolean);
        const results = [];
        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                const text = `${entry.summary ?? ''} ${(entry.keyInfo ?? []).join(' ')}`.toLowerCase();
                // 简单评分：匹配关键词数量
                let score = 0;
                for (const kw of keywords) {
                    if (text.includes(kw))
                        score++;
                }
                if (score > 0) {
                    results.push({
                        turn: entry.turnNumber ?? 0,
                        score,
                        text: entry.summary ?? '',
                    });
                }
            }
            catch {
                continue; // 跳过无效行
            }
        }
        // 按评分降序，取 top-N
        results.sort((a, b) => b.score - a.score);
        const topResults = results.slice(0, maxResults);
        if (topResults.length === 0)
            return '';
        const lines_out = ['**Search Results:**\n'];
        for (const r of topResults) {
            lines_out.push(`- Turn #${r.turn}: ${r.text}`);
        }
        return lines_out.join('\n');
    }
    catch {
        return '';
    }
}
// ============================================================================
// Block 解析/序列化
// ============================================================================
/** 解析 Block 元数据行，如 `{description: xxx}` */
function parseMetaLine(line) {
    const trimmed = line.trim();
    const descMatch = trimmed.match(/^\{description:\s*(.+?)\}$/);
    const limitMatch = trimmed.match(/^\{limit:\s*(\d+)\}$/);
    const readOnlyMatch = trimmed.match(/^\{readOnly:\s*(true|false)\}$/);
    const meta = {};
    if (descMatch)
        meta.description = descMatch[1] ?? meta.description ?? '';
    if (limitMatch)
        meta.limit = parseInt(limitMatch[1] ?? '0', 10);
    if (readOnlyMatch)
        meta.readOnly = readOnlyMatch[1] === 'true';
    return meta;
}
/** 从 Memory.md 内容解析出所有 blocks */
function parseBlocksFromMarkdown(content) {
    const blocks = new Map();
    const lines = content.split('\n');
    let currentLabel = null;
    let currentValue = '';
    let currentMeta = {};
    let inMetaSection = false;
    function saveCurrent() {
        if (currentLabel) {
            const def = types_1.DEFAULT_BLOCKS.find(d => d.label === currentLabel);
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
            }
            else if (line.trim() === '') {
                // 空行结束元数据区
                inMetaSection = false;
                continue;
            }
            else {
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
function serializeBlocksToMarkdown(blocks) {
    const lines = ['# Memory\n'];
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
