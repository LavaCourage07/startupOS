"use strict";
/**
 * Tracing — 协作会话分布式追踪。
 *
 * Story 9.18: 生产加固 — 完整可观测性
 *
 * 每个协作操作（任务分配、消息发送、冲突检测等）生成一个 span，
 * 支持父子关系和链路追踪。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tracer = void 0;
// ============================================================================
// Tracer
// ============================================================================
class Tracer {
    constructor() {
        this.spans = new Map();
        this.traces = new Map(); // traceId → spans
        this.activeSpans = new Map(); // spanId → span
    }
    /**
     * 开始一个 span。
     */
    startSpan(operation, opts) {
        const spanId = `span-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const traceId = opts.traceId ?? `trace-${Date.now()}`;
        const span = {
            id: spanId,
            traceId,
            parentId: opts.parentId,
            operation,
            agentId: opts.agentId,
            sessionId: opts.sessionId,
            startTime: Date.now(),
            status: "pending",
            attributes: opts.attributes ?? {},
        };
        this.spans.set(spanId, span);
        this.activeSpans.set(spanId, span);
        if (!this.traces.has(traceId)) {
            this.traces.set(traceId, []);
        }
        this.traces.get(traceId).push(span);
        return spanId;
    }
    /**
     * 结束一个 span。
     */
    endSpan(spanId, status = "ok") {
        const span = this.spans.get(spanId);
        if (!span)
            return;
        span.endTime = Date.now();
        span.status = status;
        this.activeSpans.delete(spanId);
    }
    /**
     * 使用回调自动管理 span 生命周期。
     */
    async withSpan(operation, opts, fn) {
        const spanId = this.startSpan(operation, opts);
        try {
            const result = await fn(spanId);
            this.endSpan(spanId, "ok");
            return result;
        }
        catch (error) {
            this.endSpan(spanId, "error");
            throw error;
        }
    }
    /**
     * 获取完整 trace。
     */
    getTrace(traceId) {
        const spans = this.traces.get(traceId);
        if (!spans)
            return undefined;
        return {
            traceId,
            spans: [...spans],
        };
    }
    /**
     * 获取 session 的所有 traces。
     */
    getTracesBySession(sessionId) {
        const result = [];
        for (const [traceId, spans] of this.traces) {
            if (spans.some((s) => s.sessionId === sessionId)) {
                result.push({ traceId, spans: [...spans] });
            }
        }
        return result;
    }
    /**
     * 获取活跃 spans。
     */
    getActiveSpans() {
        return Array.from(this.activeSpans.values());
    }
    /**
     * 获取所有 spans。
     */
    getAllSpans() {
        return Array.from(this.spans.values());
    }
    /**
     * 获取慢操作（超过阈值 ms）。
     */
    getSlowOperations(thresholdMs) {
        return this.getAllSpans().filter((s) => {
            if (!s.endTime)
                return false;
            return s.endTime - s.startTime > thresholdMs;
        });
    }
    /**
     * 清理已完成的 traces。
     */
    cleanup(completedBefore) {
        let count = 0;
        const cutoff = completedBefore ?? Date.now() - 300000; // default: 5 min ago
        for (const [traceId, spans] of this.traces) {
            const allCompleted = spans.every((s) => s.endTime && s.endTime < cutoff);
            if (allCompleted) {
                this.traces.delete(traceId);
                for (const span of spans) {
                    this.spans.delete(span.id);
                    this.activeSpans.delete(span.id);
                }
                count++;
            }
        }
        return count;
    }
}
exports.Tracer = Tracer;
