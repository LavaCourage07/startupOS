/**
 * MVP 质量门槛测试
 *
 * QA Notes:
 * - 测试质量评估逻辑的正确性
 * - 验证所有阈值检查
 * - 确保失败情况能被正确识别
 */

import { describe, it, expect } from "vitest";
import {
  QUALITY_THRESHOLD,
  evaluateMVPQualityGate,
  isMVPReady,
  type MVPQualityGate
} from "../mvp-quality-gate";

// ============================================================================
// Mock 组件创建
// ============================================================================

function createMockComponents() {
  return {
    signalReader: {
      readFromInteraction: () => ([])
    },
    distillationEngine: {
      distill: () => ({})
    },
    tastePersistence: {
      save: async () => {},
      load: async () => null
    },
    soulManager: {
      loadSOUL: async () => null
    },
    trustManagerStub: {
      isStub: () => true
    }
  };
}

// ============================================================================
// 阈值常量测试
// ============================================================================

describe("质量门槛常量", () => {
  it("should define all expected thresholds", () => {
    expect(QUALITY_THRESHOLD).toHaveProperty("signal_accuracy", 0.85);
    expect(QUALITY_THRESHOLD).toHaveProperty("distillation_success_rate", 0.90);
    expect(QUALITY_THRESHOLD).toHaveProperty("persistence_consistency", 0.95);
    expect(QUALITY_THRESHOLD).toHaveProperty("test_coverage", 0.80);
    expect(QUALITY_THRESHOLD).toHaveProperty("governance_blocked_rate", 0.95);
    expect(QUALITY_THRESHOLD).toHaveProperty("signal_read_max_latency", 100);
    expect(QUALITY_THRESHOLD).toHaveProperty("pattern_query_max_latency", 50);
    expect(QUALITY_THRESHOLD).toHaveProperty("soul_load_max_latency", 200);
  });

  it("should have thresholds in valid ranges", () => {
    // 0-1 范围的比例值
    expect(QUALITY_THRESHOLD.signal_accuracy).toBeGreaterThan(0);
    expect(QUALITY_THRESHOLD.signal_accuracy).toBeLessThanOrEqual(1);
    expect(QUALITY_THRESHOLD.distillation_success_rate).toBeGreaterThan(0);
    expect(QUALITY_THRESHOLD.distillation_success_rate).toBeLessThanOrEqual(1);
    expect(QUALITY_THRESHOLD.persistence_consistency).toBeGreaterThan(0);
    expect(QUALITY_THRESHOLD.persistence_consistency).toBeLessThanOrEqual(1);
    expect(QUALITY_THRESHOLD.test_coverage).toBeGreaterThan(0);
    expect(QUALITY_THRESHOLD.test_coverage).toBeLessThanOrEqual(1);

    // 延迟值（毫秒）
    expect(QUALITY_THRESHOLD.signal_read_max_latency).toBeGreaterThan(0);
    expect(QUALITY_THRESHOLD.pattern_query_max_latency).toBeGreaterThan(0);
    expect(QUALITY_THRESHOLD.soul_load_max_latency).toBeGreaterThan(0);
  });
});

// ============================================================================
// isMVPReady 函数测试
// ============================================================================

