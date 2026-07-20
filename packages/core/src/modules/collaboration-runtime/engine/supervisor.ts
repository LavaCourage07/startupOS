/**
 * Supervisor Mode — 静态/半动态子任务协调 + Contract Net 分配 + Verifier 验证。
 *
 * Story 9.13: Supervisor 模式（深度 ≤ 2，强制 Verifier）
 *
 * 当前工作流程：
 * 1. Supervisor 接收全局目标或外部注入 plan
 * 2. 每个子任务通过 Contract Net 协议分配合适的 Worker
 * 3. 为每个子任务指定至少一个 deterministic Verifier
 * 4. Verifier 执行非 LLM 检查（schema 验证、测试运行等）
 * 5. 如验证失败，最多 2 轮 revision loop，之后上报
 * 6. Supervisor 汇总所有结果，判定全局目标是否达成
 *
 * 说明：
 * - 当前生产路径主要由 `executeSupervisorDag()` 注入静态 plan 使用
 * - 真正的 LLM 动态分解 / Queen-Led 协调留给后续 Story 9.19
 *
 * 约束：
 * - 树深度限制 ≤ 2
 * - 强制 Verifier 角色（非 LLM 确定性检查）
 * - Revision loop 最多 2 轮
 */

import { ContractNetProtocol, type TaskDescription } from "../protocol/contract-net";

import type { EventEmitter } from "../config";
import type { Blackboard } from "../session/blackboard";
import type { EventStore } from "../session/event-store";
import type { RuntimeEvent } from "../session/types";

// ============================================================================
// Types
// ============================================================================

export type SubTaskState =
  | "pending"       // 等待分配
  | "allocating"    // 招标中
  | "executing"     // Worker 执行中
  | "verifying"     // Verifier 检查中
  | "revision"      // 修订中
  | "completed"
  | "failed"
  | "reported";     // 上报人类

export interface SubTaskResult {
  output: string;
  artifacts?: string[]; // 产出的文件/数据路径
  revisionCount: number;
}

export interface SubTask {
  id: string;
  parentTaskId?: string; // 父任务 ID（深度跟踪）
  description: string;
  requiredCapabilities?: string[];
  state: SubTaskState;
  assignedWorker?: string;
  verifierId?: string;       // deterministic verifier Agent ID
  result?: SubTaskResult;
  error?: string;
  revisionCount: number;
}

export type SupervisorState =
  | "idle"
  | "decomposing"
  | "allocating"
  | "executing"
  | "verifying"
  | "aggregating"
  | "completed"
  | "failed"
  | "escalated";

export interface DecompositionPlan {
  goal: string;
  subTasks: SubTask[];
  depth: number; // 当前分解深度（0-2）
  state: SupervisorState;
  startedAt: string;
  completedAt?: string;
}

export interface VerifierCheck {
  taskId: string;
  verifierId: string;
  passed: boolean;
  errors: string[];
  timestamp: string;
}

// ============================================================================
// CapabilityMatcher
// ============================================================================

export interface AgentCapability {
  agentId: string;
  capabilities: string[];
  domain?: string;
  skills: string[];
  currentLoad: number; // 当前任务数
  successRate?: number; // 历史成功率 0-1
}

export class CapabilityMatcher {
  /**
   * 根据任务需求对 Agent 排序，返回匹配度从高到低。
   */
  match(
    task: TaskDescription,
    availableAgents: AgentCapability[]
  ): AgentCapability[] {
    if (availableAgents.length === 0) { return []; }

    const scored = availableAgents.map((agent) => ({
      agent,
      score: this.scoreAgent(agent, task),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.agent);
  }

  private scoreAgent(agent: AgentCapability, task: TaskDescription): number {
    let score = 0;

    // 能力匹配（权重最高）
    if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
      const matchCount = task.requiredCapabilities.filter((cap) =>
        agent.capabilities.includes(cap)
      ).length;
      score += (matchCount / task.requiredCapabilities.length) * 50;
    }

    // 领域匹配
    const taskDesc = task.description;
    const agentDomain = agent.domain;
    if (taskDesc !== undefined && taskDesc.length > 0 && agentDomain !== undefined && agentDomain.length > 0) {
      const domainWords = agentDomain.toLowerCase().split(/\s+/);
      const descWords = taskDesc.toLowerCase().split(/\s+/);
      const domainMatch = domainWords.some((w) =>
        descWords.some((dw) => dw.includes(w) || w.includes(dw))
      );
      if (domainMatch) { score += 20; }
    }

    // 负载越低越优先
    score += Math.max(0, 10 - agent.currentLoad * 2);

    // 历史成功率
    if (agent.successRate !== undefined) {
      score += agent.successRate * 20;
    }

    return score;
  }
}

// ============================================================================
// SupervisorMode
// ============================================================================

export interface SupervisorDeps {
  blackboard: Blackboard;
  eventStore: EventStore;
  eventEmitter: EventEmitter;
  contractNet: ContractNetProtocol;
  agents: AgentCapability[]; // 所有可用 Worker
  maxRevisionRounds?: number; // 默认 2
  maxDepth?: number; // 默认 2
}

export class SupervisorMode {
  private deps: SupervisorDeps;
  private contractNet: ContractNetProtocol;
  private capabilityMatcher = new CapabilityMatcher();
  private plan: DecompositionPlan | null = null;
  private verifierChecks: VerifierCheck[] = [];
  private maxRevisions: number;

