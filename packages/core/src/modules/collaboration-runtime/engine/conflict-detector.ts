/**
 * Conflict Detector & Resolver — 实时检测多 Agent 协作中的冲突并自动消解。
 *
 * Story 9.15: 冲突检测与消解
 *
 * 检测 4 种冲突类型：
 * - resource_conflict: 多个 Agent 争抢同一资源/任务
 * - data_conflict: 多个 Agent 同时写同一黑板 key
 * - goal_conflict: 多个 Agent 的目标相互矛盾
 * - deadlock: 循环依赖导致死锁
 *
 * 消解策略（设计文档 §4.3）：
 * | 冲突类型 | 默认策略 | 备选策略 |
 * | resource_conflict | first_come_first_serve | priority_based, negotiation |
 * | data_conflict | lock_based | last_write_wins, merge |
 * | goal_conflict | supervisor_decision | negotiation, voting |
 * | deadlock | break_cycle | timeout |
 */

import type { Blackboard } from "../session/blackboard";
import type { EventStore } from "../session/event-store";
import type { RuntimeEvent } from "../session/types";

// ============================================================================
// Types
// ============================================================================

export type ConflictType =
  | "resource_conflict"
  | "data_conflict"
  | "goal_conflict"
  | "deadlock";

export type ResourceResolution =
  | "first_come_first_serve"
  | "priority_based"
  | "negotiation";

export type DataResolution =
  | "lock_based"
  | "last_write_wins"
  | "merge";

export type GoalResolution =
  | "supervisor_decision"
  | "negotiation"
  | "voting";

export type DeadlockResolution =
  | "break_cycle"
  | "timeout";

export type ConflictResolution =
  | ResourceResolution
  | DataResolution
  | GoalResolution
  | DeadlockResolution;

export interface Conflict {
  id: string;
  type: ConflictType;
  agents: string[];
  details: Record<string, unknown>;
  resolution: ConflictResolution;
  timestamp: string;
  resolved: boolean;
}

export interface ResolutionResult {
  conflict: Conflict;
  appliedStrategy: string;
  affectedAgents: string[];
  resolved: boolean;
}

export interface AgentPriority {
  agentId: string;
  priority: number; // higher = more priority
}

export interface ConflictDetectorConfig {
  lockTimeoutMs?: number; // 锁超时时间（默认 30s）
  writeIntervalMs?: number; // 数据冲突检测时间窗口（默认 1s）
  agentPriorities?: AgentPriority[];
}

const DEFAULT_CONFIG: Required<ConflictDetectorConfig> = {
  lockTimeoutMs: 30_000,
  writeIntervalMs: 1_000,
  agentPriorities: [],
};

// ============================================================================
// ConflictDetector
// ============================================================================

export class ConflictDetector {
  private blackboard: Blackboard;
  private config: Required<ConflictDetectorConfig>;
  private history: Conflict[] = [];
  private recentWrites = new Map<string, { agentId: string; timestamp: number }>(); // key → last writer