describe("isMVPReady", () => {
  function createPassingGate(): MVPQualityGate {
    return {
      all_stories_completed: true,
      metrics: {
        signal_accuracy: 0.87,
        distillation_success_rate: 0.92,
        persistence_consistency: 0.98,
        cross_session_validation: true,
        test_coverage: 0.85
      },
      safety: {
        governance_blocked_rate: 0.96,
        ontology_violation_detected: true
      },
      integration: {
        end_to_end_success: true,
        stubs_functional: true,
        data_collection: true
      },
      performance: {
        signal_read_p95_latency: 85,
        pattern_query_p95_latency: 42,
        soul_load_p95_latency: 175
      },
      passed: false,
      timestamp: Date.now()
    };
  }

  it("should return true for passing quality gate", () => {
    const gate = createPassingGate();
    expect(isMVPReady(gate)).toBe(true);
  });

  it("should return false when epic not completed", () => {
    const gate = createPassingGate();
    gate.all_stories_completed = false;
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return false when signal accuracy is below threshold", () => {
    const gate = createPassingGate();
    gate.metrics.signal_accuracy = 0.80;  // < 0.85
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return false when distillation success rate is below threshold", () => {
    const gate = createPassingGate();
    gate.metrics.distillation_success_rate = 0.85;  // < 0.90
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return false when persistence consistency is below threshold", () => {
    const gate = createPassingGate();
    gate.metrics.persistence_consistency = 0.90;  // < 0.95
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return false when cross-session validation fails", () => {
    const gate = createPassingGate();
    gate.metrics.cross_session_validation = false;
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return false when test coverage is below threshold", () => {
    const gate = createPassingGate();
    gate.metrics.test_coverage = 0.75;  // < 0.80
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return false when governance blocking rate is below threshold", () => {
    const gate = createPassingGate();
    gate.safety.governance_blocked_rate = 0.90;  // < 0.95
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return false when ontology violation detection fails", () => {
    const gate = createPassingGate();
    gate.safety.ontology_violation_detected = false;
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return false when end-to-end flow fails", () => {
    const gate = createPassingGate();
    gate.integration.end_to_end_success = false;
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return false when stub is not functional", () => {
    const gate = createPassingGate();
    gate.integration.stubs_functional = false;
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return false when data collection fails", () => {
    const gate = createPassingGate();
    gate.integration.data_collection = false;
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return false when signal read latency exceeds threshold", () => {
    const gate = createPassingGate();
    gate.performance.signal_read_p95_latency = 110;  // > 100
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return false when pattern query latency exceeds threshold", () => {
    const gate = createPassingGate();
    gate.performance.pattern_query_p95_latency = 60;  // > 50
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return false when SOUL load latency exceeds threshold", () => {
    const gate = createPassingGate();
    gate.performance.soul_load_p95_latency = 220;  // > 200
    expect(isMVPReady(gate)).toBe(false);
  });

  it("should return true when values are exactly at threshold", () => {
    const gate = createPassingGate();
    gate.metrics.signal_accuracy = 0.85;  // = 0.85
    gate.metrics.distillation_success_rate = 0.90;  // = 0.90
    gate.metrics.persistence_consistency = 0.95;  // = 0.95
    gate.metrics.test_coverage = 0.80;  // = 0.80
    gate.safety.governance_blocked_rate = 0.95;  // = 0.95
    gate.performance.signal_read_p95_latency = 100;  // = 100
    gate.performance.pattern_query_p95_latency = 50;  // = 50
    gate.performance.soul_load_p95_latency = 200;  // = 200

    expect(isMVPReady(gate)).toBe(true);
  });

  it("should return false when any metric is just below threshold", () => {
    const gate = createPassingGate();
    gate.metrics.signal_accuracy = 0.849;  // < 0.85
    expect(isMVPReady(gate)).toBe(false);

    gate.metrics.signal_accuracy = 0.85;  // back to threshold
    gate.metrics.distillation_success_rate = 0.899;  // < 0.90
    expect(isMVPReady(gate)).toBe(false);

    gate.metrics.distillation_success_rate = 0.90;
    gate.performance.signal_read_p95_latency = 101;  // > 100
    expect(isMVPReady(gate)).toBe(false);
  });
});

// ============================================================================
// 质量评估场景测试
// ============================================================================

describe("质量评估场景", () => {
  it("should handle near-threshold values correctly", () => {
    const nearThreshold = {
      all_stories_completed: true,
      metrics: {
        signal_accuracy: 0.86,           // 略高于阈值
        distillation_success_rate: 0.91, // 略高于阈值
        persistence_consistency: 0.96,   // 略高于阈值
        cross_session_validation: true,
        test_coverage: 0.81              // 略高于阈值
      },
      safety: {
        governance_blocked_rate: 0.96,   // 略高于阈值
        ontology_violation_detected: true
      },
      integration: {
        end_to_end_success: true,
        stubs_functional: true,
        data_collection: true
      },
      performance: {
        signal_read_p95_latency: 99,     // 略低于阈值
        pattern_query_p95_latency: 49,   // 略低于阈值
        soul_load_p95_latency: 199       // 略低于阈值
      },
      passed: false,
      timestamp: Date.now()
    };

    expect(isMVPReady(nearThreshold)).toBe(true);
  });

  it("should identify single point of failure", () => {
    const singleFailure = {
      all_stories_completed: true,
      metrics: {
        signal_accuracy: 0.87,
        distillation_success_rate: 0.92,
        persistence_consistency: 0.98,
        cross_session_validation: true,
        test_coverage: 0.79  // only one below threshold
      },
      safety: {
        governance_blocked_rate: 0.96,
        ontology_violation_detected: true
      },
      integration: {
        end_to_end_success: true,
        stubs_functional: true,
        data_collection: true
      },
      performance: {
        signal_read_p95_latency: 85,
        pattern_query_p95_latency: 42,
        soul_load_p95_latency: 175
      },
      passed: false,
      timestamp: Date.now()
    };

    expect(isMVPReady(singleFailure)).toBe(false);
  });

  it("should identify multiple points of failure", () => {
    const multipleFailures = {
      all_stories_completed: true,
      metrics: {
        signal_accuracy: 0.82,
        distillation_success_rate: 0.88,
        persistence_consistency: 0.98,
        cross_session_validation: true,
        test_coverage: 0.85
      },
      safety: {
        governance_blocked_rate: 0.94,
        ontology_violation_detected: true
      },
      integration: {
        end_to_end_success: true,
        stubs_functional: true,
        data_collection: true
      },
      performance: {
        signal_read_p95_latency: 85,
        pattern_query_p95_latency: 42,
        soul_load_p95_latency: 175
      },
      passed: false,
      timestamp: Date.now()
    };

    expect(isMVPReady(multipleFailures)).toBe(false);
  });
});

