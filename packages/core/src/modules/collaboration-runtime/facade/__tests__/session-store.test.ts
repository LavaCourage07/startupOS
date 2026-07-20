/**
 * Tests for facade/session-store — Session CRUD and ID generation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { generateId, sessions, createSession } from "../session-store";
import type { EventEmitter } from "../../../../modules/collaboration-runtime";

// Minimal stub emitter
const stubEmitter: EventEmitter = {
  emit: () => {},
  on: () => {},
  off: () => {},
};

describe("generateId", () => {
  it("returns a string starting with cs-", () => {
    const id = generateId();
    expect(id).toMatch(/^cs-\d+-[a-z0-9]{6}$/);
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });
});

describe("createSession", () => {
  beforeEach(() => {
    sessions.clear();
  });

  it("stores session in memory map", async () => {
    const session = await createSession({ projectId: "test-proj" }, stubEmitter);
    expect(sessions.has(session.id)).toBe(true);
  });

  it("sets status to created", async () => {
    const session = await createSession({ projectId: "test-proj" }, stubEmitter);
    expect(session.status).toBe("created");
  });

  it("normalizes projectId with proj- prefix", async () => {
    const session = await createSession({ projectId: "myproject" }, stubEmitter);
    expect(session.projectId).toBe("proj-myproject");
  });

  it("does not double-prefix projectId", async () => {
    const session = await createSession({ projectId: "proj-myproject" }, stubEmitter);
    expect(session.projectId).toBe("proj-myproject");
  });

  it("propagates globalGoal", async () => {
    const session = await createSession(
      { projectId: "p1", globalGoal: "Build something" },
      stubEmitter
    );
    expect(session.globalGoal).toBe("Build something");
  });

  it("stores config fields", async () => {
    const session = await createSession(
      { projectId: "p1", maxIterations: 5, timeoutMs: 30000, mode: "workflow" },
      stubEmitter
    );
    expect(session.config?.maxIterations).toBe(5);
    expect(session.config?.timeoutMs).toBe(30000);
    expect(session.config?.mode).toBe("workflow");
  });
});
