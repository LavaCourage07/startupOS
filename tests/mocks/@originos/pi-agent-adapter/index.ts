/**
 * Mock implementation of @originos/pi-agent-adapter package.
 * Created for testing purposes since workspace packages may not be fully built
 */

import type { TSchema } from "@sinclair/typebox";

// ============================================================================
// Types (from package agent/src/types.ts)
// ============================================================================

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface CustomAgentMessages {
	// Empty by default - apps extend via declaration merging
}

// Message types from pi-ai
export interface TextContent {
	type: "text";
	text: string;
	textSignature?: string;
}

export interface ThinkingContent {
	type: "thinking";
	thinking: string;
	thinkingSignature?: string;
	redacted?: boolean;
}

export interface ImageContent {
	type: "image";
	data: string;
	mimeType: string;
}

export interface ToolCall {
	type: "toolCall";
	id: string;
	name: string;
	arguments: Record<any, any>;
	thoughtSignature?: string;
}

export interface Usage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	cost: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
}

export type StopReason = "stop" | "length" | "toolUse" | "error" | "aborted";

export interface UserMessage {
	role: "user";
	content: string | (TextContent | ImageContent)[];
	timestamp: number;
}

export interface AssistantMessage {
	role: "assistant";
	content: (TextContent | ThinkingContent | ToolCall)[];
	api: string;
	provider: string;
	model: string;
	usage: Usage;
	stopReason: StopReason;
	errorMessage?: string;
	timestamp: number;
}

export interface ToolResultMessage<TDetails = any> {
	role: "toolResult";
	toolCallId: string;
	toolName: string;
	content: (TextContent | ImageContent)[];
	details?: TDetails;
	isError: boolean;
	timestamp: number;
}

export type Message = UserMessage | AssistantMessage | ToolResultMessage;

export interface AssistantMessageEvent {
	type: string;
}

// Agent specific types
export type AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages];

export interface AgentState {
	systemPrompt: string;
	model: any;
	thinkingLevel: ThinkingLevel;
	tools: AgentTool<any>[];
	messages: AgentMessage[];
	isStreaming: boolean;
	streamMessage: AgentMessage | null;
	pendingToolCalls: Set<string>;
	error?: string;
}

export interface AgentToolResult<T> {
	content: (TextContent | ImageContent)[];
	details: T;
}

export type AgentToolUpdateCallback<T = any> = (partialResult: AgentToolResult<T>) => void;

export interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> {
	name: string;
	description: string;
	parameters: TParameters;
	label: string;
	execute: (
		toolCallId: string,
		params: any,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<TDetails>,
	) => Promise<AgentToolResult<TDetails>>;
}

export interface AgentContext {
	systemPrompt: string;
	messages: AgentMessage[];
	tools?: AgentTool<any>[];
}

export type AgentEvent =
	// Agent lifecycle
	| { type: "agent_start" }
	| { type: "agent_end"; messages: AgentMessage[] }
	// Turn lifecycle
	| { type: "turn_start" }
	| { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
	// Message lifecycle
	| { type: "message_start"; message: AgentMessage }
	| { type: "message_update"; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent }
	| { type: "message_end"; message: AgentMessage }
	// Tool execution lifecycle
	| { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
	| { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any }
	| { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean };

export interface AgentOptions {
	initialState?: Partial<AgentState>;
	convertToLlm?: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;
	transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;
	steeringMode?: "all" | "one-at-a-time";
	followUpMode?: "all" | "one-at-a-time";
	streamFn?: any;
	sessionId?: string;
	getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
	onPayload?: (payload: unknown) => void;
}

// ============================================================================
// Mock Agent Class
// ============================================================================

export class MockAgent {
	private listeners = new Set<(e: AgentEvent) => void>();
	private streamFn?: AgentOptions["streamFn"];
	_state: AgentState = {
		systemPrompt: "",
		model: { id: "mock-model", provider: "mock", api: "mock", baseUrl: "", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 100000, maxTokens: 8000 },
		thinkingLevel: "off",
		tools: [],
		messages: [],
		isStreaming: false,
		streamMessage: null,
		pendingToolCalls: new Set<string>(),
	};

	constructor(opts: AgentOptions = {}) {
		this.streamFn = opts.streamFn;
		if (opts.initialState) {
			this._state = { ...this._state, ...opts.initialState };
		}
	}

	get state(): AgentState {
		return this._state;
	}

	subscribe(fn: (e: AgentEvent) => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	setSystemPrompt(v: string) {
		this._state.systemPrompt = v;
	}

	setModel(m: any) {
		this._state.model = m;
	}

	setThinkingLevel(l: ThinkingLevel) {
		this._state.thinkingLevel = l;
	}

	setTools(tools: AgentTool<any>[]) {
		this._state.tools = tools;
	}

	clearMessages() {
		this._state.messages = [];
	}

	replaceMessages(messages: AgentMessage[]) {
		this._state.messages = messages;
	}

	appendMessage(message: AgentMessage) {
		this._state.messages.push(message);
	}

	abort(): void {
		this._state.isStreaming = false;
	}

	async waitForIdle(): Promise<void> {
		return Promise.resolve();
	}

	async prompt(message: string | AgentMessage | AgentMessage[], images?: any[]): Promise<void> {
		this._state.isStreaming = true;
		this.emit({ type: "agent_start" });
		this.emit({ type: "turn_start" });

		if (this.streamFn) {
			const stream = this.streamFn(
				this._state.model,
				{ systemPrompt: this._state.systemPrompt, messages: this._state.messages, tools: this._state.tools },
				{},
			);
			for await (const _event of stream) {
				// Consuming the stream is sufficient for adapter contract tests.
			}
		}

		this._state.isStreaming = false;
		this.emit({ type: "agent_end", messages: this._state.messages });
	}

	async continue(): Promise<void> {
		this._state.isStreaming = true;
		this.emit({ type: "agent_start" });
		this.emit({ type: "turn_start" });

		await new Promise((resolve) => setTimeout(resolve, 10));

		this._state.isStreaming = false;
		this.emit({ type: "agent_end", messages: this._state.messages });
	}

	private emit(e: AgentEvent) {
		for (const listener of this.listeners) {
			listener(e);
		}
	}
}

// Re-export the real Agent as a mock
export const Agent = MockAgent;