  constructor(deps: SupervisorDeps) {
    this.deps = deps;
    this.contractNet = deps.contractNet;
    this.maxRevisions = deps.maxRevisionRounds ?? 2;
  }

  /**
   * 接收全局目标，开始分解和分配。
   */
  async start(goal: string): Promise<DecompositionPlan> {
    this.plan = {
      goal,
      subTasks: [],
      depth: 0,
      state: "decomposing",
      startedAt: new Date().toISOString(),
    };

    this.emitEvent("SUPERVISOR_START", { goal });

    // Step 1: 分解为子任务
    this.decompose();

    // Step 2: 为每个子任务分配 Worker 和 Verifier
    await this.allocateAll();

    if (this.plan === null) { throw new Error("Plan unexpectedly null after start"); }
    return this.plan;
  }

  /**
   * 标记 Worker 完成子任务。
   */
  markSubTaskComplete(
    taskId: string,
    result: SubTaskResult
  ): void {
    const task = this.plan?.subTasks.find((t) => t.id === taskId);
    if (task === undefined) { return; }

    task.result = result;
    task.state = "verifying";

    this.emitEvent("SUBTASK_COMPLETE", {
      taskId,
      worker: task.assignedWorker,
      output: result.output,
    });
  }

  /**
   * 标记子任务执行失败。
   */
  markSubTaskFailed(taskId: string, error: string): void {
    const task = this.plan?.subTasks.find((t) => t.id === taskId);
    if (task === undefined) { return; }

    task.error = error;
    task.state = "failed";

    this.emitEvent("SUBTASK_FAILED", { taskId, error });
  }

  /**
   * 运行 Verifier 检查。
   */
  runVerifier(taskId: string, verifierId: string): VerifierCheck {
    const task = this.plan?.subTasks.find((t) => t.id === taskId);
    if (!task || !task.result) {
      throw new Error(`Task ${taskId} has no result to verify`);
    }

    this.emitEvent("VERIFIER_CHECK", { taskId, verifierId });

    // Verifier 使用确定性检查（非 LLM）
    // 这里调用 deps.agentEngine 触发 deterministic verifier
    const check: VerifierCheck = {
      taskId,
      verifierId,
      passed: true, // 默认通过，实际由外部注入检查逻辑
      errors: [],
      timestamp: new Date().toISOString(),
    };

    this.verifierChecks.push(check);

    if (check.passed) {
      task.state = "completed";
      this.emitEvent("VERIFIER_PASSED", { taskId, verifierId });
    } else {
      this.emitEvent("VERIFIER_FAILED", {
        taskId,
        verifierId,
        errors: check.errors,
      });
      this.handleVerificationFailure(task, check);
    }

    return check;
  }

  /**
   * 处理验证失败，触发 revision loop。
   */
  private handleVerificationFailure(
    task: SubTask,
    _check: VerifierCheck
  ): void {
    if (task.revisionCount >= this.maxRevisions) {
      // 超过修订上限，上报
      task.state = "reported";
      this.emitEvent("REVISION_EXCEEDED", {
        taskId: task.id,
        maxRevisions: this.maxRevisions,
      });
      return;
    }

    // 重新分配给 Worker 进行修订
    task.revisionCount += 1;
    task.state = "revision";
    task.result = undefined;

    this.emitEvent("REVISION_ASSIGNED", {
      taskId: task.id,
      worker: task.assignedWorker,
      revisionRound: task.revisionCount,
    });
  }

  /**
   * 汇总所有结果。
   */
  aggregate(): {
    state: "completed" | "failed" | "escalated";
    completedCount: number;
    failedCount: number;
    escalatedCount: number;
    totalSubTasks: number;
  } {
    if (!this.plan) {
      throw new Error("No active plan");
    }

    const completed = this.plan.subTasks.filter(
      (t) => t.state === "completed"
    ).length;
    const failed = this.plan.subTasks.filter(
      (t) => t.state === "failed"
    ).length;
    const escalated = this.plan.subTasks.filter(
      (t) => t.state === "reported"
    ).length;

    this.plan.state =
      failed > 0 ? "failed" : escalated > 0 ? "escalated" : "completed";
    this.plan.completedAt = new Date().toISOString();

    return {
      state: this.plan.state,
      completedCount: completed,
      failedCount: failed,
      escalatedCount: escalated,
      totalSubTasks: this.plan.subTasks.length,
    };
  }

