import { describe, it, expect, beforeEach } from "vitest";
import { DagExecutor } from "../dag-executor";
import type { CollaborationTopology } from "../../session/types";
import type { EventStore } from "../../session/event-store";
import type { RuntimeEvent } from "../../session/types";

// ============================================================================
// Mock EventStore
// ============================================================================

class MockEventStore implements EventStore {
  events: RuntimeEvent[] = [];
  async append(event: RuntimeEvent): Promise<void> {
    this.events.push(event);
  }
  async read(): Promise<RuntimeEvent[]> { return [...this.events]; }
  async checkpoint(): Promise<void> {}
  async list(): Promise<string[]> { return []; }
}

describe("DAG Executor — Story 9.8", () => {
  let eventStore: MockEventStore;

  beforeEach(() => {
    eventStore = new MockEventStore();
  });

  // ==========================================================================
  // Linear A→B→C
  // ==========================================================================

  it("executes A→B→C linear topology in correct order", async () => {
    const order: string[] = [];
    const executor = new DagExecutor(
      eventStore,
      async (agentId) => {
        order.push(agentId);
        return { status: "completed" };
      }
    );

    const topology: CollaborationTopology = {
      agents: {
        a: { id: "a", name: "A", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
        b: { id: "b", name: "B", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
        c: { id: "c", name: "C", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
      },
      edges: [
        { from: "a", to: "b", type: "trigger", description: "" },
        { from: "b", to: "c", type: "trigger", description: "" },
      ],
      entryPoints: ["a"],
      exitPoints: ["c"],
      mode: "workflow",
    };

    const result = await executor.execute(topology);

    expect(result.status).toBe("completed");
    expect(order).toEqual(["a", "b", "c"]);
    expect(result.completedAgents).toEqual(["a", "b", "c"]);
    expect(result.failedAgents).toEqual([]);
    expect(eventStore.events.length).toBeGreaterThan(0);
  });

  // ==========================================================================
  // Parallel B/C + D aggregator
  // ==========================================================================

  it("executes B/C in parallel then D", async () => {
    const started: string[] = [];
    const executor = new DagExecutor(
      eventStore,
      async (agentId) => {
        started.push(agentId);
        return { status: "completed" };
      }
    );

    const topology: CollaborationTopology = {
      agents: {
        a: { id: "a", name: "A", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
        b: { id: "b", name: "B", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
        c: { id: "c", name: "C", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
        d: { id: "d", name: "D", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
      },
      edges: [
        { from: "a", to: "b", type: "trigger", description: "" },
        { from: "a", to: "c", type: "trigger", description: "" },
        { from: "b", to: "d", type: "trigger", description: "" },
        { from: "c", to: "d", type: "trigger", description: "" },
      ],
      entryPoints: ["a"],
      exitPoints: ["d"],
      mode: "workflow",
    };

    const result = await executor.execute(topology);

    expect(result.status).toBe("completed");
    expect(result.completedAgents).toEqual(["a", "b", "c", "d"]);
    // A must complete before B and C
    expect(started.indexOf("a")).toBeLessThan(started.indexOf("b"));
    expect(started.indexOf("a")).toBeLessThan(started.indexOf("c"));
    // B and C must complete before D
    expect(started.indexOf("b")).toBeLessThan(started.indexOf("d"));
    expect(started.indexOf("c")).toBeLessThan(started.indexOf("d"));
  });

  // ==========================================================================
  // Upstream failure
  // ==========================================================================

  it("does not trigger downstream when upstream fails", async () => {
    const executed: string[] = [];
    const executor = new DagExecutor(
      eventStore,
      async (agentId) => {
        executed.push(agentId);
        if (agentId === "b") return { status: "failed" };
        return { status: "completed" };
      },
      { timeoutMs: 5000 }
    );

    const topology: CollaborationTopology = {
      agents: {
        a: { id: "a", name: "A", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
        b: { id: "b", name: "B", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
        c: { id: "c", name: "C", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
      },
      edges: [
        { from: "a", to: "b", type: "trigger", description: "" },
        { from: "b", to: "c", type: "trigger", description: "" },
      ],
      entryPoints: ["a"],
      exitPoints: ["c"],
      mode: "workflow",
    };

    const result = await executor.execute(topology);

    expect(result.status).toBe("failed");
    expect(executed).toContain("a");
    expect(executed).toContain("b");
    expect(executed).not.toContain("c"); // C should not execute
    expect(result.failedAgents).toContain("b");
    expect(result.failedAgents).toContain("c"); // C marked as blocked
  });

  // ==========================================================================
  // Timeout
  // ==========================================================================

  it("terminates execution after timeout", async () => {
    const executor = new DagExecutor(
      eventStore,
      async (_agentId) => {
        // Sleep longer than timeout so the executor detects timeout first
        await new Promise((r) => setTimeout(r, 500));
        return { status: "completed" };
      },
      { timeoutMs: 30 }
    );

    const topology: CollaborationTopology = {
      agents: {
        a: { id: "a", name: "A", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
        b: { id: "b", name: "B", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
        c: { id: "c", name: "C", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
      },
      edges: [
        { from: "a", to: "b", type: "trigger", description: "" },
        { from: "b", to: "c", type: "trigger", description: "" },
      ],
      entryPoints: ["a"],
      exitPoints: ["c"],
      mode: "workflow",
    };

    const result = await executor.execute(topology);

    expect(result.status).toBe("timed_out");
  });

  // ==========================================================================
  // Events written to EventStore
  // ==========================================================================

  it("writes all events to EventStore", async () => {
    const executor = new DagExecutor(
      eventStore,
      async () => ({ status: "completed" })
    );

    const topology: CollaborationTopology = {
      agents: {
        a: { id: "a", name: "A", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
        b: { id: "b", name: "B", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
      },
      edges: [
        { from: "a", to: "b", type: "trigger", description: "" },
      ],
      entryPoints: ["a"],
      exitPoints: ["b"],
      mode: "workflow",
    };

    await executor.execute(topology);

    const storedEvents = await eventStore.read();
    expect(storedEvents.length).toBeGreaterThan(0);
    expect(storedEvents.some((e) => e.type === "AGENT_THINKING")).toBe(true);
    expect(storedEvents.some((e) => e.type === "AGENT_COMPLETE_TASK")).toBe(true);
    expect(storedEvents.some((e) => e.type === "SESSION_COMPLETE")).toBe(true);
  });
});

// ============================================================================
// HITL — Human-in-the-Loop: waiting → resume → downstream consumes real output
// Story 9.27 ARCH-RT-04 验收测试
// ============================================================================

describe("DAG Executor — HITL (Story 9.27 ARCH-RT-04)", () => {
  let eventStore: MockEventStore;

  beforeEach(() => {
    eventStore = new MockEventStore();
  });

  it("pauses node on waiting result and does not trigger downstream", async () => {
    const executedAgents: string[] = [];
    const executor = new DagExecutor(
      eventStore,
      async (agentId) => {
        executedAgents.push(agentId);
        if (agentId === "a") {
          return { status: "waiting", reviewRequest: { question: "Confirm action?" } };
        }
        return { status: "completed", output: `${agentId}-output` };
      },
      { timeoutMs: 500 }
    );

    const topology: CollaborationTopology = {
      agents: {
        a: { id: "a", name: "A", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
        b: { id: "b", name: "B", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
      },
      edges: [{ from: "a", to: "b", type: "trigger", description: "" }],
      entryPoints: ["a"],
      exitPoints: ["b"],
      mode: "workflow",
    };

    const resultPromise = executor.execute(topology);

    // Give executor time to reach "waiting" state
    await new Promise((r) => setTimeout(r, 50));

    const storedEvents = await eventStore.read();
    expect(storedEvents.some((e) => e.type === "HUMAN_REVIEW_REQUEST")).toBe(true);
    expect(executedAgents).not.toContain("b"); // downstream must NOT run yet

    // Let it timeout (500ms)
    const result = await resultPromise;
    expect(result.status).toBe("timed_out");
    expect(executedAgents).not.toContain("b");
  });

  it("resumes node and downstream executes after resume", async () => {
    let resumeCallCount = 0;
    const downstreamExecuted: boolean[] = [];

    const executor = new DagExecutor(
      eventStore,
      async (agentId) => {
        if (agentId === "a") {
          resumeCallCount++;
          if (resumeCallCount === 1) {
            return { status: "waiting", reviewRequest: { question: "Proceed with analysis?" } };
          }
          return { status: "completed", output: "analyst-result" };
        }
        if (agentId === "b") {
          downstreamExecuted.push(true);
          return { status: "completed", output: "b-output" };
        }
        return { status: "completed" };
      },
      { timeoutMs: 3000 }
    );

    const topology: CollaborationTopology = {
      agents: {
        a: { id: "a", name: "A", domain: "d", responsibility: "analyst", capabilities: [], dataOperations: {}, skills: [] },
        b: { id: "b", name: "B", domain: "d", responsibility: "consumer", capabilities: [], dataOperations: {}, skills: [] },
      },
      edges: [{ from: "a", to: "b", type: "trigger", description: "" }],
      entryPoints: ["a"],
      exitPoints: ["b"],
      mode: "workflow",
    };

    const resultPromise = executor.execute(topology);

    await new Promise((r) => setTimeout(r, 50));

    const eventsBeforeResume = await eventStore.read();
    expect(eventsBeforeResume.some((e) => e.type === "HUMAN_REVIEW_REQUEST")).toBe(true);
    expect(downstreamExecuted).toHaveLength(0);

    executor.resumeNode("a", "approved — proceed");

    const result = await resultPromise;

    expect(result.status).toBe("completed");
    expect(result.completedAgents).toContain("a");
    expect(result.completedAgents).toContain("b");
    expect(downstreamExecuted).toHaveLength(1);

    const allEvents = await eventStore.read();
    expect(allEvents.some((e) => e.type === "HUMAN_REVIEW_REQUEST")).toBe(true);
    expect(allEvents.some((e) => e.type === "HUMAN_REVIEW_RESPONSE")).toBe(true);
    expect(allEvents.some((e) => e.type === "SESSION_COMPLETE")).toBe(true);
  });

  it("agentExecutor is called a second time after resume (not bypassed)", async () => {
    const calls: string[] = [];

    const executor = new DagExecutor(
      eventStore,
      async (agentId) => {
        calls.push(agentId);
        const callNumber = calls.filter((c) => c === agentId).length;
        if (agentId === "a" && callNumber === 1) {
          return { status: "waiting", reviewRequest: { question: "Review needed" } };
        }
        return { status: "completed", output: `${agentId}-call${callNumber}` };
      },
      { timeoutMs: 3000 }
    );

    const topology: CollaborationTopology = {
      agents: {
        a: { id: "a", name: "A", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
        b: { id: "b", name: "B", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
      },
      edges: [{ from: "a", to: "b", type: "trigger", description: "" }],
      entryPoints: ["a"],
      exitPoints: ["b"],
      mode: "workflow",
    };

    const resultPromise = executor.execute(topology);
    await new Promise((r) => setTimeout(r, 50));

    executor.resumeNode("a", "user approved");

    const result = await resultPromise;

    expect(result.status).toBe("completed");
    // "a" called twice: first → waiting, second (after resume) → completed
    expect(calls.filter((c) => c === "a")).toHaveLength(2);
    // "b" called once after "a" completed on 2nd call
    expect(calls.filter((c) => c === "b")).toHaveLength(1);
  });

  it("blackboard records resume response", async () => {
    const blackboardData = new Map<string, unknown>();
    const mockBlackboard = {
      setData: (key: string, value: unknown) => { blackboardData.set(key, value); },
      getData: (key: string) => blackboardData.get(key) ?? null,
    };

    let firstCall = true;
    const executor = new DagExecutor(
      eventStore,
      async (agentId) => {
        if (agentId === "a" && firstCall) {
          firstCall = false;
          return { status: "waiting", reviewRequest: { question: "Check this?" } };
        }
        return { status: "completed", output: "done" };
      },
      {
        timeoutMs: 3000,
        blackboard: mockBlackboard as unknown as import("../../session/blackboard").Blackboard,
      }
    );

    const topology: CollaborationTopology = {
      agents: {
        a: { id: "a", name: "A", domain: "d", responsibility: "test", capabilities: [], dataOperations: {}, skills: [] },
      },
      edges: [],
      entryPoints: ["a"],
      exitPoints: ["a"],
      mode: "workflow",
    };

    const resultPromise = executor.execute(topology);
    await new Promise((r) => setTimeout(r, 50));

    executor.resumeNode("a", "user confirmed");

    await resultPromise;

    expect(blackboardData.get("node:a:resume")).toEqual({ response: "user confirmed" });
    expect(blackboardData.has("node:a:output")).toBe(true);
  });
});