  constructor(
    blackboard: Blackboard,
    _eventStore: EventStore,
    config?: ConflictDetectorConfig
  ) {
    this.blackboard = blackboard;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 检测冲突（每次黑板操作后调用）。
   */
  detect(newEvent: RuntimeEvent): Conflict | null {
    let conflict: Conflict | null = null;

    switch (newEvent.type) {
      case "BLACKBOARD_WRITE":
      case "BLACKBOARD_UPDATE":
        conflict = this.detectDataConflict(newEvent);
        break;

      case "TASK_ASSIGNED":
        conflict = this.detectResourceConflict(newEvent);
        break;

      case "SESSION_ABORTED":
      case "TASK_FAILED":
        conflict = this.detectGoalConflict(newEvent);
        break;
    }

    // 检查死锁（每次检测）
    if (!conflict) {
      conflict = this.detectDeadlock();
    }

    if (conflict) {
      this.history.push(conflict);
    }

    return conflict;
  }

  /**
   * 应用消解策略。
   */
  resolve(conflict: Conflict): ResolutionResult {
    switch (conflict.type) {
      case "resource_conflict":
        return this.resolveResourceConflict(conflict);
      case "data_conflict":
        return this.resolveDataConflict(conflict);
      case "goal_conflict":
        return this.resolveGoalConflict(conflict);
      case "deadlock":
        return this.resolveDeadlock(conflict);
    }
  }

  /**
   * 获取冲突历史。
   */
  getHistory(): Conflict[] {
    return [...this.history];
  }

  /**
   * 获取指定 Agent 的冲突记录。
   */
  getHistoryByAgent(agentId: string): Conflict[] {
    return this.history.filter((c) => c.agents.includes(agentId));
  }

  /**
   * 获取未解决的冲突。
   */
  getUnresolved(): Conflict[] {
    return this.history.filter((c) => !c.resolved);
  }

  /**
   * 标记冲突为已解决。
   */
  markResolved(conflictId: string): void {
    const conflict = this.history.find((c) => c.id === conflictId);
    if (conflict) {
      conflict.resolved = true;
    }
  }

  /**
   * 检查锁超时并自动释放。
   */
  checkLockTimeouts(): Conflict[] {
    const locks = this.blackboard.getLocks();
    const timedOut: Conflict[] = [];

    for (const [key, lock] of Object.entries(locks)) {
      const expiresAt = new Date(lock.expiresAt).getTime();
      if (Date.now() > expiresAt) {
        this.blackboard.release(key, lock.holder);

        const conflict: Conflict = {
          id: this.generateId(),
          type: "resource_conflict",
          agents: [lock.holder],
          details: { resource: key, reason: "lock_timeout" },
          resolution: "timeout",
          timestamp: new Date().toISOString(),
          resolved: true,
        };
        this.history.push(conflict);
        timedOut.push(conflict);
      }
    }

    return timedOut;
  }

  // ============================================================================
  // Detection
  // ============================================================================

  /**
   * 检测数据冲突：短时间内多个 Agent 写同一 key。
   */
  private detectDataConflict(event: RuntimeEvent): Conflict | null {
    const key = event.payload?.["key"] as string | undefined;
    if (!key) return null;

    const now = Date.now();
    const lastWriter = this.recentWrites.get(key);

    // 清理过期的写入记录
    if (lastWriter && now - lastWriter.timestamp > this.config.writeIntervalMs) {
      this.recentWrites.delete(key);
    }

    // 记录当前写入
    this.recentWrites.set(key, {
      agentId: event.source,
      timestamp: now,
    });

    // 如果短时间内有其他 Agent 写过同一 key，触发冲突
    if (
      lastWriter &&
      now - lastWriter.timestamp <= this.config.writeIntervalMs &&
      lastWriter.agentId !== event.source
    ) {
      return {
        id: this.generateId(),
        type: "data_conflict",
        agents: [lastWriter.agentId, event.source],
        details: { key, lastWriter: lastWriter.agentId, currentWriter: event.source },
        resolution: "lock_based",
        timestamp: new Date().toISOString(),
        resolved: false,
      };
    }

    return null;
  }

  /**
   * 检测资源冲突：任务已被分配，又被重新分配给其他 Agent。
   */
  private detectResourceConflict(event: RuntimeEvent): Conflict | null {
    const taskId = event.payload?.["taskId"] as string | undefined;
    const agentId = event.payload?.["agentId"] as string | undefined;
    if (!taskId || !agentId) return null;

    // 检查该任务是否已经被分配给其他 Agent
    const tasks = this.blackboard.getTasks();
    const task = tasks.find((t) => t.id === taskId);

    if (
      task &&
      task.assignedTo &&
      task.assignedTo !== agentId &&
      task.status === "running"
    ) {
      return {
        id: this.generateId(),
        type: "resource_conflict",
        agents: [task.assignedTo, agentId],
        details: { resource: taskId, taskStatus: task.status },
        resolution: "first_come_first_serve",
        timestamp: new Date().toISOString(),
        resolved: false,
      };
    }

    return null;
  }

  /**
   * 检测目标冲突：多个 Agent 的任务产出相互矛盾。
   */
  private detectGoalConflict(event: RuntimeEvent): Conflict | null {
    // MVP: 检测同一任务同时有成功和失败事件
    const taskId = event.payload?.["taskId"] as string | undefined;
    if (!taskId) return null;

    const relatedEvents = this.history.filter(
      (c) => c.details["taskId"] === taskId && c.type === "goal_conflict"
    );

    // 如果有已存在的 goal_conflict，说明已有 Agent 对该任务有不同结论
    if (relatedEvents.length > 0) {
      return null; // 已记录
    }

    // 检查该任务是否存在矛盾输出
    const tasks = this.blackboard.getTasks();
    const task = tasks.find((t) => t.id === taskId);

    if (task && task.output && typeof task.output === "object") {
      const output = task.output as Record<string, unknown>;
      if (output["conflict"] || output["contradiction"]) {
        return {
          id: this.generateId(),
          type: "goal_conflict",
          agents: [event.source],
          details: {
            taskId,
            goals: [String(output["goal"] ?? "unknown")],
          },
          resolution: "supervisor_decision",
          timestamp: new Date().toISOString(),
          resolved: false,
        };
      }
    }

    return null;
  }

  /**
   * 检测死锁：循环依赖。
   */
  private detectDeadlock(): Conflict | null {
    const tasks = this.blackboard.getTasks();
    const runningTasks = tasks.filter((t) => t.status === "running");

    if (runningTasks.length < 2) return null;

    // 构建依赖图
    const dependencyGraph = new Map<string, string[]>();
    for (const task of runningTasks) {
      dependencyGraph.set(task.id, task.dependsOn ?? []);
    }

    // 检测循环
    const cycle = this.findCycle(dependencyGraph);
    if (cycle && cycle.length > 1) {
      // 从任务获取关联 Agent
      const agents = runningTasks
        .filter((t) => cycle.includes(t.id) && t.assignedTo)
        .map((t) => t.assignedTo!)
        .filter((a, i, arr) => arr.indexOf(a) === i);

      return {
        id: this.generateId(),
        type: "deadlock",
        agents: agents.length > 0 ? agents : ["unknown"],
        details: { cycle, taskIds: cycle },
        resolution: "break_cycle",
        timestamp: new Date().toISOString(),
        resolved: false,
      };
    }

    return null;
  }

  /**
   * 在有向图中找环（DFS）。
   */
  private findCycle(
    graph: Map<string, string[]>
  ): string[] | null {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): string[] | null => {
      if (inStack.has(node)) {
        // 找到环
        const cycleStart = path.indexOf(node);
        return path.slice(cycleStart);
      }
      if (visited.has(node)) return null;

      visited.add(node);
      inStack.add(node);
      path.push(node);

      for (const dep of graph.get(node) ?? []) {
        const result = dfs(dep);
        if (result) return result;
      }

      path.pop();
      inStack.delete(node);
      return null;
    };

    for (const node of graph.keys()) {
      const cycle = dfs(node);
      if (cycle) return cycle;
    }

    return null;
  }

