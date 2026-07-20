/**
 * Tests for facade/hitl-dispatcher — HITL routing and message dispatch
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  sendMessageToSupervisor,
  respondToHumanReview,
  setStartDag,
  setResumeSupervisorHitl,
} from "../hitl-dispatcher";
import { sessions, eventStores } from "../session-store";
import type { CollaborationSession } from "../../../../modules/collaboration-runtime/session/types";

// Minimal FsEventStore stub
const stubStore = {
  append: vi.fn().mockResolvedValue(undefined),
};

function makeSession(overrides: Partial<CollaborationSession> = {}): CollaborationSession {
  return {
    id: "sess-1",
    projectId: "proj-test",
    status: "running",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: {},
    ...overrides,
  };
}

describe("sendMessageToSupervisor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessions.clear();
    eventStores.clear();
    setStartDag(null as never);
    setResumeSupervisorHitl(null as never);
  });

  it("returns error when session not found", async () => {
    const result = await sendMessageToSupervisor("nonexistent", "hello");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it("returns error when session is not running or greeting", async () => {
    sessions.set("sess-1", makeSession({ status: "terminated" }));
    const result = await sendMessageToSupervisor("sess-1", "hello");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not running/);
  });

  it("triggers startDag on greeting status", async () => {
    const startDag = vi.fn().mockResolvedValue({ status: "ok", result: null });
    setStartDag(startDag);
    sessions.set("sess-1", makeSession({ status: "greeting" }));

    const result = await sendMessageToSupervisor("sess-1", "My goal");
    expect(result.success).toBe(true);
    expect(startDag).toHaveBeenCalledOnce();
  });

  it("sets globalGoal on greeting", async () => {
    setStartDag(vi.fn().mockResolvedValue({ status: "ok", result: null }));
    const session = makeSession({ status: "greeting" });
    sessions.set("sess-1", session);

    await sendMessageToSupervisor("sess-1", "My new goal");
    expect(session.globalGoal).toBe("My new goal");
  });

  it("calls resumeSupervisorHitl when session is running", async () => {
    const resume = vi.fn().mockReturnValue(true);
    setResumeSupervisorHitl(resume);
    sessions.set("sess-1", makeSession({ status: "running" }));
    eventStores.set("sess-1", stubStore as never);

    const result = await sendMessageToSupervisor("sess-1", "user reply");
    expect(result.success).toBe(true);
    expect(resume).toHaveBeenCalledWith("sess-1", "user reply", undefined);
  });

  it("passes workerId to resumeSupervisorHitl", async () => {
    const resume = vi.fn().mockReturnValue(true);
    setResumeSupervisorHitl(resume);
    sessions.set("sess-1", makeSession({ status: "running" }));
    eventStores.set("sess-1", stubStore as never);

    await sendMessageToSupervisor("sess-1", "reply", "worker-42");
    expect(resume).toHaveBeenCalledWith("sess-1", "reply", "worker-42");
  });

  it("returns success even if resumeSupervisorHitl returns false (new goal path)", async () => {
    const resume = vi.fn().mockReturnValue(false);
    const startDag = vi.fn().mockResolvedValue({ status: "ok", result: null });
    setResumeSupervisorHitl(resume);
    setStartDag(startDag);
    sessions.set("sess-1", makeSession({ status: "running" }));
    eventStores.set("sess-1", stubStore as never);

    const result = await sendMessageToSupervisor("sess-1", "new objective");
    expect(result.success).toBe(true);
    expect(startDag).toHaveBeenCalledOnce();
  });
});

describe("respondToHumanReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessions.clear();
    eventStores.clear();
    setResumeSupervisorHitl(null as never);
  });

  it("delegates to sendMessageToSupervisor", async () => {
    const resume = vi.fn().mockReturnValue(true);
    setResumeSupervisorHitl(resume);
    sessions.set("sess-1", makeSession({ status: "running" }));
    eventStores.set("sess-1", stubStore as never);

    const result = await respondToHumanReview("sess-1", "agent-x", "approved");
    expect(result.success).toBe(true);
  });
});