// ============================================================================
// 集成测试 (注意: 这些测试在实际实现中应该移除 mock)
// ============================================================================

describe("MVP 质量评估集成", () => {
  it("should evaluate MVP with mock components", async () => {
    const components = createMockComponents();

    const gate = await evaluateMVPQualityGate({
      ...components,
      targetTestPath: "src/lib/taste/"
    });

    // 目前返回 mock 值，所以应该通过
    expect(gate).toBeDefined();
    expect(gate.timestamp).toBeGreaterThan(0);
  });

  it("should handle missing optional parameters", async () => {
    const components = createMockComponents();

    const gate = await evaluateMVPQualityGate(components);

    expect(gate).toBeDefined();
  });
});

// ============================================================================
// 辅助函数测试
// ============================================================================

describe("质量报告格式", () => {
  it("should have all required fields", () => {
    const gate: MVPQualityGate = {
      all_stories_completed: true,
      metrics: {
        signal_accuracy: 0.85,
        distillation_success_rate: 0.90,
        persistence_consistency: 0.95,
        cross_session_validation: true,
        test_coverage: 0.80
      },
      safety: {
        governance_blocked_rate: 0.95,
        ontology_violation_detected: true
      },
      integration: {
        end_to_end_success: true,
        stubs_functional: true,
        data_collection: true
      },
      performance: {
        signal_read_p95_latency: 100,
        pattern_query_p95_latency: 50,
        soul_load_p95_latency: 200
      },
      passed: true,
      timestamp: Date.now()
    };

    // 验证所有字段存在且类型正确
    expect(typeof gate.all_stories_completed).toBe("boolean");
    expect(typeof gate.metrics.signal_accuracy).toBe("number");
    expect(typeof gate.metrics.distillation_success_rate).toBe("number");
    expect(typeof gate.metrics.persistence_consistency).toBe("number");
    expect(typeof gate.metrics.cross_session_validation).toBe("boolean");
    expect(typeof gate.metrics.test_coverage).toBe("number");
    expect(typeof gate.safety.governance_blocked_rate).toBe("number");
    expect(typeof gate.safety.ontology_violation_detected).toBe("boolean");
    expect(typeof gate.integration.end_to_end_success).toBe("boolean");
    expect(typeof gate.integration.stubs_functional).toBe("boolean");
    expect(typeof gate.integration.data_collection).toBe("boolean");
    expect(typeof gate.performance.signal_read_p95_latency).toBe("number");
    expect(typeof gate.performance.pattern_query_p95_latency).toBe("number");
    expect(typeof gate.performance.soul_load_p95_latency).toBe("number");
    expect(typeof gate.passed).toBe("boolean");
    expect(typeof gate.timestamp).toBe("number");
  });

  it("should validate metric ranges", () => {
    const gate: MVPQualityGate = {
      all_stories_completed: true,
      metrics: {
        signal_accuracy: 0.85,
        distillation_success_rate: 0.90,
        persistence_consistency: 0.95,
        cross_session_validation: true,
        test_coverage: 0.80
      },
      safety: {
        governance_blocked_rate: 0.95,
        ontology_violation_detected: true
      },
      integration: {
        end_to_end_success: true,
        stubs_functional: true,
        data_collection: true
      },
      performance: {
        signal_read_p95_latency: 100,
        pattern_query_p95_latency: 50,
        soul_load_p95_latency: 200
      },
      passed: true,
      timestamp: Date.now()
    };

    // 验证比例值在 0-1 范围内
    expect(gate.metrics.signal_accuracy).toBeGreaterThanOrEqual(0);
    expect(gate.metrics.signal_accuracy).toBeLessThanOrEqual(1);
    expect(gate.metrics.distillation_success_rate).toBeGreaterThanOrEqual(0);
    expect(gate.metrics.distillation_success_rate).toBeLessThanOrEqual(1);
    expect(gate.metrics.persistence_consistency).toBeGreaterThanOrEqual(0);
    expect(gate.metrics.persistence_consistency).toBeLessThanOrEqual(1);
    expect(gate.metrics.test_coverage).toBeGreaterThanOrEqual(0);
    expect(gate.metrics.test_coverage).toBeLessThanOrEqual(1);
    expect(gate.safety.governance_blocked_rate).toBeGreaterThanOrEqual(0);
    expect(gate.safety.governance_blocked_rate).toBeLessThanOrEqual(1);

    // 验证延迟值为正数
    expect(gate.performance.signal_read_p95_latency).toBeGreaterThan(0);
    expect(gate.performance.pattern_query_p95_latency).toBeGreaterThan(0);
    expect(gate.performance.soul_load_p95_latency).toBeGreaterThan(0);
  });
});
