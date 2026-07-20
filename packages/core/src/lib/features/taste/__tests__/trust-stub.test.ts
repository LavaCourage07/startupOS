/**
 * TrustManagerStub 测试
 *
 * QA Notes:
 * - 测试 stub 实现的完整性
 * - 验证 stub 不会影响其他功能
 * - 确保 stub 的行为是可预测的
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TrustManagerStub,
  AUTONOMY_LEVELS,
  type TrustEvent,
  type AutonomyLevel
} from "../trust-stub";

describe("TrustManagerStub", () => {
  let stub: TrustManagerStub;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stub = new TrustManagerStub();
    // Mock console.warn 以避免测试输出过多警告
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe("初始化", () => {
    it("should initialize with default trust level", () => {
      expect(stub.getCurrentTrust()).toBe(0.5);
    });

    it("should initialize with empty event log", () => {
      expect(stub.getEventLog()).toEqual([]);
    });

    it("should identify as stub", () => {
      expect(stub.isStub()).toBe(true);
    });
  });

  describe("getAutonomyLevel", () => {
    it("should return 'guided' as default", () => {
      const level = stub.getAutonomyLevel();
      expect(level).toBe('guided');
    });

    it("should ignore domain parameter", () => {
      const level1 = stub.getAutonomyLevel("coding");
      const level2 = stub.getAutonomyLevel("design");
      expect(level1).toBe(level2);
    });

    it("should log warning for domain parameter", () => {
      stub.getAutonomyLevel("coding");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Domain-specific trust not supported")
      );
    });

    it("should be consistent with documentation", () => {
      const level = stub.getAutonomyLevel();
      const doc = AUTONOMY_LEVELS[level];

      expect(level).toBe('guided');
      expect(doc.confirmation_required).toBe('on_high_stakes');
      expect(doc.trust_range[0]).toBeLessThanOrEqual(stub.getCurrentTrust());
      expect(doc.trust_range[1]).toBeGreaterThanOrEqual(stub.getCurrentTrust());
    });
  });

  describe("processTrustEvent", () => {
    it("should log successful suggestion event", async () => {
      const event: TrustEvent = { type: 'successful_suggestion' };

      await stub.processTrustEvent(event);

      expect(stub.getEventLog()).toContain(event);
    });

    it("should log correction applied event", async () => {
      const event: TrustEvent = { type: 'correction_applied', severity: 'minor' };

      await stub.processTrustEvent(event);

      expect(stub.getEventLog()).toContain(event);
    });

    it("should log pattern verified event", async () => {
      const event: TrustEvent = { type: 'pattern_verified' };

      await stub.processTrustEvent(event);

      expect(stub.getEventLog()).toContain(event);
    });

    it("should not change trust level", async () => {
      const initialTrust = stub.getCurrentTrust();

      await stub.processTrustEvent({ type: 'successful_suggestion' });
      await stub.processTrustEvent({ type: 'pattern_verified' });

      expect(stub.getCurrentTrust()).toBe(initialTrust);
    });

    it("should log warning message", async () => {
      await stub.processTrustEvent({ type: 'successful_suggestion' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Using stub implementation")
      );
    });
  });

  describe("applyTrustPenalty", () => {
    it("should log penalty event", async () => {
      await stub.applyTrustPenalty('minor');

      const events = stub.getEventLog();
      const penaltyEvents = events.filter(e => e.type === 'correction_applied');

      expect(penaltyEvents.length).toBe(1);
      expect(penaltyEvents[0]).toEqual({
        type: 'correction_applied',
        severity: 'minor'
      });
    });

    it("should log penalty for all severity levels", async () => {
      await stub.applyTrustPenalty('minor');
      await stub.applyTrustPenalty('major');
      await stub.applyTrustPenalty('critical');

      const events = stub.getEventLog();
      const penaltyEvents = events.filter(e => e.type === 'correction_applied');

      expect(penaltyEvents).toEqual([
        { type: 'correction_applied', severity: 'minor' },
        { type: 'correction_applied', severity: 'major' },
        { type: 'correction_applied', severity: 'critical' }
      ]);
    });

    it("should not change trust level", async () => {
      const initialTrust = stub.getCurrentTrust();

      await stub.applyTrustPenalty('minor');
      await stub.applyTrustPenalty('major');

      expect(stub.getCurrentTrust()).toBe(initialTrust);
    });

    it("should log warning message", async () => {
      await stub.applyTrustPenalty('minor');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Penalty of severity")
      );
    });
  });

  describe("recoverTrust", () => {
    it("should log recovery event", async () => {
      const event: TrustEvent = { type: 'pattern_verified' };

      await stub.recoverTrust(event);

      expect(stub.getEventLog()).toContain(event);
    });

    it("should not change trust level", async () => {
      const initialTrust = stub.getCurrentTrust();

      await stub.recoverTrust({ type: 'pattern_verified' });

      expect(stub.getCurrentTrust()).toBe(initialTrust);
    });

    it("should log warning message", async () => {
      await stub.recoverTrust({ type: 'pattern_verified' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Trust recovery")
      );
    });
  });

  describe("getEventLog", () => {
    it("should return a copy of the event log", () => {
      const initialLog = stub.getEventLog();
      initialLog.push({ type: 'pattern_verified' });

      const secondLog = stub.getEventLog();

      expect(secondLog).not.toBe(initialLog);  // Different array reference
      expect(secondLog.length).toBe(0);  // Log was not modified
    });

    it("should accumulate events", async () => {
      await stub.processTrustEvent({ type: 'successful_suggestion' });
      await stub.processTrustEvent({ type: 'pattern_verified' });
      await stub.processTrustEvent({ type: 'successful_suggestion' });

      expect(stub.getEventLog().length).toBe(3);
    });
  });

  describe("clearEventLog", () => {
    it("should clear the event log", async () => {
      await stub.processTrustEvent({ type: 'successful_suggestion' });
      await stub.processTrustEvent({ type: 'pattern_verified' });

      expect(stub.getEventLog().length).toBe(2);

      stub.clearEventLog();

      expect(stub.getEventLog()).toEqual([]);
    });

    it("should not affect trust level", async () => {
      await stub.processTrustEvent({ type: 'successful_suggestion' });
      stub.clearEventLog();

      expect(stub.getCurrentTrust()).toBe(0.5);
    });
  });

  describe("Integration with other systems", () => {
    it("should work with repeated calls", async () => {
      let level;

      for (let i = 0; i < 10; i++) {
        level = stub.getAutonomyLevel();
        await stub.processTrustEvent({ type: 'successful_suggestion' });
      }

      expect(level).toBe('guided');
    });

    it("should not throw errors on simultaneous operations", async () => {
      // 模拟同时调用多个方法
      const operations = [
        stub.getAutonomyLevel(),
        stub.processTrustEvent({ type: 'successful_suggestion' }),
        stub.applyTrustPenalty('minor'),
        stub.recoverTrust({ type: 'pattern_verified' }),
        stub.getCurrentTrust()
      ];

      await Promise.all(operations);

      // 只需要验证没有抛出错误
      expect(stub.getEventLog().length).toBeGreaterThan(0);
    });
  });

  describe("Autonomy level definitions", () => {
    it("should have all four autonomy levels defined", () => {
      const levels: AutonomyLevel[] = ['limited', 'guided', 'collaborative', 'autonomous'];

      for (const level of levels) {
        expect(AUTONOMY_LEVELS[level]).toBeDefined();
        expect(AUTONOMY_LEVELS[level].description).toBeDefined();
        expect(AUTONOMY_LEVELS[level].confirmation_required).toBeDefined();
        expect(AUTONOMY_LEVELS[level].trust_range).toBeDefined();
      }
    });

    it("should have trust ranges that cover 0.0 to 1.0", () => {
      const levels: AutonomyLevel[] = ['limited', 'guided', 'collaborative', 'autonomous'];

      expect(AUTONOMY_LEVELS.limited.trust_range[0]).toBe(0.0);
      expect(AUTONOMY_LEVELS.autonomous.trust_range[1]).toBe(1.0);

      // 验证中间的区间是连续的
      for (let i = 0; i < levels.length - 1; i++) {
        const current = AUTONOMY_LEVELS[levels[i]];
        const next = AUTONOMY_LEVELS[levels[i + 1]];

        expect(current.trust_range[1]).toBeCloseTo(next.trust_range[0]);
      }
    });
  });
});
