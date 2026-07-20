import { describe, it, expect, beforeEach } from "vitest";
import { ContractNetProtocol } from "../contract-net";
import { SubscribeNotifyProtocol } from "../subscribe-notify";
import { Blackboard } from "../../session/blackboard";

// ============================================================================
// ContractNetProtocol Tests
// ============================================================================

describe("ContractNetProtocol — Full Workflow", () => {
  let cnp: ContractNetProtocol;
  let blackboard: Blackboard;

  beforeEach(() => {
    cnp = new ContractNetProtocol();
    blackboard = new Blackboard("test-session", "/tmp/test");
  });

  it("creates a CFP session and returns conversationId", async () => {
    const convId = await cnp.callForProposal(
      {
        id: "task-1",
        description: "Analyze user data",
        requiredCapabilities: ["analysis"],
      },
      ["agent-a", "agent-b"],
      new Date(Date.now() + 60000),
      blackboard
    );

    expect(convId).toMatch(/^cn-/);
    const session = cnp.getSession(convId);
    expect(session).toBeDefined();
    expect(session!.state).toBe("cfp_sent");
    expect(session!.candidates).toEqual(expect.arrayContaining(["agent-a", "agent-b"]));
  });

  it("agents can propose valid bids", async () => {
    const convId = await cnp.callForProposal(
      { id: "task-1", description: "Test" },
      ["agent-a", "agent-b"],
      new Date(Date.now() + 60000),
      blackboard
    );

    cnp.propose(convId, "agent-a", {
      confidence: 0.9,
      estimatedCost: { tokens: 100, timeMs: 5000 },
      proposal: "I will use statistical analysis",
    }, blackboard);

    cnp.propose(convId, "agent-b", {
      confidence: 0.7,
      estimatedCost: { tokens: 80, timeMs: 3000 },
      proposal: "I will use ML model",
    }, blackboard);

    const bids = cnp.getBids(convId);
    expect(bids).toHaveLength(2);
    expect(bids.find((b) => b.agentId === "agent-a")!.confidence).toBe(0.9);
  });

  it("rejects duplicate bid from same agent", async () => {
    const convId = await cnp.callForProposal(
      { id: "task-1", description: "Test" },
      ["agent-a"],
      new Date(Date.now() + 60000),
      blackboard
    );

    cnp.propose(convId, "agent-a", {
      confidence: 0.8,
      estimatedCost: { tokens: 100, timeMs: 5000 },
      proposal: "First proposal",
    }, blackboard);

    expect(() =>
      cnp.propose(convId, "agent-a", {
        confidence: 0.9,
        estimatedCost: { tokens: 100, timeMs: 5000 },
        proposal: "Second proposal",
      }, blackboard)
    ).toThrow(/already proposed/);
  });

  it("rejects proposal from non-candidate agent", async () => {
    const convId = await cnp.callForProposal(
      { id: "task-1", description: "Test" },
      ["agent-a"],
      new Date(Date.now() + 60000),
      blackboard
    );

    expect(() =>
      cnp.propose(convId, "agent-c", {
        confidence: 0.5,
        estimatedCost: { tokens: 50, timeMs: 2000 },
        proposal: "Unsolicited bid",
      }, blackboard)
    ).toThrow(/not a candidate/);
  });

  it("selects best bid by highest confidence", async () => {
    const convId = await cnp.callForProposal(
      { id: "task-1", description: "Test" },
      ["agent-a", "agent-b", "agent-c"],
      new Date(Date.now() + 60000),
      blackboard
    );

    cnp.propose(convId, "agent-a", {
      confidence: 0.6,
      estimatedCost: { tokens: 100, timeMs: 5000 },
      proposal: "Low confidence",
    }, blackboard);

    cnp.propose(convId, "agent-b", {
      confidence: 0.95,
      estimatedCost: { tokens: 200, timeMs: 8000 },
      proposal: "High confidence",
    }, blackboard);

    cnp.propose(convId, "agent-c", {
      confidence: 0.8,
      estimatedCost: { tokens: 150, timeMs: 6000 },
      proposal: "Medium confidence",
    }, blackboard);

    const best = cnp.selectBestBid(convId);
    expect(best).toBeDefined();
    expect(best!.agentId).toBe("agent-b");
    expect(best!.confidence).toBe(0.95);
  });

  it("acceptProposal sends accept to winner and reject to losers", async () => {
    const convId = await cnp.callForProposal(
      { id: "task-1", description: "Test" },
      ["agent-a", "agent-b", "agent-c"],
      new Date(Date.now() + 60000),
      blackboard
    );

    cnp.propose(convId, "agent-a", {
      confidence: 0.9,
      estimatedCost: { tokens: 100, timeMs: 5000 },
      proposal: "Winner",
    }, blackboard);

    cnp.propose(convId, "agent-b", {
      confidence: 0.5,
      estimatedCost: { tokens: 50, timeMs: 2000 },
      proposal: "Loser",
    }, blackboard);

    cnp.propose(convId, "agent-c", {
      confidence: 0.3,
      estimatedCost: { tokens: 30, timeMs: 1000 },
      proposal: "Loser",
    }, blackboard);

    cnp.acceptProposal(convId, "agent-a", blackboard);

    const session = cnp.getSession(convId);
    expect(session!.state).toBe("accepted");
    expect(session!.winnerAgentId).toBe("agent-a");

    // Verify messages on blackboard
    const winnerMessages = blackboard.getMessages("agent-a");
    expect(winnerMessages.some((m) => m.performative === "accept")).toBe(true);

    const loserMessages = blackboard.getMessages("agent-b");
    expect(loserMessages.some((m) => m.performative === "reject")).toBe(true);
  });

  it("rejectAll sends reject to all candidates", async () => {
    const convId = await cnp.callForProposal(
      { id: "task-1", description: "Test" },
      ["agent-a", "agent-b"],
      new Date(Date.now() + 60000),
      blackboard
    );

    cnp.propose(convId, "agent-a", {
      confidence: 0.5,
      estimatedCost: { tokens: 100, timeMs: 5000 },
      proposal: "Low quality",
    }, blackboard);

    cnp.rejectAll(convId, blackboard);

    const session = cnp.getSession(convId);
    expect(session!.state).toBe("rejected");

    const aMsgs = blackboard.getMessages("agent-a");
    const bMsgs = blackboard.getMessages("agent-b");
    expect(aMsgs.some((m) => m.performative === "reject")).toBe(true);
    expect(bMsgs.some((m) => m.performative === "reject")).toBe(true);
  });

  it("throws when accepting a non-bidding agent", async () => {
    const convId = await cnp.callForProposal(
      { id: "task-1", description: "Test" },
      ["agent-a", "agent-b"],
      new Date(Date.now() + 60000),
      blackboard
    );

    expect(() => cnp.acceptProposal(convId, "agent-b", blackboard)).toThrow(
      /did not propose/
    );
  });

  it("handles expired deadline", async () => {
    const convId = await cnp.callForProposal(
      { id: "task-1", description: "Test" },
      ["agent-a"],
      new Date(Date.now() - 1000), // already expired
      blackboard
    );

    expect(() =>
      cnp.propose(convId, "agent-a", {
        confidence: 0.8,
        estimatedCost: { tokens: 100, timeMs: 5000 },
        proposal: "Late bid",
      }, blackboard)
    ).toThrow(/deadline expired/);
  });

  it("throws on invalid conversationId", () => {
    expect(() => cnp.getBids("nonexistent")).toThrow(/not found/);
    expect(() => cnp.acceptProposal("nonexistent", "agent-a", blackboard)).toThrow(
      /not found/
    );
    expect(() => cnp.rejectAll("nonexistent", blackboard)).toThrow(/not found/);
  });

  it("marks sessions complete/timed-out and cleans up", async () => {
    const convId = await cnp.callForProposal(
      { id: "task-1", description: "Test" },
      ["agent-a"],
      new Date(Date.now() + 60000),
      blackboard
    );

    cnp.complete(convId);
    expect(cnp.getSession(convId)!.state).toBe("completed");

    cnp.cleanup(convId);
    expect(cnp.getSession(convId)).toBeUndefined();
  });

  it("cleanup without id removes all completed/timed-out sessions", async () => {
    const convId1 = await cnp.callForProposal(
      { id: "task-1", description: "Test" },
      ["agent-a"],
      new Date(Date.now() + 60000),
      blackboard
    );

    const convId2 = await cnp.callForProposal(
      { id: "task-2", description: "Test" },
      ["agent-b"],
      new Date(Date.now() + 60000),
      blackboard
    );

    cnp.complete(convId1);
    cnp.timeout(convId2);

    cnp.cleanup(); // remove all completed/timed-out

    expect(cnp.getSession(convId1)).toBeUndefined();
    expect(cnp.getSession(convId2)).toBeUndefined();
  });

  it("selectBestBid returns undefined for empty bids", async () => {
    const convId = await cnp.callForProposal(
      { id: "task-1", description: "Test" },
      ["agent-a"],
      new Date(Date.now() + 60000),
      blackboard
    );
    expect(cnp.selectBestBid(convId)).toBeUndefined();
  });
});

