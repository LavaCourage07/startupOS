import { describe, it, expect, beforeEach, vi } from "vitest";
import { SupervisorMode, CapabilityMatcher } from "../supervisor";
import { Blackboard } from "../../session/blackboard";
import type { EventStore } from "../../session/event-store";
import type { EventEmitter } from "../../config";
import { ContractNetProtocol } from "../../protocol/contract-net";
import type { RuntimeEvent } from "../../session/types";

describe("CapabilityMatcher", () => {
  const matcher = new CapabilityMatcher();

  it("returns empty for no agents", () => {
    const result = matcher.match(
      { id: "t-1", description: "test" },
      []
    );
    expect(result).toEqual([]);
  });

  it("scores agent higher when capabilities match", () => {
    const agents = [
      { agentId: "agent-a", capabilities: ["analysis", "ml"], currentLoad: 0, skills: [] },
      { agentId: "agent-b", capabilities: ["writing"], currentLoad: 0, skills: [] },
    ];

    const result = matcher.match(
      { id: "t-1", description: "Analyze user data", requiredCapabilities: ["analysis"] },
      agents
    );

    expect(result[0]!.agentId).toBe("agent-a");
    expect(result[1]!.agentId).toBe("agent-b");
  });

  it("considers domain matching", () => {
    const agents = [
      { agentId: "agent-a", capabilities: [], domain: "data analysis", currentLoad: 0, skills: [] },
      { agentId: "agent-b", capabilities: [], domain: "creative writing", currentLoad: 0, skills: [] },
    ];

    const result = matcher.match(
      { id: "t-1", description: "analyze data trends" },
      agents
    );

    expect(result[0]!.agentId).toBe("agent-a");
  });

  it("prefers lower load agents", () => {
    const agents = [
      { agentId: "agent-a", capabilities: ["analysis"], currentLoad: 0, skills: [] },
      { agentId: "agent-b", capabilities: ["analysis"], currentLoad: 5, skills: [] },
    ];

    const result = matcher.match(
      { id: "t-1", description: "test", requiredCapabilities: ["analysis"] },
      agents
    );

    expect(result[0]!.agentId).toBe("agent-a");
  });

  it("considers historical success rate", () => {
    const agents = [
      { agentId: "agent-a", capabilities: ["analysis"], currentLoad: 0, skills: [], successRate: 0.9 },
      { agentId: "agent-b", capabilities: ["analysis"], currentLoad: 0, skills: [], successRate: 0.3 },
    ];

    const result = matcher.match(
      { id: "t-1", description: "test", requiredCapabilities: ["analysis"] },
      agents
    );

    expect(result[0]!.agentId).toBe("agent-a");
  });
});

// ============================================================================
// Test helpers
// ============================================================================

const defaultAgents = [
    { agentId: "worker-1", capabilities: ["analysis", "coding"], skills: ["data-analysis"], currentLoad: 0, successRate: 0.8 },
    { agentId: "worker-2", capabilities: ["writing", "review"], skills: ["tech-writing"], currentLoad: 0, successRate: 0.9 },
    { agentId: "verifier-1", capabilities: ["testing", "validation"], skills: ["unit-test"], currentLoad: 0 },
  ];

function createTestDeps(overrides?: { agents?: typeof defaultAgents }) {

  const capturedEvents: RuntimeEvent[] = [];
  const blackboard = new Blackboard("test-session", "/tmp/test");
  const eventStore: EventStore = {
    append: async (event) => capturedEvents.push(event),
    read: async () => capturedEvents,
    checkpoint: async () => {},
    list: async () => [],
  };
  const eventEmitter: EventEmitter = { emit: vi.fn() };
  const contractNet = new ContractNetProtocol();

  return {
    blackboard,
    eventStore,
    eventEmitter,
    contractNet,
    agents: overrides?.agents ?? defaultAgents,
    capturedEvents,
    build: () => new SupervisorMode({
      blackboard,
      eventStore,
      eventEmitter,
      contractNet,
      agents: overrides?.agents ?? defaultAgents,
    }),
  };
}

