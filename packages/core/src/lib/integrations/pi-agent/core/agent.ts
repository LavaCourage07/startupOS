/**
 * OriginOS Agent 核心包装类
 * 包装 pi-agent-core 的 Agent，提供 OriginOS 特定的功能
 */

import type {
	AgentEvent,
	AgentMessage,
	AgentTool,
	StreamFn,
	ThinkingLevel,
} from "@mariozechner/agent";
import { Agent } from "@mariozechner/agent";
import type { AssistantMessage, AssistantMessageEvent, AssistantMessageEventStream, Message, Model } from "@mariozechner/pi-ai";
import * as piAi from "@mariozechner/pi-ai";
import type {
	OriginOSAgentConfig,
	OriginOSAgentState,
} from "../types";
import { AgentStatus } from "../../../../types/agent";
import type {
	ProjectContext,
} from "../system/config";
import type { SystemPromptVariables } from "../system/prompt";
import type { HealthMonitor, AgentHealthStatus } from "../health";
import { createHealthMonitor } from "../health";
import { createAnthropicModel, createGoogleModel, createAutoModel, createRuntimeModel, getConfigStatus } from "../server-config";
import type { RuntimeLLMConfig } from "../llm-config";
import { compressRecentTrace } from "../recent-trace-compression";
import { getLoopDetector, removeLoopDetector } from "../tools/loop-detector";
import { createWorkingSummaryMessage } from "../runtime-working-summary";
import { getVisibleStreamDelta, trimRepeatingTail } from "../stream-dedupe";

// ============================================================================
// Event Emitter
// ============================================================================

/**
 * 简单的事件发射器
 */
class EventEmitter<T> {
	private listeners = new Set<(event: T) => void>();

	subscribe(listener: (event: T) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	emit(event: T): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}

	clear(): void {
		this.listeners.clear();
	}
}

function normalizeStreamProvider(
	stream: AssistantMessageEventStream,
	provider: string
): AssistantMessageEventStream {
	const rewriteMessage = (message: AssistantMessage): AssistantMessage => {
		message.provider = provider;
		return message;
	};
	const rewriteEvent = (event: AssistantMessageEvent): AssistantMessageEvent => {
		if ("partial" in event) {
			rewriteMessage(event.partial);
		}
		if ("message" in event) {
			rewriteMessage(event.message);
		}
		return event;
	};

	return ({
		[Symbol.asyncIterator]: async function* () {
			for await (const event of stream) {
				yield rewriteEvent(event);
			}
		},
		result: async () => rewriteMessage(await stream.result()),
	} as unknown) as AssistantMessageEventStream;
}

