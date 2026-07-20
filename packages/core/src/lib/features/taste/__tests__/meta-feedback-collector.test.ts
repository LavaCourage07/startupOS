/**
 * Meta Feedback Collector 测试
 *
 * QA Notes:
 * - 测试元反馈检测的准确性
 * - 验证日志记录功能
 * - 确保统计分析正确
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MetaFeedbackCollector,
  createUserInteraction,
  generateMockMetaFeedback,
  analyzeFeedback,
  type MetaFeedback,
  type UserInteraction
} from "../meta-feedback-collector";

describe("MetaFeedbackCollector", () => {
  let collector: MetaFeedbackCollector;

  beforeEach(() => {
    collector = new MetaFeedbackCollector();
  });

  afterEach(() => {
    collector.clearLog();
  });

  describe("元反馈检测", () => {
    it("should detect correction feedback", () => {
      const interaction = createUserInteraction({
        content: "你觉得我喜欢冒险的方案，其实你理解错了",
        userId: "user-1",
        sessionId: "session-1"
      });

      const feedback = collector.detectMetaFeedback(interaction);

      expect(feedback).not.toBeNull();
      expect(feedback?.type).toBe("understanding_correction");
    });

    it("should detect affirmation feedback", () => {
      const interaction = createUserInteraction({
        content: "你最近对我的风格理解有提升",
        userId: "user-1",
        sessionId: "session-1"
      });

      const feedback = collector.detectMetaFeedback(interaction);

      expect(feedback).not.toBeNull();
      expect(feedback?.type).toBe("understanding_affirmation");
    });

    it("should detect style update feedback", () => {
      const interaction = createUserInteraction({
        content: "我的风格是保守的，我现在更喜欢稳妥的方案",
        userId: "user-1",
        sessionId: "session-1"
      });

      const feedback = collector.detectMetaFeedback(interaction);

      expect(feedback).not.toBeNull();
      expect(feedback?.type).toBe("style_update");
    });

    it("should return null for non-meta feedback", () => {
      const interaction = createUserInteraction({
        content: "这个方案不错，我们开始吧",
        userId: "user-1",
        sessionId: "session-1"
      });

      const feedback = collector.detectMetaFeedback(interaction);

      expect(feedback).toBeNull();
    });

    it("should detect various correction phrases", () => {
      const phrases = [
        "你觉得我喜欢冒险的方案，其实不是",
        "你以为我想要很创新的，但我想要稳妥的",
        "你理解错了，我的风格是保守的",
        "不是这样理解的，我更喜欢可行而非创意",
        "不对，我不喜欢冒险的方案"
      ];

      for (const phrase of phrases) {
        const interaction = createUserInteraction({
          content: phrase,
          userId: "user-1",
          sessionId: "session-1"
        });

        const feedback = collector.detectMetaFeedback(interaction);

        expect(feedback?.type).toBe("understanding_correction");
      }
    });

    it("should detect various affirmation phrases", () => {
      const phrases = [
        "你理解得对",
        "你最近对我的风格理解有提升",
        "你的理解不错",
        "你越来越了解我了",
        "越来越了解我的品味了"
      ];

      for (const phrase of phrases) {
        const interaction = createUserInteraction({
          content: phrase,
          userId: "user-1",
          sessionId: "session-1"
        });

        const feedback = collector.detectMetaFeedback(interaction);

        expect(feedback?.type).toBe("understanding_affirmation");
      }
    });

    it("should detect style update correctly", () => {
      const phrases = [
        "我的风格是保守的",
        "我现在更喜欢稳妥的方案",
        "我变了，现在倾向于平衡的风格",
        "我现在倾向于更冒险一些",
        "我的品味是实用主义"
      ];

      for (const phrase of phrases) {
        const interaction = createUserInteraction({
          content: phrase,
          userId: "user-1",
          sessionId: "session-1"
        });

        const feedback = collector.detectMetaFeedback(interaction);

        expect(feedback?.type).toBe("style_update");
      }
    });

    it("should parse affirmation comparison levels", () => {
      const excellent = createUserInteraction({
        content: "你最近的理解非常优秀",
        userId: "user-1",
        sessionId: "session-1"
      });

      const muchBetter = createUserInteraction({
        content: "你最近的理解有大大提升",
        userId: "user-1",
        sessionId: "session-1"
      });

      const better = createUserInteraction({
        content: "你最近对我的理解有点提升了",
        userId: "user-1",
        sessionId: "session-1"
      });

      const excellentFeedback = collector.detectMetaFeedback(excellent);
      const muchBetterFeedback = collector.detectMetaFeedback(muchBetter);
      const betterFeedback = collector.detectMetaFeedback(better);

      expect(excellentFeedback?.understanding_affirmation?.comparison).toBe("excellent");
      expect(muchBetterFeedback?.understanding_affirmation?.comparison).toBe("much_better");
      expect(betterFeedback?.understanding_affirmation?.comparison).toBe("better_than_before");
    });
  });

  describe("日志记录", () => {
    it("should log feedback correctly", () => {
      const feedback = generateMockMetaFeedback("understanding_correction");

      collector.logFeedback(feedback);

      const log = collector.exportFeedbackLog();
      expect(log).toHaveLength(1);
      expect(log[0].type).toBe("understanding_correction");
      expect(log[0].stage).toBe("MVP");
      expect(log[0].timestamp).toBeGreaterThan(0);
    });

    it("should log feedback with interaction ID", () => {
      const feedback = generateMockMetaFeedback("understanding_affirmation");

      collector.logFeedback(feedback, "interaction-123");

      const log = collector.exportFeedbackLog();
      expect(log[0].interaction_id).toBe("interaction-123");
    });

    it("should accumulate feedback entries", () => {
      collector.logFeedback(generateMockMetaFeedback("understanding_correction"));
      collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));
      collector.logFeedback(generateMockMetaFeedback("style_update"));

      const log = collector.exportFeedbackLog();
      expect(log).toHaveLength(3);
    });

    it("should return a copy of the log", () => {
      collector.logFeedback(generateMockMetaFeedback("understanding_correction"));

      const log1 = collector.exportFeedbackLog();
      log1.push({} as any);

      const log2 = collector.exportFeedbackLog();
      expect(log2).toHaveLength(1);
    });

    it("should clear log correctly", () => {
      collector.logFeedback(generateMockMetaFeedback("understanding_correction"));
      collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));

      expect(collector.exportFeedbackLog()).toHaveLength(2);

      collector.clearLog();

      expect(collector.exportFeedbackLog()).toHaveLength(0);
    });
  });

  describe("交互处理", () => {
    it("should process interaction and detect feedback", () => {
      const interaction = createUserInteraction({
        content: "你觉得我喜欢冒险的方案，其实你理解错了",
        userId: "user-1",
        sessionId: "session-1"
      });

      const detected = collector.processInteraction(interaction);

      expect(detected).toBe(true);
      expect(collector.exportFeedbackLog()).toHaveLength(1);
    });

    it("should process interaction without feedback", () => {
      const interaction = createUserInteraction({
        content: "这个方案不错，我们开始吧",
        userId: "user-1",
        sessionId: "session-1"
      });

      const detected = collector.processInteraction(interaction);

      expect(detected).toBe(false);
      expect(collector.exportFeedbackLog()).toHaveLength(0);
    });

    it("should process multiple interactions", () => {
      const interactions = [
        createUserInteraction({
          content: "这个方案不错",
          userId: "user-1",
          sessionId: "session-1"
        }),
        createUserInteraction({
          content: "你最近对我的风格理解有提升",
          userId: "user-1",
          sessionId: "session-1"
        }),
        createUserInteraction({
          content: "另一个普通的交互",
          userId: "user-1",
          sessionId: "session-1"
        }),
        createUserInteraction({
          content: "你理解得对",
          userId: "user-1",
          sessionId: "session-1"
        })
      ];

      let detectedCount = 0;
      for (const interaction of interactions) {
        if (collector.processInteraction(interaction)) {
          detectedCount++;
        }
      }

      expect(detectedCount).toBe(2);
      expect(collector.exportFeedbackLog()).toHaveLength(2);
    });
  });

  describe("统计功能", () => {
    it("should calculate correct stats for empty log", () => {
      const stats = collector.getStats();

      expect(stats.total_feedback).toBe(0);
      expect(stats.corrections).toBe(0);
      expect(stats.affirmations).toBe(0);
      expect(stats.style_updates).toBe(0);
      expect(stats.affirmation_rate).toBe(0);
    });

    it("should calculate correct stats for mixed feedback", () => {
      collector.logFeedback(generateMockMetaFeedback("understanding_correction"));
      collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));
      collector.logFeedback(generateMockMetaFeedback("style_update"));
      collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));
      collector.logFeedback(generateMockMetaFeedback("understanding_correction"));

      const stats = collector.getStats();

      expect(stats.total_feedback).toBe(5);
      expect(stats.corrections).toBe(2);
      expect(stats.affirmations).toBe(2);
      expect(stats.style_updates).toBe(1);
      expect(stats.affirmation_rate).toBe(2 / 5);
    });

    it("should calculate affirmation rate correctly", () => {
      collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));
      collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));
      collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));
      collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));
      collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));

      const stats = collector.getStats();

      expect(stats.affirmation_rate).toBe(1.0);
    });
  });

  describe("JSON 导出", () => {
    it("should export valid JSON", () => {
      collector.logFeedback(generateMockMetaFeedback("understanding_correction"));
      collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));

      const json = collector.exportAsJSON();

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it("should export metadata", () => {
      collector.logFeedback(generateMockMetaFeedback("understanding_correction"));

      const json = collector.exportAsJSON();
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty("metadata");
      expect(parsed.metadata).toHaveProperty("exported_at");
      expect(parsed.metadata.total_feedback).toBe(1);
    });

    it("should export feedback array", () => {
      collector.logFeedback(generateMockMetaFeedback("understanding_correction"));

      const json = collector.exportAsJSON();
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty("feedback");
      expect(parsed.feedback).toBeInstanceOf(Array);
      expect(parsed.feedback).toHaveLength(1);
    });

    it("should export stats", () => {
      collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));

      const json = collector.exportAsJSON();
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty("stats");
      expect(parsed.stats).toHaveProperty("total_feedback");
      expect(parsed.stats).toHaveProperty("affirmation_rate");
    });
  });

  describe("反馈分析", () => {
    it("should analyze empty feedback log", () => {
      const log = collector.exportFeedbackLog();
      const analysis = analyzeFeedback(log);

      expect(analysis.stats.total_feedback).toBe(0);
      expect(analysis.accuracy_estimate).toBe(0);
      expect(analysis.suggested_improvements).toHaveLength(0);
      expect(analysis.concerns).toHaveLength(0);
    });

    it("should analyze feedback with more corrections than affirmations", () => {
      collector.logFeedback(generateMockMetaFeedback("understanding_correction"));
      collector.logFeedback(generateMockMetaFeedback("understanding_correction"));
      collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));

      const log = collector.exportFeedbackLog();
      const analysis = analyzeFeedback(log);

      expect(analysis.accuracy_estimate).toBeLessThan(0.5);
      expect(analysis.concerns.length).toBeGreaterThan(0);
      expect(analysis.concerns.some(c => c.includes("纠正反馈多于肯定反馈"))).toBe(true);
    });

    it("should analyze feedback with high affirmation rate", () => {
      for (let i = 0; i < 5; i++) {
        collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));
      }

      const log = collector.exportFeedbackLog();
      const analysis = analyzeFeedback(log);

      expect(analysis.accuracy_estimate).toBeGreaterThanOrEqual(0.7);
      expect(analysis.suggested_improvements.length).toBeGreaterThan(0);
    });

    it("should analyze feedback with many style updates", () => {
      for (let i = 0; i < 6; i++) {
        collector.logFeedback(generateMockMetaFeedback("style_update"));
      }

      const log = collector.exportFeedbackLog();
      const analysis = analyzeFeedback(log);

      expect(analysis.suggested_improvements.some(
        imp => imp.includes("SOUL 演化")
      )).toBe(true);
    });

    it("should generate concern for low accuracy estimate", () => {
      for (let i = 0; i < 3; i++) {
        collector.logFeedback(generateMockMetaFeedback("understanding_correction"));
      }
      collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));

      const log = collector.exportFeedbackLog();
      const analysis = analyzeFeedback(log);

      expect(analysis.accuracy_estimate).toBeLessThan(0.5);
      expect(analysis.concerns.some(
        c => c.includes("准确性估计低于 50%")
      )).toBe(true);
    });
  });

  describe("边界场景", () => {
    it("should handle empty content", () => {
      const interaction = createUserInteraction({
        content: "",
        userId: "user-1",
        sessionId: "session-1"
      });

      const feedback = collector.detectMetaFeedback(interaction);

      expect(feedback).toBeNull();
    });

    it("should handle non-string content", () => {
      const interaction = createUserInteraction({
        content: "正常内容",
        userId: "user-1",
        sessionId: "session-1"
      });

      // Mock content as non-string
      (interaction as any).content = null;

      const feedback = collector.detectMetaFeedback(interaction);

      expect(feedback).toBeNull();
    });

    it("should handle large number of feedback entries", () => {
      const count = 1000;

      for (let i = 0; i < count; i++) {
        collector.logFeedback(generateMockMetaFeedback("understanding_affirmation"));
      }

      const log = collector.exportFeedbackLog();
      const stats = collector.getStats();

      expect(log).toHaveLength(count);
      expect(stats.total_feedback).toBe(count);
      expect(stats.affirmation_rate).toBe(1.0);
    });
  });
});

describe("createUserInteraction", () => {
  it("should create user interaction with correct structure", () => {
    const interaction = createUserInteraction({
      content: "测试内容",
      userId: "user-1",
      sessionId: "session-1"
    });

    expect(interaction.id).toMatch(/^interaction-\d+-[a-z0-9]+$/);
    expect(interaction.content).toBe("测试内容");
    expect(interaction.userId).toBe("user-1");
    expect(interaction.sessionId).toBe("session-1");
    expect(interaction.timestamp).toBeGreaterThan(0);
  });

  it("should generate unique IDs", () => {
    const interaction1 = createUserInteraction({
      content: "测试",
      userId: "user-1",
      sessionId: "session-1"
    });

    const interaction2 = createUserInteraction({
      content: "测试",
      userId: "user-1",
      sessionId: "session-1"
    });

    expect(interaction1.id).not.toBe(interaction2.id);
  });
});

describe("generateMockMetaFeedback", () => {
  it("should generate correction feedback", () => {
    const feedback = generateMockMetaFeedback("understanding_correction");

    expect(feedback.type).toBe("understanding_correction");
    expect(feedback.understanding_correction).toBeDefined();
    expect(feedback.understanding_correction?.agent_claim).toBe("你觉得我喜欢冒险的方案");
  });

  it("should generate affirmation feedback", () => {
    const feedback = generateMockMetaFeedback("understanding_affirmation");

    expect(feedback.type).toBe("understanding_affirmation");
    expect(feedback.understanding_affirmation).toBeDefined();
    expect(feedback.understanding_affirmation?.improvement_area).toBe("决策风格");
  });

  it("should generate style update feedback", () => {
    const feedback = generateMockMetaFeedback("style_update");

    expect(feedback.type).toBe("style_update");
    expect(feedback.style_update).toBeDefined();
    expect(feedback.style_update?.previous_style).toBe("保守");
  });
});
