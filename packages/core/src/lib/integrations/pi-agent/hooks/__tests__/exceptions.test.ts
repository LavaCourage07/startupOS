import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePiAgent } from "../../hooks";
import { usePiAgentStore } from "../../store";
import type { ProjectContext } from "../../types";
import type { AgentEvent } from "@mariozechner/agent";

const mockPrompt = vi.fn();
const mockAbort = vi.fn();
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

describe("Exception Scenario Tests", () => {
	describe("场景 1: 核心调度层错误（API 错误）", () => {
		it("错误状态可以通过 emit message_end 设置", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			act(() => {
				result.current.agent.emit({
					type: "message_end",
					message: { errorMessage: "API Error: LLM service unavailable" } as any,
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(result.current.uiState.errorMessage).toBe("API Error: LLM service unavailable");
			expect(result.current.isRunning).toBe(false);
		});

		it("reset 后错误状态被清除", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 设置错误状态
			act(() => {
				result.current.agent.emit({
					type: "message_end",
					message: { errorMessage: "Test error" } as any,
					timestamp: Date.now(),
				} as AgentEvent);
			});

			expect(result.current.uiState.errorMessage).toBe("Test error");

			// 清除错误
			act(() => {
				result.current.reset();
			});

			expect(result.current.uiState.errorMessage).toBe(null);
		});
	});

	describe("场景 2: 中断操作处理", () => {
		it("可以中止操作", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			act(() => {
				result.current.abort();
			});

			expect(mockAbort).toHaveBeenCalled();
			expect(result.current.isRunning).toBe(false);
		});

		it("未初始化时调用 abort 不会崩溃", () => {
			const { result } = renderHook(() => usePiAgent());

			act(() => {
				result.current.abort();
			});

			expect(result.current.isRunning).toBe(false);
		});
	});

	describe("场景 3: 无效事件类型处理", () => {
		it("未知事件类型被传递给订阅者", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const handledEventTypes: string[] = [];
			const handler = vi.fn((event: AgentEvent) => {
				handledEventTypes.push(event.type);
			});

			result.current.subscribe(handler);

			// 发送未知事件类型
			act(() => {
				result.current.agent.emit({
					type: "unknown_event_type",
					timestamp: Date.now(),
				} as AgentEvent);
			});

			// 订阅者仍然被调用
			expect(handledEventTypes).toContain("unknown_event_type");
		});

		it("无效事件不会导致状态崩溃", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

		const initialThinking = result.current.isThinking;

			// 发送多个无效事件
			const invalidEvents = [
				{ type: "invalid_1", timestamp: Date.now() },
				{ type: "invalid_2", data: {}, timestamp: Date.now() },
			];

		act(() => {
				invalidEvents.forEach((e) => {
					result.current.agent.emit(e as AgentEvent);
				});
			});

		// 状态应该保持一致
			expect(result.current.isThinking).toBe(initialThinking);
		});
	});

	describe("场景 4: 并发冲突处理", () => {
		it("多次调用不会导致状态不一致", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 并发调用 reset
			act(() => {
				result.current.reset();
			});
			act(() => {
				result.current.reset();
			});

			// 状态应该保持一致
			expect(result.current.isInitialized).toBe(false);
			expect(result.current.sessionId).toBeNull();
		});

		it("subscribe 和 unsubscribe 并发调用", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const handlers: vi.Mock[] = [];
			const unsubs: (() => void)[] = [];

			// 并发注册多个订阅
			act(() => {
				for (let i = 0; i < 5; i++) {
					const handler = vi.fn();
					handlers.push(handler);
					unsubs.push(result.current.subscribe(handler) as (() => void));
				}
			});

			act(() => {
				result.current.agent.emit({ type: "test" } as AgentEvent);
			});

			// 所有订阅者都应该被调用
			handlers.forEach((h) => {
				expect(h).toHaveBeenCalled();
			});

		// 并发取消订阅
			act(() => {
				unsubs.forEach((unsub) => unsub());
			});

			act(() => {
				result.current.agent.emit({ type: "test2" } as AgentEvent);
			});

			// 取消后应该不会被调用
			handlers.forEach((h) => {
				expect(h).toHaveBeenCalledTimes(1);
			});
		});
	});

	describe("场景 5: 边界情况", () => {
		it("快速连续调用 destroy 不会崩溃", () => {
			const { result } = renderHook(() => usePiAgent());

		// 未初始化时也可以调用 destroy
			act(() => {
				result.current.destroy();
			});
			act(() => {
				result.current.destroy();
			});

			expect(result.current.isInitialized).toBe(false);
		});

		it("未初始化时调用各种操作不会崩溃", async () => {
			const { result } = renderHook(() => usePiAgent());

			// 这些操作在未初始化时应该安全执行
			act(() => {
				result.current.abort();
			});
			act(() => {
				result.current.reset();
			});
			act(() => {
				result.current.setSystemPrompt("test");
			});
			act(() => {
				result.current.setThinkingLevel("medium");
			});

			expect(result.current.isInitialized).toBe(false);
		});

		it("destroy 后可以重新初始化", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			expect(result.current.isInitialized).toBe(true);

			act(() => {
				result.current.destroy();
			});

			expect(result.current.isInitialized).toBe(false);

			await act(async () => {
				await result.current.initialize("s2", mockProjectContext, {});
			});

			expect(result.current.isInitialized).toBe(true);
			expect(result.current.sessionId).toBe("s2");
		});
	});
});
