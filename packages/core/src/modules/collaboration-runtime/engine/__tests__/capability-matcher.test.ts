import { describe, it, expect } from "vitest";
import { CapabilityMatcher } from "../capability-matcher";
import type { AgentProfile, TaskDescription } from "../capability-matcher";

const matcher = new CapabilityMatcher();

// ============================================================================
// Basic Matching
// ============================================================================

describe("CapabilityMatcher — Basic", () => {
  it("returns empty array for no agents", () => {
    const result = matcher.match(
      { description: "test" },
      []
    );
    expect(result).toEqual([]);
  });

  it("returns scored agents sorted by score descending", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: ["analysis"], skills: [], currentLoad: 0 },
      { agentId: "b", capabilities: [], skills: [], currentLoad: 0 },
    ];

    const result = matcher.match(
      {
        description: "Analyze data",
        requiredCapabilities: ["analysis"],
      },
      agents
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.agentId).toBe("a");
    expect(result[0]!.score).toBeGreaterThan(result[1]!.score);
  });

  it("score is between 0 and 1", () => {
    const agents: AgentProfile[] = [
      { agentId: "x", capabilities: ["a", "b"], skills: ["s1"], currentLoad: 0, successRate: 0.8 },
    ];

    const result = matcher.match(
      {
        description: "test",
        domain: "data",
        requiredCapabilities: ["a", "c"],
        requiredSkills: ["s1", "s2"],
      },
      agents
    );

    expect(result[0]!.score).toBeGreaterThanOrEqual(0);
    expect(result[0]!.score).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Domain Matching (30%)
// ============================================================================

describe("CapabilityMatcher — Domain (30%)", () => {
  it("perfect domain match gives high score", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: [], skills: [], currentLoad: 0, domain: "data analysis" },
    ];

    const result = matcher.match(
      { description: "test", domain: "data analysis" },
      agents
    );

    expect(result[0]!.breakdown.domainMatch).toBe(1);
  });

  it("partial domain match gives proportional score", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: [], skills: [], currentLoad: 0, domain: "data analysis" },
    ];

    const result = matcher.match(
      { description: "test", domain: "data visualization" },
      agents
    );

    // "data" matches, "visualization" doesn't → ~0.5
    expect(result[0]!.breakdown.domainMatch).toBeGreaterThanOrEqual(0.4);
    expect(result[0]!.breakdown.domainMatch).toBeLessThanOrEqual(0.6);
  });

  it("no domain on agent gives neutral score", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: [], skills: [], currentLoad: 0 },
    ];

    const result = matcher.match(
      { description: "test", domain: "data analysis" },
      agents
    );

    expect(result[0]!.breakdown.domainMatch).toBe(0.5);
  });

  it("no domain on task gives neutral score", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: [], skills: [], currentLoad: 0, domain: "data" },
    ];

    const result = matcher.match(
      { description: "test" },
      agents
    );

    expect(result[0]!.breakdown.domainMatch).toBe(0.5);
  });
});

// ============================================================================
// Skill Matching (25%)
// ============================================================================

describe("CapabilityMatcher — Skill (25%)", () => {
  it("all skills matched → 1.0", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: [], skills: ["unit-test", "integration-test"], currentLoad: 0 },
    ];

    const result = matcher.match(
      { description: "test", requiredSkills: ["unit-test", "integration-test"] },
      agents
    );

    expect(result[0]!.breakdown.skillMatch).toBe(1);
  });

  it("half skills matched → 0.5", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: [], skills: ["unit-test"], currentLoad: 0 },
    ];

    const result = matcher.match(
      { description: "test", requiredSkills: ["unit-test", "e2e-test"] },
      agents
    );

    expect(result[0]!.breakdown.skillMatch).toBe(0.5);
  });

  it("no skill requirement → neutral", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: [], skills: ["unit-test"], currentLoad: 0 },
    ];

    const result = matcher.match(
      { description: "test" },
      agents
    );

    expect(result[0]!.breakdown.skillMatch).toBe(0.5);
  });

  it("no skills matched → 0", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: [], skills: ["writing"], currentLoad: 0 },
    ];

    const result = matcher.match(
      { description: "test", requiredSkills: ["coding", "testing"] },
      agents
    );

    expect(result[0]!.breakdown.skillMatch).toBe(0);
  });
});

// ============================================================================
// Capability Matching (25%)
// ============================================================================

describe("CapabilityMatcher — Capability (25%)", () => {
  it("all capabilities matched → 1.0", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: ["analysis", "coding", "testing"], skills: [], currentLoad: 0 },
    ];

    const result = matcher.match(
      { description: "test", requiredCapabilities: ["analysis", "testing"] },
      agents
    );

    expect(result[0]!.breakdown.capabilityMatch).toBe(1);
  });

  it("partial capabilities matched → proportional", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: ["analysis"], skills: [], currentLoad: 0 },
    ];

    const result = matcher.match(
      { description: "test", requiredCapabilities: ["analysis", "coding", "testing"] },
      agents
    );

    expect(result[0]!.breakdown.capabilityMatch).toBeCloseTo(1 / 3);
  });

  it("no capability requirement → neutral", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: ["analysis"], skills: [], currentLoad: 0 },
    ];

    const result = matcher.match(
      { description: "test" },
      agents
    );

    expect(result[0]!.breakdown.capabilityMatch).toBe(0.5);
  });
});

// ============================================================================
// Load Scoring (10%)
// ============================================================================

