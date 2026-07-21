"use strict";
/**
 * OriginOS Agent 核心包装类
 * 包装 pi-agent-core 的 Agent，提供 OriginOS 特定的功能
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OriginOSAgent = void 0;
exports.createOriginOSAgent = createOriginOSAgent;
const agent_1 = require("@mariozechner/agent");
const piAi = __importStar(require("@mariozechner/pi-ai"));
const agent_2 = require("../../../../types/agent");
const health_1 = require("../health");
const server_config_1 = require("../server-config");
const recent_trace_compression_1 = require("../recent-trace-compression");
const loop_detector_1 = require("../tools/loop-detector");
const runtime_working_summary_1 = require("../runtime-working-summary");
const stream_dedupe_1 = require("../stream-dedupe");
// ============================================================================
// Event Emitter
// ============================================================================
/**
 * 简单的事件发射器
 */
class EventEmitter {
    constructor() {
        this.listeners = new Set();
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    emit(event) {
        for (const listener of this.listeners) {
            listener(event);
        }
    }
    clear() {
        this.listeners.clear();
    }
}
function normalizeStreamProvider(stream, provider) {
    const rewriteMessage = (message) => {
        message.provider = provider;
        return message;
    };
    const rewriteEvent = (event) => {
        if ("partial" in event) {
            rewriteMessage(event.partial);
        }
        if ("message" in event) {
            rewriteMessage(event.message);
        }
        return event;
    };
    return {
        [Symbol.asyncIterator]: async function* () {
            for await (const event of stream) {
                yield rewriteEvent(event);
            }
        },
        result: async () => rewriteMessage(await stream.result()),
    };
}
function hashText(text) {
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
function previewText(text, max = 80) {
    return text.replace(/\s+/g, " ").slice(0, max);
}
// ============================================================================
// OriginOS Agent
// ============================================================================
/**
 * OriginOS Agent 类
 * 包装 pi-agent-core 的 Agent，添加 OriginOS 特定功能
 */
class OriginOSAgent {
    constructor(config, healthMonitor) {
        this.agent = null;
        this.eventEmitter = new EventEmitter();
        this.isDestroyed = false;
        this.loggedStreamContent = "";
        this.assistantStreamContent = "";
        this.assistantLoopGuardTriggered = false;
        this.turnSequence = 0;
        this.activeTurnSequence = 0;
        this.assistantMessageSequence = 0;
        this.activeAssistantMessageSequence = 0;
        this.previousAssistantTextHash = "";
        this.previousAssistantTurnSequence = 0;
        /**
         * Agent 状态
         */
        this.state = {
            isInitialized: false,
            sessionId: "",
            uiState: {
                isThinking: false,
                activeTools: [],
            },
        };
        this.config = config;
        this.sessionId = config.sessionId ?? "";
        this.projectContext = config.projectContext ?? { projectId: "" };
        this.state.sessionId = config.sessionId ?? "";
        this.state.projectContext = config.projectContext;
        this.healthMonitor = healthMonitor ?? (0, health_1.createHealthMonitor)();
        // 设置 Agent 引用到健康监控器
        this.healthMonitor.setAgent(this);
        // 自动初始化（保持向后兼容性）
        this.initialize(config);
    }
    /**
     * 初始化 Agent
     */
    initialize(config) {
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
        this.healthMonitor.setStatus(agent_2.AgentStatus.INITIALIZING);
        // 转换自定义消息类型到 LLM 消息格式
        // 包含 token 预算管理：超出 contextWindow 时截断旧消息
        const convertToLlm = (messages) => {
            // 过滤有效消息
            const validMessages = messages.filter((m) => {
                const role = m.role;
                return role === "user" || role === "assistant" || role === "toolResult";
            });
            // Token 预算管理
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const modelAny = this.config?.model;
            const contextWindow = modelAny?.contextWindow ?? 128000;
            const maxOutputTokens = modelAny?.maxTokens ?? 16384;
            const tokenBudget = contextWindow - maxOutputTokens - 4000; // 预留 system prompt + buffer
            // 估算 token 数（chars/4 启发式，中文约 2 chars/token）
            const estimateTokens = (content) => {
                if (typeof content === 'string') {
                    return Math.ceil(content.length / 3);
                }
                if (Array.isArray(content)) {
                    return content.reduce((sum, c) => {
                        if (c && typeof c === 'object' && 'text' in c) {
                            return sum + Math.ceil(c.text.length / 3);
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
            const truncateMessage = (msg) => {
                const tokens = estimateTokens(msg.content);
                if (tokens <= maxSingleMessageTokens)
                    return msg;
                // 截断内容
                if (typeof msg.content === 'string') {
                    const maxChars = maxSingleMessageTokens * 3;
                    const truncated = msg.content.slice(0, maxChars) + '\n\n[内容已截断，超出 token 限制]';
                    return { ...msg, content: truncated };
                }
                if (Array.isArray(msg.content)) {
                    let charCount = 0;
                    const maxChars = maxSingleMessageTokens * 3;
                    const truncated = [];
                    for (const c of msg.content) {
                        if (c && typeof c === 'object' && 'text' in c) {
                            const text = c.text;
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
            const keptMessages = [];
            for (let i = validMessages.length - 1; i >= 0; i--) {
                const rawMsg = validMessages[i];
                if (!rawMsg)
                    continue;
                const msg = truncateMessage(rawMsg); // 截断单条超大消息
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
        const getRuntimeModel = () => {
            const currentModel = this.agent?.state?.model;
            return currentModel ?? this.config?.model ?? {};
        };
        // 提取凭证：bearer 模式下 token 保留在 authToken，不能再注入 options.apiKey。
        const initialModel = getRuntimeModel();
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
        const streamFnWithToolChoice = (model, context, options) => {
            const opts = { ...(options || {}) };
            opts['toolChoice'] = 'auto';
            const currentModel = getRuntimeModel() ?? model;
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
                    ...(streamModel.headers ?? {}),
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
                };
            }
            else if (currentModelApiKey && !opts['apiKey']) {
                opts['apiKey'] = currentModelApiKey;
            }
            // 调试：确认凭证传递
            const finalCredential = opts['apiKey'] || streamModel?.apiKey || streamModel?.authToken;
            console.error(`[streamFn] credential check: hasOptsApiKey=${!!opts['apiKey']}, modelApiKey=${currentModelApiKey ? 'set' : 'null'}, model.authToken=${streamModel?.authToken ? 'set' : 'null'}, bearer=${currentModelUsesBearerAuth}, final=${finalCredential ? finalCredential.toString().slice(0, 10) + '...' : 'NONE'}`);
            console.error(`[streamFn] Calling pi-ai streamSimple with model:`, {
                id: streamModel.id,
                api: streamModel.api,
                provider: streamModel.provider,
                baseUrl: streamModel.baseUrl,
            });
            console.error(`[streamFn] Context messages count:`, context.messages?.length);
            const stream = piAi.streamSimple(streamModel, context, opts);
            return currentModelUsesBearerAuth ? normalizeStreamProvider(stream, model.provider) : stream;
        };
        // 检查模型是否支持 thinking（reasoning: false 表示不支持）
        const modelReasoning = this.config.model?.reasoning;
        const thinkingLevel = modelReasoning === false ? "off" : (this.config.thinkingLevel ?? "low");
        this.agent = new agent_1.Agent({
            initialState: {
                systemPrompt: this.config.systemPrompt,
                model: this.config.model,
                thinkingLevel,
                tools: this.config.tools ?? [],
                messages: [],
            },
            convertToLlm,
            // 提供 getApiKey 回调，确保 API key 可用于所有 provider
            getApiKey: async (_provider) => {
                // 优先使用当前模型配置中的 API key，支持 setModel() 后热切换
                return getRuntimeModel()?.apiKey;
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
    async start(config) {
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
    handleAgentEvent(event) {
        switch (event.type) {
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
                console.error(`[LLM Event] agent_end — messages=${event.messages?.length ?? 0}`);
                break;
            case "turn_start":
                this.activeTurnSequence = ++this.turnSequence;
                this.state.uiState.isThinking = true;
                this.healthMonitor.markProcessingStart();
                console.error(`[LLM Event] turn_start — turnSeq=${this.activeTurnSequence}`);
                break;
            case "turn_end": {
                const turnEnd = event;
                const msg = turnEnd.message;
                const toolCount = turnEnd.toolResults?.length ?? 0;
                const hasToolCalls = msg?.content?.filter?.((c) => c.type === "toolCall")?.length ?? 0;
                this.state.uiState.isThinking = false;
                this.healthMonitor.markProcessingEnd();
                this.healthMonitor.recordMessageHandled();
                // 详细日志：打印 turn 结束时的完整消息结构
                console.error(`[LLM Event] turn_end — turnSeq=${this.activeTurnSequence}, toolCalls=${hasToolCalls}, toolResults=${toolCount}`);
                if (msg) {
                    const assistantText = Array.isArray(msg.content)
                        ? msg.content
                            .filter((block) => block.type === "text" && block.text != null)
                            .map((block) => block.text)
                            .join("")
                        : "";
                    const assistantTextHash = hashText(assistantText);
                    const sameAsPreviousAssistant = msg.role === "assistant" &&
                        assistantText.length > 0 &&
                        assistantTextHash === this.previousAssistantTextHash;
                    console.error(`[LLM Turn Detail] turnSeq=${this.activeTurnSequence}, model=${msg.model ?? 'unknown'}, provider=${msg.provider ?? 'unknown'}, api=${msg.api ?? 'unknown'}, stopReason=${msg.stopReason ?? 'unknown'}, assistantTextHash=${assistantTextHash}, sameAsPreviousAssistant=${sameAsPreviousAssistant}${sameAsPreviousAssistant ? `, previousTurnSeq=${this.previousAssistantTurnSequence}` : ""}`);
                    if (msg.content && Array.isArray(msg.content)) {
                        msg.content.forEach((block, i) => {
                            if (block.type === "toolCall") {
                                console.error(`[LLM Turn Detail]   toolCall[${i}]: name=${block.name}, id=${block.id}, args=${JSON.stringify(block.arguments).slice(0, 300)}`);
                            }
                            else if (block.type === "text") {
                                console.error(`[LLM Turn Detail]   text[${i}]: len=${block.text?.length ?? 0}, preview="${(block.text ?? '').slice(0, 100)}"`);
                            }
                            else if (block.type === "thinking") {
                                console.error(`[LLM Turn Detail]   thinking[${i}]: len=${block.thinking?.length ?? 0}`);
                            }
                            else {
                                console.error(`[LLM Turn Detail]   block[${i}]: type=${block.type}`);
                            }
                        });
                    }
                    if (toolCount > 0) {
                        turnEnd.toolResults.forEach((tr, i) => {
                            const content = tr.content?.map((c) => c.type === 'text' ? c.text : `[${c.type}]`).join('') ?? '';
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
                this.applyLoopProtection(event);
                this.state.uiState.activeTools.push({
                    toolName: event.toolName,
                    startTime: Date.now(),
                });
                console.error(`[LLM Event] tool_start — ${event.toolName}`);
                break;
            case "tool_execution_end": {
                this.state.uiState.activeTools =
                    this.state.uiState.activeTools.filter((t) => t.toolName !== event.toolName);
                const toolEndEvent = event;
                const resultContent = toolEndEvent.result?.content;
                const resultText = Array.isArray(resultContent)
                    ? resultContent.filter((c) => c.type === 'text').map((c) => c.text).join('')
                    : typeof resultContent === 'string' ? resultContent : JSON.stringify(toolEndEvent.result ?? '');
                console.error(`[LLM Event] tool_end — ${event.toolName}${event.isError ? ' (ERROR)' : ''}\n[ToolResult] ${resultText}`);
                break;
            }
            case "message_start": {
                const msg = event.message;
                const role = msg?.role || "unknown";
                if (role === "assistant") {
                    this.activeAssistantMessageSequence = ++this.assistantMessageSequence;
                    this.loggedStreamContent = "";
                    this.assistantStreamContent = "";
                    this.assistantLoopGuardTriggered = false;
                }
                else {
                    this.activeAssistantMessageSequence = 0;
                }
                console.error(`[LLM Event] message_start — role=${role}, turnSeq=${this.activeTurnSequence}${role === "assistant" ? `, assistantMsgSeq=${this.activeAssistantMessageSequence}` : ""}`);
                break;
            }
            case "message_update": {
                const update = event;
                const eventType = update.assistantMessageEvent?.type || "unknown";
                // Print text/thinking deltas (to stderr to avoid corrupting JSON Line stdout in worker mode)
                if (eventType === "text_delta") {
                    let delta = update.assistantMessageEvent?.delta || "";
                    if (this.assistantLoopGuardTriggered) {
                        update.assistantMessageEvent.delta = "";
                        break;
                    }
                    if (delta.length > 0) {
                        const merged = (0, stream_dedupe_1.getVisibleStreamDelta)(this.assistantStreamContent, delta);
                        const trimmed = (0, stream_dedupe_1.trimRepeatingTail)(merged.content);
                        if (trimmed.trimmed) {
                            update.assistantMessageEvent.delta = trimmed.content.startsWith(this.assistantStreamContent)
                                ? trimmed.content.slice(this.assistantStreamContent.length)
                                : "";
                            this.assistantStreamContent = trimmed.content;
                            this.loggedStreamContent = trimmed.content;
                            this.assistantLoopGuardTriggered = true;
                            console.error(`\n[LLM LoopGuard] repeated assistant output detected — turnSeq=${this.activeTurnSequence}, assistantMsgSeq=${this.activeAssistantMessageSequence}, patternLen=${trimmed.pattern?.length ?? 0}, repetitions=${trimmed.repetitions ?? 0}, textHash=${hashText(trimmed.content)}, preview="${previewText(trimmed.content)}"`);
                            this.agent?.abort();
                            delta = update.assistantMessageEvent.delta;
                        }
                        else {
                            update.assistantMessageEvent.delta = merged.delta;
                            this.assistantStreamContent = merged.content;
                            delta = merged.delta;
                        }
                        if (delta.length > 0) {
                            const logMerged = (0, stream_dedupe_1.getVisibleStreamDelta)(this.loggedStreamContent, delta);
                            this.loggedStreamContent = logMerged.content;
                            if (logMerged.delta.length > 0) {
                                process.stderr.write(logMerged.delta);
                            }
                        }
                    }
                }
                else if (eventType === "thinking_delta") {
                    const delta = update.assistantMessageEvent?.delta || "";
                    if (delta.length > 0) {
                        const merged = (0, stream_dedupe_1.getVisibleStreamDelta)(this.loggedStreamContent, delta);
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
                const msg = event.message;
                const role = msg?.role || "unknown";
                if (role === "assistant" && this.assistantLoopGuardTriggered && Array.isArray(msg?.content)) {
                    const textBlock = msg.content.find((block) => block?.type === "text" && block.text != null);
                    if (textBlock) {
                        textBlock.text = this.assistantStreamContent;
                    }
                }
                const hasToolCalls = msg?.content?.filter?.((c) => c.type === "toolCall")?.length ?? 0;
                const textContent = Array.isArray(msg?.content)
                    ? msg.content.filter((b) => b.type === "text" && b.text != null).map((b) => b.text).join("")
                    : "";
                const stopReason = msg?.stopReason || "";
                console.error(`\n[LLM Event] message_end — role=${role}, turnSeq=${this.activeTurnSequence}${role === "assistant" ? `, assistantMsgSeq=${this.activeAssistantMessageSequence}` : ""}, stopReason=${stopReason}, toolCalls=${hasToolCalls}, textLen=${textContent.length}, textHash=${hashText(textContent)}, loopGuard=${role === "assistant" ? this.assistantLoopGuardTriggered : false}, preview="${previewText(textContent)}"`);
                if (role === "assistant") {
                    this.loggedStreamContent = "";
                }
                break;
            }
            case "agent_error":
                this.healthMonitor.recordError(event.error?.message ?? "Unknown agent error");
                console.error(`[LLM Event] agent_error:`, event.error);
                break;
        }
    }
    applyLoopProtection(event) {
        if (!this.agent || !this.sessionId || !event.toolName) {
            return;
        }
        const detector = (0, loop_detector_1.getLoopDetector)(this.sessionId);
        const result = detector.record(event.toolName, event.args ?? {});
        if (result.type === 'ok') {
            return;
        }
        const workingSummary = (0, runtime_working_summary_1.createWorkingSummaryMessage)(this.agent.state.messages);
        const summaryText = workingSummary && 'content' in workingSummary && Array.isArray(workingSummary.content)
            ? (workingSummary.content[0]?.text ?? '')
            : '';
        const warningText = workingSummary
            ? `${result.message}\n\n${summaryText}`
            : result.message;
        const warningMessage = {
            role: "system",
            content: [
                {
                    type: "text",
                    text: warningText,
                },
            ],
        };
        this.agent.appendMessage(warningMessage);
        console.error(`[LLM LoopGuard] ${result.type} — ${result.toolName} x${result.count}`);
    }
    /**
     * 检查 Agent 是否已初始化
     */
    isInitialized() {
        return this.state.isInitialized && this.agent !== null;
    }
    /**
     * 获取健康状态
     */
    healthCheck() {
        return this.healthMonitor.getHealthStatus();
    }
    /**
     * 获取健康监控器实例
     */
    getHealthMonitor() {
        return this.healthMonitor;
    }
    /**
     * 发送消息给 Agent
     */
    async prompt(message, images) {
        if (!this.agent) {
            throw new Error("Agent 未初始化");
        }
        if (this.isDestroyed) {
            throw new Error("Agent 已销毁");
        }
        const historyBeforeCompression = this.agent.state.messages.length;
        const compression = (0, recent_trace_compression_1.compressRecentTrace)(this.agent.state.messages);
        if (compression.compressed) {
            this.agent.replaceMessages(compression.messages);
            console.error(`[LLM] >>> Compressed message history: ${historyBeforeCompression} → ${compression.messages.length} | preservedTrace=${compression.preservedTraceCount}`);
        }
        const workingSummary = (0, runtime_working_summary_1.createWorkingSummaryMessage)(this.agent.state.messages);
        if (workingSummary) {
            this.agent.appendMessage(workingSummary);
            console.error(`[LLM] >>> Working summary injected before prompt`);
        }
        // LLM 调用日志
        const promptPreview = typeof message === "string"
            ? message.slice(0, 150)
            : Array.isArray(message)
                ? message.map(m => `${m.role}: ${typeof m.content === "string" ? m.content.slice(0, 100) : "[complex]"}`).join(" | ")
                : `${message.role}: ${typeof message.content === "string" ? message.content.slice(0, 100) : "[complex]"}`;
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
            await this.agent.prompt(message, images);
            const elapsed = Date.now() - t0;
            console.error(`[LLM] <<< Prompt completed | Elapsed: ${elapsed}ms`);
        }
        catch (error) {
            const elapsed = Date.now() - t0;
            const agentError = error instanceof Error ? error : new Error(String(error));
            this.state.uiState.isThinking = false;
            this.state.uiState.activeTools = [];
            this.healthMonitor.markProcessingEnd();
            this.healthMonitor.recordError(agentError.message);
            this.eventEmitter.emit({
                type: "agent_error",
                error: agentError,
            });
            console.error(`[LLM] <<< Prompt failed | Elapsed: ${elapsed}ms | ${agentError.message}`);
            throw agentError;
        }
    }
    /**
     * 继续上一次请求（用于重试）
     */
    async continue() {
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
    subscribe(listener) {
        return this.eventEmitter.subscribe(listener);
    }
    /**
     * 设置系统提示词
     */
    setSystemPrompt(prompt) {
        if (!this.agent) {
            throw new Error("Agent 未初始化");
        }
        this.agent.setSystemPrompt(prompt);
    }
    /**
     * 设置思考级别
     */
    setThinkingLevel(level) {
        if (!this.agent) {
            throw new Error("Agent 未初始化");
        }
        this.agent.setThinkingLevel?.(level);
    }
    /**
     * 设置模型
     */
    setModel(model) {
        if (!this.agent) {
            throw new Error("Agent 未初始化");
        }
        this.agent.setModel(model);
    }
    /**
     * 设置工具
     */
    setTools(tools) {
        if (!this.agent) {
            throw new Error("Agent 未初始化");
        }
        this.agent.setTools(tools);
    }
    /**
     * 注册单个工具
     */
    registerTool(tool) {
        if (!this.agent) {
            throw new Error("Agent 未初始化");
        }
        this.agent.setTools([...this.agent.state.tools, tool]);
    }
    /**
     * 移除工具
     */
    unregisterTool(toolName) {
        if (!this.agent) {
            throw new Error("Agent 未初始化");
        }
        this.agent.setTools(this.agent.state.tools.filter((t) => t.name !== toolName));
    }
    /**
     * 清空所有消息
     */
    clearMessages() {
        if (!this.agent) {
            throw new Error("Agent 未初始化");
        }
        this.agent.clearMessages();
    }
    /**
     * 替换所有消息
     */
    replaceMessages(messages) {
        if (!this.agent) {
            throw new Error("Agent 未初始化");
        }
        this.agent.replaceMessages(messages);
    }
    /**
     * 追加消息
     */
    appendMessage(message) {
        if (!this.agent) {
            throw new Error("Agent 未初始化");
        }
        this.agent.appendMessage(message);
    }
    /**
     * 中断当前操作
     */
    abort() {
        if (!this.agent) {
            return;
        }
        this.agent.abort();
    }
    /**
     * 等待空闲状态
     */
    async waitForIdle() {
        if (!this.agent) {
            return;
        }
        await this.agent.waitForIdle();
    }
    /**
     * 获取会话状态
     */
    async getSessionState() {
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
    destroy() {
        if (this.sessionId) {
            (0, loop_detector_1.removeLoopDetector)(this.sessionId);
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
    stop() {
        this.healthMonitor.markAsStopped();
        this.abort();
    }
}
exports.OriginOSAgent = OriginOSAgent;
/**
 * 创建未初始化的 OriginOS Agent
 */
function createOriginOSAgent(params) {
    const { sessionId, variables, model, thinkingLevel, useBaseModel, healthMonitor, llmConfig } = params;
    // 获取配置状态
    const configStatus = (0, server_config_1.getConfigStatus)();
    // 调试日志
    console.log('[createOriginOSAgent] Config status:', configStatus);
    console.log('[createOriginOSAgent] Env ANTHROPIC_AUTH_TOKEN:', process.env['ANTHROPIC_AUTH_TOKEN']);
    console.log('[createOriginOSAgent] Env ANTHROPIC_BASE_URL:', process.env['ANTHROPIC_BASE_URL']);
    console.log('[createOriginOSAgent] Env ANTHROPIC_MODEL:', process.env['ANTHROPIC_MODEL']);
    // 根据 provider 和配置选择模型
    let agentModel;
    const modelOptions = llmConfig?.maxTokens ? { maxTokens: llmConfig.maxTokens } : undefined;
    if (model) {
        // 用户明确指定了模型
        agentModel = model;
    }
    else if (llmConfig) {
        // 用户运行时配置优先级最高，不通过 process.env 间接传递
        agentModel = (0, server_config_1.createRuntimeModel)(llmConfig);
    }
    else if (useBaseModel || configStatus.defaultProvider === "google") {
        // 使用 Google 模型作为基础模型或备选
        agentModel = (0, server_config_1.createGoogleModel)("gemini-2.5-flash-preview-05-20");
    }
    else if (configStatus.llmProvider === "azure-openai" || configStatus.defaultProvider === "azure") {
        // Azure OpenAI 直连（显式设置或检测到配置）
        agentModel = (0, server_config_1.createAutoModel)(undefined, modelOptions);
    }
    else if (configStatus.useOpenAICompatible) {
        // 使用 OpenAI 兼容 API（自动检测或显式配置）
        agentModel = (0, server_config_1.createAutoModel)(undefined, modelOptions);
    }
    else if (configStatus.hasAnthropicKey) {
        // 使用 Anthropic 模型，支持自定义 baseUrl 和模型 ID
        agentModel = (0, server_config_1.createAnthropicModel)(); // 不传 modelId，让函数从环境变量获取
    }
    else {
        // 默认使用自动选择
        agentModel = (0, server_config_1.createAutoModel)(undefined, modelOptions);
    }
    // 确保 maxTokens 被应用（兜底）
    if (llmConfig?.maxTokens && agentModel) {
        agentModel.maxTokens = llmConfig.maxTokens;
    }
    // 调试：查看创建的模型配置
    const debugCredential = agentModel.apiKey || agentModel.authToken;
    console.log('[createOriginOSAgent] Created model:', {
        id: agentModel.id,
        api: agentModel.api,
        provider: agentModel.provider,
        baseUrl: agentModel.baseUrl,
        hasCredential: !!debugCredential,
        credentialSource: agentModel.credentialSource || (llmConfig?.anthropicAuthToken || llmConfig?.authToken
            ? 'user.anthropicAuthToken'
            : llmConfig?.anthropicApiKey || llmConfig?.apiKey
                ? 'user.anthropicApiKey'
                : 'env/default'),
        credentialAuthMode: agentModel.credentialAuthMode || (debugCredential?.includes?.('sk-ant-oat') ? 'oauth' : 'api-key'),
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
    const systemPrompt = params.systemPrompt ||
        (variables
            ? `You are OriginOS AI assistant. You are working on project: ${variables.projectName || "unnamed"}`
            : "You are OriginOS AI assistant.");
    const config = {
        sessionId,
        systemPrompt,
        model: agentModel,
        projectContext,
        thinkingLevel: (thinkingLevel || "low"),
        tools: [],
    };
    // 返回未初始化的 Agent，用户需要调用 start() 方法
    return new OriginOSAgent(config, healthMonitor);
}
