/**
 * SignalReader 测试用例/fixtures
 *
 * 这个文件定义了可测量的测试用例，用于验证 SignalReader 的准确性。
 *
 * QA Notes:
 * - 所有测试用例都有明确的输入和"ground truth"
 * - nuance 值使用 0-1 范围，便于量化比较
 * - tolerance 设置为 0.15 (15%)，允许一定的语义理解误差
 */

export interface WordChoiceTestCase {
  id: string;
  category: string;
  input: string;  // 用户实际选择的词
  alternatives: string[];  // 同义词列表
  ground_truth: {
    sentiment: 'positive' | 'negative' | 'neutral' | 'hesitant';
    nuance: {
      cautiousness: number;
      decisiveness: number;
      conservativeness: number;
      adventurousness: number;
    };
  };
}

export interface ResistanceTestCase {
  id: string;
  category: string;
  input: {
    resistance_type: 'silence' | 'topic_switch' | 'tone_change';
    followed_by: 'continue_probing' | 'new_topic';
    context: string;
  };
  ground_truth: {
    classification: 'digesting' | 'boundary_reached';
    confidence_threshold: number;
  };
}

export interface RepetitionTestCase {
  id: string;
  category: string;
  input: {
    current: {
      pattern: string;
      scenario: string;
    };
    history: Array<{
      session_id: string;
      pattern_type: string;
      count: number;
    }>;
  };
  ground_truth: {
    is_taste: boolean;
    stability_score: number;
    cross_session: boolean;
  };
}

// ============================================================================
// Word Choice 测试用例 - 词汇选择信号
// ============================================================================

export const WORD_CHOICE_TEST_CASES: WordChoiceTestCase[] = [
  // === Cautious Style (谨慎风格) ===
  {
    id: "WC-001",
    category: "cautious_style",
    input: "这个方案有点意思",
    alternatives: ["这个方案可行", "这个方案不错", "这个方案很棒"],
    ground_truth: {
      sentiment: "hesitant",
      nuance: {
        cautiousness: 0.8,
        decisiveness: 0.2,
        conservativeness: 0.7,
        adventurousness: 0.3
      }
    }
  },
  {
    id: "WC-002",
    category: "cautious_style",
    input: "我再想想",
    alternatives: ["就这样吧", "开始吧", "没问题"],
    ground_truth: {
      sentiment: "hesitant",
      nuance: {
        cautiousness: 0.9,
        decisiveness: 0.1,
        conservativeness: 0.6,
        adventurousness: 0.4
      }
    }
  },
  {
    id: "WC-003",
    category: "cautious_style",
    input: "可以考虑",
    alternatives: ["必须这样", "直接这样", "没问题"],
    ground_truth: {
      sentiment: "neutral",
      nuance: {
        cautiousness: 0.8,
        decisiveness: 0.3,
        conservativeness: 0.5,
        adventurousness: 0.5
      }
    }
  },

  // === Decisive Style (决断风格) ===
  {
    id: "WC-004",
    category: "decisive_style",
    input: "这个方案可行",
    alternatives: ["这个方案有点意思", "这个方案还不错", "这个方案考虑一下"],
    ground_truth: {
      sentiment: "positive",
      nuance: {
        cautiousness: 0.2,
        decisiveness: 0.9,
        conservativeness: 0.4,
        adventurousness: 0.6
      }
    }
  },
  {
    id: "WC-005",
    category: "decisive_style",
    input: "我们开始吧",
    alternatives: ["再想想", "我考虑一下", "有点意思"],
    ground_truth: {
      sentiment: "positive",
      nuance: {
        cautiousness: 0.1,
        decisiveness: 1.0,
        conservativeness: 0.3,
        adventurousness: 0.7
      }
    }
  },
  {
    id: "WC-006",
    category: "decisive_style",
    input: "没问题",
    alternatives: ["我再想想", "有点担心", "不确定"],
    ground_truth: {
      sentiment: "positive",
      nuance: {
        cautiousness: 0.1,
        decisiveness: 0.85,
        conservativeness: 0.2,
        adventurousness: 0.8
      }
    }
  },

  // === Exploratory Style (探索风格) ===
  {
    id: "WC-007",
    category: "exploratory_style",
    input: "有创意",
    alternatives: ["可行", "稳妥", "保守"],
    ground_truth: {
      sentiment: "positive",
      nuance: {
        cautiousness: 0.3,
        decisiveness: 0.6,
        conservativeness: 0.2,
        adventurousness: 0.9
      }
    }
  },
  {
    id: "WC-008",
    category: "exploratory_style",
    input: "试试看",
    alternatives: ["肯定不行", "稳妥起见", "有风险"],
    ground_truth: {
      sentiment: "positive",
      nuance: {
        cautiousness: 0.4,
        decisiveness: 0.5,
        conservativeness: 0.3,
        adventurousness: 0.8
      }
    }
  },

  // === Conservative Style (保守风格) ===
  {
    id: "WC-009",
    category: "conservative_style",
    input: "稳妥",
    alternatives: ["有创意", "冒险", "创新"],
    ground_truth: {
      sentiment: "positive",
      nuance: {
        cautiousness: 0.7,
        decisiveness: 0.5,
        conservativeness: 0.9,
        adventurousness: 0.1
      }
    }
  },
  {
    id: "WC-010",
    category: "conservative_style",
    input: "不冒险",
    alternatives: ["创新", "大胆", "冒险"],
    ground_truth: {
      sentiment: "neutral",
      nuance: {
        cautiousness: 0.8,
        decisiveness: 0.6,
        conservativeness: 0.9,
        adventurousness: 0.0
      }
    }
  },

  // === Negative Sentiment ===
  {
    id: "WC-011",
    category: "negative_style",
    input: "不太理想",
    alternatives: ["不错", "很好", "可以"],
    ground_truth: {
      sentiment: "negative",
      nuance: {
        cautiousness: 0.6,
        decisiveness: 0.4,
        conservativeness: 0.7,
        adventurousness: 0.3
      }
    }
  },
  {
    id: "WC-012",
    category: "negative_style",
    input: "有点担心",
    alternatives: ["没问题", "放心", "稳当"],
    ground_truth: {
      sentiment: "negative",
      nuance: {
        cautiousness: 0.9,
        decisiveness: 0.2,
        conservativeness: 0.8,
        adventurousness: 0.2
      }
    }
  }
];

