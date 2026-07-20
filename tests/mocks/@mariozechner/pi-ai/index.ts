/**
 * Mock implementation of @mariozechner/pi-ai package
 * Created for testing purposes since workspace packages may not be fully built
 */

// Re-export TypeBox types
export type { Static, TSchema } from "@sinclair/typebox";
export { Type } from "@sinclair/typebox";

// ============================================================================
// Types
// ============================================================================

export type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh";

export type KnownProvider =
	| "amazon-bedrock"
	| "anthropic"
	| "google"
	| "google-gemini-cli"
	| "google-antigravity"
	| "google-vertex"
	| "openai"
	| "azure-openai-responses"
	| "openai-codex"
	| "github-copilot"
	| "xai"
	| "groq"
	| "cerebras"
	| "openrouter"
	| "vercel-ai-gateway"
	| "zai"
	| "mistral"
	| "minimax"
	| "minimax-cn"
	| "huggingface"
	| "opencode"
	| "kimi-coding";

export type KnownApi =
	| "openai-completions"
	| "openai-responses"
	| "azure-openai-responses"
	| "openai-codex-responses"
	| "anthropic-messages"
	| "bedrock-converse-stream"
	| "google-generative-ai"
	| "google-gemini-cli"
	| "google-vertex";

export type Api = KnownApi | (string & {});
export type Provider = KnownProvider | string;

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
	api: Api;
	provider: Provider;
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

export interface Tool<TParameters extends TSchema = TSchema> {
	name: string;
	description: string;
	parameters: TParameters;
}

export interface Context {
	systemPrompt?: string;
	messages: Message[];
	tools?: Tool[];
}

export interface AssistantMessageEvent {
	type: string;
}

export type AssistantMessageEventStream = AsyncIterable<AssistantMessageEvent>;

export interface Model<TApi extends Api> {
	id: string;
	name: string;
	api: TApi;
	provider: Provider;
	baseUrl: string;
	reasoning: boolean;
	input: ("text" | "image")[];
	cost: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
	};
	contextWindow: number;
	maxTokens: number;
	headers?: Record<string, string>;
}

export interface StreamOptions {
	temperature?: number;
	maxTokens?: number;
	signal?: AbortSignal;
	apiKey?: string;
	sessionId?: string;
	onPayload?: (payload: unknown) => void;
	headers?: Record<string, string>;
	maxRetryDelayMs?: number;
	metadata?: Record<string, unknown>;
}

export interface SimpleStreamOptions extends StreamOptions {
	reasoning?: ThinkingLevel;
}

export type StreamFunction<TApi extends Api = Api, TOptions extends StreamOptions = StreamOptions> = (
	model: Model<TApi>,
	context: Context,
	options?: TOptions,
) => AssistantMessageEventStream;

// ============================================================================
// Mock Functions
// ============================================================================

const mockRegistry = new Map<string, Map<string, Model<Api>>>();

// Initialize with some mock models
function initMockModels() {
	const anthropicModels: Map<string, Model<Api>> = new Map();
	anthropicModels.set("claude-haiku-20250307", {
		id: "claude-haiku-20250307",
		name: "Claude Haiku",
		api: "anthropic-messages",
		provider: "anthropic",
		baseUrl: "https://api.anthropic.com",
		reasoning: false,
		input: ["text"],
		cost: { input: 0.25, output: 1.25, cacheRead: 0.03, cacheWrite: 0.30 },
		contextWindow: 200000,
		maxTokens: 8000,
	});
	mockRegistry.set("anthropic", anthropicModels);

	const googleModels: Map<string, Model<Api>> = new Map();
	googleModels.set("gemini-2.5-flash-lite-preview-06-17", {
		id: "gemini-2.5-flash-lite-preview-06-17",
		name: "Gemini 2.5 Flash Lite",
		api: "google-generative-ai",
		provider: "google",
		baseUrl: "https://generativelanguage.googleapis.com",
		reasoning: false,
		input: ["text", "image"],
		cost: { input: 0.075, output: 0.3, cacheRead: 0.01, cacheWrite: 0.0375 },
		contextWindow: 1000000,
		maxTokens: 8000,
	});
	mockRegistry.set("google", googleModels);
}

initMockModels();

export function getModel<TProvider extends KnownProvider, TModelId extends string>(
	provider: TProvider,
	modelId: TModelId,
): Model<Api> {
	const providerModels = mockRegistry.get(provider);
	const model = providerModels?.get(modelId as string);
	if (!model) {
		throw new Error(`Model not found: ${provider}/${modelId}`);
	}
	return model;
}

export function getProviders(): KnownProvider[] {
	return Array.from(mockRegistry.keys()) as KnownProvider[];
}

export function getModels<TProvider extends KnownProvider>(provider: TProvider): Model<Api>[] {
	const models = mockRegistry.get(provider);
	return models ? Array.from(models.values()) : [];
}

export async function* streamSimple(
	_model: Model<Api>,
	_context: Context,
	_options?: StreamOptions,
): AssistantMessageEventStream {
	yield { type: "start", partial: {} as any };
	yield { type: "text_start", contentIndex: 0, partial: {} as any };
	yield { type: "text_delta", contentIndex: 0, delta: "Mock response", partial: {} as any };
	yield { type: "text_end", contentIndex: 0, content: "Mock response", partial: {} as any };
	yield { type: "done", reason: "stop", message: {} as AssistantMessage };
}

// ============================================================================
// Mock API Registry
// ============================================================================

export const apiRegistry: Map<string, any> = new Map();

export function registerApi(provider: string, config: any): void {
	apiRegistry.set(provider, config);
}

export function getApi(provider: string): any {
	return apiRegistry.get(provider);
}

// ============================================================================
// Mock Event Stream
// ============================================================================

export class MockEventStream implements AsyncIterable<AssistantMessageEvent> {
	private events: AssistantMessageEvent[] = [];
	private currentIndex = 0;

	constructor(events: AssistantMessageEvent[]) {
		this.events = events;
	}

	async *[Symbol.asyncIterator](): AsyncIterator<AssistantMessageEvent> {
		while (this.currentIndex < this.events.length) {
			yield this.events[this.currentIndex++];
			await new Promise((resolve) => setTimeout(resolve, 1));
		}
	}
}
