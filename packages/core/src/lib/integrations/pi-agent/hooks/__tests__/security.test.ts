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

describe("Security Tests", () => {
	describe("场景 1: 超长消息处理（>10000 字符）", () => {
		it("正确处理 10000 字符的消息", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const longMessage = "a".repeat(10000);

			await act(async () => {
				await result.current.sendMessage(longMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(longMessage);
		});

		it("正确处理超过 10000 字符的消息", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const veryLongMessage = "x".repeat(50000);

			await act(async () => {
				await result.current.sendMessage(veryLongMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(veryLongMessage);
		});

		it("超长消息不会导致内存溢出", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 创建一个包含许多独特字符的长消息
			const uniqueChars: string[] = [];
			for (let i = 0; i < 10000; i++) {
				uniqueChars.push(String.fromCharCode(i % 1000));
			}
			const longMessage = uniqueChars.join("");

			await act(async () => {
				await result.current.sendMessage(longMessage);
			});

			expect(mockPrompt).toHaveBeenCalledTimes(1);
		});

		it("消息中的多字节字符正确处理", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 中文字符 - 每个字符占 3 字节
			const chineseMessage = "中".repeat(5000);
			// Emoji - 每个 emoji 占 4 字节
			const emojiMessage = "🌍".repeat(2500);

			await act(async () => {
				await result.current.sendMessage(chineseMessage);
			});

			await act(async () => {
				await result.current.sendMessage(emojiMessage);
			});

			expect(mockPrompt).toHaveBeenNthCalledWith(1, chineseMessage);
			expect(mockPrompt).toHaveBeenNthCalledWith(2, emojiMessage);
		});
	});

	describe("场景 2: 命令注入防护", () => {
		it("命令注入尝试被正确传递（在此层不过滤）", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 命令注入尝试
			const maliciousMessage = "Hello; rm -rf /; echo done";

			await act(async () => {
				await result.current.sendMessage(maliciousMessage);
			});

			// 消息应该原样传递给 agent（agent 负责安全处理）
			// 这一层只是传输层，不应该过滤内容
			expect(mockPrompt).toHaveBeenCalledWith(maliciousMessage);
		});

		it("反引号命令注入尝试", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const maliciousMessage = "`cat /etc/passwd`";

			await act(async () => {
				await result.current.sendMessage(maliciousMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(maliciousMessage);
		});

		it("管道命令注入尝试", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const maliciousMessage = "text | malware.exe";

			await act(async () => {
				await result.current.sendMessage(maliciousMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(maliciousMessage);
		});

		it("多个命令注入组合", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const maliciousMessage = "cmd1 && cmd2 || cmd3 | cmd4; cmd5 $(malicious)";

			await act(async () => {
				await result.current.sendMessage(maliciousMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(maliciousMessage);
		});
	});

	describe("场景 3: 特殊字符转义（ANSI 序列）", () => {
		it("ANSI 转义序列被正确处理", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// ANSI 颜色代码
			const ansiMessage = "\x1b[31mRed text\x1b[0m normal";

			await act(async () => {
				await result.current.sendMessage(ansiMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(ansiMessage);
		});

		it("ANSI 光标移动序列", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const ansiMessage = "Text\x1b[5GMoved\x1b[A Up";

			await act(async () => {
				await result.current.sendMessage(ansiMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(ansiMessage);
		});

		it("多个 ANSI 序列组合", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const complexMessage =
				"\x1b[31m\x1b[1mBold Red\x1b[0m \x1b[32m\x1b[4mGreen Underline\x1b[0m";

			await act(async () => {
				await result.current.sendMessage(complexMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(complexMessage);
		});

		it("零宽字符和不可见字符", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 零宽空格和零宽非连接符
			const invisibleMessage = "Visible\u200Bzero-width\u200Cspace";

			await act(async () => {
				await result.current.sendMessage(invisibleMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(invisibleMessage);
		});

		it("控制字符", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// Bell, backspace, escape 等
			const controlMessage = "Text\x07\b\x1bis weird";

			await act(async () => {
				await result.current.sendMessage(controlMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(controlMessage);
		});
	});

	describe("场景 4: XSS 防护", () => {
		it("HTML 标签正确处理", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const htmlMessage = "<script>alert('xss')</script>Text";

			await act(async () => {
				await result.current.sendMessage(htmlMessage);
			});

			// 这一层只是传输层，不对内容进行过滤
			// UI 层应该负责转义
			expect(mockPrompt).toHaveBeenCalledWith(htmlMessage);
		});

		it("事件处理器注入尝试", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const xssMessage = '<img src="x" onerror="alert(1)">';

			await act(async () => {
				await result.current.sendMessage(xssMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(xssMessage);
		});

		it("javascript: 伪协议注入", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const xssMessage = 'javascript:alert("xss")';

			await act(async () => {
				await result.current.sendMessage(xssMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(xssMessage);
		});

		it("各种 HTML 实体编码", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 十进制、十六进制、命名实体
			const entityMessage = "Test &#60;script&#62; &#x3C;script&#x3E; &lt;script&gt;";

			await act(async () => {
				await result.current.sendMessage(entityMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(entityMessage);
		});

		it("Unicode XSS 变种", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const unicodeXss = "<\u0073cript>alert(1)<\u0073cript>";

			await act(async () => {
				await result.current.sendMessage(unicodeXss);
			});

			expect(mockPrompt).toHaveBeenCalledWith(unicodeXss);
		});
	});

	describe("场景 5: 敏感信息过滤", () => {
		it("token 在消息中被传递（不在此层过滤）", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 包含 API token 的消息
			const messageWithToken = "API key: sk-1234567890abcdefghij";

			await act(async () => {
				await result.current.sendMessage(messageWithToken);
			});

			// 传输层不过滤，agent 或后端应该处理
			expect(mockPrompt).toHaveBeenCalledWith(messageWithToken);
		});

		it("密码在消息中被传递", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const messageWithPassword = "password: MySecretPass123!";

			await act(async () => {
				await result.current.sendMessage(messageWithPassword);
			});

			expect(mockPrompt).toHaveBeenCalledWith(messageWithPassword);
		});

		it("错误消息中的敏感信息（测试状态存储）", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 模拟错误中包含敏感信息
			const errorMessage = "Error: sk-sensitive-token-xyz failed";

			act(() => {
				usePiAgentStore.setState({ errorMessage });
			});

			expect(result.current.uiState.errorMessage).toBe(errorMessage);
		});

		it("projectContext 暴露 projectId 和 ontologyId", async () => {
			const { result } = renderHook(() => usePiAgent());

			const contextWithSensitive: ProjectContext = {
				projectId: "p1",
				ontologyId: "o1",
				projectName: "Test",
				currentPath: "/path",
			};

			await act(async () => {
				await result.current.initialize("s1", contextWithSensitive, {});
			});

			expect(result.current.projectContext).toEqual(contextWithSensitive);
		});
	});

	describe("其他安全考虑", () => {
		it("恶意对象属性访问", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 尝试访问不存在的属性
			// @ts-expect-error - 测试未知属性访问
			const unknown = result.current.nonExistentProperty;
			expect(unknown).toBeUndefined();
		});

		it("事件处理中的恶意数据", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			// 恶意事件
			const maliciousEvent = {
				type: "message_update" as const,
				messageId: "<img src=x onerror=alert(1)>",
				delta: "<script>alert(1)</script>",
				timestamp: Date.now(),
			};

			expect(() => {
				act(() => {
					result.current.agent.emit(maliciousEvent as AgentEvent);
				});
			}).not.toThrow();

			// 状态应该保持正常
			expect(result.current.isInitialized).toBe(true);
		});

		it("空字节注入", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const nullByteMessage = "text\x00with null\x00bytes";

			await act(async () => {
				await result.current.sendMessage(nullByteMessage);
			});

			expect(mockPrompt).toHaveBeenCalledWith(nullByteMessage);
		});

		it("路径遍历字符串", async () => {
			const { result } = renderHook(() => usePiAgent());

			await act(async () => {
				await result.current.initialize("s1", mockProjectContext, {});
			});

			const pathTraversal = "../../etc/passwd";

			await act(async () => {
				await result.current.sendMessage(pathTraversal);
			});

			expect(mockPrompt).toHaveBeenCalledWith(pathTraversal);
		});
	});
});