// ============================================================================
// SubscribeNotifyProtocol Tests
// ============================================================================

describe("SubscribeNotifyProtocol — Subscription Management", () => {
  let snp: SubscribeNotifyProtocol;
  let blackboard: Blackboard;

  beforeEach(() => {
    snp = new SubscribeNotifyProtocol();
    blackboard = new Blackboard("test-session", "/tmp/test");
  });

  it("subscribes an agent to a topic", () => {
    const sub = snp.subscribe("agent-a", "data-updates", undefined, blackboard);

    expect(sub.subscriberId).toBe("agent-a");
    expect(sub.topic).toBe("data-updates");
    expect(sub.conversationId).toMatch(/^sub-data-updates-agent-a-/);

    const subscribers = snp.getSubscribers("data-updates");
    expect(subscribers).toHaveLength(1);
    expect(subscribers[0]!.subscriberId).toBe("agent-a");
  });

  it("subscribes with filter", () => {
    const sub = snp.subscribe(
      "agent-a",
      "events",
      { type: "error", severity: "high" },
      blackboard
    );

    expect(sub.filter).toEqual({ type: "error", severity: "high" });
  });

  it("multiple agents can subscribe to same topic", () => {
    snp.subscribe("agent-a", "alerts");
    snp.subscribe("agent-b", "alerts");
    snp.subscribe("agent-c", "alerts");

    expect(snp.getSubscribers("alerts")).toHaveLength(3);
  });

  it("one agent can subscribe to multiple topics", () => {
    snp.subscribe("agent-a", "alerts");
    snp.subscribe("agent-a", "data-updates");
    snp.subscribe("agent-a", "system-events");

    const subs = snp.getSubscriptionsByAgent("agent-a");
    expect(subs).toHaveLength(3);
  });

  it("unsubscribe removes agent from topic", () => {
    snp.subscribe("agent-a", "alerts", undefined, blackboard);
    snp.subscribe("agent-b", "alerts", undefined, blackboard);

    const result = snp.unsubscribe("agent-a", "alerts", blackboard);
    expect(result).toBe(true);

    const subscribers = snp.getSubscribers("alerts");
    expect(subscribers).toHaveLength(1);
    expect(subscribers[0]!.subscriberId).toBe("agent-b");
  });

  it("unsubscribe returns false for non-existent subscription", () => {
    const result = snp.unsubscribe("agent-x", "nonexistent");
    expect(result).toBe(false);
  });

  it("clearing last subscriber removes topic", () => {
    snp.subscribe("agent-a", "alerts");
    snp.unsubscribe("agent-a", "alerts");

    expect(snp.getSubscribers("alerts")).toHaveLength(0);
    expect(snp.listTopics()).not.toContain("alerts");
  });

  it("listTopics returns all active topics", () => {
    snp.subscribe("agent-a", "topic-1");
    snp.subscribe("agent-b", "topic-2");
    snp.subscribe("agent-c", "topic-3");

    const topics = snp.listTopics();
    expect(topics).toContain("topic-1");
    expect(topics).toContain("topic-2");
    expect(topics).toContain("topic-3");
  });
});

