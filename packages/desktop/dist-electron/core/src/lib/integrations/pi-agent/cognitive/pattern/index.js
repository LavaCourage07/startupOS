"use strict";
/**
 * PatternProvider — 新版（cognitive/pattern/）
 *
 * 职责分层：
 *   - 上层：信号提取（CorrectionDetector + extractor）、Patterns.md 渲染
 *   - 底层：ArchivalMemory 存储 + 语义检索（由 Memory Core 提供）
 *
 * 替代旧版 cognitive/pattern-provider.ts 和
 * modules/memory-core/session/enhanced-pattern-provider.ts。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternProvider = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const correction_detector_1 = require("./correction-detector");
const extractor_1 = require("./extractor");
const renderer_1 = require("./renderer");
const pattern_ingest_1 = require("../../../../../modules/memory-core/archival/pattern-ingest");
const pattern_ingest_2 = require("../../../../../modules/memory-core/archival/pattern-ingest");
class PatternProvider {
    constructor(agentDir, archival) {
        this.name = 'pattern';
        this.migrated = false;
        this.agentDir = agentDir;
        this.archival = archival;
        this.snapshotMdPath = path_1.default.join(agentDir, 'Patterns.md');
        this.migrationMarkerPath = path_1.default.join(agentDir, 'archival', '.pattern-migration-v1.json');
        this.renderer = new renderer_1.PatternRenderer(agentDir, archival);
    }
    /** 启动时一次性迁移旧数据 */
    async initialize() {
        if (this.migrated)
            return;
        this.migrated = true;
        if ((0, fs_1.existsSync)(this.migrationMarkerPath))
            return;
        const startedAt = Date.now();
        const result = await (0, pattern_ingest_1.migratePatternsToArchival)(this.archival, this.agentDir).catch(() => null);
        (0, fs_1.mkdirSync)(path_1.default.dirname(this.migrationMarkerPath), { recursive: true });
        (0, fs_1.writeFileSync)(this.migrationMarkerPath, JSON.stringify({
            version: 1,
            migratedAt: new Date().toISOString(),
            elapsedMs: Date.now() - startedAt,
            patternsMigrated: result?.patternsMigrated ?? 0,
            reflectionsMigrated: result?.reflectionsMigrated ?? 0,
        }, null, 2), 'utf-8');
    }
    async sync_turn(data) {
        const signals = (0, correction_detector_1.detectCorrections)(data.userMessage);
        // 回写 outcome（供 PracticeLogger 落盘使用）
        if (signals.length > 0) {
            data.outcome.userCorrections = (data.outcome.userCorrections ?? 0) + signals.length;
            data.outcome['correctionSignals'] = signals;
        }
        await (0, extractor_1.extractAndIngest)(data, signals, this.archival);
        // 若检测到工具失败，额外写入 Reflexion 反思
        const failed = data.toolCalls.filter(t => !t.success);
        if (failed.length > 0) {
            await (0, pattern_ingest_2.ingestReflectionToArchival)(this.archival, {
                scene: data.userMessage,
                toolChain: data.toolCalls.map(t => t.name),
                failureReason: failed.map(t => `${t.name}: ${t.result}`).join('; '),
                lesson: `工具链在当前场景下不可靠，建议寻找替代路径`,
                tryNextTime: `避免 ${failed.map(t => t.name).join(', ')} 路径`,
            }).catch(() => { });
        }
    }
    async prefetch(query) {
        const results = await this.archival.search(query, { limit: 5, tags: ['pattern'] });
        if (results.length === 0)
            return null;
        const parts = ['## Relevant Patterns\n'];
        for (const r of results) {
            parts.push(`- [score: ${r.score.toFixed(2)}] ${r.text.split('\n')[0]}`);
        }
        return parts.join('\n');
    }
    async system_prompt_block() {
        if ((0, fs_1.existsSync)(this.snapshotMdPath)) {
            const content = (0, fs_1.readFileSync)(this.snapshotMdPath, 'utf-8').trim();
            if (content) {
                return `## Experience Patterns Snapshot\n\n${content}`;
            }
        }
        return '';
    }
    async on_session_end(_messages) {
        await this.renderer.regenerate();
    }
}
exports.PatternProvider = PatternProvider;
