"use strict";
/**
 * 实践日志记录系统（Story C.4）
 *
 * 每次 turn 自动记录结构化数据到 practice/turns/turn-{N}.json
 * 异步写入，不阻塞 Agent 响应
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PracticeLogger = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
// ============================================================================
// PracticeLogger
// ============================================================================
class PracticeLogger {
    constructor(agentDir) {
        this.name = 'practice';
        this.turnsDir = path_1.default.join(agentDir, 'practice', 'turns');
        this.summaryPath = path_1.default.join(agentDir, 'practice', 'summary.json');
        this.ensurePracticeDir();
    }
    async sync_turn(data) {
        const turnFile = path_1.default.join(this.turnsDir, `turn-${data.turnNumber}.json`);
        (0, fs_1.writeFileSync)(turnFile, JSON.stringify(data, null, 2), 'utf-8');
        await this.updateSummary(data);
    }
    async prefetch(_query) {
        return null;
    }
    async system_prompt_block() {
        return '';
    }
    // ==========================================================================
    // 内部方法
    // ==========================================================================
    ensurePracticeDir() {
        if (!(0, fs_1.existsSync)(this.turnsDir)) {
            (0, fs_1.mkdirSync)(this.turnsDir, { recursive: true });
        }
    }
    readSummary() {
        if (!(0, fs_1.existsSync)(this.summaryPath)) {
            return {
                totalTurns: 0,
                totalToolCalls: 0,
                averageToolChainLength: 0,
                successRate: 0,
                resolvedCount: 0,
                lastUpdated: Date.now(),
            };
        }
        try {
            return JSON.parse((0, fs_1.readFileSync)(this.summaryPath, 'utf-8'));
        }
        catch {
            return {
                totalTurns: 0,
                totalToolCalls: 0,
                averageToolChainLength: 0,
                successRate: 0,
                resolvedCount: 0,
                lastUpdated: Date.now(),
            };
        }
    }
    writeSummary(summary) {
        (0, fs_1.writeFileSync)(this.summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
    }
    async updateSummary(data) {
        const summary = this.readSummary();
        summary.totalTurns++;
        summary.totalToolCalls += data.toolCalls.length;
        summary.resolvedCount += data.outcome.resolved ? 1 : 0;
        summary.lastUpdated = Date.now();
        if (summary.totalTurns > 0) {
            summary.averageToolChainLength = +(summary.totalToolCalls / summary.totalTurns).toFixed(2);
            summary.successRate = +(summary.resolvedCount / summary.totalTurns * 100).toFixed(2);
        }
        this.writeSummary(summary);
    }
}
exports.PracticeLogger = PracticeLogger;
