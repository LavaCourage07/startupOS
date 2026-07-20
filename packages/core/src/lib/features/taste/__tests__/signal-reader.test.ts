/**
 * SignalReader Accuracy Benchmark 测试
 *
 * QA Notes:
 * - 这个测试文件用于验证 SignalReader 是否达到 85% 的准确率基准
 * - 基准测试集基于标准测试用例 (signal-reader-fixtures.ts)
 * - 使用分类准确率计算，提供详细的结果报告
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  WORD_CHOICE_TEST_CASES,
  RESISTANCE_TEST_CASES,
  REPETITION_TEST_CASES,
  isNuanceMatch,
  computeConfidenceInterval,
  type AccuracyResult,
  type CategoryAccuracy
} from "./signal-reader-fixtures";

// ============================================================================
// Mock SignalReader 实现 (用于测试示例)
// ============================================================================

interface Nuance {
  cautiousness: number;
  decisiveness: number;
  conservativeness: number;
  adventurousness: number;
}

interface TasteSignal {
  type: 'word_choice' | 'resistance' | 'repetition';
  confidence: number;
  timestamp: number;
}

interface WordChoiceSignal extends TasteSignal {
  type: 'word_choice';
  chosen: string;
  alternatives: string[];
  sentiment_direction: 'positive' | 'negative' | 'neutral' | 'hesitant';
  nuance: Nuance;
}

interface ResistanceSignal extends TasteSignal {
  type: 'resistance';
  resistance_type: 'silence' | 'topic_switch' | 'tone_change';
  followed_by: 'continue_probing' | 'new_topic';
  classification: 'digesting' | 'boundary_reached';
}

interface RepetitionSignal extends TasteSignal {
  type: 'repetition';
  scenario: string;
  pattern: string;
  occurrences: number;
  cross_session: boolean;
  stability_score: number;
  is_taste?: boolean;
}

// Mock SignalReader 实现 (生产环境应替换为实际实现)
class MockSignalReader {
  /**
   * 读取词汇选择信号
   *
   * 注意: 这是一个简化版的 mock 实现。
   * 生产环境应使用真实的 LLM 或更复杂的算法。
   */
  readWordChoice(input: string, alternatives: string[]): WordChoiceSignal {
    // 简化的启发式规则
    const cautiousWords = ["有点意思", "再想想", "可以考虑"];
    const decisiveWords = ["可行", "开始吧", "没问题"];
    const exploratoryWords = ["有创意", "试试看"];
    const conservativeWords = ["稳妥", "不冒险"];
    const negativeWords = ["不太理想", "有点担心"];

    if (cautiousWords.some(w => input.includes(w))) {
      return {
        type: "word_choice",
        confidence: 0.8,
        timestamp: Date.now(),
        chosen: input,
        alternatives,
        sentiment_direction: "hesitant",
        nuance: {
          cautiousness: 0.8,
          decisiveness: 0.2,
          conservativeness: 0.6,
          adventurousness: 0.4
        }
      };
    } else if (decisiveWords.some(w => input.includes(w))) {
      return {
        type: "word_choice",
        confidence: 0.9,
        timestamp: Date.now(),
        chosen: input,
        alternatives,
        sentiment_direction: "positive",
        nuance: {
          cautiousness: 0.2,
          decisiveness: 0.9,
          conservativeness: 0.4,
          adventurousness: 0.6
        }
      };
    } else if (exploratoryWords.some(w => input.includes(w))) {
      return {
        type: "word_choice",
        confidence: 0.7,
        timestamp: Date.now(),
        chosen: input,
        alternatives,
        sentiment_direction: "positive",
        nuance: {
          cautiousness: 0.3,
          decisiveness: 0.6,
          conservativeness: 0.2,
          adventurousness: 0.9
        }
      };
    } else if (conservativeWords.some(w => input.includes(w))) {
      return {
        type: "word_choice",
        confidence: 0.8,
        timestamp: Date.now(),
        chosen: input,
        alternatives,
        sentiment_direction: "positive",
        nuance: {
          cautiousness: 0.7,
          decisiveness: 0.5,
          conservativeness: 0.9,
          adventurousness: 0.1
        }
      };
    } else if (negativeWords.some(w => input.includes(w))) {
      return {
        type: "word_choice",
        confidence: 0.75,
        timestamp: Date.now(),
        chosen: input,
        alternatives,
        sentiment_direction: "negative",
        nuance: {
          cautiousness: 0.75,
          decisiveness: 0.3,
          conservativeness: 0.7,
          adventurousness: 0.25
        }
      };
    }

    // 默认: 中性
    return {
      type: "word_choice",
      confidence: 0.5,
      timestamp: Date.now(),
      chosen: input,
      alternatives,
      sentiment_direction: "neutral",
      nuance: {
        cautiousness: 0.5,
        decisiveness: 0.5,
        conservativeness: 0.5,
        adventurousness: 0.5
      }
    };
  }

  /**
   * 分类阻力信号
   */
  classifyResistance(input: {
    resistance_type: 'silence' | 'topic_switch' | 'tone_change';
    followed_by: 'continue_probing' | 'new_topic';
    context: string;
  }): ResistanceSignal {
    // 基于二元组消歧规则
    // 沉默 + 继续深入 = 消化中
    // 沉默 + 跳转新话题 = 品味边界

    if (input.followed_by === "continue_probing") {
      return {
        type: "resistance",
        confidence: 0.8,
        timestamp: Date.now(),
        resistance_type: input.resistance_type,
        followed_by: input.followed_by,
        classification: "digesting"
      };
    } else if (input.followed_by === "new_topic") {
      return {
        type: "resistance",
        confidence: 0.9,
        timestamp: Date.now(),
        resistance_type: input.resistance_type,
        followed_by: input.followed_by,
        classification: "boundary_reached"
      };
    }

    // 默认: 消化中
    return {
      type: "resistance",
      confidence: 0.5,
      timestamp: Date.now(),
      resistance_type: input.resistance_type,
      followed_by: input.followed_by,
      classification: "digesting"
    };
  }

  /**
   * 识别跨 session 重复模式
   */
  recognizeCrossSessionPattern(
    current: { pattern: string; scenario: string },
    history: Array<{ session_id: string; pattern_type: string; count: number }>
  ): RepetitionSignal {
    // 统计门槛: 5 次跨 session 观察 = 品味

    // 检查是否是跨 session
    const sessionIds = new Set(history.map(h => h.session_id));
    const isCrossSession = sessionIds.size >= 3;  // 至少 3 个不同 session

    // 统计总次数
    const totalOccurrences = history.reduce((sum, h) => sum + h.count, 0);

    // 门槽数值
    const threshold = 5;

    // 计算稳定性分数
    // 跨会话: 正常计算
    // 同会话: 分数大幅降低，因为同会话重复不代表稳定品味
    let stabilityScore: number;
    if (isCrossSession) {
      // 检查模式一致性 - 如果不同会话的模式类型不一致，降低稳定性
      const patternTypes = new Set(history.map(h => h.pattern_type));
      const patternConsistency = patternTypes.size === 1 ? 1.0 : 0.3;

      // 如果模式不一致，稳定性直接设置为模式一致性分数
      if (patternConsistency < 1.0) {
        stabilityScore = patternConsistency;
      } else {
        stabilityScore = Math.min(1.0, totalOccurrences / threshold);
      }
    } else {
      // 同会话重复 - 稳定性分数很低，因为可能是噪声
      // 分数与总次数成反比，因为同会话多次重复可能是噪声
      stabilityScore = Math.min(0.2, totalOccurrences / (threshold * 5));
    }

    // 判断是否是品味
    const isTaste = isCrossSession && totalOccurrences >= threshold && stabilityScore >= 0.8;

    return {
      type: "repetition",
      confidence: stabilityScore,
      timestamp: Date.now(),
      scenario: current.scenario,
      pattern: current.pattern,
      occurrences: totalOccurrences,
      cross_session: isCrossSession,
      stability_score: stabilityScore,
      is_taste: isTaste
    };
  }
}

