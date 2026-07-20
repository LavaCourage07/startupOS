"use strict";
/**
 * Recall Memory — 对话历史索引 + 语义搜索。
 *
 * Story M.4: 升级现有关键词搜索为语义搜索，保留 keyword 回退。
 * 兼容现有 MemoryTracker.recordTurn() 和 Dream cursor 行为。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecallMemory = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const history_store_1 = require("./history-store");
const embedding_1 = require("../archival/embedding");
class RecallMemory {
    constructor(agentDir, sessionId = 'default') {
        this.entries = [];
        this.historyStore = new history_store_1.HistoryStore(node_path_1.default.join(agentDir, 'memory', 'history'), sessionId);
        this.dreamCursorPath = node_path_1.default.join(agentDir, '.dream_cursor');
        this.loadFromDisk();
    }
    /** 记录一轮对话（兼容现有 MemoryTracker.recordTurn()） */
    recordTurn(data) {
        const entry = {
            turnNumber: data.turnNumber,
            summary: data.userMessage.slice(0, 200),
            userMessage: data.userMessage,
            assistantMessage: data.assistantMessage ?? '',
            toolCalls: data.toolCalls ?? [],
            timestamp: Date.now(),
        };
        this.entries.push(entry);
        this.historyStore.append(entry);
    }
    /** 语义搜索对话历史（ONNX 可用时用余弦相似度，否则用 TF-IDF 向量余弦） */
    async searchSemantic(query, maxResults = 5) {
        const queryEmbedding = await embedding_1.embeddingEngine.encode(query);
        const scored = await Promise.all(this.entries.map(async (entry) => {
            const textContent = `${entry.userMessage} ${entry.assistantMessage ?? ''}`;
            const entryEmbedding = await embedding_1.embeddingEngine.encode(textContent);
            const score = (0, embedding_1.cosineSimilarity)(queryEmbedding, entryEmbedding);
            return {
                turnNumber: entry.turnNumber,
                score,
                summary: entry.summary,
                text: entry.userMessage,
            };
        }));
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, maxResults);
    }
    /** 关键词搜索（回退模式） */
    searchKeyword(query, maxResults = 5) {
        const scored = this.entries.map((entry) => this.scoreKeyword(entry, query));
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, maxResults);
    }
    // ==========================================================================
    // Dream cursor 兼容
    // ==========================================================================
    getDreamCursor() {
        if (!node_fs_1.default.existsSync(this.dreamCursorPath))
            return 0;
        try {
            return parseInt(node_fs_1.default.readFileSync(this.dreamCursorPath, 'utf-8').trim(), 10) || 0;
        }
        catch {
            return 0;
        }
    }
    setDreamCursor(cursor) {
        node_fs_1.default.writeFileSync(this.dreamCursorPath, String(cursor), 'utf-8');
    }
    readRecentHistory(sinceCursor) {
        const entries = this.readSince(sinceCursor);
        return entries
            .map((e) => `Turn #${e.turnNumber}:\nUser: ${e.userMessage}\nAssistant: ${e.assistantMessage ?? ''}\n`)
            .join('\n');
    }
    count() {
        return this.entries.length;
    }
    // ==========================================================================
    // Internal
    // ==========================================================================
    loadFromDisk() {
        this.entries = this.historyStore.readAll();
    }
    readSince(turnNumber) {
        return this.entries.filter((e) => e.turnNumber >= turnNumber);
    }
    scoreKeyword(entry, query) {
        const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
        const text = `${entry.userMessage} ${entry.assistantMessage ?? ''}`.toLowerCase();
        let score = 0;
        for (const term of queryTerms) {
            if (text.includes(term))
                score += 1;
        }
        return {
            turnNumber: entry.turnNumber,
            score: score / Math.max(queryTerms.length, 1),
            summary: entry.summary,
            text: entry.userMessage,
        };
    }
}
exports.RecallMemory = RecallMemory;