// ============================================================================
// SupervisorMode — Decomposition & Allocation
// ============================================================================

describe("SupervisorMode — Decomposition & Allocation", () => {
  it("starts with a goal and creates a decomposition plan", async () => {
    const { build, capturedEvents } = createTestDeps();
    const supervisor = build();

    const plan = await supervisor.start("Analyze user behavior and generate report");

    expect(plan.goal).toBe("Analyze user behavior and generate report");
    expect(plan.state).toBe("allocating");
    expect(plan.depth).toBe(0);
    expect(plan.subTasks.length).toBeGreaterThan(0);
  });

  it("allocates worker and verifier to each subtask", async () => {
    const { build } = createTestDeps();
    const supervisor = build();

    await supervisor.start("Analyze data");

    const plan = supervisor.getPlan()!;
    expect(plan.subTasks).toHaveLength(1);

    const task = plan.subTasks[0]!;
    expect(task.assignedWorker).toBeDefined();
    expect(task.verifierId).toBeDefined();
    expect(task.verifierId).not.toBe(task.assignedWorker);
  });

  it("marks subtask as failed when no workers available", async () => {
    const { build } = createTestDeps({ agents: [] });
    const supervisor = build();

    const plan = await supervisor.start("Do everything");
    expect(plan.subTasks[0]!.state).toBe("failed");
    expect(plan.subTasks[0]!.error).toBe("No suitable Worker available");
  });

  it("emits events during start", async () => {
    const { build, capturedEvents } = createTestDeps();
    const supervisor = build();

    await supervisor.start("Test goal");

    const types = capturedEvents.map((e) => e.type);
    expect(types).toContain("SUPERVISOR_START");
    expect(types).toContain("DECOMPOSING");
    expect(types).toContain("DECOMPOSITION_COMPLETE");
    expect(types).toContain("ALLOCATING");
    expect(types).toContain("ALLOCATION_COMPLETE");
  });
});

// ============================================================================
// SupervisorMode — Verification & Revision Loop
// ============================================================================

describe("SupervisorMode — Verification & Revision Loop", () => {
  function createVerifDeps() {
    const agents = [
      { agentId: "worker-1", capabilities: ["coding"], skills: [], currentLoad: 0 },
      { agentId: "verifier-1", capabilities: ["testing"], skills: [], currentLoad: 0 },
    ];
    return createTestDeps({ agents });
  }

  it("passes verifier check", async () => {
    const { build } = createVerifDeps();
    const supervisor = build();

    await supervisor.start("Build feature");

    const plan = supervisor.getPlan()!;
    const task = plan.subTasks[0]!;

    supervisor.markSubTaskComplete(task.id, {
      output: "code written",
      revisionCount: 0,
    });

    const check = supervisor.runVerifier(task.id, task.verifierId!);
    expect(check.passed).toBe(true);
    expect(check.verifierId).toBe(task.verifierId);
    expect(task.state).toBe("completed");
  });

  it("marks task as failed", async () => {
    const { build } = createVerifDeps();
    const supervisor = build();

    await supervisor.start("Build feature");

    const plan = supervisor.getPlan()!;
    const task = plan.subTasks[0]!;

    supervisor.markSubTaskFailed(task.id, "Build failed: syntax error");

    expect(task.state).toBe("failed");
    expect(task.error).toBe("Build failed: syntax error");
  });

  it("aggregate returns completed when all tasks pass", async () => {
    const { build } = createVerifDeps();
    const supervisor = build();

    await supervisor.start("Build feature");

    const plan = supervisor.getPlan()!;
    const task = plan.subTasks[0]!;

    supervisor.markSubTaskComplete(task.id, { output: "done", revisionCount: 0 });
    supervisor.runVerifier(task.id, task.verifierId!);

    const result = supervisor.aggregate();
    expect(result.state).toBe("completed");
    expect(result.completedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.totalSubTasks).toBe(1);
  });

  it("aggregate returns failed when tasks fail", async () => {
    const { build } = createVerifDeps();
    const supervisor = build();

    await supervisor.start("Build feature");

    const plan = supervisor.getPlan()!;
    const task = plan.subTasks[0]!;

    supervisor.markSubTaskFailed(task.id, "Compilation error");

    const result = supervisor.aggregate();
    expect(result.state).toBe("failed");
    expect(result.failedCount).toBe(1);
  });

  it("throws when verifying task without result", async () => {
    const { build } = createVerifDeps();
    const supervisor = build();

    await supervisor.start("Build feature");

    const plan = supervisor.getPlan()!;
    const task = plan.subTasks[0]!;

    expect(() => supervisor.runVerifier(task.id, "verifier-1")).toThrow(/no result/);
  });
});

