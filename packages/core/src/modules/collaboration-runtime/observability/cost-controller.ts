/**
 * Resource Limiter & Cost Controller — per-Agent Token 配额、成本控制。
 *
 * Story 9.18: 生产加固 — 成本控制与资源配额
 *
 * 功能：
 * - per-Agent Token 配额管理
 * - 实时检查是否超配额
 * - 按 Agent/Session 维度的成本报告
 */

// ============================================================================
// Types
// ============================================================================

export interface AgentQuota {
  agentId: string;
  maxTokens: number;
  maxToolCalls?: number;
  maxMessages?: number;
}

export interface AgentUsage {
  agentId: string;
  tokensUsed: number;
  toolCalls: number;
  messagesSent: number;
  turnCount: number;
}

export interface CostReport {
  sessionId: string;
  totalTokens: number;
  totalAgentTurns: number;
  totalMessages: number;
  agentBreakdown: Record<
    string,
    {
      tokensUsed: number;
      turns: number;
      messages: number;
      quotaRemaining: number;
      quotaExceeded: boolean;
    }
  >;
  estimatedCostUsd: number;
}

export interface QuotaCheck {
  allowed: boolean;
  remaining: number;
  reason?: string;
}

// ============================================================================
// Token cost model (approximate)
// ============================================================================

const TOKEN_COST_PER_1K: Record<string, number> = {
  input: 0.0025,
  output: 0.01,
};

// ============================================================================
// CostController
// ============================================================================

export class CostController {
  private quotas = new Map<string, AgentQuota>();
  private usages = new Map<string, AgentUsage>(); // agentId → usage
  private tokenInputCounts = new Map<string, number>();
  private tokenOutputCounts = new Map<string, number>();

  /**
   * 设置 Agent Token 配额。
   */
  setQuota(config: AgentQuota): void {
    this.quotas.set(config.agentId, { ...config });

    // 初始化 usage（如不存在）
    if (!this.usages.has(config.agentId)) {
      this.usages.set(config.agentId, {
        agentId: config.agentId,
        tokensUsed: 0,
        toolCalls: 0,
        messagesSent: 0,
        turnCount: 0,
      });
    }
  }

  /**
   * 移除 Agent 配额。
   */
  removeQuota(agentId: string): void {
    this.quotas.delete(agentId);
  }

  /**
   * 检查是否超 Token 配额。
   */
  checkTokenQuota(agentId: string): QuotaCheck {
    const quota = this.quotas.get(agentId);
    if (!quota) {
      // 无配额限制 → 允许
      return { allowed: true, remaining: Infinity };
    }

    const usage = this.usages.get(agentId);
    const remaining = quota.maxTokens - (usage?.tokensUsed ?? 0);

    if (remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        reason: `Token quota exceeded for ${agentId} (${usage?.tokensUsed}/${quota.maxTokens})`,
      };
    }

    return { allowed: true, remaining };
  }

  /**
   * 检查是否超工具调用配额。
   */
  checkToolCallQuota(agentId: string): QuotaCheck {
    const quota = this.quotas.get(agentId);
    if (!quota?.maxToolCalls) {
      return { allowed: true, remaining: Infinity };
    }

    const usage = this.usages.get(agentId);
    const used = usage?.toolCalls ?? 0;
    const remaining = quota.maxToolCalls - used;

    if (remaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        reason: `Tool call quota exceeded for ${agentId} (${used}/${quota.maxToolCalls})`,
      };
    }

    return { allowed: true, remaining };
  }

  /**
   * 记录 Token 使用量。
   */
  recordUsage(
    agentId: string,
    usage: { inputTokens?: number; outputTokens?: number }
  ): void {
    const agentUsage = this.ensureUsage(agentId);

    if (usage.inputTokens) {
      agentUsage.tokensUsed += usage.inputTokens;
      this.tokenInputCounts.set(
        agentId,
        (this.tokenInputCounts.get(agentId) ?? 0) + usage.inputTokens
      );
    }
    if (usage.outputTokens) {
      agentUsage.tokensUsed += usage.outputTokens;
      this.tokenOutputCounts.set(
        agentId,
        (this.tokenOutputCounts.get(agentId) ?? 0) + usage.outputTokens
      );
    }
  }

  /**
   * 记录工具调用。
   */
  recordToolCall(agentId: string): void {
    this.ensureUsage(agentId).toolCalls += 1;
  }

  /**
   * 记录消息发送。
   */
  recordMessage(agentId: string): void {
    this.ensureUsage(agentId).messagesSent += 1;
  }

  /**
   * 记录一轮思考。
   */
  recordTurn(agentId: string): void {
    this.ensureUsage(agentId).turnCount += 1;
  }

  /**
   * 获取 Agent 使用详情。
   */
  getUsage(agentId: string): AgentUsage | undefined {
    return this.usages.get(agentId);
  }

  /**
   * 获取所有 Agent 使用详情。
   */
  getAllUsage(): AgentUsage[] {
    return Array.from(this.usages.values());
  }

  /**
   * 获取成本报告。
   */
  getCostReport(sessionId: string): CostReport {
    let totalTokens = 0;
    let totalTurns = 0;
    let totalMessages = 0;
    const agentBreakdown: CostReport["agentBreakdown"] = {};

    for (const [agentId, usage] of this.usages) {
      const quota = this.quotas.get(agentId);
      const remaining = quota
        ? Math.max(0, quota.maxTokens - usage.tokensUsed)
        : Infinity;

      agentBreakdown[agentId] = {
        tokensUsed: usage.tokensUsed,
        turns: usage.turnCount,
        messages: usage.messagesSent,
        quotaRemaining: remaining,
        quotaExceeded: quota ? usage.tokensUsed > quota.maxTokens : false,
      };

      totalTokens += usage.tokensUsed;
      totalTurns += usage.turnCount;
      totalMessages += usage.messagesSent;
    }

    return {
      sessionId,
      totalTokens,
      totalAgentTurns: totalTurns,
      totalMessages,
      agentBreakdown,
      estimatedCostUsd: this.estimateCost(totalTokens),
    };
  }

  /**
   * 重置指定 Agent 的使用统计。
   */
  resetUsage(agentId: string): void {
    this.usages.set(agentId, {
      agentId,
      tokensUsed: 0,
      toolCalls: 0,
      messagesSent: 0,
      turnCount: 0,
    });
  }

  /**
   * 重置所有使用统计。
   */
  resetAllUsage(): void {
    for (const [agentId] of this.usages) {
      this.resetUsage(agentId);
    }
  }

  // ============================================================================
  // Internal
  // ============================================================================

  private ensureUsage(agentId: string): AgentUsage {
    if (!this.usages.has(agentId)) {
      this.usages.set(agentId, {
        agentId,
        tokensUsed: 0,
        toolCalls: 0,
        messagesSent: 0,
        turnCount: 0,
      });
    }
    return this.usages.get(agentId)!;
  }

  private estimateCost(totalTokens: number): number {
    // Simplified: assume 50/50 input/output split
    const inputTokens = totalTokens * 0.5;
    const outputTokens = totalTokens * 0.5;
    return (
      (inputTokens / 1000) * (TOKEN_COST_PER_1K["input"] ?? 0.0025) +
      (outputTokens / 1000) * (TOKEN_COST_PER_1K["output"] ?? 0.01)
    );
  }
}
