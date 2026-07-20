import { describe, it, expect, beforeEach } from "vitest";
import { AclProtocol } from "../acl";
import { Blackboard } from "../../session/blackboard";

describe("AclProtocol — Message Creation", () => {
  let acl: AclProtocol;

  beforeEach(() => {
    acl = new AclProtocol();
  });

  it("creates a valid inform message", () => {
    const msg = acl.createMessage({
      performative: "inform",
      sender: "agent-a",
      receiver: "agent-b",
      content: { data: "hello" },
    });

    expect(msg.performative).toBe("inform");
    expect(msg.sender).toBe("agent-a");
    expect(msg.receiver).toBe("agent-b");
    expect(msg.content).toEqual({ data: "hello" });
    expect(msg.id).toMatch(/^acl-/);
    expect(msg.timestamp).toBeDefined();
  });

  it("creates a request with replyWith for matching", () => {
    const msg = acl.createMessage({
      performative: "request",
      sender: "agent-a",
      receiver: "agent-b",
      content: { action: "analyze" },
      conversationId: "conv-1",
      replyWith: "req-1",
    });

    expect(msg.replyWith).toBe("req-1");
    expect(msg.conversationId).toBe("conv-1");
    expect(msg.performative).toBe("request");
  });

  it("creates a response with inReplyTo", () => {
    const msg = acl.createMessage({
      performative: "inform",
      sender: "agent-b",
      receiver: "agent-a",
      content: { result: "done" },
      conversationId: "conv-1",
      inReplyTo: "req-1",
    });

    expect(msg.inReplyTo).toBe("req-1");
  });

  it("throws on invalid performative", () => {
    expect(() =>
      acl.createMessage({
        performative: "invalid" as any,
        sender: "a",
        receiver: "b",
        content: {},
      })
    ).toThrow(/Invalid performative/);
  });

  it("throws on missing sender", () => {
    expect(() =>
      acl.createMessage({
        performative: "inform",
        sender: "",
        receiver: "b",
        content: {},
      })
    ).toThrow(/sender and receiver/);
  });

  it("validates message format", () => {
    const errors = acl.validateMessage({
      performative: "inform",
      sender: "a",
      receiver: "b",
      content: "test",
    });
    expect(errors).toEqual([]);

    const badErrors = acl.validateMessage({
      sender: "",
      receiver: "",
    });
    expect(badErrors.length).toBeGreaterThan(0);
    expect(badErrors).toContain("performative is required");
    expect(badErrors).toContain("sender is required");
    expect(badErrors).toContain("receiver is required");
    expect(badErrors).toContain("content is required");
  });
});

describe("AclProtocol — Message Routing", () => {
  let acl: AclProtocol;
  let blackboard: Blackboard;

  beforeEach(() => {
    acl = new AclProtocol();
    blackboard = new Blackboard("test-session", "/tmp/test");
  });

  it("registers and lists agents", () => {
    acl.registerAgent("agent-a");
    acl.registerAgent("agent-b");
    acl.registerAgent("agent-c");

    expect(acl.getRegisteredAgents()).toEqual(
      expect.arrayContaining(["agent-a", "agent-b", "agent-c"])
    );
  });

  it("directed message delivers to target only", () => {
    acl.registerAgent("agent-a");
    acl.registerAgent("agent-b");
    acl.registerAgent("agent-c");

    const msg = acl.createMessage({
      performative: "inform",
      sender: "agent-a",
      receiver: "agent-b",
      content: "secret",
    });

    const result = acl.send(msg, blackboard);
    expect(result.delivered).toEqual(["agent-b"]);

    // agent-b can see the message
    const bMessages = blackboard.getMessages("agent-b");
    expect(bMessages.some((m) => m.content === "secret")).toBe(true);

    // agent-c cannot see the message
    const cMessages = blackboard.getMessages("agent-c");
    expect(cMessages.some((m) => m.content === "secret")).toBe(false);
  });

  it("broadcast message delivers to all registered agents except sender", () => {
    acl.registerAgent("agent-a");
    acl.registerAgent("agent-b");
    acl.registerAgent("agent-c");

    const msg = acl.createMessage({
      performative: "notify",
      sender: "agent-a",
      receiver: "*",
      content: { event: "started" },
    });

    const result = acl.send(msg, blackboard);
    expect(result.delivered).toContain("agent-b");
    expect(result.delivered).toContain("agent-c");
    expect(result.delivered).not.toContain("agent-a");
    expect(result.delivered.length).toBe(2);
  });

  it("unregistered agent does not receive broadcast", () => {
    acl.registerAgent("agent-a");

    const msg = acl.createMessage({
      performative: "notify",
      sender: "agent-a",
      receiver: "*",
      content: "broadcast",
    });

    const result = acl.send(msg, blackboard);
    expect(result.delivered).toEqual([]);
  });

  it("unregisterAgent removes from routing", () => {
    acl.registerAgent("agent-a");
    acl.registerAgent("agent-b");
    acl.unregisterAgent("agent-b");

    const msg = acl.createMessage({
      performative: "notify",
      sender: "agent-a",
      receiver: "*",
      content: "test",
    });

    const result = acl.send(msg, blackboard);
    expect(result.delivered).toEqual([]);
  });
});

