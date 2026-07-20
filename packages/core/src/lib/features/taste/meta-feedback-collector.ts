/**
 * Meta Feedback 数据收集器 (MVP 阶段)
 *
 * QA Notes:
 * - 虽然完整的 Meta Feedback 处理 (T.10) 被延后，
 *   但我们需要收集数据以验证 T.1-T.6 的有效性。
 * - 这个收集器会记录用户的元反馈（口头或书面），
 *   以便后续分析品味理解是否准确。
 */

// ============================================================================
// 类型定义
// ============================================================================

export interface UserInteraction {
  id: string;
  content: string;
  timestamp: number;
  userId: string;
  sessionId: string;
}

export interface MetaFeedback {
  type: 'understanding_correction' | 'understanding_affirmation' | 'style_update';

  // 纠正：agent 的品味理解错误
  understanding_correction?: {
    agent_claim: string;      // agent 声称的品味
    correction: string;       // 纠正内容
    evidence_examples: string[];  // 证据示例
  };

  // 肯定：agent 的品味理解提升
  understanding_affirmation?: {
    improvement_area: string;  // 改进领域
    comparison: 'better_than_before' | 'much_better' | 'excellent';
  };

  // 风格更新：显式风格的改变
  style_update?: {
    previous_style: string;
    new_style: string;
    reason: string;
  };
}

export interface MetaFeedbackEntry extends MetaFeedback {
  timestamp: number;
  stage: 'MVP' | 'FULL';
  interaction_id?: string;  // 关联的交互 ID
}

export interface MetaFeedbackStats {
  total_feedback: number;
  corrections: number;
  affirmations: number;
  style_updates: number;
  affirmation_rate: number;  // 肯定占所有反馈的比例
}

// ============================================================================
// Meta 模式
// ============================================================================

const META_PATTERNS = {
  correction: [
    /你觉得我喜欢/i,
    /你以为我/i,
    /你理解错了/i,
    /你不是这样理解的/i,
    /不是这样理解的/i,
    /我的风格不是/i,
    /不对/,
  ],
  affirmation: [
    /你理解得对/i,
    /你最近.*理解/i,
    /.*理解不错/,
    /.*理解得好/,
    /.*理解.*优秀/,
    /越来越了解/,
    /理解准确/
  ],
  style_update: [
    /我的风格是/i,
    /我现在更喜欢/i,
    /我变了/i,
    /我现在倾向于/i,
    /我的品味是/i
  ]
};

// ============================================================================
// MetaFeedbackCollector 实现
// ============================================================================

export class MetaFeedbackCollector {
  private feedbackLog: MetaFeedbackEntry[] = [];
  private interactionHistory: Map<string, UserInteraction> = new Map();

  /**
   * 尝试识别交互中的元反馈
   *
   * @param interaction - 用户交互
   * @returns 检测到的元反馈，如果未检测到则返回 null
   */
  detectMetaFeedback(interaction: UserInteraction): MetaFeedback | null {
    // 处理非字符串内容
    if (typeof interaction.content !== 'string' || interaction.content === null) {
      return null;
    }

    const content = interaction.content.trim();

    // 处理空字符串
    if (content.length === 0) {
      return null;
    }

    const lowerContent = content.toLowerCase();

    // 检查纠正模式
    for (const pattern of META_PATTERNS.correction) {
      if (pattern.test(lowerContent)) {
        return this.parseCorrection(content);
      }
    }

    // 检查肯定模式
    for (const pattern of META_PATTERNS.affirmation) {
      if (pattern.test(lowerContent)) {
        return this.parseAffirmation(content);
      }
    }

    // 检查风格更新模式
    for (const pattern of META_PATTERNS.style_update) {
      if (pattern.test(lowerContent)) {
        return this.parseStyleUpdate(content);
      }
    }

    return null;
  }