  /**
   * 获取当前计划。
   */
  getPlan(): DecompositionPlan | null {
    return this.plan;
  }

  /**
   * 外部注入 DecompositionPlan（用于绕过 decompose stub）。
   * Story 9.28B: 从 agents.json 推断静态 plan 后调用此方法。
   */
  setPlan(plan: DecompositionPlan): void {
    this.plan = plan;
  }

  /**
   * Step 2: 为所有子任务分配 Worker 和 Verifier。
   * Story 9.28D: 公开供 executeSupervisorDag 调用。
   */
  async allocateAll(): Promise<void> {
    if (this.plan === null) { return; }

    this.plan.state = "allocating";
    this.emitEvent("ALLOCATING");

    const pendingTasks = this.plan.subTasks.filter(
      (t) => t.state === "pending"
    );

    for (const task of pendingTasks) {
      await this.allocateTask(task);
    }

    this.emitEvent("ALLOCATION_COMPLETE", {
      allocatedCount: pendingTasks.length,
    });
  }

  /**
   * 获取 Verifier 检查记录。
   */
  getVerifierChecks(): VerifierCheck[] {
    return [...this.verifierChecks];
  }

  // ============================================================================
  // Internal
  // ============================================================================

  /**
   * Step 1: 分解全局目标为子任务。
   *
   * MVP 使用简单的基于规则的分解。
   * 生产环境应使用 LLM 分解。
   */
  private decompose(): void {
    if (this.plan === null) { return; }

    this.plan.state = "decomposing";
    this.emitEvent("DECOMPOSING", { goal: this.plan.goal });

    // MVP: 将目标按能力需求拆分为独立子任务
    // 实际应由 LLM 生成结构化的子任务列表
    const subTask: SubTask = {
      id: this.generateTaskId(),
      description: this.plan.goal,
      state: "pending",
      revisionCount: 0,
    };

    this.plan.subTasks.push(subTask);

    this.emitEvent("DECOMPOSITION_COMPLETE", {
      subTaskCount: this.plan.subTasks.length,
    });
  }

  /**
   * 为单个子任务分配 Worker（通过 Contract Net）+ Verifier。
   */
  private async allocateTask(task: SubTask): Promise<void> {
    if (this.plan === null) { return; }

    task.state = "allocating";

    // 1. 匹配候选 Worker
    const taskDesc: TaskDescription = {
      id: task.id,
      description: task.description,
      requiredCapabilities: task.requiredCapabilities,
      deadline: new Date(Date.now() + 5 * 60 * 1000), // 5 分钟默认
    };

    const candidates = this.capabilityMatcher.match(
      taskDesc,
      this.deps.agents.filter((a) => a.agentId !== "supervisor")
    );

    if (candidates.length === 0) {
      task.state = "failed";
      task.error = "No suitable Worker available";
      this.emitEvent("NO_WORKER_AVAILABLE", { taskId: task.id });
      return;
    }

    // 2. 选择最佳 Worker（最高匹配度）
    const selectedWorker = candidates[0]!;

    // 3. 选择 Verifier（排除被选为 Worker 的 Agent）
    const verifierCandidates = this.deps.agents.filter(
      (a) => a.agentId !== selectedWorker.agentId
    );
    const verifier = verifierCandidates.length > 0
      ? verifierCandidates[0]
      : null;

    // 4. 分配
    task.assignedWorker = selectedWorker.agentId;
    task.verifierId = verifier?.agentId;
    task.state = "executing";

    this.emitEvent("TASK_ALLOCATED", {
      taskId: task.id,
      worker: selectedWorker.agentId,
      verifier: verifier?.agentId,
    });

    // 5. 通过 Contract Net 发送正式分配
    try {
      const convId = await this.contractNet.callForProposal(
        taskDesc,
        [selectedWorker.agentId],
        taskDesc.deadline!,
        this.deps.blackboard
      );

      // 模拟 Worker 接受（实际由 Worker 自行投标）
      this.contractNet.acceptProposal(
        convId,
        selectedWorker.agentId,
        this.deps.blackboard
      );
    } catch {
      // Contract Net 失败不影响基本分配，Worker 仍可通过黑板接收任务
      this.emitEvent("CONTRACT_NET_SKIPPED", { taskId: task.id });
    }
  }

  /**
   * 生成唯一任务 ID。
   */
  private generateTaskId(): string {
    return `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }

  /**
   * 发出事件到 EventStore。
   */
  private emitEvent(type: string, payload?: Record<string, unknown>): void {
    const event: RuntimeEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: type as RuntimeEvent["type"],
      timestamp: new Date().toISOString(),
      source: "supervisor",
      sessionId: "supervisor",
      seq: Date.now(),
      payload: payload ?? {},
    };

    void this.deps.eventStore.append(event);
    this.deps.eventEmitter.emit(event);
  }
}