describe("AclProtocol — Conversation Isolation", () => {
  let acl: AclProtocol;
  let blackboard: Blackboard;

  beforeEach(() => {
    acl = new AclProtocol();
    blackboard = new Blackboard("test-session", "/tmp/test");
    acl.registerAgent("agent-a");
    acl.registerAgent("agent-b");
  });

  it("getUnread filters by conversationId", () => {
    // Message in conv-1
    const msg1 = acl.createMessage({
      performative: "request",
      sender: "agent-a",
      receiver: "agent-b",
      content: "task-1",
      conversationId: "conv-1",
    });
    acl.send(msg1, blackboard);

    // Message in conv-2
    const msg2 = acl.createMessage({
      performative: "request",
      sender: "agent-a",
      receiver: "agent-b",
      content: "task-2",
      conversationId: "conv-2",
    });
    acl.send(msg2, blackboard);

    const conv1Messages = acl.getUnread("agent-b", blackboard, { conversationId: "conv-1" });
    expect(conv1Messages).toHaveLength(1);
    expect(conv1Messages[0]!.content).toBe("task-1");

    const conv2Messages = acl.getUnread("agent-b", blackboard, { conversationId: "conv-2" });
    expect(conv2Messages).toHaveLength(1);
    expect(conv2Messages[0]!.content).toBe("task-2");
  });

  it("getUnread without conversationId returns all messages", () => {
    const msg1 = acl.createMessage({
      performative: "request",
      sender: "agent-a",
      receiver: "agent-b",
      content: "task-1",
      conversationId: "conv-1",
    });
    acl.send(msg1, blackboard);

    const msg2 = acl.createMessage({
      performative: "request",
      sender: "agent-a",
      receiver: "agent-b",
      content: "task-2",
      conversationId: "conv-2",
    });
    acl.send(msg2, blackboard);

    const allMessages = acl.getUnread("agent-b", blackboard);
    expect(allMessages).toHaveLength(2);
  });

  it("getConversationHistory returns sorted messages from all agents", () => {
    // agent-a requests
    const req = acl.createMessage({
      performative: "request",
      sender: "agent-a",
      receiver: "agent-b",
      content: "analyze this",
      conversationId: "analysis",
      replyWith: "req-001",
    });
    acl.send(req, blackboard);

    // agent-b responds
    const resp = acl.createMessage({
      performative: "inform",
      sender: "agent-b",
      receiver: "agent-a",
      content: { result: "analysis complete" },
      conversationId: "analysis",
      inReplyTo: "req-001",
    });
    acl.send(resp, blackboard);

    const history = acl.getConversationHistory("analysis", blackboard);
    expect(history).toHaveLength(2);
    expect(history[0]!.performative).toBe("request");
    expect(history[1]!.performative).toBe("inform");
  });
});