function hashText(text: string): string {
	if (!text) {
		return "empty";
	}
	let hash = 2166136261;
	for (let i = 0; i < text.length; i += 1) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

function previewText(text: string, max = 80): string {
	return text.replace(/\s+/g, " ").slice(0, max);
}

type SyntheticSystemMessage = {
	role: "system";
	content: Array<{
		type: "text";
		text: string;
	}>;
};

// ============================================================================
// OriginOS Agent
// ============================================================================

/**
 * OriginOS Agent 类
 * 包装 pi-agent-core 的 Agent，添加 OriginOS 特定功能
 */
export class OriginOSAgent {
	private agent: Agent | null = null;
	private sessionId: string;
	private projectContext: ProjectContext;
	private eventEmitter = new EventEmitter<AgentEvent>();
	private isDestroyed = false;
	private healthMonitor: HealthMonitor;
	private config?: OriginOSAgentConfig;
	private loggedStreamContent = "";
	private assistantStreamContent = "";
	private assistantLoopGuardTriggered = false;
	private turnSequence = 0;
	private activeTurnSequence = 0;
	private assistantMessageSequence = 0;
	private activeAssistantMessageSequence = 0;
	private previousAssistantTextHash = "";
	private previousAssistantTurnSequence = 0;

	/**
	 * Agent 状态
	 */
	public readonly state: OriginOSAgentState = {
		isInitialized: false,
		sessionId: "",
		uiState: {
			isThinking: false,
			activeTools: [],
		},
	};

	constructor(config: OriginOSAgentConfig, healthMonitor?: HealthMonitor) {
		this.config = config;
		this.sessionId = config.sessionId ?? "";
		this.projectContext = config.projectContext ?? { projectId: "" };
		this.state.sessionId = config.sessionId ?? "";
		this.state.projectContext = config.projectContext;
		this.healthMonitor = healthMonitor ?? createHealthMonitor();

		// 设置 Agent 引用到健康监控器
		this.healthMonitor.setAgent(this);

		// 自动初始化（保持向后兼容性）
		this.initialize(config);
	}

	/**
	 * 初始化 Agent
	 */
	private initialize(config?: OriginOSAgentConfig): void {
		if (this.isDestroyed) {
			throw new Error("Agent 已销毁，无法初始化");
		}

		if (config) {
			this.config = config;
		}

		if (!this.config) {
			throw new Error("Agent 未配置，无法初始化");
		}

		// 设置初始化状态到健康监控器
		this.healthMonitor.setStatus(AgentStatus.INITIALIZING);

		// 转换自定义消息类型到 LLM 消息格式
		// 包含 token 预算管理：超出 contextWindow 时截断旧消息
		const convertToLlm = (messages: AgentMessage[]): Message[] => {
			// 过滤有效消息
			const validMessages = messages.filter((m) => {
				const role: string = m.role;
				return role === "user" || role === "assistant" || role === "toolResult";
			}) as Message[];

			// Token 预算管理
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const modelAny = this.config?.model as any;
			const contextWindow: number = modelAny?.contextWindow ?? 128000;
			const maxOutputTokens: number = modelAny?.maxTokens ?? 16384;
			const tokenBudget = contextWindow - maxOutputTokens - 4000; // 预留 system prompt + buffer

			// 估算 token 数（chars/4 启发式，中文约 2 chars/token）
			const estimateTokens = (content: unknown): number => {
				if (typeof content === 'string') {
					return Math.ceil(content.length / 3);
				}
				if (Array.isArray(content)) {
					return content.reduce((sum, c) => {
						if (c && typeof c === 'object' && 'text' in c) {
							return sum + Math.ceil((c.text as string).length / 3);
						}
						return sum;
					}, 0);
				}
				return 0;
			};

			// 单条消息最大 token 限制（防止一条超大消息撑爆上下文）
			const maxSingleMessageTokens = Math.floor(tokenBudget * 0.4); // 单条最多占 40% 预算

			// 截断单条超大消息
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const truncateMessage = (msg: any): any => {
				const tokens = estimateTokens(msg.content);
				if (tokens <= maxSingleMessageTokens) return msg;

				// 截断内容
				if (typeof msg.content === 'string') {
					const maxChars = maxSingleMessageTokens * 3;
					const truncated = msg.content.slice(0, maxChars) + '\n\n[内容已截断，超出 token 限制]';
					return { ...msg, content: truncated };
				}
				if (Array.isArray(msg.content)) {
					let charCount = 0;
					const maxChars = maxSingleMessageTokens * 3;
					const truncated: unknown[] = [];
					for (const c of msg.content) {
						if (c && typeof c === 'object' && 'text' in c) {
							const text = (c as { text: string }).text;
							if (charCount + text.length > maxChars) {
								truncated.push({ ...c, text: text.slice(0, maxChars - charCount) + '\n\n[内容已截断]' });
								break;
							}
							charCount += text.length;
						}
						truncated.push(c);
					}
					return { ...msg, content: truncated };
				}
				return msg;
			};

			// 从后往前保留消息，直到超出预算
			let totalTokens = 0;
			const keptMessages: Message[] = [];
			for (let i = validMessages.length - 1; i >= 0; i--) {
				const rawMsg = validMessages[i];
				if (!rawMsg) continue;
				const msg = truncateMessage(rawMsg) as Message; // 截断单条超大消息
				const tokens = estimateTokens(msg.content);
				if (totalTokens + tokens > tokenBudget && keptMessages.length >= 2) {
					break; // 至少保留最近 2 条消息
				}
				keptMessages.unshift(msg);
				totalTokens += tokens;
			}

			// 日志记录 token 使用情况
			if (validMessages.length !== keptMessages.length) {
				console.log(`[Agent] Context truncated: ${validMessages.length} → ${keptMessages.length} messages, ~${totalTokens}/${tokenBudget} tokens`);
			}

			return keptMessages;
		};

		const getRuntimeModel = (): Model<any> => {
			const currentModel = (this.agent?.state as { model?: Model<any> } | undefined)?.model;
			return currentModel ?? this.config?.model ?? ({} as Model<any>);
		};

		// 提取凭证：bearer 模式下 token 保留在 authToken，不能再注入 options.apiKey。
		const initialModel = getRuntimeModel() as any;
		const modelApiKey = initialModel?.apiKey;
		const modelAuthToken = initialModel?.authToken;
		const modelCredentialSource = initialModel?.credentialSource;
		const modelCredentialAuthMode = initialModel?.credentialAuthMode;
		const modelId = initialModel?.id;
		const modelApi = initialModel?.api;
		const modelBaseUrl = initialModel?.baseUrl;

		// 调试日志
		console.error('[OriginOSAgent] Initializing agent with:', {
			modelId,
			modelApi,
			modelBaseUrl,
			hasApiKey: !!modelApiKey,
			hasAuthToken: !!modelAuthToken,
			credentialSource: modelCredentialSource || 'env/default',
			credentialAuthMode: modelCredentialAuthMode || (modelApiKey?.includes?.('sk-ant-oat') ? 'oauth' : 'api-key'),
			credentialPrefix: modelApiKey
				? `${modelApiKey.substring(0, 10)}...`
				: modelAuthToken
					? `${modelAuthToken.substring(0, 10)}...`
					: 'none',
		});

		// 包装 streamFn，注入 toolChoice 确保工具调用被启用
		const streamFnWithToolChoice: StreamFn = (model, context, options) => {
			const opts = { ...(options || {}) } as Record<string, unknown>;
			(opts as Record<string, unknown>)['toolChoice'] = 'auto';
			const currentModel = (getRuntimeModel() as any) ?? model;
			const currentModelApiKey = currentModel?.apiKey;
			const currentModelAuthToken = currentModel?.authToken;
			const currentModelCredentialAuthMode = currentModel?.credentialAuthMode;
			const currentModelUsesBearerAuth = currentModelCredentialAuthMode === "bearer" || currentModelCredentialAuthMode === "oauth";
			let streamModel = {
				...model,
				...currentModel,
			};
			if (currentModelUsesBearerAuth && currentModelAuthToken) {
				opts['apiKey'] = currentModelAuthToken;
				// pi-ai 的 Anthropic provider 从 options.headers 读取自定义 header（不是 model.headers），
				// 所以 Bearer Authorization 必须放在 opts 中传递。
				opts['headers'] = {
					...((streamModel as any).headers ?? {}),
					authorization: `Bearer ${currentModelAuthToken}`,
				};
				streamModel = {
					...streamModel,
					// pi-ai's Anthropic provider falls back to configured api-key auth.
					// Its Copilot path is the available Bearer-auth transport. streamSimple
					// still resolves credentials from options.apiKey, so keep the token there.
					provider: 'github-copilot',
					apiKey: null,
					authToken: null,
				} as typeof model & { apiKey: null; authToken: null };
			} else if (currentModelApiKey && !opts['apiKey']) {
				opts['apiKey'] = currentModelApiKey;
			}
			// 调试：确认凭证传递
			const finalCredential = opts['apiKey'] || (streamModel as any)?.apiKey || (streamModel as any)?.authToken;
			console.error(`[streamFn] credential check: hasOptsApiKey=${!!opts['apiKey']}, modelApiKey=${currentModelApiKey ? 'set' : 'null'}, model.authToken=${(streamModel as any)?.authToken ? 'set' : 'null'}, bearer=${currentModelUsesBearerAuth}, final=${finalCredential ? finalCredential.toString().slice(0, 10) + '...' : 'NONE'}`);
			console.error(`[streamFn] Calling pi-ai streamSimple with model:`, {
				id: streamModel.id,
				api: streamModel.api,
				provider: streamModel.provider,
				baseUrl: (streamModel as any).baseUrl,
			});
			console.error(`[streamFn] Context messages count:`, context.messages?.length);

			const stream = piAi.streamSimple(streamModel, context, opts);

			return currentModelUsesBearerAuth ? normalizeStreamProvider(stream, model.provider) : stream;
		};

		// 检查模型是否支持 thinking（reasoning: false 表示不支持）
		const modelReasoning = (this.config.model as any)?.reasoning;
		const thinkingLevel = modelReasoning === false ? "off" : (this.config.thinkingLevel ?? "low");

		this.agent = new Agent({
			initialState: {
				systemPrompt: this.config.systemPrompt,
				model: this.config.model,
				thinkingLevel,
				tools: this.config.tools ?? [],
				messages: [],
			},
			convertToLlm,
			// 提供 getApiKey 回调，确保 API key 可用于所有 provider
			getApiKey: async (_provider: string) => {
				// 优先使用当前模型配置中的 API key，支持 setModel() 后热切换
				return (getRuntimeModel() as any)?.apiKey;
			},
			// 使用包装的 streamFn 注入 toolChoice
			streamFn: streamFnWithToolChoice,
		});

		// 订阅 Agent 事件并转发到我们的事件发射器
		this.agent.subscribe((event) => {
			this.handleAgentEvent(event);
			this.eventEmitter.emit(event);
		});

		this.state.isInitialized = true;

		// 标记为运行状态
		this.healthMonitor.markAsRunning();
	}

	/**
	 * 公开的启动方法（如果已停止可以重新启动）
	 */
	async start(config?: OriginOSAgentConfig): Promise<void> {
		if (this.isDestroyed) {
			throw new Error("Agent 已销毁，无法初始化");
		}

		if (config) {
			this.config = config;
		}

		if (this.isInitialized()) {
			// 已初始化，标记为运行中
			this.healthMonitor.markAsRunning();
			return;
		}

		// 需要重新初始化
		if (this.config) {
			this.initialize(this.config);
		}
	}

	/**
	 * 处理 Agent 事件
	 */
	private handleAgentEvent(event: AgentEvent): void {
		switch ((event as any).type) {
			case "agent_start":
				this.state.uiState.isThinking = true;
				this.healthMonitor.markProcessingStart();
				console.error(`[LLM Event] agent_start`);
				break;

			case "agent_end":
				this.state.uiState.isThinking = false;
				this.state.uiState.activeTools = [];
				this.healthMonitor.markProcessingEnd();
				this.healthMonitor.recordMessageHandled();
				console.error(`[LLM Event] agent_end — messages=${(event as any).messages?.length ?? 0}`);
				break;

			case "turn_start":
				this.activeTurnSequence = ++this.turnSequence;
				this.state.uiState.isThinking = true;
				this.healthMonitor.markProcessingStart();
				console.error(`[LLM Event] turn_start — turnSeq=${this.activeTurnSequence}`);
				break;

			case "turn_end": {
				const turnEnd = event as any;
				const msg = turnEnd.message;
				const toolCount = turnEnd.toolResults?.length ?? 0;
				const hasToolCalls = msg?.content?.filter?.((c: any) => c.type === "toolCall")?.length ?? 0;
				this.state.uiState.isThinking = false;
				this.healthMonitor.markProcessingEnd();
				this.healthMonitor.recordMessageHandled();

				// 详细日志：打印 turn 结束时的完整消息结构
				console.error(
					`[LLM Event] turn_end — turnSeq=${this.activeTurnSequence}, toolCalls=${hasToolCalls}, toolResults=${toolCount}`
				);
				if (msg) {
					const assistantText =
						Array.isArray(msg.content)
							? msg.content
									.filter((block: any) => block.type === "text" && block.text != null)
									.map((block: any) => block.text)
									.join("")
							: "";
					const assistantTextHash = hashText(assistantText);
					const sameAsPreviousAssistant =
						msg.role === "assistant" &&
						assistantText.length > 0 &&
						assistantTextHash === this.previousAssistantTextHash;
					console.error(
						`[LLM Turn Detail] turnSeq=${this.activeTurnSequence}, model=${msg.model ?? 'unknown'}, provider=${msg.provider ?? 'unknown'}, api=${msg.api ?? 'unknown'}, stopReason=${msg.stopReason ?? 'unknown'}, assistantTextHash=${assistantTextHash}, sameAsPreviousAssistant=${sameAsPreviousAssistant}${sameAsPreviousAssistant ? `, previousTurnSeq=${this.previousAssistantTurnSequence}` : ""}`
					);
					if (msg.content && Array.isArray(msg.content)) {
						msg.content.forEach((block: any, i: number) => {
							if (block.type === "toolCall") {
								console.error(`[LLM Turn Detail]   toolCall[${i}]: name=${block.name}, id=${block.id}, args=${JSON.stringify(block.arguments).slice(0, 300)}`);
							} else if (block.type === "text") {
								console.error(`[LLM Turn Detail]   text[${i}]: len=${block.text?.length ?? 0}, preview="${(block.text ?? '').slice(0, 100)}"`);
							} else if (block.type === "thinking") {
								console.error(`[LLM Turn Detail]   thinking[${i}]: len=${block.thinking?.length ?? 0}`);
							} else {
								console.error(`[LLM Turn Detail]   block[${i}]: type=${block.type}`);
							}
						});
					}
					if (toolCount > 0) {
						turnEnd.toolResults.forEach((tr: any, i: number) => {
							const content = tr.content?.map((c: any) => c.type === 'text' ? c.text : `[${c.type}]`).join('') ?? '';
							console.error(`[LLM Turn Detail]   toolResult[${i}]: name=${tr.toolName ?? 'unknown'}, callId=${tr.toolCallId ?? 'unknown'}, content_preview="${content.slice(0, 200)}"`);
						});
					}
					if (msg.role === "assistant" && assistantText.length > 0) {
						this.previousAssistantTextHash = assistantTextHash;
						this.previousAssistantTurnSequence = this.activeTurnSequence;
					}
				}
				break;
			}

			case "tool_execution_start":
				this.applyLoopProtection(event as any);
				this.state.uiState.activeTools.push({
					toolName: (event as any).toolName,
					startTime: Date.now(),
				});
				console.error(`[LLM Event] tool_start — ${(event as any).toolName}`);
				break;

			case "tool_execution_end": {
				this.state.uiState.activeTools =
					this.state.uiState.activeTools.filter(
						(t) => t.toolName !== (event as any).toolName
					);
				const toolEndEvent = event as any;
				const resultContent = toolEndEvent.result?.content;
				const resultText = Array.isArray(resultContent)
					? resultContent.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
					: typeof resultContent === 'string' ? resultContent : JSON.stringify(toolEndEvent.result ?? '');
				console.error(`[LLM Event] tool_end — ${(event as any).toolName}${(event as any).isError ? ' (ERROR)' : ''}\n[ToolResult] ${resultText}`);
				break;
			}

			case "message_start": {
				const msg = (event as any).message;
				const role = msg?.role || "unknown";
				if (role === "assistant") {
					this.activeAssistantMessageSequence = ++this.assistantMessageSequence;
					this.loggedStreamContent = "";
					this.assistantStreamContent = "";
					this.assistantLoopGuardTriggered = false;
				} else {
					this.activeAssistantMessageSequence = 0;
				}
				console.error(
					`[LLM Event] message_start — role=${role}, turnSeq=${this.activeTurnSequence}${role === "assistant" ? `, assistantMsgSeq=${this.activeAssistantMessageSequence}` : ""}`
				);
				break;
			}

			case "message_update": {
				const update = event as any;
				const eventType = update.assistantMessageEvent?.type || "unknown";
				// Print text/thinking deltas (to stderr to avoid corrupting JSON Line stdout in worker mode)
				if (eventType === "text_delta") {
					let delta = update.assistantMessageEvent?.delta || "";
					if (this.assistantLoopGuardTriggered) {
						update.assistantMessageEvent.delta = "";
						break;
					}
					if (delta.length > 0) {
						const merged = getVisibleStreamDelta(this.assistantStreamContent, delta);
						const trimmed = trimRepeatingTail(merged.content);
						if (trimmed.trimmed) {
							update.assistantMessageEvent.delta = trimmed.content.startsWith(this.assistantStreamContent)
								? trimmed.content.slice(this.assistantStreamContent.length)
								: "";
							this.assistantStreamContent = trimmed.content;
							this.loggedStreamContent = trimmed.content;
							this.assistantLoopGuardTriggered = true;
							console.error(
								`\n[LLM LoopGuard] repeated assistant output detected — turnSeq=${this.activeTurnSequence}, assistantMsgSeq=${this.activeAssistantMessageSequence}, patternLen=${trimmed.pattern?.length ?? 0}, repetitions=${trimmed.repetitions ?? 0}, textHash=${hashText(trimmed.content)}, preview="${previewText(trimmed.content)}"`
							);
							this.agent?.abort();
							delta = update.assistantMessageEvent.delta;
						} else {
							update.assistantMessageEvent.delta = merged.delta;
							this.assistantStreamContent = merged.content;
							delta = merged.delta;
						}

						if (delta.length > 0) {
							const logMerged = getVisibleStreamDelta(this.loggedStreamContent, delta);
							this.loggedStreamContent = logMerged.content;
							if (logMerged.delta.length > 0) {
								process.stderr.write(logMerged.delta);
							}
						}
					}
				} else if (eventType === "thinking_delta") {
					const delta = update.assistantMessageEvent?.delta || "";
					if (delta.length > 0) {
						const merged = getVisibleStreamDelta(this.loggedStreamContent, delta);
						this.loggedStreamContent = merged.content;
						if (merged.delta.length > 0) {
							process.stderr.write(merged.delta);
						}
					}
				}
				// 打印 tool call 相关事件
				if (eventType === "toolcall_start" || eventType === "toolcall_end" || eventType === "toolcall_delta") {
					const ae = update.assistantMessageEvent || {};
					console.error(`\n[LLM Event] message_update — ${eventType}`);
					if (ae.toolCall) {
						const tc = ae.toolCall;
						console.error(`  → name=${tc.name}, id=${tc.id}, args=${JSON.stringify(tc.arguments).slice(0, 200)}`);
					}
				}
				break;
			}

			case "message_end": {
				const msg = (event as any).message;
				const role = msg?.role || "unknown";
				if (role === "assistant" && this.assistantLoopGuardTriggered && Array.isArray(msg?.content)) {
					const textBlock = msg.content.find((block: any) => block?.type === "text" && block.text != null);
					if (textBlock) {
						textBlock.text = this.assistantStreamContent;
					}
				}
				const hasToolCalls = msg?.content?.filter?.((c: any) => c.type === "toolCall")?.length ?? 0;
				const textContent = Array.isArray(msg?.content)
					? msg.content.filter((b: any) => b.type === "text" && b.text != null).map((b: any) => b.text).join("")
					: "";
				const stopReason = msg?.stopReason || "";
				console.error(
					`\n[LLM Event] message_end — role=${role}, turnSeq=${this.activeTurnSequence}${role === "assistant" ? `, assistantMsgSeq=${this.activeAssistantMessageSequence}` : ""}, stopReason=${stopReason}, toolCalls=${hasToolCalls}, textLen=${textContent.length}, textHash=${hashText(textContent)}, loopGuard=${role === "assistant" ? this.assistantLoopGuardTriggered : false}, preview="${previewText(textContent)}"`
				);
				if (role === "assistant") {
					this.loggedStreamContent = "";
				}
				break;
			}

			case "agent_error":
				this.healthMonitor.recordError(
					(event as any).error?.message ?? "Unknown agent error"
				);
				console.error(`[LLM Event] agent_error:`, (event as any).error);
				break;
		}
	}

	private applyLoopProtection(event: { toolName?: string; args?: unknown }): void {
		if (!this.agent || !this.sessionId || !event.toolName) {
			return;
		}

		const detector = getLoopDetector(this.sessionId);
		const result = detector.record(event.toolName, event.args ?? {});
		if (result.type === 'ok') {
			return;
		}

		const workingSummary = createWorkingSummaryMessage(this.agent.state.messages as AgentMessage[]);
		const summaryText =
			workingSummary && 'content' in workingSummary && Array.isArray(workingSummary.content)
				? ((workingSummary.content[0] as { text?: string } | undefined)?.text ?? '')
				: '';
		const warningText = workingSummary
			? `${result.message}\n\n${summaryText}`
			: result.message;
		const warningMessage: SyntheticSystemMessage = {
			role: "system",
			content: [
				{
					type: "text",
					text: warningText,
				},
			],
		};

		this.agent.appendMessage(warningMessage as unknown as AgentMessage);
		console.error(`[LLM LoopGuard] ${result.type} — ${result.toolName} x${result.count}`);
	}

	/**
	 * 检查 Agent 是否已初始化
	 */
	isInitialized(): boolean {
		return this.state.isInitialized && this.agent !== null;
	}

	/**
	 * 获取健康状态
	 */
	healthCheck(): AgentHealthStatus {
		return this.healthMonitor.getHealthStatus();
	}

	/**
	 * 获取健康监控器实例
	 */
	getHealthMonitor(): HealthMonitor {
		return this.healthMonitor;
	}

	/**
	 * 发送消息给 Agent
	 */
	async prompt(
		message: string | AgentMessage | AgentMessage[],
		images?: Array<{ type: "image"; data: string; mimeType: string }>
	): Promise<void> {
		if (!this.agent) {
			throw new Error("Agent 未初始化");
		}
		if (this.isDestroyed) {
			throw new Error("Agent 已销毁");
		}

		const historyBeforeCompression = this.agent.state.messages.length;
		const compression = compressRecentTrace(this.agent.state.messages as AgentMessage[]);
		if (compression.compressed) {
			this.agent.replaceMessages(compression.messages);
			console.error(
				`[LLM] >>> Compressed message history: ${historyBeforeCompression} → ${compression.messages.length} | preservedTrace=${compression.preservedTraceCount}`
			);
		}

		const workingSummary = createWorkingSummaryMessage(this.agent.state.messages as AgentMessage[]);
		if (workingSummary) {
			this.agent.appendMessage(workingSummary);
			console.error(`[LLM] >>> Working summary injected before prompt`);
		}

		// LLM 调用日志
		const promptPreview = typeof message === "string"
			? message.slice(0, 150)
			: Array.isArray(message)
				? message.map(m => `${m.role}: ${typeof (m as any).content === "string" ? (m as any).content.slice(0, 100) : "[complex]"}`).join(" | ")
				: `${(message as any).role}: ${typeof (message as any).content === "string" ? (message as any).content.slice(0, 100) : "[complex]"}`;
		const msgCount = this.agent.state.messages?.length ?? 0;
		const modelInfo = {
			provider: this.agent.state.model.provider,
			id: this.agent.state.model.id,
		};
		const thinkingLevel = this.agent.state.thinkingLevel;
		const toolCount = this.agent.state.tools?.length ?? 0;

		console.error(`[LLM] >>> Prompt called | Model: ${modelInfo.provider}/${modelInfo.id} | Thinking: ${thinkingLevel} | History msgs: ${msgCount} | Tools: ${toolCount}`);
		console.error(`[LLM] >>> Prompt preview: ${promptPreview}`);
		if (images && images.length > 0) {
			console.error(`[LLM] >>> Images: ${images.length} attached`);
		}

		const t0 = Date.now();
		try {
			await this.agent.prompt(message as string, images);
			const elapsed = Date.now() - t0;
			console.error(`[LLM] <<< Prompt completed | Elapsed: ${elapsed}ms`);
		} catch (error) {
			const elapsed = Date.now() - t0;
			const agentError = error instanceof Error ? error : new Error(String(error));
			this.state.uiState.isThinking = false;
			this.state.uiState.activeTools = [];
			this.healthMonitor.markProcessingEnd();
			this.healthMonitor.recordError(agentError.message);
			this.eventEmitter.emit({
				type: "agent_error",
				error: agentError,
			} as unknown as AgentEvent);
			console.error(`[LLM] <<< Prompt failed | Elapsed: ${elapsed}ms | ${agentError.message}`);
			throw agentError;
		}
	}

	/**
	 * 继续上一次请求（用于重试）
	 */
	async continue(): Promise<void> {
		if (!this.agent) {
			throw new Error("Agent 未初始化");
		}
		if (this.isDestroyed) {
			throw new Error("Agent 已销毁");
		}

		await this.agent.continue();
	}

	/**
	 * 订阅事件
	 */
	subscribe(listener: (event: AgentEvent) => void): () => void {
		return this.eventEmitter.subscribe(listener);
	}

	/**
	 * 设置系统提示词
	 */
	setSystemPrompt(prompt: string): void {
		if (!this.agent) {
			throw new Error("Agent 未初始化");
		}
		this.agent.setSystemPrompt(prompt);
	}

	/**
	 * 设置思考级别
	 */
	setThinkingLevel(level: "off" | "minimal" | "low" | "medium" | "high"): void {
		if (!this.agent) {
			throw new Error("Agent 未初始化");
		}
		(this.agent as any).setThinkingLevel?.(level);
	}

	/**
	 * 设置模型
	 */
	setModel(model: Model<any>): void {
		if (!this.agent) {
			throw new Error("Agent 未初始化");
		}
		this.agent.setModel(model);
	}

	/**
	 * 设置工具
	 */
	setTools(tools: AgentTool<any>[]): void {
		if (!this.agent) {
			throw new Error("Agent 未初始化");
		}
		this.agent.setTools(tools);
	}

	/**
	 * 注册单个工具
	 */
	registerTool(tool: AgentTool<any>): void {
		if (!this.agent) {
			throw new Error("Agent 未初始化");
		}
		this.agent.setTools([...this.agent.state.tools, tool]);
	}

	/**
	 * 移除工具
	 */
	unregisterTool(toolName: string): void {
		if (!this.agent) {
			throw new Error("Agent 未初始化");
		}
		this.agent.setTools(
			this.agent.state.tools.filter((t) => t.name !== toolName)
		);
	}

	/**
	 * 清空所有消息
	 */
	clearMessages(): void {
		if (!this.agent) {
			throw new Error("Agent 未初始化");
		}
		this.agent.clearMessages();
	}

	/**
	 * 替换所有消息
	 */
	replaceMessages(messages: AgentMessage[]): void {
		if (!this.agent) {
			throw new Error("Agent 未初始化");
		}
		this.agent.replaceMessages(messages);
	}

	/**
	 * 追加消息
	 */
	appendMessage(message: AgentMessage): void {
		if (!this.agent) {
			throw new Error("Agent 未初始化");
		}
		this.agent.appendMessage(message);
	}

	/**
	 * 中断当前操作
	 */
	abort(): void {
		if (!this.agent) {
			return;
		}
		this.agent.abort();
	}

	/**
	 * 等待空闲状态
	 */
	async waitForIdle(): Promise<void> {
		if (!this.agent) {
			return;
		}
		await this.agent.waitForIdle();
	}

	/**
	 * 获取会话状态
	 */
	async getSessionState(): Promise<SessionData> {
		if (!this.agent) {
			throw new Error("Agent 未初始化");
		}

		return {
			sessionId: this.sessionId,
			messages: this.agent.state.messages,
			systemPrompt: this.agent.state.systemPrompt,
			model: {
				provider: this.agent.state.model.provider || "unknown",
				id: this.agent.state.model.id || "unknown",
			},
			createdAt: Date.now(),
			updatedAt: Date.now(),
			projectContext: this.projectContext,
		};
	}

	/**
	 * 销毁 Agent
	 */
	destroy(): void {
		if (this.sessionId) {
			removeLoopDetector(this.sessionId);
		}
		this.isDestroyed = true;
		this.eventEmitter.clear();
		this.healthMonitor.markAsStopped();
		// pi-agent-core 的 Agent 没有显式的 destroy 方法
		// 只需要清理我们的引用和事件监听器
		this.agent = null;
		this.state.isInitialized = false;
	}

	/**
	 * 正确停止 Agent
	 */
	stop(): void {
		this.healthMonitor.markAsStopped();
		this.abort();
	}
}

// ============================================================================
// 辅助类型
// ============================================================================

/**
 * 会话数据
 */
export interface SessionData {
	sessionId: string;
	messages: AgentMessage[];
	systemPrompt: string;
	model: {
		provider: string;
		id: string;
	};
	createdAt: number;
	updatedAt: number;
	projectContext?: ProjectContext;
}

/**
 * 创建 OriginOS Agent 的工厂函数
 */
export interface CreateOriginOSAgentParams {
	/**
	 * 会话ID
	 */
	sessionId: string;

	/**
	 * 系统提示词
	 */
	systemPrompt?: string;

	/**
	 * 系统提示词变量
	 */
	variables?: SystemPromptVariables;

	/**
	 * 模型（可选）
	 */
	model?: Model<any>;

	/**
	 * 思考级别（可选）
	 */
	thinkingLevel?: ThinkingLevel;

	/**
	 * 是否使用基础模型（降级选项）
	 */
	useBaseModel?: boolean;

	/**
	 * 代理自带的健康监控器（可选）
	 */
	healthMonitor?: HealthMonitor;

	/**
	 * 运行时 LLM 配置（可选，覆盖环境变量）
	 */
	llmConfig?: RuntimeLLMConfig;
}

/**
 * 创建未初始化的 OriginOS Agent
 */
export function createOriginOSAgent(
	params: CreateOriginOSAgentParams
): OriginOSAgent {
	const { sessionId, variables, model, thinkingLevel, useBaseModel, healthMonitor, llmConfig } =
		params;

	// 获取配置状态
	const configStatus = getConfigStatus();

	// 调试日志
	console.log('[createOriginOSAgent] Config status:', configStatus);
	console.log('[createOriginOSAgent] Env ANTHROPIC_AUTH_TOKEN:', process.env['ANTHROPIC_AUTH_TOKEN']);
	console.log('[createOriginOSAgent] Env ANTHROPIC_BASE_URL:', process.env['ANTHROPIC_BASE_URL']);
	console.log('[createOriginOSAgent] Env ANTHROPIC_MODEL:', process.env['ANTHROPIC_MODEL']);

	// 根据 provider 和配置选择模型
	let agentModel: Model<any>;
	const modelOptions = llmConfig?.maxTokens ? { maxTokens: llmConfig.maxTokens } : undefined;

	if (model) {
		// 用户明确指定了模型
		agentModel = model;
	} else if (llmConfig) {
		// 用户运行时配置优先级最高，不通过 process.env 间接传递
		agentModel = createRuntimeModel(llmConfig);
	} else if (useBaseModel || configStatus.defaultProvider === "google") {
		// 使用 Google 模型作为基础模型或备选
		agentModel = createGoogleModel("gemini-2.5-flash-preview-05-20");
	} else if (configStatus.llmProvider === "azure-openai" || configStatus.defaultProvider === "azure") {
		// Azure OpenAI 直连（显式设置或检测到配置）
		agentModel = createAutoModel(undefined, modelOptions);
	} else if (configStatus.useOpenAICompatible) {
		// 使用 OpenAI 兼容 API（自动检测或显式配置）
		agentModel = createAutoModel(undefined, modelOptions);
	} else if (configStatus.hasAnthropicKey) {
		// 使用 Anthropic 模型，支持自定义 baseUrl 和模型 ID
		agentModel = createAnthropicModel(); // 不传 modelId，让函数从环境变量获取
	} else {
		// 默认使用自动选择
		agentModel = createAutoModel(undefined, modelOptions);
	}

	// 确保 maxTokens 被应用（兜底）
	if (llmConfig?.maxTokens && agentModel) {
		agentModel.maxTokens = llmConfig.maxTokens;
	}

	// 调试：查看创建的模型配置
	const debugCredential = (agentModel as any).apiKey || (agentModel as any).authToken;
	console.log('[createOriginOSAgent] Created model:', {
		id: agentModel.id,
		api: agentModel.api,
		provider: agentModel.provider,
		baseUrl: (agentModel as any).baseUrl,
		hasCredential: !!debugCredential,
		credentialSource: (agentModel as any).credentialSource || (llmConfig?.anthropicAuthToken || llmConfig?.authToken
			? 'user.anthropicAuthToken'
			: llmConfig?.anthropicApiKey || llmConfig?.apiKey
				? 'user.anthropicApiKey'
				: 'env/default'),
		credentialAuthMode: (agentModel as any).credentialAuthMode || (debugCredential?.includes?.('sk-ant-oat') ? 'oauth' : 'api-key'),
		credentialPrefix: debugCredential ? debugCredential.substring(0, 15) + '...' : 'none',
	});

	const projectContext = variables
		? {
				projectId: variables.projectId || "default",
				ontologyId: variables.ontologyId,
				projectName: variables.projectName,
				currentPath: variables.projectPath,
				userId: variables.userId,
			}
		: { projectId: "default" };

	const systemPrompt =
		params.systemPrompt ||
		(variables
			? `You are OriginOS AI assistant. You are working on project: ${variables.projectName || "unnamed"}`
			: "You are OriginOS AI assistant.");

	const config: OriginOSAgentConfig = {
		sessionId,
		systemPrompt,
		model: agentModel,
		projectContext,
		thinkingLevel: (thinkingLevel || "low") as OriginOSAgentConfig['thinkingLevel'],
		tools: [],
	};

	// 返回未初始化的 Agent，用户需要调用 start() 方法
	return new OriginOSAgent(config, healthMonitor);
}