  /**
   * 记录元反馈
   *
   * @param feedback - 元反馈内容
   * @param interactionId - 关联的交互 ID（可选）
   */
  logFeedback(feedback: MetaFeedback, interactionId?: string): void {
    const entry: MetaFeedbackEntry = {
      ...feedback,
      timestamp: Date.now(),
      stage: "MVP",
      interaction_id: interactionId
    };

    this.feedbackLog.push(entry);

    console.log('[MetaFeedbackCollector] Feedback logged:', {
      type: entry.type,
      stage: entry.stage,
      timestamp: new Date(entry.timestamp).toLocaleString('zh-CN')
    });
  }

  /**
   * 处理用户交互，自动检测和记录元反馈
   *
   * @param interaction - 用户交互
   * @returns 是否检测到元反馈
   */
  processInteraction(interaction: UserInteraction): boolean {
    // 记录交互历史
    this.interactionHistory.set(interaction.id, interaction);

    // 检测元反馈
    const feedback = this.detectMetaFeedback(interaction);

    if (feedback) {
      this.logFeedback(feedback, interaction.id);
      return true;
    }

    return false;
  }

  /**
   * 导出反馈日志
   *
   * @returns 反馈日志的副本
   */
  exportFeedbackLog(): MetaFeedbackEntry[] {
    return [...this.feedbackLog];
  }

  /**
   * 获取反馈统计
   */
  getStats(): MetaFeedbackStats {
    const total = this.feedbackLog.length;
    const corrections = this.feedbackLog.filter(f => f.type === 'understanding_correction').length;
    const affirmations = this.feedbackLog.filter(f => f.type === 'understanding_affirmation').length;
    const style_updates = this.feedbackLog.filter(f => f.type === 'style_update').length;

    return {
      total_feedback: total,
      corrections,
      affirmations,
      style_updates,
      affirmation_rate: total > 0 ? affirmations / total : 0
    };
  }

  /**
   * 清空日志
   */
  clearLog(): void {
    this.feedbackLog = [];
    this.interactionHistory.clear();
  }

  /**
   * 导出为 JSON（用于分析）
   */
  exportAsJSON(): string {
    return JSON.stringify({
      metadata: {
        exported_at: new Date().toISOString(),
        total_feedback: this.feedbackLog.length
      },
      feedback: this.feedbackLog,
      stats: this.getStats()
    }, null, 2);
  }

  // ============================================================================
  // 私有解析方法
  // ============================================================================

  private parseCorrection(content: string): MetaFeedback {
    // 简单的启发式解析
    // 注意: 在完整实现中，这应该使用更复杂的 NLP 或 LLM 解析

    const agentClaim = this.extractAfter(content, /你觉得|你以为/) ||
                       this.extractAfter(content, /你理解/) ||
                       "未识别";

    const correction = this.extractAfter(content, /其实|其实是|其实我/) ||
                       this.extractAfter(content, /不对/) ||
                       "未识别";

    return {
      type: 'understanding_correction',
      understanding_correction: {
        agent_claim: agentClaim,
        correction: correction,
        evidence_examples: []
      }
    };
  }

  private parseAffirmation(content: string): MetaFeedback {
    // 匹配 "你最近X理解有提升"
    const improvementMatch = content.match(/你最近(.*)理解有提升/);
    const improvementArea = improvementMatch?.[1]?.trim() || "整体";

    // 匹配肯定程度
    if (content.includes("很好") || content.includes("优秀") || content.includes("excellent")) {
      return {
        type: 'understanding_affirmation',
        understanding_affirmation: {
          improvement_area: improvementArea,
          comparison: 'excellent'
        }
      };
    } else if (content.includes("大大") || content.includes("much")) {
      return {
        type: 'understanding_affirmation',
        understanding_affirmation: {
          improvement_area: improvementArea,
          comparison: 'much_better'
        }
      };
    } else {
      return {
        type: 'understanding_affirmation',
        understanding_affirmation: {
          improvement_area: improvementArea,
          comparison: 'better_than_before'
        }
      };
    }
  }

