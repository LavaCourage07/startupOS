"use strict";
/**
 * DAG Executor — Workflow 模式核心执行引擎。
 *
 * Story 9.8: DAG 执行器（Workflow 模式）
 *
 * 功能：
 * - Kahn 算法拓扑排序
 * - 无依赖 Agent 并行执行
 * - 有依赖 Agent 等待上游完成后触发
 * - 优先级队列 + aging（防饥饿）
 * - Back-pressure（队列积压超阈值暂停上游）
 * - 超时与最大迭代次数限制
 * - 所有事件写入 EventStore
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DagExecutor = void 0;
// ============================================================================
// DAG Executor
// ============================================================================
class DagExecutor {
    constructor(eventStore, agentExecutor, config = {}) {
        this.topology = null;
        this.nodes = new Map();
        this.events = [];
        this.aborted = false;
        this.eventStore = eventStore;
        this.agentExecutor = agentExecutor;
        this.config = {
            timeoutMs: config.timeoutMs ?? 300000,
            maxIterations: config.maxIterations ?? 100,
            backPressureThreshold: config.backPressureThreshold ?? 10,
            agingIntervalMs: config.agingIntervalMs ?? 1000,
            agingPriorityBoost: config.agingPriorityBoost ?? 1,
            blackboard: config.blackboard,
            conflictDetector: config.conflictDetector,
            costController: config.costController,
            eventEmitter: config.eventEmitter,
        };
        this.blackboard = config.blackboard;
        this.conflictDetector = config.conflictDetector;
        this.costController = config.costController;
    }
    // ==========================================================================
    // Execute
    // ==========================================================================
    /**
     * 执行 DAG。
     * 1. 构建 DAG 节点
     * 2. 拓扑排序（Kahn 算法）确定初始就绪集
     * 3. 并行执行就绪节点
     * 4. 上游完成后触发下游
     * 5. 全局目标判定
     */
    async execute(topology) {
        this.nodes.clear();
        this.events = [];
        this.aborted = false;
        this.topology = topology;
        // 构建 DAG
        this.buildDag(topology);
        const deadline = Date.now() + this.config.timeoutMs;
        let iterations = 0;
        // 主循环
        while (true) {
            if (this.aborted) {
                return this.buildResult("aborted");
            }
            if (Date.now() > deadline) {
                await this.emitEvent("SESSION_ABORTED", { reason: "timeout" }, "system");
                return this.buildResult("timed_out");
            }
            if (iterations >= this.config.maxIterations) {
                await this.emitEvent("SESSION_ABORTED", { reason: "max_iterations" }, "system");
                return this.buildResult("failed");
            }
            iterations++;
            // 应用 aging：提升等待中节点的优先级
            this.applyAging();
            // Back-pressure 检查
            const runningCount = this.countByStatus("running");
            if (runningCount >= this.config.backPressureThreshold) {
                await this.emitEvent("AGENT_THINKING", {
                    reason: "back_pressure",
                    runningCount,
                    threshold: this.config.backPressureThreshold,
                }, "system");
                await this.sleep(100);
                continue;
            }
            // 找出就绪节点（所有依赖已完成）
            const readyNodes = this.getReadyNodes();
            this.checkConflicts();
            // 并行执行就绪节点
            if (readyNodes.length > 0) {
                await this.executeBatch(readyNodes);
            }
            // 检查是否全部完成
            if (this.isDone()) {
                await this.emitEvent("SESSION_COMPLETE", {
                    completedAgents: this.getCompletedIds(),
                    failedAgents: this.getFailedIds(),
                }, "system");
                return this.buildResult("completed");
            }
            // 没有就绪节点但有未完成节点 → 上游失败导致死锁
            if (readyNodes.length === 0 && this.hasUnfinishedNodes()) {
                const blockedIds = this.getBlockedNodeIds();
                for (const id of blockedIds) {
                    const node = this.nodes.get(id);
                    node.status = "failed";
                    await this.emitEvent("AGENT_FAIL_TASK", {
                        agentId: id,
                        reason: "blocked_by_failed_dependency",
                    }, "system");
                }
                return this.buildResult("failed");
            }
            // 短暂休眠，等待异步任务完成
            await this.sleep(10);
        }
    }
    /** 中止执行 */
    abort() {
        this.aborted = true;
    }
    /** 暂停指定节点（Human-in-the-Loop） */
    pauseAtNode(agentId, reviewRequest) {
        const node = this.nodes.get(agentId);
        if (node === undefined || node.status !== "running") {
            return;
        }
        node.status = "waiting";
        void this.emitEvent("HUMAN_REVIEW_REQUEST", {
            agentId,
            question: reviewRequest.question,
            context: reviewRequest.context ?? {},
        }, agentId);
        void this.emitProgressEvent();
    }
    /** 恢复指定节点（用户确认后） */
    resumeNode(agentId, userResponse) {
        const node = this.nodes.get(agentId);
        if (node === undefined || node.status !== "waiting") {
            return;
        }
        node.status = "ready";
        node.queuedAt = Date.now();
        if (this.blackboard) {
            this.blackboard.setData(`node:${agentId}:resume`, { response: userResponse }, "user");
        }
        void this.emitEvent("HUMAN_REVIEW_RESPONSE", { agentId, response: userResponse }, "system");
        void this.emitProgressEvent();
    }
    // ==========================================================================
    // DAG 构建
    // ==========================================================================
    buildDag(topology) {
        // 初始化所有节点
        for (const agentId of Object.keys(topology.agents)) {
            this.nodes.set(agentId, {
                agentId,
                dependencies: [],
                dependents: [],
                status: "pending",
                priority: 0,
                queuedAt: Date.now(),
            });
        }
        // 构建邻接关系（仅 trigger 类型的边参与 DAG）
        for (const edge of topology.edges) {
            if (edge.type !== "trigger") {
                continue;
            }
            const fromNode = this.nodes.get(edge.from);
            const toNode = this.nodes.get(edge.to);
            if (fromNode && toNode) {
                fromNode.dependents.push(edge.to);
                toNode.dependencies.push(edge.from);
            }
        }
        // 无依赖的节点标记为 ready
        for (const node of this.nodes.values()) {
            if (node.dependencies.length === 0) {
                node.status = "ready";
            }
        }
    }
    // ==========================================================================
    // 执行
    // ==========================================================================
    /** 获取当前就绪节点（按优先级排序） */
    getReadyNodes() {
        const ready = Array.from(this.nodes.values())
            .filter((n) => n.status === "ready")
            .sort((a, b) => b.priority - a.priority) // 优先级高的先执行
            .map((n) => n.agentId);
        return ready;
    }
    /** 并行执行一批节点 */
    async executeBatch(agentIds) {
        const promises = agentIds.map(async (agentId) => {
            const quota = this.costController?.checkTokenQuota(agentId);
            if (quota && !quota.allowed) {
                const node = this.nodes.get(agentId);
                node.status = "failed";
                await this.emitEvent("AGENT_FAIL_TASK", { agentId, reason: quota.reason ?? "quota_exceeded" }, "system");
                await this.emitProgressEvent();
                return;
            }
            const node = this.nodes.get(agentId);
            node.status = "running";
            this.costController?.recordTurn(agentId);
            this.writeNodeInput(agentId);
            await this.emitProgressEvent(); // 状态变更：开始运行
            await this.emitEvent("AGENT_THINKING", { agentId }, agentId);
            try {
                const result = await this.agentExecutor(agentId);
                if (result.status === "completed") {
                    node.status = "completed";
                    this.writeNodeOutput(agentId, result.output);
                    await this.emitProgressEvent(); // 状态变更：完成
                    await this.emitEvent("AGENT_COMPLETE_TASK", { agentId, output: result.output }, agentId);
                    // 触发下游
                    for (const depId of node.dependents) {
                        this.maybeMarkReady(depId);
                    }
                    await this.dispatchNotifyEdges(agentId, result.output);
                }
                else if (result.status === "waiting") {
                    // Human-in-the-Loop: 节点暂停，等待用户确认
                    node.status = "waiting";
                    await this.emitEvent("HUMAN_REVIEW_REQUEST", {
                        agentId,
                        question: result.reviewRequest?.question ?? "",
                        context: result.reviewRequest?.context ?? {},
                    }, agentId);
                    await this.emitProgressEvent();
                    // 下游不被触发，直到用户确认
                }
                else {
                    node.status = "failed";
                    await this.emitProgressEvent(); // 状态变更：失败
                    await this.emitEvent("AGENT_FAIL_TASK", { agentId }, agentId);
                }
            }
            catch (err) {
                node.status = "failed";
                await this.emitProgressEvent();
                await this.emitEvent("AGENT_FAIL_TASK", {
                    agentId,
                    error: err instanceof Error ? err.message : String(err),
                }, agentId);
            }
        });
        await Promise.all(promises);
    }
    /** 检查某节点是否可标记为就绪（所有依赖已完成） */
    maybeMarkReady(agentId) {
        const node = this.nodes.get(agentId);
        if (!node || node.status !== "pending") {
            return;
        }
        const allDepsCompleted = node.dependencies.every((depId) => {
            const depNode = this.nodes.get(depId);
            return depNode?.status === "completed";
        });
        if (allDepsCompleted) {
            node.status = "ready";
            node.queuedAt = Date.now();
        }
    }
    writeNodeInput(agentId) {
        if (!this.blackboard || this.topology === null) {
            return;
        }
        const input = this.topology.edges
            .filter((edge) => edge.to === agentId && edge.type === "trigger")
            .map((edge) => ({
            from: edge.from,
            output: this.blackboard?.getData(`node:${edge.from}:output`) ?? null,
        }));
        this.blackboard.setData(`node:${agentId}:input`, input, "system");
    }
    writeNodeOutput(agentId, output) {
        if (!this.blackboard) {
            return;
        }
        this.blackboard.setData(`node:${agentId}:output`, output ?? null, agentId);
    }
    async dispatchNotifyEdges(agentId, output) {
        if (this.topology === null) {
            return;
        }
        const notifyEdges = this.topology.edges.filter((edge) => edge.from === agentId && edge.type === "notify");
        await Promise.all(notifyEdges.map(async (edge) => {
            if (this.blackboard) {
                this.blackboard.sendMessage({
                    id: `notify-${edge.from}-${edge.to}-${Date.now()}`,
                    performative: "notify",
                    sender: edge.from,
                    receiver: edge.to,
                    content: {
                        edge: this.serializeEdge(edge),
                        output,
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            await this.emitEvent("AGENT_MESSAGE", {
                kind: "notify",
                target: edge.to,
                edge: this.serializeEdge(edge),
                output,
            }, edge.from);
        }));
    }
    serializeEdge(edge) {
        return {
            from: edge.from,
            to: edge.to,
            type: edge.type,
            description: edge.description,
        };
    }
    checkConflicts() {
        if (!this.conflictDetector) {
            return;
        }
        for (const conflict of this.conflictDetector.checkLockTimeouts()) {
            void this.emitEvent("CONFLICT_DETECTED", {
                conflictId: conflict.id,
                conflictType: conflict.type,
                agents: conflict.agents,
                details: conflict.details,
            }, "system");
        }
    }
    // ==========================================================================
    // Aging — 防饥饿
    // ==========================================================================
    /** 获取当前 DAG 运行快照（供外部查询进度） */
    getSnapshot() {
        const all = Array.from(this.nodes.values()).map((n) => ({
            agentId: n.agentId,
            status: n.status,
        }));
        const current = all.filter((n) => n.status === "running").map((n) => n.agentId);
        const waiting = all.filter((n) => n.status === "waiting").map((n) => n.agentId);
        const pending = all.filter((n) => n.status === "pending" || n.status === "ready").map((n) => n.agentId);
        const completed = this.getCompletedIds();
        const failed = this.getFailedIds();
        let progress;
        if (current.length > 0) {
            progress = `正在执行: ${current.join(", ")}`;
        }
        else if (waiting.length > 0) {
            progress = `等待确认: ${waiting.join(", ")}`;
        }
        else if (all.length > 0 && all.every((n) => n.status === "completed" || n.status === "failed")) {
            progress = `已完成: ${completed.length}/${all.length}`;
        }
        else if (all.length > 0 && all.every((n) => n.status === "pending")) {
            progress = "等待启动";
        }
        else {
            progress = `${completed.length}/${all.length} 完成`;
        }
        return { agents: all, completedAgents: completed, failedAgents: failed, currentAgentIds: current, waitingAgentIds: waiting, pendingAgentIds: pending, progress };
    }
    applyAging() {
        const now = Date.now();
        for (const node of this.nodes.values()) {
            if (node.status === "pending" || node.status === "ready") {
                const waitTime = now - node.queuedAt;
                if (waitTime > this.config.agingIntervalMs) {
                    node.priority += this.config.agingPriorityBoost;
                    node.queuedAt = now; // 重置计时器
                }
            }
        }
    }
    // ==========================================================================
    // 状态查询
    // ==========================================================================
    isDone() {
        for (const node of this.nodes.values()) {
            if (node.status !== "completed" && node.status !== "failed") {
                return false;
            }
        }
        return true;
    }
    hasUnfinishedNodes() {
        for (const node of this.nodes.values()) {
            if (node.status === "pending" || node.status === "running" || node.status === "ready") {
                return true;
            }
        }
        return false;
    }
    getBlockedNodeIds() {
        const blocked = [];
        for (const node of this.nodes.values()) {
            if (node.status === "pending" || node.status === "ready") {
                const hasFailedDependency = node.dependencies.some((depId) => {
                    const depNode = this.nodes.get(depId);
                    return depNode?.status === "failed";
                });
                if (hasFailedDependency) {
                    blocked.push(node.agentId);
                }
            }
        }
        return blocked;
    }
    countByStatus(status) {
        let count = 0;
        for (const node of this.nodes.values()) {
            if (node.status === status) {
                count++;
            }
        }
        return count;
    }
    getCompletedIds() {
        return Array.from(this.nodes.values())
            .filter((n) => n.status === "completed")
            .map((n) => n.agentId);
    }
    getFailedIds() {
        return Array.from(this.nodes.values())
            .filter((n) => n.status === "failed")
            .map((n) => n.agentId);
    }
    // ==========================================================================
    // Event emission
    // ==========================================================================
    async emitEvent(type, payload, source) {
        const event = {
            id: `evt-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sessionId: "dag-executor", // 会被上层覆盖
            seq: this.events.length + 1,
            type,
            payload,
            source,
            timestamp: new Date().toISOString(),
        };
        this.events.push(event);
        await this.eventStore.append(event);
    }
    /** DAG 进度事件 — 包含全量节点状态快照 */
    async emitProgressEvent() {
        const snapshot = this.getSnapshot();
        await this.emitEvent("DAG_PROGRESS", snapshot, "system");
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    buildResult(status) {
        return {
            status,
            completedAgents: this.getCompletedIds(),
            failedAgents: this.getFailedIds(),
            events: [...this.events],
        };
    }
}
exports.DagExecutor = DagExecutor;
