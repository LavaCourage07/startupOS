/**
 * T.8 Trust Expansion - Stub 实现
 *
 * 注意: 这是 MVP 阶段的临时实现，用于隔离 T.8 的开发。
 * 完整实现将在后续 Epic 中完成。
 *
 * QA Notes:
 * - Stub 实现所有接口方法，但只提供固定行为
 * - 所有方法添加警告日志，方便调试
 * - 提供 isStub() 方法用于检测
 * - 数据结构与完整实现保持一致
 */

// ============================================================================
// 类型定义
// ============================================================================

export type AutonomyLevel =
  | 'limited'
  | 'guided'
  | 'collaborative'
  | 'autonomous';

export interface TrustModel {
  overall_trust: number;  // 总体信任度 (0-1)
  domain_trust: Map<string, number>;  // 领域信任度

  // 信任历史
  history: {
    timestamp: number;
    event: TrustEvent;
    delta: number;  // 信任度变化
  }[];
}

export type TrustEvent =
  | { type: 'successful_suggestion' }
  | { type: 'correction_applied'; severity: 'minor' | 'major' | 'critical' }
  | { type: 'pattern_verified' }
  | { type: 'pattern_rejected' };

export interface TrustManager {
  /**
   * 处理信任事件
   */
  processTrustEvent(event: TrustEvent): Promise<void>;

  /**
   * 获取当前自主级别
   */
  getAutonomyLevel(domain?: string): AutonomyLevel;

  /**
   * 信任度折损与恢复
   */
  applyTrustPenalty(severity: 'minor' | 'major' | 'critical'): Promise<void>;

  recoverTrust(event: TrustEvent): Promise<void>;
}

// ============================================================================
// Stub 实现
// ============================================================================

/**
 * TrustManagerStub
 *
 * MVP 阶段: 使用固定的 "guided" 自主级别
 */
export class TrustManagerStub implements TrustManager {
  // MVP: 固定为 "guided" 级别
  // 这意味着 agent 可在有多个可行方案时自主选择，
  // 但在高风险决策时仍需用户确认
  private static readonly DEFAULT_AUTONOMY: AutonomyLevel = 'guided';

  private trustLevel: number = 0.5;  // MVP: 固定信任度
  private eventLog: TrustEvent[] = [];

  /**
   * MVP 实现: 信任管理器的桩方法
   *
   * 注意: 这个 stub 只记录事件，不实际影响信任度
   */
  async processTrustEvent(event: TrustEvent): Promise<void> {
    this.eventLog.push(event);

    console.warn('[TrustManagerStub] Using stub implementation.');
    console.warn('[TrustManagerStub] Trust events are logged but not processed.');
    console.warn('[TrustManagerStub] Full implementation will be in T.8 (Trust Expansion).');
  }

  /**
   * MVP 实现: 返回固定的自主级别
   */
  getAutonomyLevel(domain?: string): AutonomyLevel {
    if (domain) {
      console.warn(`[TrustManagerStub] Domain-specific trust not supported in stub. Returning default.`);
    }
    return TrustManagerStub.DEFAULT_AUTONOMY;
  }

  /**
   * MVP 实现: 不实际应用惩罚
   */
  async applyTrustPenalty(severity: 'minor' | 'major' | 'critical'): Promise<void> {
    this.eventLog.push({
      type: 'correction_applied',
      severity
    });

    console.warn(`[TrustManagerStub] Penalty of severity '${severity}' would be applied in full implementation.`);
    console.warn('[TrustManagerStub] Full implementation will be in T.8 (Trust Expansion).');
  }

  /**
   * MVP 实现: 不实际恢复信任度
   */
  async recoverTrust(event: TrustEvent): Promise<void> {
    this.eventLog.push(event);

    console.warn('[TrustManagerStub] Trust recovery would be applied in full implementation.');
    console.warn('[TrustManagerStub] Full implementation will be in T.8 (Trust Expansion).');
  }

  /**
   * 获取当前信任度（用于调试）
   */
  getCurrentTrust(): number {
    return this.trustLevel;
  }

  /**
   * 获取事件日志（用于调试）
   */
  getEventLog(): TrustEvent[] {
    return [...this.eventLog];
  }

  /**
   * 清空事件日志（用于测试）
   */
  clearEventLog(): void {
    this.eventLog = [];
  }

  /**
   * 检查是否是 Stub 实现
   *
   * 这个方法用于在代码中检测是否使用的是 stub，
   * 避免在 stub 环境中执行不支持的逻辑
   */
  isStub(): boolean {
    return true;
  }
}

// ============================================================================
// Autonomy 级别定义文档
// ============================================================================

/**
 * Autonomy Level 文档
 *
 * limited:
 *   - agent 只提供建议，所有决策由用户确认
 *   - confirmation_required: 'always'
 *
 * guided:
 *   - agent 可在有多个可行方案时自主选择
 *   - confirmation_required: 'on_high_stakes'
 *
 * collaborative:
 *   - agent 可自主处理常规任务，只在模糊地带确认
 *   - confirmation_required: 'on_ambiguity'
 *
 * autonomous:
 *   - agent 完全自主决策，只在边界情况警示
 *   - confirmation_required: 'never'
 */
export const AUTONOMY_LEVELS = {
  limited: {
    description: 'agent 只提供建议，所有决策由用户确认',
    confirmation_required: 'always',
    trust_range: [0.0, 0.3] as [number, number]
  },
  guided: {
    description: 'agent 可在有多个可行方案时自主选择',
    confirmation_required: 'on_high_stakes',
    trust_range: [0.3, 0.6] as [number, number]
  },
  collaborative: {
    description: 'agent 可自主处理常规任务，只在模糊地带确认',
    confirmation_required: 'on_ambiguity',
    trust_range: [0.6, 0.8] as [number, number]
  },
  autonomous: {
    description: 'agent 完全自主决策，只在边界情况警示',
    confirmation_required: 'never',
    trust_range: [0.8, 1.0] as [number, number]
  }
} as const;