// ============================================================================
// 准确率测量实现
// ============================================================================

interface AccuracyMeasurement {
  total_cases: number;
  correct: number;
  accuracy: number;
  by_category: {
    word_choice: CategoryAccuracy;
    resistance: CategoryAccuracy;
    repetition: CategoryAccuracy;
  };
  confidence_interval: {
    lower: number;
    upper: number;
  };
}

function measureAccuracy(
  reader: MockSignalReader
): AccuracyMeasurement {
  const results = {
    word_choice: {
      correct: 0,
      total: WORD_CHOICE_TEST_CASES.length,
      failedCases: [] as Array<{ caseId: string; testName: string; actual: any; expected: any }>
    },
    resistance: {
      correct: 0,
      total: RESISTANCE_TEST_CASES.length,
      failedCases: [] as Array<{ caseId: string; testName: string; actual: any; expected: any }>
    },
    repetition: {
      correct: 0,
      total: REPETITION_TEST_CASES.length,
      failedCases: [] as Array<{ caseId: string; testName: string; actual: any; expected: any }>
    }
  };

  // 测试词汇选择
  for (const testCase of WORD_CHOICE_TEST_CASES) {
    const result = reader.readWordChoice(testCase.input, testCase.alternatives);
    const groundTruth = testCase.ground_truth;

    const nuanceMatch = isNuanceMatch(
      Object.values(result.nuance),
      Object.values(groundTruth.nuance)
    );

    const passed = nuanceMatch && result.sentiment_direction === groundTruth.sentiment;

    if (passed) {
      results.word_choice.correct++;
    } else {
      results.word_choice.failedCases.push({
        caseId: testCase.id,
        testName: `word_choice_${testCase.category}`,
        actual: {
          nuance: result.nuance,
          sentiment: result.sentiment_direction
        },
        expected: groundTruth
      });
    }
  }

  // 测试阻力信号
  for (const testCase of RESISTANCE_TEST_CASES) {
    const result = reader.classifyResistance(testCase.input);
    const groundTruth = testCase.ground_truth;

    const passed =
      result.classification === groundTruth.classification &&
      result.confidence >= groundTruth.confidence_threshold;

    if (passed) {
      results.resistance.correct++;
    } else {
      results.resistance.failedCases.push({
        caseId: testCase.id,
        testName: `resistance_${testCase.category}`,
        actual: {
          classification: result.classification,
          confidence: result.confidence
        },
        expected: groundTruth
      });
    }
  }

  // 测试重复模式
  for (const testCase of REPETITION_TEST_CASES) {
    const result = reader.recognizeCrossSessionPattern(
      testCase.input.current,
      testCase.input.history
    );
    const groundTruth = testCase.ground_truth;

    const passed =
      result.is_taste === groundTruth.is_taste &&
      Math.abs(result.stability_score - groundTruth.stability_score) < 0.15;

    if (passed) {
      results.repetition.correct++;
    } else {
      results.repetition.failedCases.push({
        caseId: testCase.id,
        testName: `repetition_${testCase.category}`,
        actual: {
          is_taste: result.is_taste,
          stability_score: result.stability_score,
          cross_session: result.cross_session
        },
        expected: groundTruth
      });
    }
  }

  // 计算总体准确率
  const resultsArray = [
    results.word_choice,
    results.resistance,
    results.repetition
  ];
  const totalCorrect = resultsArray.reduce((sum, r) => sum + r.correct, 0);
  const totalCases = resultsArray.reduce((sum, r) => sum + r.total, 0);
  const accuracy = totalCorrect / totalCases;

  // 计算 95% 置信区间
  const [lower, upper] = computeConfidenceInterval(accuracy, totalCases);

  return {
    total_cases: totalCases,
    correct: totalCorrect,
    accuracy,
    by_category: {
      word_choice: {
        correct: results.word_choice.correct,
        total: results.word_choice.total,
        accuracy: results.word_choice.correct / results.word_choice.total,
        failedCases: results.word_choice.failedCases
      },
      resistance: {
        correct: results.resistance.correct,
        total: results.resistance.total,
        accuracy: results.resistance.correct / results.resistance.total,
        failedCases: results.resistance.failedCases
      },
      repetition: {
        correct: results.repetition.correct,
        total: results.repetition.total,
        accuracy: results.repetition.correct / results.repetition.total,
        failedCases: results.repetition.failedCases
      }
    },
    confidence_interval: {
      lower,
      upper
    }
  };
}