describe("AclProtocol — Request/Response Matching", () => {
  let acl: AclProtocol;
  let blackboard: Blackboard;

  beforeEach(() => {
    acl = new AclProtocol();
    blackboard = new Blackboard("test-session", "/tmp/test");
    acl.registerAgent("agent-a");
    acl.registerAgent("agent-b");
  });

  it("matches request with response via replyWith/inReplyTo", () => {
    // agent-a sends request with replyWith
    const request = acl.createMessage({
      performative: "request",
      sender: "agent-a",
      receiver: "agent-b",
      content: { action: "count" },
      conversationId: "data-analysis",
      replyWith: "req-count-001",
    });
    acl.send(request, blackboard);

    // agent-b responds with inReplyTo
    const response = acl.createMessage({
      performative: "inform",
      sender: "agent-b",
      receiver: "agent-a",
      content: { count: 42 },
      conversationId: "data-analysis",
      inReplyTo: "req-count-001",
    });
    acl.send(response, blackboard);

    const matched = acl.matchResponse(request, blackboard);
    expect(matched).not.toBeNull();
    expect(matched!.performative).toBe("inform");
    expect(matched!.content).toEqual({ count: 42 });
    expect(matched!.inReplyTo).toBe("req-count-001");
  });

  it("returns null when no matching response exists", () => {
    const request = acl.createMessage({
      performative: "request",
      sender: "agent-a",
      receiver: "agent-b",
      content: {},
      replyWith: "req-unanswered",
    });
    acl.send(request, blackboard);

    const matched = acl.matchResponse(request, blackboard);
    expect(matched).toBeNull();
  });

  it("returns null for request without replyWith", () => {
    const request = acl.createMessage({
      performative: "request",
      sender: "agent-a",
      receiver: "agent-b",
      content: {},
      // no replyWith
    });

    const matched = acl.matchResponse(request, blackboard);
    expect(matched).toBeNull();
  });

  it("does not match wrong inReplyTo", () => {
    const request = acl.createMessage({
      performative: "request",
      sender: "agent-a",
      receiver: "agent-b",
      content: {},
      replyWith: "req-wrong-id",
    });
    acl.send(request, blackboard);

    // Response to a different request
    const response = acl.createMessage({
      performative: "inform",
      sender: "agent-b",
      receiver: "agent-a",
      content: {},
      inReplyTo: "req-other-id",
    });
    acl.send(response, blackboard);

    const matched = acl.matchResponse(request, blackboard);
    expect(matched).toBeNull();
  });

  it("full request-response workflow", () => {
    // Step 1: agent-a requests analysis from agent-b
    const request = acl.createMessage({
      performative: "request",
      sender: "agent-a",
      receiver: "agent-b",
      content: { action: "analyze", data: "user_behavior" },
      conversationId: "analysis-flow",
      replyWith: "req-analysis-1",
    });
    acl.send(request, blackboard);

    // Step 2: agent-b reads unread messages
    const unread = acl.getUnread("agent-b", blackboard, { conversationId: "analysis-flow" });
    expect(unread).toHaveLength(1);
    expect(unread[0]!.performative).toBe("request");

    // Step 3: agent-b processes and responds
    const response = acl.createMessage({
      performative: "inform",
      sender: "agent-b",
      receiver: "agent-a",
      content: { insights: ["pattern-1", "pattern-2"] },
      conversationId: "analysis-flow",
      inReplyTo: "req-analysis-1",
    });
    acl.send(response, blackboard);

    // Step 4: agent-a matches the response
    const matched = acl.matchResponse(request, blackboard);
    expect(matched).not.toBeNull();
    expect(matched!.sender).toBe("agent-b");
    expect(matched!.content).toEqual({ insights: ["pattern-1", "pattern-2"] });
  });
});