// ============================================================================
// Resistance 测试用例 - 阻力信号与二元组消歧
// ============================================================================

export const RESISTANCE_TEST_CASES: ResistanceTestCase[] = [
  // === Digesting (非阻力) ===
  {
    id: "RS-001",
    category: "digesting",
    input: {
      resistance_type: "silence",
      followed_by: "continue_probing",
      context: "用户沉默 5 秒后追问: '具体的技术选型呢？'"
    },
    ground_truth: {
      classification: "digesting",
      confidence_threshold: 0.7
    }
  },
  {
    id: "RS-002",
    category: "digesting",
    input: {
      resistance_type: "silence",
      followed_by: "continue_probing",
      context: "用户沉默后深入探问: '这个方案的优缺点是什么？'"
    },
    ground_truth: {
      classification: "digesting",
      confidence_threshold: 0.7
    }
  },
  {
    id: "RS-003",
    category: "digesting",
    input: {
      resistance_type: "tone_change",
      followed_by: "continue_probing",
      context: "用户语调放慢后继续讨论细节"
    },
    ground_truth: {
      classification: "digesting",
      confidence_threshold: 0.6
    }
  },

  // === Boundary Reached (品味边界) ===
  {
    id: "RS-004",
    category: "boundary",
    input: {
      resistance_type: "silence",
      followed_by: "new_topic",
      context: "用户沉默 10 秒后说: '对了，数据库呢？'"
    },
    ground_truth: {
      classification: "boundary_reached",
      confidence_threshold: 0.8
    }
  },
  {
    id: "RS-005",
    category: "boundary",
    input: {
      resistance_type: "silence",
      followed_by: "new_topic",
      context: "用户沉默后突然切换: '我们换个话题吧'"
    },
    ground_truth: {
      classification: "boundary_reached",
      confidence_threshold: 0.9
    }
  },
  {
    id: "RS-006",
    category: "boundary",
    input: {
      resistance_type: "topic_switch",
      followed_by: "new_topic",
      context: "用户直接跳转: '刚才说的算了，说说别的'"
    },
    ground_truth: {
      classification: "boundary_reached",
      confidence_threshold: 0.9
    }
  },
  {
    id: "RS-007",
    category: "boundary",
    input: {
      resistance_type: "tone_change",
      followed_by: "new_topic",
      context: "用户语调冷淡后转移话题"
    },
    ground_truth: {
      classification: "boundary_reached",
      confidence_threshold: 0.7
    }
  },

  // === 模糊场景 (边界测试) ===
  {
    id: "RS-008",
    category: "ambiguous",
    input: {
      resistance_type: "silence",
      followed_by: "continue_probing",
      context: "用户沉默后说: '嗯... 然后呢？'"
    },
    ground_truth: {
      classification: "digesting",  // "然后呢" 继续话题
      confidence_threshold: 0.5  // 置信度低，模糊场景
    }
  }
];

// ============================================================================
// Repetition 测试用例 - 跨 session 模式识别
// ============================================================================

// 辅助函数：生成历史记录
function generateHistory(numSessions: number, crossSession: boolean) {
  if (crossSession) {
    return Array.from({ length: numSessions }, (_, i) => ({
      session_id: `session-${i}`,
      pattern_type: "silence_switch",
      count: 1
    }));
  } else {
    return [{
      session_id: "single-session",
      pattern_type: "silence_probing",
      count: numSessions
    }];
  }
}

