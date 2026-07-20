"use strict";
/**
 * 工具调用循环检测
 *
 * 参考 openclaw src/agents/tool-loop-detection.ts：
 * 检测 LLM 重复调用同一工具却无进展的情况，超过阈值时返回警告。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoopDetector = void 0;
exports.getLoopDetector = getLoopDetector;
exports.removeLoopDetector = removeLoopDetector;
// ============================================================================
// 配置常量
// ============================================================================
const HISTORY_SIZE = 30;
const WARNING_THRESHOLD = 8; // 连续重复 N 次触发警告
const CIRCUIT_BREAKER = 20; // 连续重复 N 次触发断路（强制注入停止提示）
// ============================================================================
// LoopDetector
// ============================================================================
class LoopDetector {
    constructor() {
        this.history = [];
    }
    /**
     * 记录一次工具调用并检测是否进入循环。
     * @param toolName 工具名称
     * @param params 工具参数（用于判断是否"相同输入"）
     */
    record(toolName, params) {
        const inputHash = stableHash(params);
        this.history.push({ toolName, inputHash });
        if (this.history.length > HISTORY_SIZE) {
            this.history.shift();
        }
        const count = this.countTrailingRepeats(toolName, inputHash);
        if (count >= CIRCUIT_BREAKER) {
            return {
                type: 'circuit_breaker',
                toolName,
                count,
                message: `[LoopDetector] 检测到工具 \`${toolName}\` 以相同参数连续调用 ${count} 次，已触发断路保护。请停止重复调用，检查任务是否已完成或换用其他方式。`,
            };
        }
        if (count >= WARNING_THRESHOLD) {
            return {
                type: 'warning',
                toolName,
                count,
                message: `[LoopDetector] 工具 \`${toolName}\` 已连续以相同参数调用 ${count} 次，可能陷入循环。请确认任务是否有进展，或考虑换用其他工具。`,
            };
        }
        return { type: 'ok' };
    }
    reset() {
        this.history = [];
    }
    /** 统计末尾连续相同 toolName + inputHash 的次数 */
    countTrailingRepeats(toolName, inputHash) {
        let count = 0;
        for (let i = this.history.length - 1; i >= 0; i--) {
            const entry = this.history[i];
            if (entry.toolName === toolName && entry.inputHash === inputHash) {
                count++;
            }
            else {
                break;
            }
        }
        return count;
    }
}
exports.LoopDetector = LoopDetector;
// ============================================================================
// 辅助：稳定 hash（不引入额外依赖）
// ============================================================================
function stableHash(value) {
    try {
        return JSON.stringify(value, Object.keys(value).sort()) ?? '';
    }
    catch {
        return String(value);
    }
}
// ============================================================================
// 会话级别的 LoopDetector 注册表
// ============================================================================
const detectors = new Map();
function getLoopDetector(sessionId) {
    let detector = detectors.get(sessionId);
    if (!detector) {
        detector = new LoopDetector();
        detectors.set(sessionId, detector);
    }
    return detector;
}
function removeLoopDetector(sessionId) {
    detectors.delete(sessionId);
}
