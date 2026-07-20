/**
 * OrphanReconciler tests (Story 9.24)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import { OrphanReconciler, checkProcessAlive } from "../orphan-reconciler";
import type { CollaborationSession } from "../types";

const TEST_DIR = path.join(process.cwd(), "data/test-orphan-reconciler");

function makeSession(overrides: Partial<CollaborationSession> = {}): CollaborationSession {
  const now = new Date().toISOString();
  return {
    id: `test-session-${Math.random().toString(36).slice(2)}`,
    projectId: "test-project",
    globalGoal: "Test goal",
    status: "running",
    createdAt: now,
    updatedAt: now,
    config: {},
    ...overrides,
  };
}

describe("checkProcessAlive", () => {
  it("returns alive for current process", () => {
    expect(checkProcessAlive(process.pid)).toBe("alive");
  });

  it("returns alive for parent process", () => {
    // Parent process (shell) should still exist
    expect(checkProcessAlive(process.ppid)).toBe("alive");
  });

  it("returns dead for non-existent PID", () => {
    // PID 1 is usually init on Linux, but on macOS it's launchd.
    // Use a very high PID that's guaranteed to not exist.
    expect(checkProcessAlive(999999999)).toBe("dead");
  });
});

describe("OrphanReconciler", () => {
  let reconciler: OrphanReconciler;

  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    reconciler = new OrphanReconciler(TEST_DIR, 24 * 60 * 60 * 1000); // 24h
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("saveSessions / loadSessions", () => {
    it("persists and reloads sessions", async () => {
      const sessions = [makeSession({ id: "s1" }), makeSession({ id: "s2" })];
      await reconciler.saveSessions(sessions);

      const loaded = await reconciler.loadSessions();
      expect(loaded).toHaveLength(2);
      expect(loaded.map((s) => s.id)).toContain("s1");
      expect(loaded.map((s) => s.id)).toContain("s2");
    });

    it("returns empty array when no file exists", async () => {
      const loaded = await reconciler.loadSessions();
      expect(loaded).toEqual([]);
    });
  });

  describe("recordPid", () => {
    it("adds hostPid to session", () => {
      const session = makeSession();
      const result = reconciler.recordPid(session);
      expect(result.hostPid).toBe(process.pid);
    });

    it("does not mutate original session", () => {
      const session = makeSession();
      reconciler.recordPid(session);
      expect(session.hostPid).toBeUndefined();
    });
  });

  describe("detectOrphans", () => {
    it("keeps session with alive PID", async () => {
      const session = makeSession({ hostPid: process.pid });
      const reports = await reconciler.detectOrphans([session]);
      expect(reports).toHaveLength(1);
      expect(reports[0].action).toBe("kept");
      expect(reports[0].status).toBe("alive");
    });

    it("detects orphan with dead PID", async () => {
      const session = makeSession({ hostPid: 999999999 });
      const reports = await reconciler.detectOrphans([session]);
      expect(reports).toHaveLength(1);
      expect(reports[0].action).toBe("terminated");
      expect(reports[0].status).toBe("orphan");
      expect(reports[0].reason).toContain("ESRCH");
    });

    it("skips already-terminal sessions", async () => {
      const completed = makeSession({ status: "completed", hostPid: 999999999 });
      const aborted = makeSession({ status: "aborted", hostPid: 999999999 });
      const reports = await reconciler.detectOrphans([completed, aborted]);
      // Terminal sessions are skipped from detection entirely
      expect(reports).toHaveLength(0);
    });

    it("keeps session with unknown PID", async () => {
      // EPERM case: can't easily test without another user's process
      // But the logic treats EPERM as "alive"
      const session = makeSession({ hostPid: 1 }); // PID 1 on macOS is launchd, should be alive
      const reports = await reconciler.detectOrphans([session]);
      expect(reports).toHaveLength(1);
      expect(reports[0].action).toBe("kept");
    });
  });

  describe("checkTTLExpired", () => {
    it("detects expired TTL for sessions without PID", async () => {
      const oneDayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      const session = makeSession({ updatedAt: oneDayAgo });
      const reports = await reconciler.checkTTLExpired([session]);
      expect(reports).toHaveLength(1);
      expect(reports[0].action).toBe("terminated");
      expect(reports[0].reason).toContain("TTL expired");
    });

    it("does not flag sessions within TTL", async () => {
      const session = makeSession({ updatedAt: new Date().toISOString() });
      const reports = await reconciler.checkTTLExpired([session]);
      expect(reports).toHaveLength(0);
    });

    it("skips sessions with PID (handled by detectOrphans)", async () => {
      const oneDayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      const session = makeSession({ hostPid: 12345, updatedAt: oneDayAgo });
      const reports = await reconciler.checkTTLExpired([session]);
      expect(reports).toHaveLength(0);
    });
  });

  describe("reconcile", () => {
    it("marks orphaned sessions as terminated", async () => {
      const session = makeSession({ id: "s1", hostPid: 999999999 });
      const reports = await reconciler.detectOrphans([session]);
      const updated = await reconciler.reconcile([session], reports);
      expect(updated[0].status).toBe("terminated");
      expect(updated[0].terminationReason).toContain("ESRCH");
    });

    it("keeps alive sessions unchanged", async () => {
      const session = makeSession({ id: "s1", hostPid: process.pid });
      const reports = await reconciler.detectOrphans([session]);
      const updated = await reconciler.reconcile([session], reports);
      expect(updated[0].status).toBe("running");
    });
  });

  describe("runReconciliation", () => {
    it("detects, reconciles, and persists", async () => {
      const deadSession = makeSession({ id: "dead", hostPid: 999999999 });
      const aliveSession = makeSession({ id: "alive", hostPid: process.pid });
      const sessions = [deadSession, aliveSession];

      const reports = await reconciler.runReconciliation(sessions);

      const terminated = reports.filter((r) => r.action === "terminated");
      expect(terminated).toHaveLength(1);
      expect(terminated[0].sessionId).toBe("dead");

      // Verify persisted state
      const persisted = await reconciler.loadSessions();
      const terminatedPersisted = persisted.find((s) => s.id === "dead");
      expect(terminatedPersisted).toBeDefined();
      expect(terminatedPersisted?.status).toBe("terminated");
    });

    it("handles empty session list", async () => {
      const reports = await reconciler.runReconciliation([]);
      expect(reports).toHaveLength(0);
    });
  });

  describe("custom TTL", () => {
    it("uses custom TTL value", async () => {
      const shortTtlReconciler = new OrphanReconciler(TEST_DIR, 60 * 1000); // 1 minute
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const session = makeSession({ updatedAt: fiveMinAgo });
      const reports = await shortTtlReconciler.checkTTLExpired([session]);
      expect(reports).toHaveLength(1);
    });
  });
});
