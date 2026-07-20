/**
 * Tests for engine/supervisor-dag — resumeSupervisorHitl workerId routing
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resumeSupervisorHitl } from "../supervisor-dag";

type HitlChannel = {
  resume: (reply: string) => Promise<void>;
  question: string;
  onBehalfOfName: string;
};

function populateWorkerChannels(
  sessionId: string,
  workers: Record<string, HitlChannel>
) {
  if (!globalThis.__hitlChannelByWorker) {
    globalThis.__hitlChannelByWorker = new Map();
  }
  const sessionMap = new Map<string, HitlChannel>();
  for (const [wid, channel] of Object.entries(workers)) {
    sessionMap.set(wid, channel);
  }
  globalThis.__hitlChannelByWorker.set(sessionId, sessionMap);
}

function makeChannel() {
  const calls: string[] = [];
  const channel: HitlChannel = {
    resume: async (reply) => { calls.push(reply); },
    question: "Proceed?",
    onBehalfOfName: "Worker",
  };
  return { channel, calls };
}

describe("resumeSupervisorHitl", () => {
  beforeEach(() => {
    if (globalThis.__hitlChannelByWorker) {
      globalThis.__hitlChannelByWorker.clear();
    }
    if (globalThis.__hitlResumerRegistry) {
      globalThis.__hitlResumerRegistry.clear();
    }
  });

  it("returns false when no session channels exist", () => {
    expect(resumeSupervisorHitl("nonexistent", "reply")).toBe(false);
  });

  it("routes to exact workerId when specified", async () => {
    const { channel: ch1, calls: c1 } = makeChannel();
    const { channel: ch2, calls: c2 } = makeChannel();
    populateWorkerChannels("sess-1", { "worker-a": ch1, "worker-b": ch2 });

    const result = resumeSupervisorHitl("sess-1", "go", "worker-a");
    expect(result).toBe(true);

    // Allow microtasks to flush
    await Promise.resolve();
    expect(c1).toEqual(["go"]);
    expect(c2).toEqual([]);
  });

  it("routes to last registered worker when no workerId given", async () => {
    const { channel: ch1, calls: c1 } = makeChannel();
    const { channel: ch2, calls: c2 } = makeChannel();
    populateWorkerChannels("sess-1", { "worker-a": ch1, "worker-b": ch2 });

    const result = resumeSupervisorHitl("sess-1", "approved");
    expect(result).toBe(true);

    await Promise.resolve();
    expect(c2).toEqual(["approved"]); // last registered = worker-b
    expect(c1).toEqual([]);
  });

  it("removes the consumed worker channel entry", () => {
    const { channel } = makeChannel();
    populateWorkerChannels("sess-1", { "worker-a": channel });

    resumeSupervisorHitl("sess-1", "yes", "worker-a");

    const sessionMap = globalThis.__hitlChannelByWorker!.get("sess-1");
    expect(sessionMap?.has("worker-a")).toBe(false);
  });

  it("falls back to hitlResumerRegistry when no worker channels present", async () => {
    if (!globalThis.__hitlResumerRegistry) {
      globalThis.__hitlResumerRegistry = new Map();
    }
    let captured: string | undefined;
    globalThis.__hitlResumerRegistry.set("sess-2", (reply) => { captured = reply; });

    const result = resumeSupervisorHitl("sess-2", "fallback-reply");
    expect(result).toBe(true);
    expect(captured).toBe("fallback-reply");
  });

  it("returns false when no worker channels and no registry entry", () => {
    expect(resumeSupervisorHitl("sess-3", "anything")).toBe(false);
  });

  it("falls back to last worker when workerId not found in map", async () => {
    const { channel, calls } = makeChannel();
    populateWorkerChannels("sess-4", { "worker-x": channel });

    const result = resumeSupervisorHitl("sess-4", "msg", "worker-unknown");
    expect(result).toBe(true);

    await Promise.resolve();
    expect(calls).toEqual(["msg"]);
  });
});
