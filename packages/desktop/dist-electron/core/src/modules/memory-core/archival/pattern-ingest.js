"use strict";
/**
 * Pattern 语义化提取 + Archival 写入。
 *
 * Story M.7: 从工具调用结果（成功/失败状态、返回摘要）中提炼有意义的 principle，
 * 而非截断 thinking 文本。Pattern 条目写入 Archival Memory。
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPrincipleFromToolResults = extractPrincipleFromToolResults;
exports.ingestPatternToArchival = ingestPatternToArchival;
exports.ingestReflectionToArchival = ingestReflectionToArchival;
exports.migratePatternsToArchival = migratePatternsToArchival;
/**
 * 从工具链统计数据中提炼可复用原则。
 * 利用工具调用的成功/失败状态和返回结果摘要，
 * 而非截断 thinking 文本。
 */
function extractPrincipleFromToolResults(entry, isAntiPattern) {
    const { successRate, avgToolCalls, sampleCount, lastScene, lastResultSummaries } = entry;
    const toolChain = entry.toolChain ?? [];
    if (isAntiPattern) {
        const reasons = [];
        if (successRate < 50)
            reasons.push(`成功率仅 ${successRate.toFixed(0)}%`);
        if (avgToolCalls > 5)
            reasons.push(`工具链过长（平均 ${avgToolCalls.toFixed(1)} 步）`);
        if (lastResultSummaries.length > 0) {
            const errors = lastResultSummaries.filter(s => s.toLowerCase().includes('error') || s.toLowerCase().includes('fail'));
            if (errors.length > 0) {
                reasons.push(`常见错误: ${errors.slice(0, 2).join('; ')}`);
            }
        }
        return `反模式: ${toolChain.join(' → ')} — ${reasons.join('，')}`;
    }
    // 成功模式：基于工具链和结果摘要构建原则
    const parts = [];
    // 场景描述
    if (lastScene) {
        parts.push(`适用场景: ${lastScene.slice(0, 100)}`);
    }
    // 工具链描述
    parts.push(`推荐路径: ${toolChain.join(' → ')}`);
    // 成功率
    if (sampleCount >= 2) {
        parts.push(`验证 ${sampleCount} 次，成功率 ${successRate.toFixed(0)}%`);
    }
    // 工具调用结果摘要
    if (lastResultSummaries.length > 0) {
        const keyInsights = lastResultSummaries
            .filter(s => s.length > 0)
            .slice(0, 2)
            .map(s => s.slice(0, 80));
        if (keyInsights.length > 0) {
            parts.push(`关键发现: ${keyInsights.join('; ')}`);
        }
    }
    return parts.join('。');
}
/**
 * 将 Pattern 条目写入 Archival Memory。
 * 双写策略：保留 registry.json，同时写入 Archival。
 */
async function ingestPatternToArchival(archival, entry, isAntiPattern) {
    const principle = extractPrincipleFromToolResults(entry, isAntiPattern);
    const tags = [
        isAntiPattern ? 'anti-pattern' : 'pattern',
        ...(entry.toolChain ?? []),
        ...extractSceneTags(entry.lastScene),
    ];
    const id = await archival.insert(principle, tags);
    return id;
}
/**
 * 将 Reflection 条目写入 Archival Memory。
 */
async function ingestReflectionToArchival(archival, data) {
    const text = `失败场景: ${data.scene}\n` +
        `失败原因: ${data.failureReason}\n` +
        `教训: ${data.lesson}\n` +
        `下次尝试: ${data.tryNextTime}`;
    const tags = ['reflection', ...data.toolChain, ...extractSceneTags(data.scene)];
    const id = await archival.insert(text, tags);
    return id;
}
/**
 * 一次性迁移：将现有 registry.json + episodic-memory 批量导入 Archival。
 */
async function migratePatternsToArchival(archival, agentDir) {
    const fs = await Promise.resolve().then(() => __importStar(require('node:fs')));
    const path = await Promise.resolve().then(() => __importStar(require('node:path')));
    let patternsMigrated = 0;
    let reflectionsMigrated = 0;
    // Migrate registry.json patterns
    const registryPath = path.join(agentDir, 'patterns', 'registry.json');
    if (fs.existsSync(registryPath)) {
        try {
            const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
            for (const pattern of registry.patterns ?? []) {
                const entry = {
                    toolChain: pattern.toolChain ?? [],
                    successRate: pattern.effectiveness?.successRate ?? 0,
                    avgToolCalls: pattern.effectiveness?.avgToolCalls ?? 0,
                    sampleCount: pattern.effectiveness?.sampleCount ?? 0,
                    lastScene: pattern.triggerCondition ?? '',
                    lastThinking: pattern.principle ?? '',
                    lastResultSummaries: [],
                };
                await ingestPatternToArchival(archival, entry, pattern.isAntiPattern ?? false);
                patternsMigrated++;
            }
        }
        catch {
            // skip malformed registry
        }
    }
    // Migrate episodic-memory reflections
    const episodicDir = path.join(agentDir, 'patterns', 'episodic-memory');
    if (fs.existsSync(episodicDir)) {
        try {
            const files = fs.readdirSync(episodicDir).filter(f => f.endsWith('.json'));
            for (const file of files) {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(episodicDir, file), 'utf-8'));
                    await ingestReflectionToArchival(archival, {
                        scene: data.scene ?? '',
                        toolChain: data.toolChain ?? [],
                        failureReason: data.failureReason ?? '',
                        lesson: data.reflection?.lesson ?? '',
                        tryNextTime: data.reflection?.tryNextTime ?? '',
                    });
                    reflectionsMigrated++;
                }
                catch {
                    // skip malformed entry
                }
            }
        }
        catch {
            // skip if directory not readable
        }
    }
    return { patternsMigrated, reflectionsMigrated };
}
function extractSceneTags(scene) {
    if (!scene)
        return [];
    return scene
        .toLowerCase()
        .split(/\s+/)
        .map(w => w.replace(/[^a-z0-9\u4e00-\u9fff]/g, ''))
        .filter(w => w.length > 3)
        .slice(0, 5);
}
