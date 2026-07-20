"use strict";
/**
 * Sleep-time Compute Scheduler（Story C.9 — Letta 睡眠计算）
 *
 * 将记忆整理、知识提取、模式沉淀等重量操作移出关键路径，
 * 在 Agent 空闲时异步执行。
 *
 * 设计原则：
 * - 本模块只做任务队列管理，不直接调用 LLM
 * - LLM 调用由上层编排（CognitiveManager / session handler）
 * - 支持多种触发器：session_end / interval / manual
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SleepComputeScheduler = void 0;
exports.createConsolidateTask = createConsolidateTask;
exports.createKnowledgeTask = createKnowledgeTask;
exports.createPatternTask = createPatternTask;
exports.createUpdateBlockTask = createUpdateBlockTask;
// ============================================================================
// SleepComputeScheduler
// ============================================================================
/** 睡眠计算调度器 */
class SleepComputeScheduler {
    constructor() {
        this.pendingTasks = new Map();
        this.turnCounter = 0;
        this.idCounter = 0;
    }
    /**
     * 调度一个睡眠计算任务。
     *
     * @param task 要执行的任务
     * @param trigger 触发条件
     * @returns 任务 ID，可用于后续取消
     */
    schedule(task, trigger) {
        const id = `sleep-${++this.idCounter}`;
        this.pendingTasks.set(id, {
            id,
            task,
            trigger,
            scheduledAt: Date.now(),
        });
        return id;
    }
    /**
     * 取消已调度的任务。
     *
     * @param taskId 任务 ID
     * @returns 是否成功取消
     */
    cancel(taskId) {
        return this.pendingTasks.delete(taskId);
    }
    /**
     * 获取所有待处理任务。
     */
    getPendingTasks() {
        return Array.from(this.pendingTasks.values());
    }
    /**
     * 获取触发类型为 session_end 的所有待处理任务。
     */
    getTasksForSessionEnd() {
        return this.getPendingTasks().filter(e => e.trigger.type === 'session_end');
    }
    /**
     * 检查是否因 interval 触发需要调度新任务。
     * 每调用一次 turnCounter++，匹配 everyNTurns 为当前 turn 倍数的 interval 任务。
     */
    checkIntervalTriggers(currentTurn) {
        if (currentTurn !== undefined) {
            this.turnCounter = currentTurn;
        }
        else {
            this.turnCounter++;
        }
        // 找出满足条件的 interval 任务
        const triggered = this.getPendingTasks().filter(e => {
            if (e.trigger.type !== 'interval')
                return false;
            return this.turnCounter % e.trigger.everyNTurns === 0;
        });
        return triggered.length > 0;
    }
    /**
     * 获取满足 interval 触发条件的待处理任务。
     */
    getTasksForInterval() {
        return this.getPendingTasks().filter(e => e.trigger.type === 'interval');
    }
    /**
     * 获取所有 manual 触发的手动任务。
     */
    getTasksForManual() {
        return this.getPendingTasks().filter(e => e.trigger.type === 'manual');
    }
    /**
     * 执行并移除所有 session_end 任务。
     * 同时也会执行所有 interval 和 manual 任务（session_end 时一并清理）。
     *
     * @returns 待执行的任务列表
     */
    executePendingForSessionEnd() {
        const toExecute = this.getPendingTasks();
        if (toExecute.length === 0)
            return [];
        // 清除所有已调度的任务（session_end 时全部执行）
        for (const entry of toExecute) {
            this.pendingTasks.delete(entry.id);
        }
        return toExecute;
    }
    /**
     * 执行并移除满足 interval 触发条件的任务。
     *
     * @returns 待执行的任务列表
     */
    executePendingForInterval() {
        const toExecute = this.getTasksForInterval();
        for (const entry of toExecute) {
            this.pendingTasks.delete(entry.id);
        }
        return toExecute;
    }
    /**
     * 执行并移除一个 manual 任务。
     *
     * @returns 待执行的任务，如无则返回 null
     */
    executeManualTask() {
        const tasks = this.getTasksForManual();
        if (tasks.length === 0)
            return null;
        const entry = tasks[0];
        this.pendingTasks.delete(entry.id);
        return entry;
    }
    /** 重置调度器状态 */
    reset() {
        this.pendingTasks.clear();
        this.turnCounter = 0;
        this.idCounter = 0;
    }
    /** 获取当前 turn 计数 */
    get turnCount() {
        return this.turnCounter;
    }
}
exports.SleepComputeScheduler = SleepComputeScheduler;
// ============================================================================
// Helper：创建常见睡眠任务
// ============================================================================
/** 创建记忆整合任务 */
function createConsolidateTask(turnFrom, turnTo) {
    return {
        type: 'consolidate_memory',
        payload: { turnRange: [turnFrom, turnTo] },
    };
}
/** 创建知识提取任务 */
function createKnowledgeTask(source = 'turns') {
    return {
        type: 'extract_knowledge',
        payload: { source },
    };
}
/** 创建模式挖掘任务 */
function createPatternTask(lookback = 10) {
    return {
        type: 'mine_patterns',
        payload: { lookback },
    };
}
/** 创建 block 更新任务 */
function createUpdateBlockTask(blockNames) {
    return {
        type: 'update_blocks',
        payload: { blockNames },
    };
}
