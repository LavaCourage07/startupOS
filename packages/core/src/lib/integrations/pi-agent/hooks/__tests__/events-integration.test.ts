import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePiAgent, usePiAgentEvent } from "../../hooks";
import { usePiAgentStore } from "../../store";
import type { ProjectContext } from "../../types";
import type { AgentEvent } from "@mariozechner/agent";

const mockPrompt = vi.fn();
const mockAbort = vi.fn();
const mockDestroy = vi.fn();

vi.mock("../../core/agent.js", () => ({
	createOriginOSAgent: vi.fn(() => {
		class MockAgent {
			state = {
				messages: [
					{ role: "system", content: "You are a helpful assistant" },
				],
				systemPrompt: "You are a helpful assistant",
			};
			eventHandlers = new Set();

			async prompt() { return mockPrompt.apply(this, arguments); }
			async continue() {}
			abort() { mockAbort(); }
			destroy() { mockDestroy(); }
			async waitForIdle() {}
			subscribe(handler: (event: AgentEvent) => () => {}) {
				this.eventHandlers.add(handler);
				return () => {
					this.eventHandlers.delete(handler);
				};
			}
			emit(event: AgentEvent) {
				for (const h of this.eventHandlers) {
					try {
						h(event);
					} catch (e) {
						// Ignore errors in event handlers
					}
				}
			}
			setSystemPrompt() {}
			setModel() {}
			setTools() {}
			setThinkingLevel() {}
			isInitialized() { return true; }
		}
		return new MockAgent();
	}),
}));

const mockProjectContext: ProjectContext = {
	projectId: "p1",
	ontologyId: "o1",
	projectName: "Test",
	currentPath: "/path",
};

beforeEach(() => {
	vi.clearAllMocks();
	mockPrompt.mockResolvedValue(undefined);
	usePiAgentStore.getState().reset();
});

afterEach(() => {
	usePiAgentStore.getState().reset();
});