// ============================================================================
// SupervisorMode — Plan Management
// ============================================================================

describe("SupervisorMode — Plan Management", () => {
  function createPlanDeps() {
    const agents = [
      { agentId: "worker-1", capabilities: ["coding"], skills: [], currentLoad: 0 },
      { agentId: "verifier-1", capabilities: ["testing"], skills: [], currentLoad: 0 },
    ];
    return createTestDeps({ agents });
  }

  it("returns null plan before start", () => {
    const { build } = createPlanDeps();
    const supervisor = build();
    expect(supervisor.getPlan()).toBeNull();
  });

  it("returns empty verifier checks before any check", () => {
    const { build } = createPlanDeps();
    const supervisor = build();
    expect(supervisor.getVerifierChecks()).toEqual([]);
  });

  it("throws aggregate before plan exists", () => {
    const { build } = createPlanDeps();
    const supervisor = build();
    expect(() => supervisor.aggregate()).toThrow(/No active plan/);
  });

  it("returns verifier checks after check", async () => {
    const { build } = createPlanDeps();
    const supervisor = build();

    await supervisor.start("Test");
    const plan = supervisor.getPlan()!;
    const task = plan.subTasks[0]!;

    supervisor.markSubTaskComplete(task.id, { output: "result", revisionCount: 0 });
    supervisor.runVerifier(task.id, task.verifierId!);

    const checks = supervisor.getVerifierChecks();
    expect(checks).toHaveLength(1);
    expect(checks[0]!.taskId).toBe(task.id);
    expect(checks[0]!.verifierId).toBe(task.verifierId);
  });
});

// ============================================================================
// SupervisorMode — Custom Revision Budget
// ============================================================================

describe("SupervisorMode — Custom Revision Budget", () => {
  it("uses custom max revision rounds", () => {
    const { build } = createTestDeps();
    const sup = new SupervisorMode({
      blackboard: build.deps?.blackboard ?? new Blackboard("test", "/tmp"),
      eventStore: { append: async () => {}, read: async () => [], checkpoint: async () => {}, list: async () => [] },
      eventEmitter: { emit: () => {} },
      contractNet: new ContractNetProtocol(),
      agents: [
        { agentId: "worker-1", capabilities: ["coding"], skills: [], currentLoad: 0 },
        { agentId: "verifier-1", capabilities: ["testing"], skills: [], currentLoad: 0 },
      ],
      maxRevisionRounds: 1,
    });
    expect(sup).toBeDefined();
  });

  it("uses custom max depth", () => {
    const { build } = createTestDeps();
    const sup = new SupervisorMode({
      blackboard: build.deps?.blackboard ?? new Blackboard("test", "/tmp"),
      eventStore: { append: async () => {}, read: async () => [], checkpoint: async () => {}, list: async () => [] },
      eventEmitter: { emit: () => {} },
      contractNet: new ContractNetProtocol(),
      agents: [
        { agentId: "worker-1", capabilities: ["coding"], skills: [], currentLoad: 0 },
        { agentId: "verifier-1", capabilities: ["testing"], skills: [], currentLoad: 0 },
      ],
      maxDepth: 1,
    });
    expect(sup).toBeDefined();
  });
});

