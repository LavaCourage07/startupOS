"use strict";
/**
 * AgentTaskSnapshot — Multica 风格的任务快照机制
 *
 * 提供 "所有活跃任务 + 每个 Agent 的最近终端任务" 的快照查询，
 * 类似 Multica agent-task-snapshot。
 *
 * 参考 Multica:
 * - Workspace 级别快照：所有活跃任务 + 每个 Agent 的最近终端任务
 * - 实时更新监听：任务生命周期事件触发缓存更新
 * - 故意跳过高频事件：不监听 task:progress 和 task:message
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentTaskSnapshot = void 0;
const memory_keys_1 = require("../session/memory-keys");
class AgentTaskSnapshot {
    constructor(blackboard, _sessionDir, cacheExpiryMs) {
        this.cacheExpiryMs = 5000; // 5 秒缓存
        this.lastRefreshAt = 0;
        this.pendingInvalidation = false;
        this.blackboard = blackboard;
        if (cacheExpiryMs)
            this.cacheExpiryMs = cacheExpiryMs;
    }
    /**
     * 获取快照（带缓存）
     */
    async getSnapshot(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && !this.pendingInvalidation && this.cachedSnapshot && (now - this.lastRefreshAt) < this.cacheExpiryMs) {
            return this.cachedSnapshot;
        }
        this.pendingInvalidation = false;
        const snapshot = await this.buildSnapshot();
        this.cachedSnapshot = snapshot;
        this.lastRefreshAt = now;
        return snapshot;
    }
    /**
     * 使缓存失效（任务生命周期事件触发）
     */
    invalidate() {
        this.pendingInvalidation = true;
    }
    /**
     * 按 Agent ID 获取快照
     */
    /**
     * 按 Agent ID 获取快照
     */
    async getAgentSnapshot(agentId) {
        const snapshot = await this.getSnapshot();
        return snapshot.agents.find((a) => a.agentId === agentId) ?? null;
    }
    /**
     * 构建快照
     */
    /**
     * 构建快照
     */
    async buildSnapshot() {
        const tasks = this.blackboard.getTasks();
        const activeTasks = tasks.filter((t) => t.status === "running" || t.status === "assigned");
        const completedTasks = tasks.filter((t) => t.status === "completed" || t.status === "reported");
        const failedTasks = tasks.filter((t) => t.status === "failed");
        const blockedTasks = tasks.filter((t) => t.status === "blocked");
        // 收集所有 Agent ID
        const agentIds = new Set(tasks.map((t) => t.assignedTo).filter(Boolean));
        const agents = [];
        for (const agentId of agentIds) {
            const agentSnapshot = await this.buildAgentSnapshot(agentId, tasks, activeTasks, completedTasks, failedTasks, blockedTasks);
            agents.push(agentSnapshot);
        }
        return {
            sessionId: this.blackboard.sessionId,
            activeTasks,
            agents,
            summary: {
                totalAgents: agentIds.size,
                activeAgents: activeTasks.length,
                totalActiveTasks: activeTasks.length,
                totalCompletedTasks: completedTasks.length,
                totalFailedTasks: failedTasks.length,
                totalBlockedTasks: blockedTasks.length,
                avgMemoryMb: this.calculateAvgMemory(agents),
                avgCpuPercentage: this.calculateAvgCpu(agents),
            },
            snapshotAt: new Date().toISOString(),
        };
    }
    /**
     * 构建单个 Agent 快照
     */
    /**
     * 构建单个 Agent 快照
     */
    async buildAgentSnapshot(agentId, _allTasks, activeTasks, completedTasks, failedTasks, blockedTasks) {
        const activeTask = activeTasks.find((t) => t.assignedTo === agentId);
        const recentTerminalTask = [...completedTasks, ...failedTasks, ...blockedTasks]
            .filter((t) => t.assignedTo === agentId)
            .sort((a, b) => {
            const timeA = ((a.completedAt && new Date(a.completedAt).getTime()) ?? 0);
            const timeB = ((b.completedAt && new Date(b.completedAt).getTime()) ?? 0);
            return timeB - timeA;
        })[0];
        // 读取进度
        const progressEntry = this.blackboard.getDataEntry((0, memory_keys_1.buildWorkerKey)(memory_keys_1.MemoryKeyCategory.PROGRESS, agentId));
        const progress = progressEntry?.value;
        // 读取阻塞状态
        const blockedEntry = this.blackboard.getDataEntry((0, memory_keys_1.buildWorkerKey)(memory_keys_1.MemoryKeyCategory.BLOCKED, agentId));
        const blockedStatus = blockedEntry?.value;
        return {
            agentId,
            agentName: this.blackboard.getAgentName(agentId),
            activeTask: activeTask
                ? {
                    taskId: activeTask.id,
                    description: activeTask.description,
                    status: activeTask.status,
                    assignedAt: activeTask.createdAt,
                    startedAt: activeTask.createdAt,
                    progress,
                }
                : undefined,
            recentTerminalTask: recentTerminalTask
                ? {
                    taskId: recentTerminalTask.id,
                    description: recentTerminalTask.description,
                    status: recentTerminalTask.status,
                    completedAt: recentTerminalTask.completedAt,
                    output: recentTerminalTask.output,
                }
                : undefined,
            resourceUsage: this.calculateResourceUsage(agentId),
            blockedStatus,
        };
    }
    /**
     * 计算 Agent 资源使用
     */
    /**
     * 计算 Agent 资源使用
     */
    calculateResourceUsage(agentId) {
        const metricsEntry = this.blackboard.getDataEntry((0, memory_keys_1.buildWorkerKey)(memory_keys_1.MemoryKeyCategory.METRICS, agentId));
        if (!metricsEntry?.value) {
            return undefined;
        }
        const metrics = metricsEntry.value;
        const tasks = this.blackboard.getTasks();
        const agentTasks = tasks.filter((t) => t.assignedTo === agentId);
        return {
            memoryMbAvg: metrics.memoryMb,
            cpuPercentageAvg: metrics.cpuPercentage,
            taskCount: agentTasks.length,
        };
    }
    /**
     * 计算平均内存使用
     */
    /**
     * 计算平均内存使用
     */
    calculateAvgMemory(agents) {
        const usages = agents
            .map((a) => a.resourceUsage?.memoryMbAvg ?? 0)
            .filter((v) => v > 0);
        return usages.length > 0 ? usages.reduce((sum, m) => sum + m, 0) / usages.length : 0;
    }
    /**
     * 计算平均 CPU 使用
     */
    /**
     * 计算平均 CPU 使用
     */
    calculateAvgCpu(agents) {
        const usages = agents
            .map((a) => a.resourceUsage?.cpuPercentageAvg ?? 0)
            .filter((v) => v >= 0);
        return usages.length > 0 ? usages.reduce((sum, c) => sum + c, 0) / usages.length : 0;
    }
    /**
     * 获取所有阻塞的 Agent
     */
    getBlockedAgents() {
        const blockedAgents = [];
        const allKeys = this.blackboard.getEntries().map((e) => e.key);
        for (const key of allKeys) {
            const parsed = (0, memory_keys_1.parseMemoryKey)(key);
            if (parsed?.category === memory_keys_1.MemoryKeyCategory.BLOCKED && parsed.role?.startsWith("worker-")) {
                const agentId = parsed.role.replace("worker-", "");
                if (!blockedAgents.includes(agentId)) {
                    blockedAgents.push(agentId);
                }
            }
        }
        return blockedAgents;
    }
    /**
     * 获取所有活跃 Agent
     */
    getActiveAgents() {
        const tasks = this.blackboard.getTasks();
        return Array.from(new Set(tasks
            .filter((t) => t.status === "running" || t.status === "assigned")
            .map((t) => t.assignedTo)
            .filter((v) => v !== undefined)));
    }
}
exports.AgentTaskSnapshot = AgentTaskSnapshot;