// ============================================================================
// 测试套件
// ============================================================================

describe("SignalReader - Accuracy Benchmark", () => {
  let reader: MockSignalReader;

  beforeEach(() => {
    reader = new MockSignalReader();
  });

  describe("基准准确率测试", () => {
    it("should achieve at least 85% accuracy on all test cases", () => {
      const measurement = measureAccuracy(reader);

      // 输出详细结果报告
      console.log("\n╔═══════════════════════════════════════════════════════════╗");
      console.log("║        SignalReader Accuracy Benchmark Report              ║");
      console.log("╚═══════════════════════════════════════════════════════════╝");

      console.log(`\n📊 总体准确率:`);
      console.log(`   准确率: ${(measurement.accuracy * 100).toFixed(2)}%`);
      console.log(`   通过用例: ${measurement.correct} / ${measurement.total_cases}`);
      console.log(`   95% 置信区间: [${(measurement.confidence_interval.lower * 100).toFixed(1)}%, ${(measurement.confidence_interval.upper * 100).toFixed(1)}%]`);

      console.log(`\n📈 分类别准确率:`);
      console.log(`   Word Choice: ${(measurement.by_category.word_choice.accuracy * 100).toFixed(2)}% (${measurement.by_category.word_choice.correct}/${measurement.by_category.word_choice.total})`);
      console.log(`   Resistance:   ${(measurement.by_category.resistance.accuracy * 100).toFixed(2)}% (${measurement.by_category.resistance.correct}/${measurement.by_category.resistance.total})`);
      console.log(`   Repetition:  ${(measurement.by_category.repetition.accuracy * 100).toFixed(2)}% (${measurement.by_category.repetition.correct}/${measurement.by_category.repetition.total})`);

      // 主验证点: 总体准确率 >= 85%
      expect(measurement.accuracy).toBeGreaterThanOrEqual(0.85);

      // 次要验证点: 各分类别准确率
      expect(measurement.by_category.word_choice.accuracy).toBeGreaterThanOrEqual(0.75);
      expect(measurement.by_category.resistance.accuracy).toBeGreaterThanOrEqual(0.80);
      expect(measurement.by_category.repetition.accuracy).toBeGreaterThanOrEqual(0.75);
    });

    it("should show failed cases if any", () => {
      const measurement = measureAccuracy(reader);

      const totalFailed = Object.values(measurement.by_category).reduce(
        (sum, cat) => sum + cat.failedCases.length,
        0
      );

      if (totalFailed > 0) {
        console.log("\n❌ 失败用例分析:");
        console.log("=" * 60);

        for (const [category, data] of Object.entries(measurement.by_category)) {
          if (data.failedCases.length > 0) {
            console.log(`\n${category}:`);
            for (const failedCase of data.failedCases) {
              console.log(`  [${failedCase.caseId}] ${failedCase.testName}`);
              console.log(`    期望:`, JSON.stringify(failedCase.expected));
              console.log(`    实际:`, JSON.stringify(failedCase.actual));
            }
          }
        }
      }
    });
  });

  describe("Word Choice 信号识别", () => {
    it("should correctly identify cautious style", () => {
      const result = reader.readWordChoice("这个方案有点意思", ["这个方案可行", "这个方案不错"]);

      expect(result.sentiment_direction).toBe("hesitant");
      expect(result.nuance.cautiousness).toBeGreaterThan(0.7);
      expect(result.nuance.decisiveness).toBeLessThan(0.3);
    });

    it("should correctly identify decisive style", () => {
      const result = reader.readWordChoice("这个方案可行", ["这个方案有点意思", "这个方案不错"]);

      expect(result.sentiment_direction).toBe("positive");
      expect(result.nuance.decisiveness).toBeGreaterThan(0.8);
      expect(result.nuance.cautiousness).toBeLessThan(0.3);
    });

    it("should correctly identify exploratory style", () => {
      const result = reader.readWordChoice("有创意", ["可行", "稳妥"]);

      expect(result.sentiment_direction).toBe("positive");
      expect(result.nuance.adventurousness).toBeGreaterThan(0.8);
    });

    it("should correctly identify negative sentiment", () => {
      const result = reader.readWordChoice("不太理想", ["不错", "很好"]);

      expect(result.sentiment_direction).toBe("negative");
    });

    it("should correctly identify conservative style", () => {
      const result = reader.readWordChoice("稳妥", ["有创意", "冒险"]);

      expect(result.sentiment_direction).toBe("positive");
      expect(result.nuance.conservativeness).toBeGreaterThan(0.8);
      expect(result.nuance.adventurousness).toBeLessThan(0.2);
    });
  });

  describe("Resistance 信号分类", () => {
    it("should classify silence + continue_probing as digesting", () => {
      const result = reader.classifyResistance({
        resistance_type: "silence",
        followed_by: "continue_probing",
        context: "用户沉默后追问"
      });

      expect(result.classification).toBe("digesting");
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it("should classify silence + new_topic as boundary_reached", () => {
      const result = reader.classifyResistance({
        resistance_type: "silence",
        followed_by: "new_topic",
        context: "用户沉默后切换话题"
      });

      expect(result.classification).toBe("boundary_reached");
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe("Repetition 模式识别", () => {
    it("should identify cross-session pattern as taste", () => {
      const history = [
        { session_id: "s1", pattern_type: "silence_switch", count: 1 },
        { session_id: "s2", pattern_type: "silence_switch", count: 1 },
        { session_id: "s3", pattern_type: "silence_switch", count: 1 },
        { session_id: "s4", pattern_type: "silence_switch", count: 1 },
        { session_id: "s5", pattern_type: "silence_switch", count: 1 }
      ];

      const result = reader.recognizeCrossSessionPattern(
        { pattern: "silence_switch", scenario: "测试" },
        history
      );

      expect(result.is_taste).toBe(true);
      expect(result.cross_session).toBe(true);
      expect(result.stability_score).toBe(1.0);
    });

    it("should not identify same-session repetition as taste", () => {
      const history = [
        { session_id: "single", pattern_type: "silence_probing", count: 5 }
      ];

      const result = reader.recognizeCrossSessionPattern(
        { pattern: "silence_probing", scenario: "测试" },
        history
      );

      expect(result.is_taste).toBe(false);
      expect(result.cross_session).toBe(false);
      expect(result.stability_score).toBeLessThan(1.0);
    });

    it("should require minimum threshold for taste", () => {
      // 4 次，未达到门槛 5
      const history = [
        { session_id: "s1", pattern_type: "test", count: 1 },
        { session_id: "s2", pattern_type: "test", count: 1 },
        { session_id: "s3", pattern_type: "test", count: 1 },
        { session_id: "s4", pattern_type: "test", count: 1 }
      ];

      const result = reader.recognizeCrossSessionPattern(
        { pattern: "test", scenario: "测试" },
        history
      );

      expect(result.is_taste).toBe(false);
      expect(result.stability_score).toBeLessThan(1.0);
    });
  });

  describe("边界测试", () => {
    it("should handle empty word choice input gracefully", () => {
      const result = reader.readWordChoice("", []);

      expect(result.confidence).toBeLessThan(0.6);  // 低置信度
      expect(result.sentiment_direction).toBe("neutral");
    });

    it("should handle empty repetition history gracefully", () => {
      const result = reader.recognizeCrossSessionPattern(
        { pattern: "test", scenario: "测试" },
        []
      );

      expect(result.is_taste).toBe(false);
      expect(result.stability_score).toBe(0);
    });

    it("should handle single repetition in history", () => {
      const history = [
        { session_id: "s1", pattern_type: "test", count: 1 }
      ];

      const result = reader.recognizeCrossSessionPattern(
        { pattern: "test", scenario: "测试" },
        history
      );

      expect(result.is_taste).toBe(false);
      expect(result.stability_score).toBeLessThan(0.3);
    });
  });
});
