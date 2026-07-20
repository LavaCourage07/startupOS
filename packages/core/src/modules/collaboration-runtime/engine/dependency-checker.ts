/**
 * DependencyChecker — Worker 任务依赖检查前置机制
 *
 * 借鉴 Ruflo 的 "依赖检查前置" 协议，Worker 在开始任务前
 * 必须验证上游依赖状态，否则写入 `blocked`。
 *
 * 参考 Ruflo worker-specialist:
 * - START 前检查依赖：dependencies []
 * - 依赖缺失时立即写入 blocked 状态
 * - 阻塞检测：阻塞立即报告，不等待超时
 */

import type { Blackboard } from "../session/blackboard";
import type { CollaborationTopology, TaskItem } from "../session/types";
import {
  buildWorkerKey,
  MemoryKeyCategory,
} from "../session/memory-keys";

export interface DependencySpec {
  /** 依赖的 Agent ID */
  agentId: string;
  /** 依赖的任务 ID（optional，表示只要该 Agent 有任何已完成任务即可） */
  taskId?: string;
  /** 依赖的输出键名（optional，从 deliverables 中提取） */
  outputKey?: string;
  /** 依赖类型：上游 Agent 完成或特定任务完成 */
  type?: "agent-complete" | "task-complete";
}

export interface DependencyCheckResult {
  satisfied: boolean;
  missingDeps: DependencySpec[];
  blockedReason?: string;
}

export interface DependencyResolvedEvent {
  type: "DEPENDENCY_RESOLVED";
  taskId: string;
  workerId: string;
  dependencies: DependencySpec[];
  resolvedAt: string;
}

export class DependencyChecker {
  private blackboard: Blackboard;

  constructor(blackboard: Blackboard) {
    this.blackboard = blackboard;
  }

  /**
   * 检查依赖是否满足
   */
  checkDependencies(dependencies: DependencySpec[]): DependencyCheckResult {
    const missingDeps: DependencySpec[] = [];

    for (const dep of dependencies) {
      const satisfied = this.checkSingleDependency(dep);
      if (!satisfied) {
        missingDeps.push(dep);
      }
    }

    if (missingDeps.length === 0) {
      return { satisfied: true, missingDeps: [] };
    }

    const blockedReason = this.formatBlockedReason(missingDeps);
    return { satisfied: false, missingDeps, blockedReason };
  }

  /**
   * 从 Topology 自动推导依赖（对于上游 Agent）
   */
  deriveDependenciesFromTopology(
    agentId: string,
    topology: CollaborationTopology
  ): DependencySpec[] {
    const dependencies: DependencySpec[] = [];
    const incomingEdges = topology.edges.filter(
      (e) => e.to === agentId && e.type === "trigger"
    );

    for (const edge of incomingEdges) {
      dependencies.push({
        agentId: edge.from,
        taskId: undefined, // 只要上游完成了即可
        outputKey: undefined,
        type: "agent-complete",
      });
    }

    return dependencies;
  }

  /**
   * 推导指定任务的依赖（基于 DAG 层级）
   */
  deriveDependenciesFromDag(
    agentId: string,
    allTasks: TaskItem[]
  ): DependencySpec[] {
    const dependencies: DependencySpec[] = [];
    const thisTask = allTasks.find((t) => t.assignedTo === agentId);

    if (!thisTask?.dependsOn || thisTask.dependsOn.length === 0) {
      return dependencies;
    }

    for (const depId of thisTask.dependsOn) {
      const depTask = allTasks.find((t) => t.id === depId);
      if (!depTask) continue;

      dependencies.push({
        agentId: depTask.assignedTo ?? "",
        taskId: depId,
        type: "task-complete",
      });
    }

    return dependencies;
  }

  /**
   * 过滤已满足的依赖
   */
  filterSatisfiedDependencies(dependencies: DependencySpec[]): {
    satisfied: DependencySpec[];
    missing: DependencySpec[];
  } {
    const satisfied: DependencySpec[] = [];
    const missing: DependencySpec[] = [];

    for (const dep of dependencies) {
      if (this.checkSingleDependency(dep)) {
        satisfied.push(dep);
      } else {
        missing.push(dep);
      }
    }

    return { satisfied, missing };
  }

