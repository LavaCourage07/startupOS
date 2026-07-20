"use strict";
/**
 * Metrics — 协作运行时指标收集，兼容 Prometheus 格式。
 *
 * Story 9.18: 生产加固 — 完整可观测性
 *
 * 指标列表：
 * | agent.turns_total | agentId, sessionId | Agent 执行轮次 |
 * | agent.tool_calls_total | agentId, toolName | 工具调用次数 |
 * | agent.tokens_used | agentId, sessionId | Token 消耗 |
 * | collaboration.messages_total | from, to, type | 消息数量 |
 * | collaboration.conflicts_total | type, resolution | 冲突统计 |
 * | collaboration.task_success_total | agentId, taskId | 任务成功率 |
 * | collaboration.duration_seconds | sessionId | 会话耗时 |
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsRegistry = void 0;
// ============================================================================
// Simple counter metric
// ============================================================================
class Counter {
    constructor() {
        this.samples = new Map();
    }
    increment(labels = {}, by = 1) {
        const key = this.key(labels);
        this.samples.set(key, (this.samples.get(key) ?? 0) + by);
    }
    get(labels = {}) {
        return this.samples.get(this.key(labels)) ?? 0;
    }
    getAll() {
        return new Map(this.samples);
    }
    reset() {
        this.samples.clear();
    }
    key(labels) {
        return Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(",");
    }
}
// ============================================================================
// Gauge metric
// ============================================================================
class Gauge {
    constructor() {
        this.samples = new Map();
    }
    set(labels, value) {
        this.samples.set(this.key(labels), value);
    }
    get(labels = {}) {
        return this.samples.get(this.key(labels)) ?? 0;
    }
    getAll() {
        return new Map(this.samples);
    }
    reset() {
        this.samples.clear();
    }
    key(labels) {
        return Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(",");
    }
}
// ============================================================================
// MetricsRegistry
// ============================================================================
class MetricsRegistry {
    constructor() {
        // Counters
        this.agentTurns = new Counter();
        this.agentToolCalls = new Counter();
        this.agentTokensUsed = new Counter();
        this.collaborationMessages = new Counter();
        this.collaborationConflicts = new Counter();
        this.collaborationTaskSuccess = new Counter();
        // Gauges
        this.collaborationDuration = new Gauge();
    }
    /**
     * Record agent turn.
     */
    recordAgentTurn(agentId, sessionId) {
        this.agentTurns.increment({ agentId, sessionId });
    }
    /**
     * Record tool call.
     */
    recordToolCall(agentId, toolName) {
        this.agentToolCalls.increment({ agentId, toolName });
    }
    /**
     * Record token usage.
     */
    recordTokens(agentId, sessionId, count) {
        this.agentTokensUsed.increment({ agentId, sessionId }, count);
    }
    /**
     * Record collaboration message.
     */
    recordMessage(from, to, type) {
        this.collaborationMessages.increment({ from, to, type });
    }
    /**
     * Record conflict detection.
     */
    recordConflict(conflictType, resolution) {
        this.collaborationConflicts.increment({ type: conflictType, resolution });
    }
    /**
     * Record task outcome.
     */
    recordTaskOutcome(agentId, taskId, success) {
        this.collaborationTaskSuccess.increment({
            agentId,
            taskId,
            outcome: success ? "success" : "failure",
        });
    }
    /**
     * Set session duration.
     */
    setDuration(sessionId, seconds) {
        this.collaborationDuration.set({ sessionId }, seconds);
    }
    /**
     * Collect all metrics as samples.
     */
    collect() {
        const samples = [];
        const now = Date.now();
        const collectCounter = (counter, name) => {
            for (const [key, value] of counter.getAll()) {
                const labels = this.parseKey(key);
                samples.push({ name, value, labels, timestamp: now });
            }
        };
        collectCounter(this.agentTurns, "agent_turns_total");
        collectCounter(this.agentToolCalls, "agent_tool_calls_total");
        collectCounter(this.agentTokensUsed, "agent_tokens_used_total");
        collectCounter(this.collaborationMessages, "collaboration_messages_total");
        collectCounter(this.collaborationConflicts, "collaboration_conflicts_total");
        collectCounter(this.collaborationTaskSuccess, "collaboration_task_success_total");
        for (const [key, value] of this.collaborationDuration.getAll()) {
            const labels = this.parseKey(key);
            samples.push({ name: "collaboration_duration_seconds", value, labels, timestamp: now });
        }
        return samples;
    }
    /**
     * Export in Prometheus text format.
     */
    toPrometheusText() {
        const samples = this.collect();
        const lines = [];
        // Group by metric name
        const grouped = new Map();
        for (const sample of samples) {
            if (!grouped.has(sample.name))
                grouped.set(sample.name, []);
            grouped.get(sample.name).push(sample);
        }
        for (const [name, samps] of grouped) {
            lines.push(`# TYPE ${name} counter`);
            for (const sample of samps) {
                const labelStr = Object.entries(sample.labels)
                    .map(([k, v]) => `${k}="${v}"`)
                    .join(",");
                lines.push(labelStr ? `${name}{${labelStr}} ${sample.value}` : `${name} ${sample.value}`);
            }
            lines.push("");
        }
        return lines.join("\n");
    }
    /**
     * Reset all metrics.
     */
    reset() {
        this.agentTurns.reset();
        this.agentToolCalls.reset();
        this.agentTokensUsed.reset();
        this.collaborationMessages.reset();
        this.collaborationConflicts.reset();
        this.collaborationTaskSuccess.reset();
        this.collaborationDuration.reset();
    }
    parseKey(key) {
        if (!key)
            return {};
        const labels = {};
        for (const pair of key.split(",")) {
            const [k, v] = pair.split("=");
            if (k && v !== undefined)
                labels[k] = v;
        }
        return labels;
    }
}
exports.MetricsRegistry = MetricsRegistry;
