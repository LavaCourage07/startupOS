/**
 * Test setup mocks for pi-mono dependencies
 * This file provides mock implementations that work with the test runner
 */

// Mock @mariozechner/agent module
vi.mock("@mariozechner/agent", () => {
	class MockAgent {
		constructor(config?: unknown) {
			this._listeners = new Set<(event: any) => void>();

			this.state = {
				systemPrompt: config?.initialState?.systemPrompt || "",
				model: config?.initialState?.model || { provider: "anthropic", id: "claude-haiku-20250307" },
				thinkingLevel: config?.initialState?.thinkingLevel || "low",
				tools: config?.initialState?.tools || [],
				messages: config?.initialState?.messages || [],
			};

			// Store onPayload if provided
			if (config?.onPayload) {
				this.onPayload = config.onPayload;
			}
		}

		_listeners = new Set<(event: any) => void>();

		state: {
			systemPrompt: string;
			model: { provider: string; id: string };
			thinkingLevel: string;
			tools: any[];
			messages: any[];
		};

	_prompt = vi.fn();
		_continue = vi.fn();
		_abort = vi.fn();
		_waitForIdle = vi.fn();
		_onPayload;

		subscribe(listener: (event: any) => void): () => void {
			this._listeners.add(listener);
			return () => this._listeners.delete(listener);
		}

		emit(event: any): void {
			for (const listener of this._listeners) {
				listener(event);
			}
		}

		setSystemPrompt = vi.fn((prompt: string) => {
			this.state.systemPrompt = prompt;
		});

		setModel = vi.fn((model: unknown) => {
			this.state.model = model as any;
		});

		setTools = vi.fn((tools: any[]) => {
			this.state.tools = tools;
		});

		clearMessages = vi.fn(() => {
			this.state.messages = [];
		});

		replaceMessages = vi.fn((messages: any[]) => {
			this.state.messages = messages;
		});

		appendMessage = vi.fn((message: any) => {
			this.state.messages.push(message);
		});

		destroy = vi.fn(() => {
			this._listeners.clear();
		});

		get State() {
			return this.state;
		}
	}

	return { Agent: MockAgent };
});

// Mock @mariozechner/pi-ai module
vi.mock("@mariozechner/pi-ai", () => ({
	getModel: vi.fn((provider: string, id: string) => ({
		provider,
		id,
	})),

	createMessage: vi.fn((role: string, content: string) => ({
		role,
		content: [{ type: "text", text: content }],
	})),

	compressMessage: vi.fn((messages: any[]) => messages),
}));

// Re-export MockAgent type for use in tests
export type { MockAgent } from "@mariozechner/agent";