  // ============================================================================
  // Resolution
  // ============================================================================

  /**
   * 资源冲突：先到先得（保留先分配者的所有权）。
   */
  private resolveResourceConflict(conflict: Conflict): ResolutionResult {
    const firstAgent = conflict.agents[0];
    if (!firstAgent) {
      return { conflict, appliedStrategy: "none", affectedAgents: [], resolved: false };
    }

    // 保留第一个 Agent 的所有权，通知其他 Agent
    const affectedAgents = conflict.agents.slice(1);

    conflict.resolved = true;
    conflict.resolution = "first_come_first_serve";

    return {
      conflict,
      appliedStrategy: "first_come_first_serve",
      affectedAgents,
      resolved: true,
    };
  }

  /**
   * 数据冲突：基于锁（检查谁持有锁，无锁则 last-write-wins）。
   */
  private resolveDataConflict(conflict: Conflict): ResolutionResult {
    const key = conflict.details["key"] as string | undefined;
    if (!key) {
      return { conflict, appliedStrategy: "last_write_wins", affectedAgents: conflict.agents, resolved: true };
    }

    const locks = this.blackboard.getLocks();
    const lock = locks[key];

    if (lock && conflict.agents.includes(lock.holder)) {
      // 锁持有者有写权限
      conflict.resolution = "lock_based";
    } else {
      // 无锁 → last-write-wins
      conflict.resolution = "last_write_wins";
    }

    conflict.resolved = true;

    return {
      conflict,
      appliedStrategy: conflict.resolution,
      affectedAgents: conflict.agents,
      resolved: true,
    };
  }

  /**
   * 目标冲突：上报 Supervisor 裁决。
   */
  private resolveGoalConflict(conflict: Conflict): ResolutionResult {
    conflict.resolution = "supervisor_decision";
    // 不自动标记 resolved — 需要 Supervisor 手动处理
    return {
      conflict,
      appliedStrategy: "supervisor_decision",
      affectedAgents: conflict.agents,
      resolved: false, // 等待 Supervisor 裁决
    };
  }

  /**
   * 死锁：打破循环（中断优先级最低的 Agent）。
   */
  private resolveDeadlock(conflict: Conflict): ResolutionResult {
    const cycle = conflict.details["cycle"] as string[] | undefined;
    if (!cycle || cycle.length === 0) {
      return { conflict, appliedStrategy: "none", affectedAgents: [], resolved: false };
    }

    // 找到优先级最低的 Agent（或在没有优先级配置时选择最后一个）
    const victim = this.selectDeadlockVictim(conflict.agents);

    if (victim) {
      conflict.resolution = "break_cycle";
      conflict.resolved = true;
    }

    return {
      conflict,
      appliedStrategy: "break_cycle",
      affectedAgents: victim ? [victim] : conflict.agents,
      resolved: !!victim,
    };
  }

  /**
   * 选择死锁牺牲者（优先级最低的 Agent）。
   */
  private selectDeadlockVictim(agents: string[]): string | undefined {
    if (agents.length === 0) return undefined;
    if (this.config.agentPriorities.length === 0) {
      // 无优先级配置 → 选择最后一个
      return agents[agents.length - 1];
    }

    const priorityMap = new Map(
      this.config.agentPriorities.map((p) => [p.agentId, p.priority])
    );

    let victim = agents[0];
    let lowestPriority = priorityMap.get(agents[0]!) ?? 0;

    for (const agent of agents.slice(1)) {
      const priority = priorityMap.get(agent) ?? 0;
      if (priority < lowestPriority) {
        lowestPriority = priority;
        victim = agent;
      }
    }

    return victim;
  }

  // ============================================================================
  // Utility
  // ============================================================================

  private generateId(): string {
    return `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }
}