describe("Event Flow Integration Tests", () => {
	describe("完整消息流（用户消息 → 思考 → 流式响应 → 完成）", () => {
		it("turn_start 和 turn_end 事件流", async () => {
			const { result } = renderHook(() => usePiAgent());

			// 1. 初始化
			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});
			expect(result.current.isInitialized).toBe(true);

			// 2. 订阅事件
			const eventLog: AgentEvent[] = [];
			const handler = vi.fn((event: AgentEvent) => {
				eventLog.push(event);
			});
			result.current.subscribe(handler);

			// 3. 模拟完整消息流
			act(() => {
				result.current.agent.emit({
					type: "turn_start",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			act(() => {
				result.current.agent.emit({
					type: "message_update",
					messageId: "msg-1",
					delta: "Hello",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			act(() => {
				result.current.agent.emit({
					type: "message_update",
					messageId: "msg-1",
					delta: " World",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			act(() => {
				result.current.agent.emit({
					type: "message_end",
					message: { id: "msg-1", content: "Hello World" } as any,
					timestamp: Date.now(),
				} as AgentEvent);
			});

			act(() => {
				result.current.agent.emit({
					type: "turn_end",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			// 4. 验证消息流
			expect(eventLog.length).toBeGreaterThan(0);

			// 检查关键事件
			const eventTypes = eventLog.map(e => e.type);
			expect(eventTypes).toContain("turn_start");
			expect(eventTypes).toContain("turn_end");
			expect(eventTypes).toContain("message_update");
			expect(eventTypes).toContain("message_end");

			// 5. 验证状态变化
			expect(result.current.isThinking).toBe(false);
		});

		it("流式响应按顺序到达", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const deltas: string[] = [];
			result.current.subscribe((event: AgentEvent) => {
				if (event.type === "message_update" && event.delta) {
					deltas.push(event.delta);
				}
			});

			// 模拟流式响应
			act(() => {
				result.current.agent.emit({
					type: "message_update",
					messageId: "msg-1",
					delta: "Hello",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			act(() => {
				result.current.agent.emit({
					type: "message_update",
					messageId: "msg-1",
					delta: " there",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			act(() => {
				result.current.agent.emit({
					type: "message_update",
					messageId: "msg-1",
					delta: "!",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			// 验证顺序
			expect(deltas).toEqual(["Hello", " there", "!"]);
		});

		it("消息流中的思考状态正确切换", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 初始状态
			expect(result.current.isThinking).toBe(false);

			// 开始思考
			act(() => {
				result.current.agent.emit({
					type: "turn_start",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(result.current.isThinking).toBe(true);

			// 结束思考
			act(() => {
				result.current.agent.emit({
					type: "turn_end",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(result.current.isThinking).toBe(false);
		});
	});

	describe("工具执行流（tool_start → tool_end）", () => {
		it("单工具执行完整流程", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const toolEvents: AgentEvent[] = [];
			result.current.subscribe((event: AgentEvent) => {
				if (event.type === "tool_execution_start" || event.type === "tool_execution_end") {
					toolEvents.push(event);
				}
			});

			// 开始工具执行
			act(() => {
				result.current.agent.emit({
					type: "tool_execution_start",
					toolName: "read_file",
					toolId: "tool-1",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(result.current.uiState.activeTools).toHaveLength(1);
			expect(result.current.uiState.activeTools[0].toolName).toBe("read_file");

			// 结束工具执行
			act(() => {
				result.current.agent.emit({
					type: "tool_execution_end",
					toolName: "read_file",
					toolId: "tool-1",
					result: { content: "file content" },
					timestamp: Date.now() + 100,
				} as AgentEvent);
			});

			expect(result.current.uiState.activeTools).toHaveLength(0);
			expect(toolEvents).toHaveLength(2);
		});

		it("并发工具执行", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 启动第一个工具
			act(() => {
				result.current.agent.emit({
					type: "tool_execution_start",
					toolName: "read_file",
					toolId: "tool-1",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(result.current.uiState.activeTools).toHaveLength(1);

			// 启动第二个工具
			act(() => {
				result.current.agent.emit({
					type: "tool_execution_start",
					toolName: "write_file",
					toolId: "tool-2",
					timestamp: Date.now() + 10,
				} as AgentEvent);
			});

			expect(result.current.uiState.activeTools).toHaveLength(2);

			// 完成第一个工具
			act(() => {
				result.current.agent.emit({
					type: "tool_execution_end",
					toolName: "read_file",
					toolId: "tool-1",
					result: {},
					timestamp: Date.now() + 100,
				} as AgentEvent);
			});

			expect(result.current.uiState.activeTools).toHaveLength(1);
			expect(result.current.uiState.activeTools[0].toolName).toBe("write_file");

			// 完成第二个工具
			act(() => {
				result.current.agent.emit({
					type: "tool_execution_end",
					toolName: "write_file",
					toolId: "tool-2",
					result: {},
					timestamp: Date.now() + 200,
				} as AgentEvent);
			});

			expect(result.current.uiState.activeTools).toHaveLength(0);
		});

		it("工具执行时的状态正确", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			expect(result.current.uiState.activeTools).toHaveLength(0);

			act(() => {
				result.current.agent.emit({
					type: "tool_execution_start",
					toolName: "read_file",
					toolId: "tool-1",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			const activeTool = result.current.uiState.activeTools[0];
			expect(activeTool.toolName).toBe("read_file");
			expect(activeTool.startTime).toBeGreaterThan(0);
		});
	});

	describe("CUI 组件集成（CommandInterface 提交、实时显示）", () => {
		it("usePiAgentEvent 正确接收消息事件", async () => {
			await act(async () => {
				await usePiAgentStore.getState().initialize("s1", mockProjectContext, {});
			});

			const receivedEvents: AgentEvent[] = [];
			const { unmount } = renderHook(() =>
				usePiAgentEvent((event) => {
					receivedEvents.push(event);
				})
			);

			act(() => {
				const agent = usePiAgentStore.getState().agent;
				agent?.emit({
					type: "message_update",
					messageId: "msg-1",
					delta: "Hello",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(receivedEvents.some(e => e.type === "message_update")).toBe(true);

			unmount();
		});

		it("消息更新实时反映在 uiState 中", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			act(() => {
				result.current.agent.emit({
					type: "tool_execution_start",
					toolName: "search_files",
					toolId: "tool-1",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(result.current.uiState.activeTools).toHaveLength(1);
			expect(result.current.uiState.activeTools[0].toolName).toBe("search_files");
		});

		it("错误状态实时反映在 uiState 中", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			act(() => {
				result.current.agent.emit({
					type: "message_end",
					message: { errorMessage: "Tool execution failed" } as any,
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(result.current.uiState.errorMessage).toBe("Tool execution failed");
		});

		it("isThinking 状态实时反映在 uiState 中", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			expect(result.current.uiState.isThinking).toBe(false);

			act(() => {
				result.current.agent.emit({
					type: "turn_start",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(result.current.uiState.isThinking).toBe(true);

			act(() => {
				result.current.agent.emit({
					type: "turn_end",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(result.current.uiState.isThinking).toBe(false);
		});
	});

	describe("事件流中的状态一致性", () => {
		it("复杂事件序列保持状态一致", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 复杂事件序列
			act(() => {
				result.current.agent.emit({
					type: "turn_start",
					timestamp: Date.now(),
				} as AgentEvent);
			});
			expect(result.current.isThinking).toBe(true);

			act(() => {
				result.current.agent.emit({
					type: "tool_execution_start",
					toolName: "search",
					toolId: "t1",
					timestamp: Date.now(),
				} as AgentEvent);
			});
			expect(result.current.uiState.activeTools).toHaveLength(1);

			act(() => {
				result.current.agent.emit({
					type: "tool_execution_end",
					toolName: "search",
					toolId: "t1",
					result: {},
					timestamp: Date.now(),
				} as AgentEvent);
			});
			expect(result.current.uiState.activeTools).toHaveLength(0);

			act(() => {
				result.current.agent.emit({
					type: "tool_execution_start",
					toolName: "write",
					toolId: "t2",
					timestamp: Date.now(),
				} as AgentEvent);
			});
			expect(result.current.uiState.activeTools).toHaveLength(1);

			act(() => {
				result.current.agent.emit({
					type: "message_end",
					message: { errorMessage: "Error" } as any,
					timestamp: Date.now(),
				} as AgentEvent);
			});
			expect(result.current.uiState.errorMessage).toBe("Error");

			act(() => {
				result.current.agent.emit({
					type: "turn_end",
					timestamp: Date.now(),
				} as AgentEvent);
			});
			expect(result.current.isThinking).toBe(false);

			act(() => result.current.reset());

			// 最终状态应全部重置
			expect(result.current.isThinking).toBe(false);
			expect(result.current.uiState.activeTools).toHaveLength(0);
			expect(result.current.uiState.errorMessage).toBe(null);
		});
	});

	describe("消息同步", () => {
		it("agent.state.messages 同步到 hooks.messages", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 初始消息
			expect(result.current.messages).toBeDefined();
			if (result.current.messages) {
				expect(result.current.messages.length).toBeGreaterThan(0);
			}
		});
	});
});
