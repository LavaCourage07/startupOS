/**
 * Unit tests for OriginOSAgent
 *
 * Tests cover:
 * - OriginOSAgent creation and initialization
 * - Agent session lifecycle (create, start, stop, destroy)
 * - Event subscription mechanism (on, off, emit)
 * - Message sending and receiving
 * - Tool registration and invocation
 * - Configuration management
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as piAi from "@mariozechner/pi-ai";

// Import after mocking - @mariozechner packages are now aliased in vitest.config.ts
import { OriginOSAgent, createOriginOSAgent } from "../agent";
import type { OriginOSAgentConfig, OriginOSAgentState } from "../../types";
import type { ProjectContext } from "../../system/config";
import { removeLoopDetector } from "../../tools/loop-detector";
import { createWorkingSummaryMessage } from "../../runtime-working-summary";

// ============================================================================
// Test Data
// ============================================================================

const mockSessionId = "test-session-123";
const mockProjectContext: ProjectContext = {
	projectId: "project-001",
	ontologyId: "ontology-001",
	projectName: "Test Project",
	currentPath: "/data/projects/test",
	userId: "user-001",
};

const basicConfig: OriginOSAgentConfig = {
	sessionId: mockSessionId,
	systemPrompt: "You are a helpful assistant",
	model: { provider: "anthropic" as const, id: "test-model" },
	projectContext: mockProjectContext,
	thinkingLevel: "low",
};

// ============================================================================
// Test Suite
// ============================================================================

describe("OriginOSAgent", () => {
	let agent: OriginOSAgent;

	beforeEach(() => {
		vi.clearAllMocks();
		piAi.__streamCalls.length = 0;
		removeLoopDetector(mockSessionId);
	});

	describe("Agent Creation and Initialization", () => {
		it("should create an agent instance with valid config", () => {
			agent = new OriginOSAgent(basicConfig);

			expect(agent).toBeDefined();
			expect(agent).toBeInstanceOf(OriginOSAgent);
		});

		it("should initialize agent state correctly", () => {
			agent = new OriginOSAgent(basicConfig);

			const state = agent.state as OriginOSAgentState;

			expect(state.isInitialized).toBe(true);
			expect(state.sessionId).toBe(mockSessionId);
			expect(state.projectContext).toEqual(mockProjectContext);
			expect(state.uiState.isThinking).toBe(false);
			expect(state.uiState.activeTools).toEqual([]);
		});

		it("should store sessionId in state", () => {
			agent = new OriginOSAgent({
				...basicConfig,
				sessionId: "custom-session-456",
			});

			expect(agent.state.sessionId).toBe("custom-session-456");
		});

		it("should store project context in state", () => {
			agent = new OriginOSAgent(basicConfig);

			expect(agent.state.projectContext).toEqual(mockProjectContext);
		});

		it("should set initial thinking state to false", () => {
			agent = new OriginOSAgent(basicConfig);

			expect(agent.state.uiState.isThinking).toBe(false);
		});

		it("should initialize with empty active tools list", () => {
			agent = new OriginOSAgent(basicConfig);

			expect(agent.state.uiState.activeTools).toEqual([]);
		});
	});

	describe("Agent Session Lifecycle", () => {
		beforeEach(() => {
			agent = new OriginOSAgent(basicConfig);
		});

		it("should be able to send messages (start a session)", async () => {
			await expect(
				agent.prompt("Hello, world!")
			).resolves.not.toThrow();
		});

		it("should accept string messages", async () => {
			await agent.prompt("Test message");

			expect(true).toBe(true); // If we get here, no error was thrown
		});

		it("should continue a previous session", async () => {
			await expect(
				agent.continue()
			).resolves.not.toThrow();
		});

		it("should handle abort operation", () => {
			expect(() => {
				agent.abort();
			}).not.toThrow();
		});

		it("should wait for idle state", async () => {
			await expect(
				agent.waitForIdle()
			).resolves.not.toThrow();
		});
	});

	describe("Message Sending and Receiving", () => {
		beforeEach(() => {
			agent = new OriginOSAgent(basicConfig);
		});

		it("should send a simple string message", async () => {
			await expect(
				agent.prompt("Hello, Agent!")
			).resolves.not.toThrow();
		});

		it("should send multiple messages", async () => {
			const messages = [
				{
					role: "user",
					content: [{ type: "text", text: "First message" }],
				},
				{
					role: "assistant",
					content: [{ type: "text", text: "Response" }],
				},
				{
					role: "user",
					content: [{ type: "text", text: "Second message" }],
				},
			];

			await expect(
				agent.prompt(messages)
			).resolves.not.toThrow();
		});

		it("should compress long histories while preserving recent execution trace before prompt", async () => {
			const internalAgent = (agent as any).agent;
			const longHistory = Array.from({ length: 17 }, (_, index) => ({
				role: "user",
				content: [{ type: "text", text: `user-${index}` }],
			}));
			longHistory.push({
				role: "assistant",
				content: [{ type: "text", text: "plan-before-tool" }],
			});
			longHistory.push({
				role: "assistant",
				content: [{ type: "toolCall", id: "call-1", name: "read_file", arguments: { path: "Memory.md" } }],
			});
			longHistory.push({
				role: "toolResult",
				content: [{ type: "text", text: "Memory contents" }],
				toolName: "read_file",
				toolCallId: "call-1",
			});
			longHistory.push({
				role: "assistant",
				content: [{ type: "text", text: "tool failed, do not repeat" }],
			});
			internalAgent.state.messages = longHistory;

			await agent.prompt("continue");

			expect(internalAgent.replaceMessages).toHaveBeenCalledTimes(1);
			const compressedMessages = internalAgent.replaceMessages.mock.calls[0]?.[0];
			expect(compressedMessages.length).toBeLessThan(longHistory.length);
			expect(compressedMessages.some((message: any) => JSON.stringify(message.content).includes("user-16"))).toBe(true);
			expect(compressedMessages.some((message: any) => JSON.stringify(message.content).includes("plan-before-tool"))).toBe(true);
			expect(compressedMessages.some((message: any) => JSON.stringify(message.content).includes("read_file"))).toBe(true);
			expect(compressedMessages.some((message: any) => JSON.stringify(message.content).includes("Memory contents"))).toBe(true);
			expect(compressedMessages.some((message: any) => JSON.stringify(message.content).includes("do not repeat"))).toBe(true);
			expect(internalAgent.appendMessage).toHaveBeenCalled();
			expect(internalAgent.appendMessage.mock.calls.some((call: any[]) => JSON.stringify(call[0]?.content).includes("[Working Summary]"))).toBe(true);
			expect(internalAgent.appendMessage.mock.calls[0]?.[0]?.role).toBe("system");
		});
	});

	describe("Tool Registration and Invocation", () => {
		beforeEach(() => {
			agent = new OriginOSAgent(basicConfig);
		});

		it("should set tools", () => {
			const tools = [
				{
					name: "test-tool",
					description: "Test tool",
					parameters: {},
					execute: vi.fn(),
				},
			];

			expect(() => {
				agent.setTools(tools);
			}).not.toThrow();
		});

		it("should register a single tool", () => {
			const tool = {
				name: "single-tool",
				description: "Single test tool",
				parameters: {},
				execute: vi.fn(),
			};

			expect(() => {
				agent.registerTool(tool);
			}).not.toThrow();
		});

		it("should unregister a tool", () => {
			const tool = {
				name: "removable-tool",
				description: "Tool to remove",
				parameters: {},
				execute: vi.fn(),
			};

			agent.registerTool(tool);

			expect(() => {
				agent.unregisterTool("removable-tool");
			}).not.toThrow();
		});

		it("should inject a loop warning into message history after repeated identical tool calls", () => {
			const internalAgent = (agent as any).agent;
			expect(internalAgent).toBeDefined();
			internalAgent.state.messages = [
				{
					role: "user",
					content: [{ type: "text", text: "请继续读取报价文件" }],
				},
				{
					role: "assistant",
					content: [{ type: "text", text: "最近失败原因：Memory.md 不存在，不要重复 read_file，改为请求用户补充路径" }],
				},
			];

			for (let i = 0; i < 8; i++) {
				internalAgent.emit({
					type: "tool_execution_start",
					toolName: "read_file",
					args: { path: "Memory.md" },
				});
			}

			expect(internalAgent.appendMessage).toHaveBeenCalledTimes(1);
			const appendedMessage = internalAgent.appendMessage.mock.calls[0]?.[0];
			expect(appendedMessage?.role).toBe("system");
			expect(appendedMessage?.content?.[0]?.type).toBe("text");
			expect(appendedMessage?.content?.[0]?.text).toContain("可能陷入循环");
			expect(appendedMessage?.content?.[0]?.text).toContain("[Working Summary]");
			expect(appendedMessage?.content?.[0]?.text).toContain("最近失败原因");
			expect(appendedMessage?.content?.[0]?.text).toContain("禁止重复动作");
		});
	});

	describe("Working Summary", () => {
		it("should build a runtime working summary from recent task and failure context", () => {
			const summary = createWorkingSummaryMessage([
				{
					role: "user",
					content: [{ type: "text", text: "请继续处理旧计划，如果失败就换一种方式" }],
				} as any,
				{
					role: "assistant",
					content: [{ type: "text", text: "最近失败原因：old-plan.md 不存在，不要重复 read_file，改为请求用户补充路径" }],
				} as any,
			]);

			expect(summary).not.toBeNull();
			expect(summary?.content?.[0]).toMatchObject({ type: "text" });
			const text = (summary?.content?.[0] as any)?.text ?? "";
			expect(text).toContain("[Working Summary]");
			expect(text).toContain("当前任务");
			expect(text).toContain("最近失败原因");
			expect(text).toContain("禁止重复动作");
		});
	});

	describe("Configuration Management", () => {
		beforeEach(() => {
			agent = new OriginOSAgent(basicConfig);
		});

		it("should set system prompt", () => {
			const newPrompt = "You are now a technical assistant";

			expect(() => {
				agent.setSystemPrompt(newPrompt);
			}).not.toThrow();
		});

		it("should set model", () => {
			const newModel = { provider: "google" as const, id: "gemini-pro" };

			expect(() => {
				agent.setModel(newModel);
			}).not.toThrow();
		});

		it("should use the latest model credentials after setModel", async () => {
			const bearerConfig: OriginOSAgentConfig = {
				...basicConfig,
				model: {
					provider: "anthropic" as const,
					id: "test-model",
					authToken: "sk-bearer-token",
					apiKey: null,
					credentialAuthMode: "bearer",
				} as any,
			};
			agent = new OriginOSAgent(bearerConfig);

			await agent.prompt("first");
			expect(piAi.__streamCalls.length).toBeGreaterThan(0);
			const firstCall = piAi.__streamCalls[piAi.__streamCalls.length - 1];
			expect(firstCall.model).toMatchObject({
				provider: "github-copilot",
				apiKey: null,
				authToken: null,
			});
			expect(firstCall.options).toMatchObject({
				toolChoice: "auto",
				apiKey: "sk-bearer-token",
			});

			agent.setModel({
				provider: "anthropic" as const,
				id: "test-model",
				apiKey: "sk-api-key",
				authToken: null,
				credentialAuthMode: "api-key",
			} as any);

			await agent.prompt("second");
			expect(piAi.__streamCalls.length).toBeGreaterThan(1);
			const secondCall = piAi.__streamCalls[piAi.__streamCalls.length - 1];
			expect(secondCall.model).toMatchObject({
				provider: "anthropic",
				apiKey: "sk-api-key",
				authToken: null,
			});
			expect(secondCall.options).toMatchObject({
				toolChoice: "auto",
				apiKey: "sk-api-key",
			});
		});
	});
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe("createOriginOSAgent", () => {
	it("should create an agent with default model", async () => {
		const agent = await createOriginOSAgent({
			sessionId: "test-session",
			variables: {
				projectId: "project-001",
				projectName: "Test Project",
				projectPath: "/data/projects/test",
				userId: "user-001",
			},
		});

		expect(agent).toBeInstanceOf(OriginOSAgent);
	});

	it("should create an agent with custom model", async () => {
		const customModel = { provider: "google" as const, id: "gemini-pro" };

		// Note: We can't actually test this properly because getModel is mocked
		// But we can verify the function accepts the parameter
		const agent = await createOriginOSAgent({
			sessionId: "test-session",
			variables: {
				projectId: "test",
			},
			model: customModel,
		});

		expect(agent).toBeInstanceOf(OriginOSAgent);
	});

	it("should create an agent with custom thinking level", async () => {
		const agent = await createOriginOSAgent({
			sessionId: "test-session",
			variables: {
				projectId: "test",
			},
			thinkingLevel: "high",
		});

		expect(agent).toBeInstanceOf(OriginOSAgent);
	});
});
