/**
 * Mock utilities for pi-mono dependencies
 * Used in unit tests to avoid dependency on external packages
 */

vi.mock("@mariozechner/agent", () => ({
	Agent: class MockAgent {
		constructor(config: unknown) {
			this.state = {
				systemPrompt: config?.initialState?.systemPrompt || "",
				model: config?.initialState?.model || { provider: "anthropic", id: "test" },
				thinkingLevel: config?.initialState?.thinkingLevel || "low",
				tools: config?.initialState?.tools || [],
				messages: config?.initialState?.messages || [],
			};
			this._listeners = new Set();
		}

		state: {
			systemPrompt: string;
			model: { provider: string; id: string };
			thinkingLevel: string;
			tools: any[];
			messages: any[];
		};

		_listeners: Set<(event: any) => void>;

		prompt = vi.fn(async () => {});
		continue = vi.fn(async () => {});
		abort = vi.fn(() => {});
		waitForIdle = vi.fn(async () => {});

		subscribe(listener: (event: any) => void): () => void {
			this._listeners.add(listener);
			return () => this._listeners.delete(listener);
		}

		setSystemPrompt = vi.fn((prompt: string) => {
			this.state.systemPrompt = prompt;
		});

		setModel = vi.fn((model: unknown) => {
			this.state.model = model;
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
	},
}));

vi.mock("@mariozechner/pi-ai", () => ({
	getModel: vi.fn((provider: string, id: string) => ({
		provider,
		id,
	})),

	createMessage: vi.fn((role: string, content: string) => ({
		role,
		content: [{ type: "text", text: content }],
	})),
}));

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

// Export Mock Agent class for use in tests
export class MockAgent {
	constructor(config: unknown) {
		this.state = {
			systemPrompt: config?.initialState?.systemPrompt || "",
			model: config?.initialState?.model || { provider: "anthropic", id: "test" },
			thinkingLevel: config?.initialState?.thinkingLevel || "low",
			tools: config?.initialState?.tools || [],
			messages: config?.initialState?.messages || [],
		};
		this._listeners = new Set();
	}

	state: {
		systemPrompt: string;
		model: { provider: string; id: string };
		thinkingLevel: string;
		tools: any[];
		messages: any[];
	};

	_listeners: Set<(event: any) => void>;

	prompt = vi.fn();
	continue = vi.fn();
	abort = vi.fn();
	waitForIdle = vi.fn();

	subscribe(listener: (event: any) => void): () => void {
		this._listeners.add(listener);
		return () => this._listeners.delete(listener);
	}

	emit(event: any): void {
		for (const listener of this._listeners) {
			listener(event);
		}
	}

	setSystemPrompt = vi.fn();
	setModel = vi.fn();
	setTools = vi.fn();
	clearMessages = vi.fn();
	replaceMessages = vi.fn();
	appendMessage = vi.fn();
}

// Export mock model factory
export const mockGetModel = vi.fn((provider: string, id: string) => ({
	provider,
	id,
}));

// Mock message creator
export const mockCreateMessage = vi.fn((role: string, content: string) => ({
	role,
	content: [{ type: "text", text: content }],
}));