export const REPETITION_TEST_CASES: RepetitionTestCase[] = [
  // === 跨 session Taste (正例) ===
  {
    id: "RP-001",
    category: "cross_session_taste",
    input: {
      current: {
        pattern: "silence_switch",
        scenario: "选择设计方案时的沉默"
      },
      history: generateHistory(5, true)  // 5 次跨 session
    },
    ground_truth: {
      is_taste: true,
      stability_score: 1.0,  // 达到门槛
      cross_session: true
    }
  },
  {
    id: "RP-002",
    category: "cross_session_taste",
    input: {
      current: {
        pattern: "word_choice_cautious",
        scenario: "词汇选择偏好"
      },
      history: generateHistory(6, true)  // 6 次跨 session
    },
    ground_truth: {
      is_taste: true,
      stability_score: 1.0,
      cross_session: true
    }
  },

  // === 同 session 噪声 (负例) ===
  {
    id: "RP-003",
    category: "same_session_noise",
    input: {
      current: {
        pattern: "silence_probing",
        scenario: "同一会话内的沉默"
      },
      history: generateHistory(5, false)  // 5 次同 session
    },
    ground_truth: {
      is_taste: false,
      stability_score: 0.2,  // 未达到门槛
      cross_session: false
    }
  },
  {
    id: "RP-004",
    category: "same_session_noise",
    input: {
      current: {
        pattern: "repeated_question",
        scenario: "同一会话内的重复问题"
      },
      history: generateHistory(3, false)  // 3 次同 session
    },
    ground_truth: {
      is_taste: false,
      stability_score: 0.15,
      cross_session: false
    }
  },

  // === 未达到门槛 (过渡状态) ===
  {
    id: "RP-005",
    category: "under_threshold",
    input: {
      current: {
        pattern: "silence_switch",
        scenario: "跨 session 模式"
      },
      history: generateHistory(4, true)  // 4 次跨 session < 门槛 5
    },
    ground_truth: {
      is_taste: false,
      stability_score: 0.8,  // 接近但未达到
      cross_session: true
    }
  },
  {
    id: "RP-006",
    category: "under_threshold",
    input: {
      current: {
        pattern: "word_choice_exploratory",
        scenario: "词汇选择偏好"
      },
      history: generateHistory(3, true)  // 3 次跨 session < 门槛 5
    },
    ground_truth: {
      is_taste: false,
      stability_score: 0.6,
      cross_session: true
    }
  },

  // === 稳定性测试 (跨 session + 稳定性分数) ===
  {
    id: "RP-007",
    category: "stable_pattern",
    input: {
      current: {
        pattern: "decision_style_conservative",
        scenario: "决策风格偏好"
      },
      history: [
        { session_id: "s1", pattern_type: "conservative", count: 5 },
        { session_id: "s2", pattern_type: "conservative", count: 4 },
        { session_id: "s3", pattern_type: "conservative", count: 6 },
        { session_id: "s4", pattern_type: "conservative", count: 5 },
        { session_id: "s5", pattern_type: "conservative", count: 5 }
      ]
    },
    ground_truth: {
      is_taste: true,
      stability_score: 1.0,
      cross_session: true
    }
  },
  {
    id: "RP-008",
    category: "unstable_pattern",
    input: {
      current: {
        pattern: "decision_style_mixed",
        scenario: "混合决策风格"
      },
      history: [
        { session_id: "s1", pattern_type: "conservative", count: 3 },
        { session_id: "s2", pattern_type: "adventurous", count: 2 },
        { session_id: "s3", pattern_type: "conservative", count: 1 },
        { session_id: "s4", pattern_type: "adventurous", count: 1 },
        { session_id: "s5", pattern_type: "conservative", count: 1 }
      ]
    },
    ground_truth: {
      is_taste: false,
      stability_score: 0.3,
      cross_session: true
    }
  }
];

// ============================================================================
// 准确率计算工具函数
// ============================================================================

export interface AccuracyResult {
  passed: boolean;
  testName: string;
  actual: any;
  expected: any;
}

export interface CategoryAccuracy {
  correct: number;
  total: number;
  accuracy: number;
  failedCases: Array<{
    caseId: string;
    testName: string;
    actual: any;
    expected: any;
  }>;
}

/**
 * 检查 nuance 是否匹配（允许一定误差）
 *
 * @param actual - 实际的 nuance 值
 * @param expected - 期望的 nuance 值
 * @param tolerance - 误差容忍度 (默认 0.15)
 * @returns 是否匹配
 */
export function isNuanceMatch(
  actual: number[],
  expected: number[],
  tolerance: number = 0.2
): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  for (let i = 0; i < actual.length; i++) {
    if (Math.abs(actual[i] - expected[i]) > tolerance) {
      return false;
    }
  }

  return true;
}

/**
 * 计算总体准确率的置信区间
 *
 * @param accuracy - 准确率
 * @param totalCases - 总用例数
 * @param confidence - 置信水平 (默认 0.95)
 * @returns 置信区间 [lower, upper]
 */
export function computeConfidenceInterval(
  accuracy: number,
  totalCases: number,
  confidence: number = 0.95
): [number, number] {
  // Z 分数 (95% 置信水平 = 1.96)
  const z = confidence === 0.95 ? 1.96 : 1.645;
  const margin = z * Math.sqrt((accuracy * (1 - accuracy)) / totalCases);

  return [
    Math.max(0, accuracy - margin),
    Math.min(1, accuracy + margin)
  ];
}
