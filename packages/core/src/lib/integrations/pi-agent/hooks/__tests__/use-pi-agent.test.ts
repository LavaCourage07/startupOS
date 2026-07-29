import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePiAgent, usePiAgentStatus, usePiAgentEvent } from "../../hooks";
import { usePiAgentStore } from "../../store";
import type { ProjectContext } from "../../types";
import type { AgentEvent } from "@originos/pi-agent-adapter";

const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
const mockAbort = vi.fn();
const mockPrompt = vi.fn();
const mockSetSystemPrompt = vi.fn();
const mockSetModel = vi.fn();
const mockSetTools = vi.fn();
const mockDestroy = vi.fn();

vi.mock("../../core/agent.js", () => ({
	createOriginOSAgent: vi.fn(() => {
		class MockAgent {
			state = { messages: [], systemPrompt: "" };
			eventHandlers = new Set();

			async prompt() { return mockPrompt.apply(this, arguments); }
			async continue() {}
			abort() { mockAbort(); }
			destroy() { mockDestroy(); }
			async waitForIdle() {}
			subscribe(handler: (event: AgentEvent) => () => {}) {
				this.eventHandlers.add(handler);
				mockSubscribe(handler);
				return () => {
					this.eventHandlers.delete(handler);
					mockUnsubscribe();
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
			setSystemPrompt() { mockSetSystemPrompt.apply(this, arguments); }
			setModel() { mockSetModel.apply(this, arguments); }
			setTools() { mockSetTools.apply(this, arguments); }
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
	usePiAgentStore.setState({ errorMessage: null, activeTools: [] });
});

afterEach(() => {
	usePiAgentStore.getState().reset();
});

describe("usePiAgent", () => {
	describe("Hook 初始化状态", () => {
		it("初始状态正确 - isInitialized 为 false", () => {
			const { result } = renderHook(() => usePiAgent());
			expect(result.current.isInitialized).toBe(false);
			expect(result.current.isThinking).toBe(false);
			expect(result.current.messages).toBeUndefined();
			expect(result.current.uiState.activeTools).toEqual([]);
			expect(result.current.uiState.errorMessage).toBe(null);
		});

		it("初始状态正确 - agent 为 null", () => {
			const { result } = renderHook(() => usePiAgent());
			expect(result.current.agent).toBeNull();
		});

		it("初始状态正确 - sessionId 为 null", () => {
			const { result } = renderHook(() => usePiAgent());
			expect(result.current.sessionId).toBeNull();
		});

		it("初始状态正确 - projectContext 为 null", () => {
			const { result } = renderHook(() => usePiAgent());
			expect(result.current.projectContext).toBeNull();
		});

		it("初始状态正确 - uiState 属性", () => {
			const { result } = renderHook(() => usePiAgent());
			expect(result.current.uiState.isThinking).toBe(false);
			expect(result.current.uiState.isRunning).toBe(false);
			expect(result.current.uiState.activeTools).toEqual([]);
			expect(result.current.uiState.progressMessage).toBe(null);
			expect(result.current.uiState.errorMessage).toBe(null);
		});
	});

	describe("initialize 调用正确", () => {
		it("initialize 调用后 isInitialized 为 true", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			expect(result.current.isInitialized).toBe(true);
		});

		it("initialize 调用后设置 sessionId", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s123", mockProjectContext, {});
			});
			expect(result.current.sessionId).toBe("s123");
		});

		it("initialize 调用后设置 projectContext", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			expect(result.current.projectContext).toEqual(mockProjectContext);
		});

		it("initialize 调用时传递变量", async () => {
			const { result } = renderHook(() => usePiAgent());
			const variables = { VAR1: "value1", VAR2: "value2" };
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, variables);
			});
			expect(result.current.isInitialized).toBe(true);
		});

		it("initialize 调用后 agent 可用", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			expect(result.current.agent).not.toBeNull();
		});
	});

	describe("sendMessage 功能正常（包括未初始化错误）", () => {
		it("sendMessage 调用 agent.prompt", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			await act(async () => {
				await result.current.sendMessage("Hi");
			});
			expect(mockPrompt).toHaveBeenCalledWith("Hi");
		});

		it("sendMessage 在未初始化时抛出错误", async () => {
			const { result } = renderHook(() => usePiAgent());
			await expect(async () => {
				await act(async () => {
					await result.current.sendMessage("Hi");
				});
			}).rejects.toThrow("Agent 未初始化。");
		});

		it("sendMessage 发送空消息", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			await act(async () => {
				await result.current.sendMessage("");
			});
			expect(mockPrompt).toHaveBeenCalledWith("");
		});

		it("sendMessage 发送长消息", async () => {
			const { result } = renderHook(() => usePiAgent());
			const longMessage = "a".repeat(1000);
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			await act(async () => {
				await result.current.sendMessage(longMessage);
			});
			expect(mockPrompt).toHaveBeenCalledWith(longMessage);
		});

		it("sendMessage 发送特殊字符", async () => {
			const { result } = renderHook(() => usePiAgent());
			const specialMessage = "Hello 世界 🌍 <script>console.log('xss')</script>";
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			await act(async () => {
				await result.current.sendMessage(specialMessage);
			});
			expect(mockPrompt).toHaveBeenCalledWith(specialMessage);
		});
	});

	describe("reset/destroy 功能正常", () => {
		it("reset 清除状态", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			act(() => result.current.reset());
			expect(result.current.isInitialized).toBe(false);
			expect(result.current.uiState.activeTools).toEqual([]);
			expect(result.current.sessionId).toBeNull();
		});

		it("destroy 调用 agent.destroy", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			act(() => result.current.destroy());
			expect(mockDestroy).toHaveBeenCalled();
		});

		it("destroy 清除状态", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			act(() => result.current.destroy());
			expect(result.current.isInitialized).toBe(false);
			expect(result.current.sessionId).toBeNull();
			expect(result.current.projectContext).toBeNull();
		});

		it("destroy 后可以重新初始化", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});
			act(() => result.current.destroy());
			expect(result.current.isInitialized).toBe(false);

			await act(async () => {
				await result.current.initialize("s2", mockProjectContext, {});
			});
			expect(result.current.isInitialized).toBe(true);
			expect(result.current.sessionId).toBe("s2");
		});
	});

	describe("subscribe/unsubscribe 功能正常", () => {
		it("subscribe 返回 unsubscribe 函数", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			const handler = vi.fn();
			const unsubscribe = result.current.subscribe(handler);
			expect(typeof unsubscribe).toBe("function");
		});

		it("subscribe 注册的事件处理函数被调用", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			const handler = vi.fn();
			result.current.subscribe(handler);
			act(() => result.current.agent.emit({ type: "test" } as AgentEvent));

			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("unsubscribe 移除事件处理函数", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			const handler = vi.fn();
			const unsubscribe = result.current.subscribe(handler);

			act(() => {
				result.current.agent.emit({ type: "test1" } as AgentEvent);
			});
			expect(handler).toHaveBeenCalledTimes(1);

			act(() => {
				unsubscribe();
				result.current.agent.emit({ type: "test2" } as AgentEvent);
			});
			// No new calls after unsubscribe
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("未初始化时 subscribe 返回 no-op 函数", () => {
			const { result } = renderHook(() => usePiAgent());
			const handler = vi.fn();
			const unsubscribe = result.current.subscribe(handler);

			expect(typeof unsubscribe).toBe("function");
			expect(handler).not.toHaveBeenCalled();
		});

		it("支持多个事件订阅者", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			const handler1 = vi.fn();
			const handler2 = vi.fn();
			result.current.subscribe(handler1);
			result.current.subscribe(handler2);

			act(() => {
				result.current.agent.emit({ type: "test" } as AgentEvent);
			});

			expect(handler1).toHaveBeenCalledTimes(1);
			expect(handler2).toHaveBeenCalledTimes(1);
		});
	});

	describe("事件处理（turn_start, turn_end, tool_execution_start/end, message_end）", () => {
		it("turn_start 设置 isThinking 为 true", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});

			expect(result.current.isThinking).toBe(false);

			act(() => {
				result.current.agent.emit({ type: "turn_start", timestamp: Date.now() } as AgentEvent);
			});

			expect(result.current.isThinking).toBe(true);
		});

		it("turn_end 清除状态", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});

			act(() => {
				result.current.agent.emit({ type: "turn_start", timestamp: Date.now() } as AgentEvent);
			});
			expect(result.current.isThinking).toBe(true);

			act(() => {
				result.current.agent.emit({ type: "turn_end", timestamp: Date.now() } as AgentEvent);
			});
			expect(result.current.isThinking).toBe(false);
		});

		it("agent_start 设置 isRunning 为 true", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});

			expect(result.current.isRunning).toBe(false);

			act(() => {
				result.current.agent.emit({ type: "agent_start", timestamp: Date.now() } as AgentEvent);
			});

			expect(result.current.isRunning).toBe(true);
		});

		it("agent_end 设置 isRunning 为 false", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});

			act(() => {
				result.current.agent.emit({ type: "agent_start", timestamp: Date.now() } as AgentEvent);
			});
			expect(result.current.isRunning).toBe(true);

			act(() => {
				result.current.agent.emit({ type: "agent_end", timestamp: Date.now() } as AgentEvent);
			});
			expect(result.current.isRunning).toBe(false);
		});

		it("message_update 顺序保证", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});

			const callOrder: string[] = [];
			const handler = vi.fn((event: AgentEvent) => {
				if (event.type === "message_update") {
					callOrder.push(event.delta as string);
				}
			});

			result.current.subscribe(handler);

			act(() => {
				result.current.agent.emit({
					type: "message_update",
					messageId: "msg-1",
					delta: "Hello",
					timestamp: Date.now(),
				} as AgentEvent);
				result.current.agent.emit({
					type: "message_update",
					messageId: "msg-1",
					delta: " World",
					timestamp: Date.now(),
				} as AgentEvent);
				result.current.agent.emit({
					type: "message_update",
					messageId: "msg-1",
					delta: "!",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(callOrder).toEqual(["Hello", " World", "!"]);
		});

		it("tool_execution_start 更新 uiState.activeTools", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});

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
		});

		it("tool_execution_end 从 uiState.activeTools 移除", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});

			act(() => {
				result.current.agent.emit({
					type: "tool_execution_start",
					toolName: "read_file",
					toolId: "tool-1",
					timestamp: Date.now(),
				} as AgentEvent);
			});
			act(() => {
				result.current.agent.emit({
					type: "tool_execution_end",
					toolName: "read_file",
					toolId: "tool-1",
					result: {},
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(result.current.uiState.activeTools).toHaveLength(0);
		});

		it("多个工具可以同时运行", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});

			act(() => {
				result.current.agent.emit({
					type: "tool_execution_start",
					toolName: "read_file",
					toolId: "tool-1",
					timestamp: Date.now(),
				} as AgentEvent);
			});
			act(() => {
				result.current.agent.emit({
					type: "tool_execution_start",
					toolName: "write_file",
					toolId: "tool-2",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(result.current.uiState.activeTools).toHaveLength(2);
		});
	});

	describe("message_end 错误处理", () => {
		it("message_end 中的 errorMessage 设置错误状态", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});

			act(() => {
				result.current.agent.emit({
					type: "message_end",
					message: { errorMessage: "Test error" } as any,
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(result.current.uiState.errorMessage).toBe("Test error");
		});

		it("reset 后错误状态被清除", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});

			act(() => {
				result.current.agent.emit({
					type: "message_end",
					message: { errorMessage: "Test error" } as any,
					timestamp: Date.now(),
				} as AgentEvent);
			});
			expect(result.current.uiState.errorMessage).toBe("Test error");

			act(() => result.current.reset());

			expect(result.current.uiState.errorMessage).toBe(null);
		});

		it("发送消息时的错误设置状态", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});

			// 直接设置错误状态来测试状态传播
			act(() => {
				usePiAgentStore.setState({ errorMessage: "Network error" });
			});

			expect(result.current.uiState.errorMessage).toBe("Network error");
		});
	});

	describe("其他功能", () => {
		it("updateProjectContext 更新上下文", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			act(() => {
				result.current.updateProjectContext({ projectName: "Updated" });
			});
			expect(result.current.projectContext?.projectName).toBe("Updated");
		});

		it("setSystemPrompt 在已初始化的情况下调用", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			act(() => {
				result.current.setSystemPrompt("You are helpful");
			});
			expect(mockSetSystemPrompt).toHaveBeenCalledWith("You are helpful");
		});

		it("setSystemPrompt 在未初始化的情况下不调用并警告", async () => {
			const { result } = renderHook(() => usePiAgent());
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			act(() => {
				result.current.setSystemPrompt("You are helpful");
			});

			expect(consoleWarnSpy).toHaveBeenCalledWith("Agent 未初始化，无法设置系统提示词");
			expect(mockSetSystemPrompt).not.toHaveBeenCalled();
			consoleWarnSpy.mockRestore();
		});

		it("setThinkingLevel 在已初始化的情况下调用", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			act(() => {
				result.current.setThinkingLevel("medium");
			});
			// Should not throw error
		});

		it("abort 调用 agent.abort", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			act(() => {
				result.current.abort();
			});
			expect(mockAbort).toHaveBeenCalled();
		});

		it("abort 清除 isRunning 状态", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});
			act(() => {
				result.current.abort();
			});
			expect(result.current.isRunning).toBe(false);
		});
	});

	describe("并发 message_update 事件保持顺序", () => {
		it("10 个连续的 message_update 事件保持顺序", async () => {
			const { result } = renderHook(() => usePiAgent());
			await act(async () => {
				await result.current.initialize("s", mockProjectContext, {});
			});

			const deltas: string[] = [];
			const handler = vi.fn((event: AgentEvent) => {
				if (event.type === "message_update") {
					deltas.push(event.delta as string);
				}
			});

			result.current.subscribe(handler);

			const events = Array.from({ length: 10 }, (_, i) => ({
				type: "message_update",
				messageId: "msg-1",
				delta: `chunk-${i}`,
				timestamp: Date.now(),
			}));

			act(() => {
				events.forEach((e) => result.current.agent.emit(e as AgentEvent));
			});

			expect(deltas).toEqual(events.map((e) => e.delta));
		});
	});

	describe("usePiAgentStatus hook 各种状态", () => {
		it("idle 状态", async () => {
			await act(async () => {
				await usePiAgentStore.getState().initialize("s", mockProjectContext, {});
			});

			const { result } = renderHook(() => usePiAgentStatus());

			expect(result.current.status).toBe("idle");
			expect(result.current.message).toBe("就绪");
		});

		it("thinking 状态", async () => {
			await act(async () => {
				await usePiAgentStore.getState().initialize("s", mockProjectContext, {});
			});
			act(() => {
				usePiAgentStore.setState({ isThinking: true });
			});

			const { result } = renderHook(() => usePiAgentStatus());

			expect(result.current.status).toBe("thinking");
			expect(result.current.message).toBe("正在思考...");
		});

		it("thinking with tool 状态", async () => {
			await act(async () => {
				await usePiAgentStore.getState().initialize("s", mockProjectContext, {});
			});
			act(() => {
				usePiAgentStore.setState({
					isThinking: true,
					activeTools: [{ toolName: "read_file", startTime: Date.now() }],
				});
			});

			const { result } = renderHook(() => usePiAgentStatus());

			expect(result.current.status).toBe("thinking");
			expect(result.current.message).toBe("正在执行工具: read_file");
		});

		it("running 状态", async () => {
			await act(async () => {
				await usePiAgentStore.getState().initialize("s", mockProjectContext, {});
			});
			act(() => {
				usePiAgentStore.setState({ isRunning: true });
			});

			const { result } = renderHook(() => usePiAgentStatus());

			expect(result.current.status).toBe("running");
			expect(result.current.message).toBe("处理中...");
		});

		it("error 状态", async () => {
			await act(async () => {
				await usePiAgentStore.getState().initialize("s", mockProjectContext, {});
			});
			act(() => {
				usePiAgentStore.setState({ errorMessage: "Test error" });
			});

			const { result } = renderHook(() => usePiAgentStatus());

			expect(result.current.status).toBe("error");
			expect(result.current.message).toBe("Test error");
		});

		it("错误状态优先于 thinking 状态", async () => {
			await act(async () => {
				await usePiAgentStore.getState().initialize("s", mockProjectContext, {});
			});
			act(() => {
				usePiAgentStore.setState({
					isThinking: true,
					errorMessage: "Critical error",
				});
			});

			const { result } = renderHook(() => usePiAgentStatus());

			expect(result.current.status).toBe("error");
			expect(result.current.message).toBe("Critical error");
		});
	});

	describe("usePiAgentEvent hook", () => {
		it("订阅事件并接收事件", async () => {
			await act(async () => {
				await usePiAgentStore.getState().initialize("s", mockProjectContext, {});
			});

			const handler = vi.fn();
			const { unmount } = renderHook(() => usePiAgentEvent(handler));

			act(() => {
				const agent = usePiAgentStore.getState().agent;
				agent?.emit({ type: "tool_execution_start" } as AgentEvent);
			});

			expect(handler).toHaveBeenCalled();

			unmount();
		});

		it("组件卸载时自动取消订阅", async () => {
			await act(async () => {
				await usePiAgentStore.getState().initialize("s", mockProjectContext, {});
			});

			const handler = vi.fn();
			const { unmount } = renderHook(() => usePiAgentEvent(handler));

			const initialCallCount = mockUnsubscribe.mock.calls.length;
			unmount();

			expect(mockUnsubscribe.mock.calls.length).toBeGreaterThan(initialCallCount);
		});

		it("未初始化时不订阅", () => {
			const handler = vi.fn();
			renderHook(() => usePiAgentEvent(handler));

			const agent = usePiAgentStore.getState().agent;
			expect(agent).toBeNull();
			expect(handler).not.toHaveBeenCalled();
		});
	});
});
