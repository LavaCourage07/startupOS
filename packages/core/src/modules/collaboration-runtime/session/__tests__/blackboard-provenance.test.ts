import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { Blackboard } from "../blackboard";
import type { RuntimeEvent } from "../types";

describe("Blackboard — Provenance & Correction", () => {
  let bb: Blackboard;
  let snapshotDir: string;

  beforeEach(async () => {
    snapshotDir = await mkdtemp(path.join(os.tmpdir(), "originos-bb-"));
    bb = new Blackboard("test-session", snapshotDir);
  });

  // ==========================================================================
  // setData / getData with provenance
  // ==========================================================================

  it("wraps values with provenance on setData", () => {
    bb.setData("key1", { value: "test" }, "agent-a", {
      sourceUri: "tool://read_file",
    });

    expect(bb.getData("key1")).toEqual({ value: "test" });

    const entry = bb.getDataEntry("key1");
    expect(entry).toBeDefined();
    expect(entry!.provenance.writer).toBe("agent-a");
    expect(entry!.provenance.version).toBe(1);
    expect(entry!.provenance.sourceUri).toBe("tool://read_file");
    expect(entry!.corrections).toEqual([]);
  });

  it("increments version on repeated writes", () => {
    bb.setData("key1", "v1", "agent-a");
    bb.setData("key1", "v2", "agent-b");
    bb.setData("key1", "v3", "agent-c");

    const entry = bb.getDataEntry("key1");
    expect(entry!.provenance.version).toBe(3);
    expect(entry!.provenance.writer).toBe("agent-c");
    expect(bb.getData("key1")).toBe("v3");
  });

  it("records toolCallsCited in provenance", () => {
    bb.setData("facts", ["a", "b"], "agent-a", {
      toolCallsCited: ["call-1", "call-2"],
    });

    const prov = bb.getProvenance("facts");
    expect(prov!.toolCallsCited).toEqual(["call-1", "call-2"]);
  });

  // ==========================================================================
  // Event sourcing rebuilds provenance
  // ==========================================================================

  it("rebuilds state from BLACKBOARD_WRITE events with provenance", () => {
    const events: RuntimeEvent[] = [
      {
        id: "evt-1",
        sessionId: "test-session",
        seq: 1,
        type: "AGENT_REGISTERED",
        payload: {},
        source: "agent-a",
        timestamp: "2026-05-13T10:00:00Z",
      },
      {
        id: "evt-2",
        sessionId: "test-session",
        seq: 2,
        type: "BLACKBOARD_WRITE",
        payload: { key: "status", value: "active", sourceUri: "tool://check" },
        source: "agent-a",
        timestamp: "2026-05-13T10:00:01Z",
      },
    ];

    bb.fromEvents(events);

    expect(bb.getData("status")).toBe("active");
    const prov = bb.getProvenance("status");
    expect(prov!.writer).toBe("agent-a");
    expect(prov!.version).toBe(1);
    expect(prov!.sourceUri).toBe("tool://check");
    expect(prov!.timestamp).toBe("2026-05-13T10:00:01Z");
  });

  it("rebuilds from multiple BLACKBOARD_WRITE/UPDATE events", () => {
    const events: RuntimeEvent[] = [
      {
        id: "evt-1",
        sessionId: "test-session",
        seq: 1,
        type: "AGENT_REGISTERED",
        payload: {},
        source: "agent-x",
        timestamp: "2026-05-13T10:00:00Z",
      },
      {
        id: "evt-2",
        sessionId: "test-session",
        seq: 2,
        type: "BLACKBOARD_WRITE",
        payload: { key: "count", value: 1 },
        source: "agent-x",
        timestamp: "2026-05-13T10:00:01Z",
      },
      {
        id: "evt-3",
        sessionId: "test-session",
        seq: 3,
        type: "BLACKBOARD_UPDATE",
        payload: { key: "count", value: 5 },
        source: "agent-y",
        timestamp: "2026-05-13T10:00:02Z",
      },
    ];

    bb.fromEvents(events);

    const entry = bb.getDataEntry("count");
    expect(entry!.value).toBe(5);
    expect(entry!.provenance.version).toBe(2);
    expect(entry!.provenance.writer).toBe("agent-y");
  });

  // ==========================================================================
  // Append-only correction
  // ==========================================================================

  it("creates correction entry without overwriting provenance history", () => {
    bb.setData("result", "wrong", "agent-a");

    const originalVersion = bb.getProvenance("result")!.version;

    bb.correctData(
      "result",
      "correct",
      "verifier-b",
      "Agent A hallucinated the count"
    );

    // Effective value updated
    expect(bb.getData("result")).toBe("correct");

    // Correction recorded
    const corrections = bb.getCorrections("result");
    expect(corrections).toHaveLength(1);
    expect(corrections[0]?.correctedBy).toBe("verifier-b");
    expect(corrections[0]?.reason).toBe("Agent A hallucinated the count");
    expect(corrections[0]?.newValue).toBe("correct");

    // Version incremented (not replaced)
    expect(bb.getProvenance("result")!.version).toBe(originalVersion + 1);

    // New provenance points to correction source
    expect(bb.getProvenance("result")!.sourceUri).toMatch(/^correction:\/\//);
  });

  it("throws if correcting non-existent key", () => {
    expect(() => bb.correctData("nonexistent", "x", "agent-b", "reason")).toThrow(
      'does not exist to correct'
    );
  });

  it("supports chained corrections", () => {
    bb.setData("data", "v1", "agent-a");
    bb.correctData("data", "v2", "verifier-b", "v1 was wrong");
    bb.correctData("data", "v3", "verifier-c", "v2 was incomplete");

    expect(bb.getData("data")).toBe("v3");
    expect(bb.getCorrections("data")).toHaveLength(2);
    expect(bb.getProvenance("data")!.version).toBe(3);
  });

  // ==========================================================================
  // Lock enforcement still works
  // ==========================================================================

  it("respects locks with provenance-aware setData", () => {
    bb.lock("locked-key", "agent-a");
    expect(() => bb.setData("locked-key", "x", "agent-b")).toThrow(
      'is locked by'
    );

    // Holder can still write
    bb.setData("locked-key", "y", "agent-a");
    expect(bb.getData("locked-key")).toBe("y");
  });

  // ==========================================================================
  // Snapshot / restore preserves provenance
  // ==========================================================================

  it("toState includes provenance in sharedData", () => {
    bb.setData("x", 42, "agent-a", { sourceUri: "tool://calc" });

    const state = bb.toState();
    const entry = state.sharedData["x"];
    expect(entry!.value).toBe(42);
    expect(entry!.provenance.writer).toBe("agent-a");
    expect(entry!.provenance.sourceUri).toBe("tool://calc");
    expect(entry!.provenance.version).toBe(1);
  });

  it("stores artifact refs with provenance metadata", () => {
    const ref = bb.setArtifact("review-report", { path: "wiki/review.md" }, "reviewer-a", {
      sourceTaskId: "subtask-review",
    });

    const artifact = bb.getArtifact("review-report");
    expect(ref).toBe("artifact://test-session/review-report");
    expect(artifact).toBeDefined();
    expect(artifact!.ref).toBe(ref);
    expect(artifact!.sourceTaskId).toBe("subtask-review");
    expect(artifact!.provenance).toEqual({
      writer: "reviewer-a",
      timestamp: artifact!.createdAt,
      sourceTaskId: "subtask-review",
    });
  });

  it("persists artifact refs across snapshot and reload", async () => {
    const ref = bb.setArtifact("design-spec", { path: "ontology/data-import-spec.md" }, "design-data-import", {
      sourceTaskId: "subtask-import",
    });

    await bb.snapshot();
    const restored = await Blackboard.loadSnapshot("test-session", snapshotDir);

    expect(restored).not.toBeNull();
    const artifact = restored?.getArtifact("design-spec");
    expect(artifact?.ref).toBe(ref);
    expect(artifact?.sourceTaskId).toBe("subtask-import");
    expect(artifact?.provenance?.writer).toBe("design-data-import");
    await rm(snapshotDir, { recursive: true, force: true });
  });
});