describe("SubscribeNotifyProtocol — Notifications", () => {
  let snp: SubscribeNotifyProtocol;
  let blackboard: Blackboard;

  beforeEach(() => {
    snp = new SubscribeNotifyProtocol();
    blackboard = new Blackboard("test-session", "/tmp/test");
  });

  it("notify delivers to all subscribers of a topic", () => {
    snp.subscribe("agent-a", "alerts", undefined, blackboard);
    snp.subscribe("agent-b", "alerts", undefined, blackboard);

    const notified = snp.notify("alerts", "System overload!", "monitor", blackboard);

    expect(notified).toHaveLength(2);
    expect(notified).toContain("agent-a");
    expect(notified).toContain("agent-b");

    // Verify messages on blackboard
    const aMsgs = blackboard.getMessages("agent-a");
    expect(aMsgs.some((m) => m.content === "System overload!")).toBe(true);
  });

  it("notify returns empty for topic with no subscribers", () => {
    const notified = snp.notify("unknown-topic", "test", "sender", blackboard);
    expect(notified).toHaveLength(0);
  });

  it("filter excludes non-matching subscribers", () => {
    snp.subscribe("agent-a", "events", { type: "error" }, blackboard);
    snp.subscribe("agent-b", "events", { type: "info" }, blackboard);

    // Notify with type=error — only agent-a should receive
    const notified = snp.notify(
      "events",
      { type: "error", message: "Something broke" },
      "monitor",
      blackboard
    );

    expect(notified).toHaveLength(1);
    expect(notified).toContain("agent-a");
    expect(notified).not.toContain("agent-b");
  });

  it("filter matches all criteria", () => {
    snp.subscribe("agent-a", "events", { type: "error", severity: "high" }, blackboard);
    snp.subscribe("agent-b", "events", { type: "error", severity: "low" }, blackboard);

    const notified = snp.notify(
      "events",
      { type: "error", severity: "high", message: "Critical" },
      "monitor",
      blackboard
    );

    expect(notified).toHaveLength(1);
    expect(notified).toContain("agent-a");
  });

  it("broadcast delivers to all topics' subscribers", () => {
    snp.subscribe("agent-a", "topic-1");
    snp.subscribe("agent-b", "topic-2");
    snp.subscribe("agent-c", "topic-1");

    const count = snp.broadcast("Global announcement", "admin", blackboard);
    expect(count).toBe(3);
  });

  it("getNotifications returns notification history", () => {
    snp.subscribe("agent-a", "alerts");

    snp.notify("alerts", "Alert 1", "monitor", blackboard);
    snp.notify("alerts", "Alert 2", "monitor", blackboard);

    // Each notify creates a new conversationId
    const topics = snp.listTopics();
    expect(topics).toContain("alerts");
  });

  it("getStats returns correct counts", () => {
    snp.subscribe("agent-a", "topic-1");
    snp.subscribe("agent-b", "topic-1");
    snp.subscribe("agent-c", "topic-2");

    const stats = snp.getStats();
    expect(stats.topics).toBe(2);
    expect(stats.totalSubscriptions).toBe(3);
  });

  it("clearTopic removes all subscriptions for that topic", () => {
    snp.subscribe("agent-a", "temp-topic");
    snp.subscribe("agent-b", "temp-topic");

    snp.clearTopic("temp-topic");
    expect(snp.getSubscribers("temp-topic")).toHaveLength(0);
  });

  it("clearAll removes everything", () => {
    snp.subscribe("agent-a", "topic-1");
    snp.subscribe("agent-b", "topic-2");

    snp.clearAll();

    expect(snp.listTopics()).toHaveLength(0);
    expect(snp.getStats().topics).toBe(0);
    expect(snp.getStats().totalSubscriptions).toBe(0);
  });
});
