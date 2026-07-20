"use strict";
/**
 * Structured Logging — JSON 格式日志，包含 sessionId/agentId/timestamp。
 *
 * Story 9.18: 生产加固 — 完整可观测性
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredLogger = void 0;
// ============================================================================
// Logger
// ============================================================================
class StructuredLogger {
    constructor(sessionId) {
        this.handlers = [];
        this.sessionId = sessionId;
    }
    /**
     * 注册日志处理器。
     */
    on(handler) {
        this.handlers.push(handler);
    }
    /**
     * 设置默认 agentId（该 logger 实例的主要 Agent）。
     */
    setAgentId(agentId) {
        this.defaultAgentId = agentId;
    }
    /**
     * 发出日志条目。
     */
    emit(entry) {
        const logEntry = {
            ...entry,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
        };
        for (const handler of this.handlers) {
            try {
                handler(logEntry);
            }
            catch {
                // Handler failures should not crash the logger
            }
        }
        // Console output (formatted)
        const colored = this.colorize(logEntry.level, `[${logEntry.level.toUpperCase()}]`);
        console.log(`${colored} ${logEntry.timestamp} [${logEntry.sessionId}] ${logEntry.agentId ?? "system"}: ${logEntry.message}`);
    }
    /**
     * Debug level.
     */
    debug(message, data, agentId) {
        this.emit({ level: "debug", message, data, agentId: agentId ?? this.defaultAgentId });
    }
    /**
     * Info level.
     */
    info(message, data, agentId) {
        this.emit({ level: "info", message, data, agentId: agentId ?? this.defaultAgentId });
    }
    /**
     * Warn level.
     */
    warn(message, data, agentId) {
        this.emit({ level: "warn", message, data, agentId: agentId ?? this.defaultAgentId });
    }
    /**
     * Error level.
     */
    error(message, data, agentId) {
        this.emit({ level: "error", message, data, agentId: agentId ?? this.defaultAgentId });
    }
    /**
     * 导出为 JSON 行格式。
     */
    toLine(entry) {
        return JSON.stringify(entry);
    }
    colorize(level, text) {
        const colors = {
            debug: "\x1b[36m", // cyan
            info: "\x1b[32m", // green
            warn: "\x1b[33m", // yellow
            error: "\x1b[31m", // red
        };
        const reset = "\x1b[0m";
        return `${colors[level]}${text}${reset}`;
    }
}
exports.StructuredLogger = StructuredLogger;