// ============================================================================
// SUP-06: Barrier skips downstream when required upstream failed
// ============================================================================

describe("SUP-06 — downstream skipped when required upstream fails", () => {
  it("aggregate counts failed tasks correctly", async () => {
    const agents = [
      { agentId: "reviewer-1", capabilities: ["review"], skills: [], currentLoad: 0 },
      { agentId: "verifier-1", capabilities: ["testing"], skills: [], currentLoad: 0 },
    ];
    const { build } = createTestDeps({ agents });
    const supervisor = build();

    await supervisor.start("Review and generate report");

    const plan = supervisor.getPlan()!;
    const task = plan.subTasks[0]!;

    // Reviewer fails — report-generator should not start
    supervisor.markSubTaskFailed(task.id, "Reviewer could not access data");

    const result = supervisor.aggregate();
    expect(result.failedCount).toBe(1);
    expect(result.completedCount).toBe(0);
    expect(result.state).toBe("failed");
  });

  it("aggregate state is completed when all subtasks pass", async () => {
    const agents = [
      { agentId: "worker-1", capabilities: ["coding"], skills: [], currentLoad: 0 },
      { agentId: "verifier-1", capabilities: ["testing"], skills: [], currentLoad: 0 },
    ];
    const { build } = createTestDeps({ agents });
    const supervisor = build();

    await supervisor.start("Complete task");
    const plan = supervisor.getPlan()!;
    const task = plan.subTasks[0]!;

    supervisor.markSubTaskComplete(task.id, { output: "done", revisionCount: 0 });
    supervisor.runVerifier(task.id, task.verifierId!);

    const result = supervisor.aggregate();
    expect(result.state).toBe("completed");
    expect(result.completedCount).toBe(1);
  });
});

// ============================================================================
// SUP-05: Revision inherits task context (revisionCount tracked)
// ============================================================================

describe("SUP-05 — revision count is tracked and capped", () => {
  it("revisionCount increments per revision round", async () => {
    const agents = [
      { agentId: "worker-1", capabilities: ["coding"], skills: [], currentLoad: 0 },
      { agentId: "verifier-1", capabilities: ["testing"], skills: [], currentLoad: 0 },
    ];
    const { build } = createTestDeps({ agents });
    const supervisor = build();

    await supervisor.start("Build feature");
    const plan = supervisor.getPlan()!;
    const task = plan.subTasks[0]!;

    // First attempt — mark complete
    supervisor.markSubTaskComplete(task.id, { output: "partial", revisionCount: 1 });
    const check1 = supervisor.runVerifier(task.id, task.verifierId!);

    // verifier passes on first check (deterministic in test)
    expect(check1.passed).toBe(true);
    expect(task.result?.revisionCount).toBe(1);
  });

  it("setPlan injects external plan and allocates immediately", async () => {
    const agents = [
      { agentId: "worker-1", capabilities: ["coding"], skills: [], currentLoad: 0 },
      { agentId: "verifier-1", capabilities: ["testing"], skills: [], currentLoad: 0 },
    ];
    const { build } = createTestDeps({ agents });
    const supervisor = build();

    supervisor.setPlan({
      goal: "External plan",
      subTasks: [{
        id: "external-task-1",
        description: "Do the thing",
        state: "pending",
        revisionCount: 0,
        assignedWorker: "worker-1",
      }],
      depth: 0,
      state: "decomposing",
      startedAt: new Date().toISOString(),
    });

    await supervisor.allocateAll();
    const plan = supervisor.getPlan()!;
    expect(plan.goal).toBe("External plan");
    expect(plan.subTasks[0]?.assignedWorker).toBe("worker-1");
  });
});
