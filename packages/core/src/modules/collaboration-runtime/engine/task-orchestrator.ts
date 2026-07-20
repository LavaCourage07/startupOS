/**
 * TaskOrchestrator 桥接层 — Story 9.28A
 *
 * 职责：桥接 SupervisorMode ↔ AgentSpawner
 * - 将 SubTask 通过 spawner 启动 Agent 子进程执行
 * - 将结果写回 Blackboard，供下游聚合消费
 */

import path from "path";
import { getDataRoot } from "../../../lib/paths";
import { getGlobalSpawner } from "../sandbox/agent-spawner";
import { Blackboard } from "../session/blackboard";

import type { SubTask } from "./supervisor";
import type { RuntimeEvent } from "../session/types";

export interface SubTaskExecutionResult {
  id: string;
  agentId: string;
  output: string;
  completed: boolean;
  metrics: Record<string, unknown>;
}

export class TaskOrchestrator {
  private blackboard: Blackboard;

  constructor(blackboard: Blackboard) {
    this.blackboard = blackboard;
  }

  /**
   * 执行单个 SubTask — 通过 spawner 启动 Agent 子进程。
   */
  async executeTask(task: SubTask, projectId: string): Promise<SubTaskExecutionResult> {
    const agentId = task.assignedWorker ?? task.id;
    const workingDirectory = path.join(getDataRoot(), "projects", projectId, "agents", agentId);
    const spawner = getGlobalSpawner();

    const events: RuntimeEvent[] = [];
    const captureEvent = (event: RuntimeEvent): void => {
      events.push(event);
    };

    try {
      const proc = await spawner.spawn(
        { projectId, agentId, workingDirectory, agentType: "originos" },
        captureEvent,
      );

      await proc.prompt(task.description);

      const output = this.extractOutput(events);
      this.blackboard.setData(`result:${task.id}`, { agentId, output }, agentId);

      return { id: task.id, agentId, output, completed: true, metrics: {} };
    } finally {
      void spawner.destroy(agentId);
    }
  }

  /**
   * 并行执行所有子任务（简单版：忽略依赖排序）。
   * 依赖排序由 SupervisorMode.allocateAll 保证。
   */
  async runAll(tasks: SubTask[], projectId: string): Promise<SubTaskExecutionResult[]> {
    const results: SubTaskExecutionResult[] = [];

    for (const task of tasks) {
      try {
        const r = await this.executeTask(task, projectId);
        results.push(r);
      } catch (err) {
        results.push({
          id: task.id,
          agentId: task.assignedWorker ?? task.id,
          output: "",
          completed: false,
          metrics: { error: (err as Error).message },
        });
      }
    }

    return results;
  }

  private extractOutput(events: RuntimeEvent[]): string {
    const lastMsg = events
      .filter((e) => e.type === "ASSISTANT_MESSAGE" || e.type === "AGENT_END")
      .pop();
    if (!lastMsg) { return ""; }
    const output = lastMsg.payload?.["content"] ?? lastMsg.payload?.["message"];
    return typeof output === "string" ? output : JSON.stringify(output);
  }
}

export default TaskOrchestrator;