  /**
   * 检查依赖是否被阻塞（上游 Agent 阻塞则本任务也阻塞）
   */
  isTransitivelyBlocked(dependencies: DependencySpec[]): boolean {
    for (const dep of dependencies) {
      // 检查上游 Agent 是否阻塞
      const blockedKey = buildWorkerKey(MemoryKeyCategory.BLOCKED, dep.agentId);
      const blockedEntry = this.blackboard.getDataEntry(blockedKey);

      if (blockedEntry?.value) {
        return true;
      }

      // 检查上游任务是否阻塞
      const tasks = this.blackboard.getTasks();
      const depTask = tasks.find((t) => t.id === dep.taskId);
      if (depTask?.status === "blocked") {
        return true;
      }
    }

    return false;
  }

  /**
   * 生成依赖满足事件（用于通知等待的 Worker）
   */
  generateResolutionEvent(
    taskId: string,
    workerId: string,
    resolvedDeps: DependencySpec[]
  ): DependencyResolvedEvent {
    return {
      type: "DEPENDENCY_RESOLVED",
      taskId,
      workerId,
      dependencies: resolvedDeps,
      resolvedAt: new Date().toISOString(),
    };
  }

  /**
   * 获取阻塞原因的详细描述
   */
  getBlockedReasonDetails(workerId: string): string | null {
    const blockedKey = buildWorkerKey(MemoryKeyCategory.BLOCKED, workerId);
    const blockedEntry = this.blackboard.getDataEntry(blockedKey);

    if (!blockedEntry?.value) {
      return null;
    }

    const blocked = blockedEntry.value as {
      blockedOn: string;
      waitingFor: string[];
      since: string;
      rationale?: string;
    };

    let details = `Blocked on ${blocked.blockedOn} since ${blocked.since}`;

    if (blocked.waitingFor && blocked.waitingFor.length > 0) {
      details += `. Waiting for: ${blocked.waitingFor.join(", ")}`;
    }

    if (blocked.rationale) {
      details += `. Rationale: ${blocked.rationale}`;
    }

    return details;
  }

  /**
   * 检查单个依赖是否满足
   */
  private checkSingleDependency(dep: DependencySpec): boolean {
    if (dep.type === "task-complete" && dep.taskId) {
      // 检查特定任务是否完成
      const task = this.blackboard.getTasks().find((t) => t.id === dep.taskId);
      if (!task) return false;
      return task.status === "completed" && !!task.completedAt;
    } else {
      // 检查 Agent 是否有任何已完成任务
      const tasks = this.blackboard.getTasks();
      const agentCompletedTasks = tasks.filter(
        (t) => t.assignedTo === dep.agentId && (t.status === "completed" || t.status === "reported")
      );

      if (dep.type === "agent-complete") {
        return agentCompletedTasks.length > 0;
      }

      // 默认：只要上游有任务（非 pending）即可
      const agentTasks = tasks.filter((t) => t.assignedTo === dep.agentId);
      return agentTasks.some((t) => t.status !== "pending");
    }
  }

  /**
   * 格式化阻塞原因
   */
  private formatBlockedReason(missingDeps: DependencySpec[]): string {
    const depDescriptions = missingDeps.map((dep) => {
      if (dep.taskId) {
        return `Task ${dep.taskId} from Agent ${dep.agentId}`;
      }
      return `Agent ${dep.agentId} (any completed task)`;
    });

    return `Missing dependencies: ${depDescriptions.join(", ")}`;
  }

  /**
   * 检查 Agent 可用的上游输出
   */
  getAvailableUpstreamOutputs(agentId: string): Array<{ agentId: string; taskId?: string; outputKey?: string }> {
    const topology = this.loadTopologyFromBlackboard();
    if (!topology) return [];

    const upstreamAgents = topology.edges
      .filter((e) => e.to === agentId && e.type === "trigger")
      .map((e) => e.from);

    return upstreamAgents.map((upstreamAgentId) => ({
      agentId: upstreamAgentId,
      taskId: undefined,
      outputKey: undefined,
    }));
  }

  /**
   * 从 Blackboard 加载 Topology（如果存在）
   */
  private loadTopologyFromBlackboard(): CollaborationTopology | null {
    const topologyKey = "topology";
    const topologyEntry = this.blackboard.getDataEntry(topologyKey);

    if (!topologyEntry?.value) {
      return null;
    }

    return topologyEntry.value as CollaborationTopology;
  }
}