  private parseStyleUpdate(content: string): MetaFeedback {
    const previousStyle = "未识别";
    const newStyle = this.extractAfter(content, /我的风格是|我现在更喜欢|我现在倾向于/) ||
                    "未识别";
    const reason = this.extractAfter(content, /因为|理由/) || "未指定";

    return {
      type: 'style_update',
      style_update: {
        previous_style: previousStyle,
        new_style: newStyle,
        reason
      }
    };
  }

  private extractAfter(content: string, pattern: RegExp): string {
    const match = content.match(pattern);
    if (match) {
      const afterMatch = content.substring(match.index! + match[0].length).trim();
      // 去掉标点
      return afterMatch.replace(/[，。！？,.!?]/g, '');
    }
    return '';
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 创建一个用户交互对象
 */
export function createUserInteraction(params: {
  content: string;
  userId: string;
  sessionId: string;
}): UserInteraction {
  return {
    id: `interaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    content: params.content,
    timestamp: Date.now(),
    userId: params.userId,
    sessionId: params.sessionId
  };
}

/**
 * 模拟元反馈生成（用于测试）
 */
export function generateMockMetaFeedback(type: MetaFeedback['type']): MetaFeedback {
  switch (type) {
    case 'understanding_correction':
      return {
        type: 'understanding_correction',
        understanding_correction: {
          agent_claim: '你觉得我喜欢冒险的方案',
          correction: '其实我更喜欢稳妥的方案',
          evidence_examples: ['上次我选择了保守方案', '之前的风险方案都被拒绝了']
        }
      };
    case 'understanding_affirmation':
      return {
        type: 'understanding_affirmation',
        understanding_affirmation: {
          improvement_area: '决策风格',
          comparison: 'better_than_before'
        }
      };
    case 'style_update':
      return {
        type: 'style_update',
        style_update: {
          previous_style: '保守',
          new_style: '平衡',
          reason: '最近项目需要更多探索'
        }
      };
  }
}

/**
 * 分析元反馈数据（用于生成报告）
 */
export interface MetaFeedbackAnalysis {
  stats: MetaFeedbackStats;
  accuracy_estimate: number;  // 基于肯定率的准确性估计
  suggested_improvements: string[];
  concerns: string[];
}

export function analyzeFeedback(feedbackLog: MetaFeedbackEntry[]): MetaFeedbackAnalysis {
  const stats = {
    total_feedback: feedbackLog.length,
    corrections: feedbackLog.filter(f => f.type === 'understanding_correction').length,
    affirmations: feedbackLog.filter(f => f.type === 'understanding_affirmation').length,
    style_updates: feedbackLog.filter(f => f.type === 'style_update').length,
    affirmation_rate: 0
  };

  const affirmation_rate = stats.total_feedback > 0
    ? stats.affirmations / stats.total_feedback
    : 0;

  stats.affirmation_rate = affirmation_rate;

  // 分析准确性估计（基于肯定率）
  // 注意: 这是一个粗略估计，实际的准确性需要更复杂的分析
  const accuracy_estimate = affirmation_rate;

  // 生成改进建议
  const suggested_improvements: string[] = [];
  const concerns: string[] = [];

  // 只有在有反馈数据时才添加相关建议
  if (stats.total_feedback === 0) {
    // 空日志时返回空的建议和担忧
    return {
      stats,
      accuracy_estimate: 0,
      suggested_improvements: [],
      concerns: []
    };
  }

  if (stats.corrections > stats.affirmations) {
    concerns.push('纠正反馈多于肯定反馈，可能需要改进 SignalReader 的准确性');
  }

  if (accuracy_estimate < 0.5) {
    concerns.push('准确性估计低于 50%，建议审查基准测试用例');
  }

  if (affirmation_rate >= 0.7) {
    suggested_improvements.push('理解准确性良好，可以考虑减少人工干预');
  }

  if (stats.style_updates > 5) {
    suggested_improvements.push('用户风格更新较多，建议关注 SOUL 演化机制');
  }

  return {
    stats,
    accuracy_estimate,
    suggested_improvements,
    concerns
  };
}
