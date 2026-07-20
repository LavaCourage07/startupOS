"use strict";
/**
 * SupervisorHeartbeat — Queen 风格的定时权威状态写入
 *
 * 借鉴 Ruflo 的 Queen 心跳机制，每分钟强制写入 Supervisor 状态，
 * 确保共享记忆中始终有最新的权威数据。
 *
 * 参考 Ruflo queen-coordinator:
 * - 每分钟写入 swarm$queen$status
 * - 每 2 分钟写入 swarm$queen$royal-report
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupervisorHeartbeat = void 0;
const memory_keys_1 = require("../session/memory-keys");
class SupervisorHeartbeat {
    constructor(blackboard, supervisorId, config = {}) {
        this.objectives = {
            completed: [],
            pending: [],
        };
        this.blackboard = blackboard;
        this.supervisorId = supervisorId;
        this.sessionId = blackboard.sessionId;
        this.intervalMs = config.intervalMs ?? 60000; // 1 分钟
        this.reportIntervalMs = config.reportIntervalMs ?? 120000; // 2 分钟
    }
    /**
     * 启动心跳定时器
     */
    start() {
        this.stop();
        this.writeStatus(); // 立即写入第一次
        // 状态心跳
        this.heartbeatTimer = setInterval(() => {
            this.writeStatus();
        }, this.intervalMs);
        // Royal Report
        this.reportTimer = setInterval(() => {
            this.writeRoyalReport();
        }, this.reportIntervalMs);
        console.error(`[SupervisorHeartbeat] Started: supervisor=${this.supervisorId}, interval=${this.intervalMs}ms, reportInterval=${this.reportIntervalMs}ms`);
    }
    /**
     * 停止心跳定时器
     */
    stop() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
        if (this.reportTimer) {
            clearInterval(this.reportTimer);
            this.reportTimer = undefined;
        }
        console.error(`[SupervisorHeartbeat] Stopped: supervisor=${this.supervisorId}`);
    }
    /**
     * 设置管理目标
     */
    setObjectives(completed, pending) {
        this.objectives = { completed, pending };
    }
    /**
     * 标记目标完成
     */
    markObjectiveCompleted(objective) {
        const idx = this.objectives.pending.indexOf(objective);
        if (idx >= 0) {
            this.objectives.pending.splice(idx, 1);
            if (!this.objectives.completed.includes(objective)) {
                this.objectives.completed.push(objective);
            }
        }
    }
    /**
     * 添加新目标
     */
    addObjective(objective) {
        if (!this.objectives.pending.includes(objective)) {
            this.objectives.pending.push(objective);
        }
    }
    /**
     * 写入权威状态（每分钟）
     */
    writeStatus() {
        const tasks = this.blackboard.getTasks();
        const activeWorkers = new Set(tasks
            .filter((t) => t.status === "running" || t.status === "assigned")
            .map((t) => t.assignedTo)
            .filter((v) => v !== undefined));
        const status = {
            agent: this.supervisorId,
            status: this.determineSwarmState(tasks),
            hierarchyEstablished: activeWorkers.size > 0,
            subjects: Array.from(activeWorkers),
            royalDirectives: this.extractDirectives(tasks),
            successionPlan: "collective-intelligence",
            timestamp: Date.now(),
            activeTaskCount: tasks.filter((t) => t.status === "running").length,
            completedCount: tasks.filter((t) => t.status === "completed").length,
            failedCount: tasks.filter((t) => t.status === "failed").length,
            reportedCount: tasks.filter((t) => t.status === "reported").length,
        };
        const key = (0, memory_keys_1.buildSupervisorKey)(memory_keys_1.MemoryKeyCategory.STATUS, this.sessionId);
        this.blackboard.setData(key, status, this.supervisorId, {
            sourceUri: `supervisor-heartbeat:${this.sessionId}`,
        });
        console.error(`[SupervisorHeartbeat] Status written: active=${status.activeTaskCount}, completed=${status.completedCount}, failed=${status.failedCount}, subjects=${status.subjects.length}`);
    }
    /**
     * 写入 Royal Report（每 2 分钟）
     */
    writeRoyalReport() {
        const tasks = this.blackboard.getTasks();
        const totalTasks = tasks.length;
        const completed = tasks.filter((t) => t.status === "completed").length;
        const progress = totalTasks > 0 ? (completed / totalTasks) * 100 : 0;
        const report = {
            decree: "Status Report",
            swarmState: this.determineSwarmState(tasks) === "sovereign-active" ? "operational" : "degraded",
            objectivesCompleted: this.objectives.completed,
            objectivesPending: this.objectives.pending,
            resourceUtilization: {
                percentage: Math.round(progress).toString() + "%",
                activeAgents: this.extractActiveWorkers(tasks).length,
                avgMemoryMb: this.calculateAvgMemory(),
                avgCpuPercentage: this.calculateAvgCpu(),
            },
            recommendations: this.generateRecommendations(tasks),
            nextReview: Date.now() + this.reportIntervalMs,
            timestamp: Date.now(),
        };
        const key = (0, memory_keys_1.buildSupervisorKey)(memory_keys_1.MemoryKeyCategory.REPORT, this.sessionId);
        this.blackboard.setData(key, report, this.supervisorId, {
            sourceUri: `supervisor-report:${this.sessionId}`,
        });
        console.error(`[SupervisorHeartbeat] Royal Report written: progress=${progress.toFixed(1)}%, recommendations=${report.recommendations.length}`);
    }
    /**
     * 确定 Swarm 状态
     */
    determineSwarmState(tasks) {
        const failed = tasks.filter((t) => t.status === "failed").length;
        const blocked = tasks.filter((t) => t.status === "blocked").length;
        if (failed > 0 && failed > tasks.length / 2) {
            return "failed";
        }
        if (blocked > 0) {
            return "paused";
        }
        return "sovereign-active";
    }
    /**
     * 提取活跃 Worker
     */
    extractActiveWorkers(tasks) {
        return Array.from(new Set(tasks.filter((t) => t.status === "running").map((t) => t.assignedTo))).filter(Boolean);
    }
    /**
     * 提取已下发指令
     */
    extractDirectives(tasks) {
        return tasks
            .filter((t) => t.status === "assigned" || t.status === "running")
            .map((t) => `dispatch-${t.id}`);
    }
    /**
     * 计算平均内存使用
     */
    calculateAvgMemory() {
        const agents = this.getWorkersWithMetrics();
        if (agents.length === 0)
            return undefined;
        const memoryValues = agents
            .map((a) => a.metrics?.memoryMb)
            .filter((m) => m !== undefined && m > 0);
        return memoryValues.length > 0
            ? memoryValues.reduce((sum, m) => sum + m, 0) / memoryValues.length
            : undefined;
    }
    /**
     * 计算平均 CPU 使用
     */
    calculateAvgCpu() {
        const agents = this.getWorkersWithMetrics();
        if (agents.length === 0)
            return undefined;
        const cpuValues = agents
            .map((a) => a.metrics?.cpuPercentage)
            .filter((c) => c !== undefined && c >= 0);
        return cpuValues.length > 0
            ? cpuValues.reduce((sum, c) => sum + c, 0) / cpuValues.length
            : undefined;
    }
    /**
     * 获取有指标数据的 Worker
     */
    getWorkersWithMetrics() {
        const tasks = this.blackboard.getTasks();
        const workerIds = Array.from(new Set(tasks.map((t) => t.assignedTo).filter((v) => v !== undefined)));
        return workerIds.map((agentId) => {
            const metricsKey = (0, memory_keys_1.buildWorkerKey)(memory_keys_1.MemoryKeyCategory.METRICS, agentId);
            const metricsEntry = this.blackboard.getDataEntry(metricsKey);
            return {
                agentId,
                metrics: metricsEntry?.value,
            };
        });
    }
    /**
     * 生成推荐
     */
    generateRecommendations(tasks) {
        const recommendations = [];
        const blocked = tasks.filter((t) => t.status === "blocked").length;
        const pending = tasks.filter((t) => t.status === "pending").length;
        const running = tasks.filter((t) => t.status === "running").length;
        if (blocked > 0) {
            recommendations.push(`Resolve ${blocked} blocked task${blocked > 1 ? "s" : ""}: check dependencies or escalate to human`);
        }
        if (pending > running) {
            recommendations.push(`Spawn more workers: ${pending} pending tasks but only ${running} executing`);
        }
        if (running === 0 && pending > 0) {
            recommendations.push("No active workers: all tasks pending, check worker pool");
        }
        const failed = tasks.filter((t) => t.status === "failed").length;
        if (failed > 0) {
            recommendations.push(`Review ${failed} failed task${failed > 1 ? "s" : ""}: consider task reassignment or retry logic`);
        }
        if (recommendations.length === 0 && running > 0) {
            recommendations.push("Swarm operating normally: continue monitoring");
        }
        return recommendations;
    }
}
exports.SupervisorHeartbeat = SupervisorHeartbeat;