describe("CapabilityMatcher — Load (10%)", () => {
  it("zero load → 1.0", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: [], skills: [], currentLoad: 0 },
    ];

    const result = matcher.match(
      { description: "test" },
      agents
    );

    expect(result[0]!.breakdown.loadScore).toBe(1);
  });

  it("load 5 → 0.5", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: [], skills: [], currentLoad: 5 },
    ];

    const result = matcher.match(
      { description: "test" },
      agents
    );

    expect(result[0]!.breakdown.loadScore).toBe(0.5);
  });

  it("load >= 10 → 0.0", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: [], skills: [], currentLoad: 10 },
      { agentId: "b", capabilities: [], skills: [], currentLoad: 20 },
    ];

    const result = matcher.match(
      { description: "test" },
      agents
    );

    expect(result[0]!.breakdown.loadScore).toBe(0);
    expect(result[1]!.breakdown.loadScore).toBe(0);
  });

  it("lower load agent scores higher", () => {
    const agents: AgentProfile[] = [
      { agentId: "free", capabilities: [], skills: [], currentLoad: 0 },
      { agentId: "busy", capabilities: [], skills: [], currentLoad: 8 },
    ];

    const result = matcher.match(
      { description: "test" },
      agents
    );

    expect(result[0]!.agentId).toBe("free");
    expect(result[0]!.breakdown.loadScore).toBeGreaterThan(
      result[1]!.breakdown.loadScore
    );
  });
});

// ============================================================================
// History Scoring (10%)
// ============================================================================

describe("CapabilityMatcher — History (10%)", () => {
  it("high success rate → high score", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: [], skills: [], currentLoad: 0, successRate: 0.95 },
    ];

    const result = matcher.match(
      { description: "test" },
      agents
    );

    expect(result[0]!.breakdown.historyScore).toBe(0.95);
  });

  it("no history → neutral 0.5", () => {
    const agents: AgentProfile[] = [
      { agentId: "a", capabilities: [], skills: [], currentLoad: 0 },
    ];

    const result = matcher.match(
      { description: "test" },
      agents
    );

    expect(result[0]!.breakdown.historyScore).toBe(0.5);
  });

  it("high success rate agent beats low success rate on equal features", () => {
    const agents: AgentProfile[] = [
      { agentId: "good", capabilities: ["x"], skills: [], currentLoad: 0, successRate: 0.9 },
      { agentId: "bad", capabilities: ["x"], skills: [], currentLoad: 0, successRate: 0.2 },
    ];

    const result = matcher.match(
      { description: "test", requiredCapabilities: ["x"] },
      agents
    );

    expect(result[0]!.agentId).toBe("good");
    expect(result[0]!.score).toBeGreaterThan(result[1]!.score);
  });
});

// ============================================================================
// Integration — Full Scoring
// ============================================================================

describe("CapabilityMatcher — Integration", () => {
  it("specialist beats generalist when skills/capabilities are specific", () => {
    const agents: AgentProfile[] = [
      {
        agentId: "specialist",
        capabilities: ["ml", "data-analysis"],
        skills: ["tensorflow", "pytorch"],
        currentLoad: 1,
        domain: "machine learning",
        successRate: 0.9,
      },
      {
        agentId: "generalist",
        capabilities: ["writing", "review"],
        skills: ["markdown"],
        currentLoad: 0,
        domain: "technical writing",
        successRate: 0.8,
      },
    ];

    const result = matcher.match(
      {
        description: "Train ML model on user data",
        domain: "machine learning",
        requiredCapabilities: ["ml", "data-analysis"],
        requiredSkills: ["tensorflow"],
      },
      agents
    );

    expect(result[0]!.agentId).toBe("specialist");
    expect(result[0]!.score).toBeGreaterThan(result[1]!.score);
  });

  it("multiple agents with same domain ranked by load and history", () => {
    const agents: AgentProfile[] = [
      { agentId: "dev1", capabilities: ["coding"], skills: ["react"], currentLoad: 3, domain: "frontend", successRate: 0.7 },
      { agentId: "dev2", capabilities: ["coding"], skills: ["react"], currentLoad: 1, domain: "frontend", successRate: 0.9 },
      { agentId: "dev3", capabilities: ["coding"], skills: ["react"], currentLoad: 0, domain: "frontend", successRate: 0.5 },
    ];

    const result = matcher.match(
      {
        description: "Build React component",
        domain: "frontend",
        requiredCapabilities: ["coding"],
        requiredSkills: ["react"],
      },
      agents
    );

    // dev2 has low load + high history → should win over dev3 (no history) and dev1 (high load)
    expect(result[0]!.agentId).toBe("dev2");
  });

  it("breakdown reflects all dimensions", () => {
    const agents: AgentProfile[] = [
      {
        agentId: "full",
        capabilities: ["analysis"],
        skills: ["pandas"],
        currentLoad: 2,
        domain: "data science",
        successRate: 0.85,
      },
    ];

    const result = matcher.match(
      {
        description: "Analyze dataset",
        domain: "data science",
        requiredCapabilities: ["analysis"],
        requiredSkills: ["pandas"],
      },
      agents
    );

    const b = result[0]!.breakdown;
    expect(b.domainMatch).toBe(1);
    expect(b.skillMatch).toBe(1);
    expect(b.capabilityMatch).toBe(1);
    expect(b.loadScore).toBeGreaterThan(0.7);
    expect(b.historyScore).toBe(0.85);
  });
});
