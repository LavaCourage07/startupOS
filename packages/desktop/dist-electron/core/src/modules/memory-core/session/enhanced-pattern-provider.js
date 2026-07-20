"use strict";
/**
 * Pattern Provider — 增强版（集成 Archival Memory）。
 *
 * Story M.7: PatternProvider 的 prefetch 和 searchReflections
 * 优先走 Archival 语义搜索，回退到关键词匹配。
 *
 * 使用方式：在 launcher 中用此替代原 PatternProvider，
 * 或在原 PatternProvider 中注入 Archival 引用。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedPatternProvider = void 0;
const pattern_ingest_1 = require("../archival/pattern-ingest");
class EnhancedPatternProvider {
    constructor(agentDir, archival) {
        this.name = 'pattern';
        this.migrated = false;
        this.agentDir = agentDir;
        this.archival = archival;
    }
    /**
     * Agent 启动时调用，执行一次性迁移。
     */
    async initialize() {
        if (this.migrated)
            return { patternsMigrated: 0, reflectionsMigrated: 0 };
        this.migrated = true;
        return (0, pattern_ingest_1.migratePatternsToArchival)(this.archival, this.agentDir);
    }
    /**
     * 语义搜索 Pattern（优先）+ 关键词回退。
     */
    async prefetch(query) {
        const archivalResults = await this.archival.search(query, {
            limit: 5,
            tags: ['pattern'],
        });
        if (archivalResults.length > 0) {
            const parts = ['## Relevant Patterns (Semantic)\n'];
            for (const r of archivalResults) {
                parts.push(`- [score: ${r.score.toFixed(2)}] ${r.text}`);
            }
            return parts.join('\n');
        }
        // 回退：关键词搜索所有条目，过滤 pattern 标签
        const allEntries = this.archival.getAll(50);
        const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const matched = allEntries
            .filter(e => e.tags.includes('pattern'))
            .filter(e => {
            const text = e.text.toLowerCase();
            return keywords.some(kw => text.includes(kw));
        })
            .slice(0, 5);
        if (matched.length > 0) {
            const parts = ['## Relevant Patterns (Keyword)\n'];
            for (const m of matched) {
                parts.push(`- ${m.text}`);
            }
            return parts.join('\n');
        }
        return null;
    }
    /**
     * 语义搜索 Reflection（优先）+ Jaccard 回退。
     */
    async searchReflections(query) {
        const archivalResults = await this.archival.search(query, {
            limit: 5,
            tags: ['reflection'],
        });
        if (archivalResults.length > 0) {
            const lines = ['## 历史失败反思（语义匹配）\n'];
            for (const r of archivalResults) {
                lines.push(`- [score: ${r.score.toFixed(2)}] ${r.text}`);
            }
            return lines.join('\n');
        }
        // 回退：关键词搜索
        const allEntries = this.archival.getAll(50);
        const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const matched = allEntries
            .filter(e => e.tags.includes('reflection'))
            .filter(e => {
            const text = e.text.toLowerCase();
            return keywords.some(kw => text.includes(kw));
        })
            .slice(0, 3);
        if (matched.length > 0) {
            const lines = ['## 历史失败反思（关键词）\n'];
            for (const m of matched) {
                lines.push(`- ${m.text}`);
            }
            return lines.join('\n');
        }
        return null;
    }
    /**
     * Pattern sync_turn：接收 TurnCognitiveData，从 toolCalls 推导 toolChain / successRate / resultSummaries。
     */
    async sync_turn(data) {
        const toolCalls = data.toolCalls ?? [];
        const toolChain = toolCalls.map(tc => tc.name);
        const successCount = toolCalls.filter(tc => tc.success).length;
        const successRate = toolCalls.length > 0 ? (successCount / toolCalls.length) * 100 : 100;
        const resultSummaries = toolCalls.map(tc => tc.result).filter(Boolean);
        await (0, pattern_ingest_1.ingestPatternToArchival)(this.archival, {
            toolChain,
            successRate,
            avgToolCalls: toolCalls.length,
            sampleCount: 1,
            lastScene: data.userMessage ?? '',
            lastThinking: '',
            lastResultSummaries: resultSummaries,
        }, data.outcome?.resolved === false);
    }
    /**
     * Reflection sync_turn：从 toolCalls 中的失败条目生成反思。
     */
    async sync_reflection(data) {
        await (0, pattern_ingest_1.ingestReflectionToArchival)(this.archival, data);
    }
    /**
     * System prompt block：返回 Patterns 快照用于注入 system prompt。
     */
    async system_prompt_block() {
        const entries = this.archival.getAll(50);
        const patterns = entries.filter(e => e.tags.includes('pattern'));
        if (patterns.length === 0)
            return '';
        const parts = ['# Patterns Library\n'];
        for (const p of patterns.slice(0, 10)) {
            parts.push(`- ${p.text}`);
        }
        return parts.join('\n');
    }
}
exports.EnhancedPatternProvider = EnhancedPatternProvider;
