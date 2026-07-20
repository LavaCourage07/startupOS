/**
 * UpstreamResults — 上游 Agent 产出管理（基于 Blackboard Event Sourcing）
 *
 * 替代本地 Map 实现，利用 Blackboard 的 Event Sourcing 机制
 */

import type { Blackboard } from "../session/blackboard";

export class UpstreamResults {
  private blackboard: Blackboard;

  constructor(blackboard: Blackboard) {
    this.blackboard = blackboard;
  }

  /**
   * 上游 Agent 完成时写入 Blackboard
   */
  writeUpstreamOutput(agentId: string, agentName: string, output: string): void {
    const outputKey = `upstream$${agentId}$output`;
    this.blackboard.setData(outputKey, output, agentId, {
      sourceUri: `dag-executor:upstream:${this.blackboard.sessionId}`,
      toolCallsCited: [],
    });

    // 同时写入上游元数据（方便查询）
    const metaKey = `meta$upstream$${agentId}`;
    const meta = {
      agentId,
      agentName,
      completedAt: new Date().toISOString(),
      outputLength: output.length,
    };
    this.blackboard.setData(metaKey, meta, "dag-executor", {
      sourceUri: `dag-executor:meta:${this.blackboard.sessionId}`,
    });
  }

  /**
   * 读取上游 Agent 的产出（供下游 Agent 使用）
   */
  readUpstreamOutput(agentId: string, agentName: string): string {
    const outputKey = `upstream$${agentId}$output`;
    const value = this.blackboard.getData(outputKey);

    if (!value) {
      return `(上游 ${agentName} 尚未完成或无输出)`;
    }

    return String(value);
  }

  /**
   * 检查上游是否已完成
   */
  isUpstreamCompleted(agentId: string): boolean {
    const outputKey = `upstream$${agentId}$output`;
    return this.blackboard.getData(outputKey) !== undefined;
  }

  /**
   * 获取上游完成状态摘要
   */
  getUpstreamMetadatas(): Array<{ agentId: string; agentName: string; completedAt: string; outputLength: number }> {
    const allEntries = this.blackboard.getEntries().filter((entry) =>
      entry.key.startsWith("meta$upstream$")
    );

    return allEntries.map((entry) => {
      const v = entry.value as { agentId: string; agentName: string; completedAt: string; outputLength: number };
      return {
        agentId: v.agentId,
        agentName: v.agentName,
        completedAt: v.completedAt,
        outputLength: v.outputLength,
      };
    });
  }
}
