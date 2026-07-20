/**
 * Messages 模块单元测试
 * 测试通信协议、消息验证和转换
 */

import { describe, it, expect } from "vitest";
import {
	validateUserMessage,
	validateAgentResponse,
	validateMessage,
	createUserMessage,
	createAgentResponse,
	userMessageToAgentMessage,
	agentMessageToAgentResponse,
	convertMessagesToAgent,
	MessageError,
	createFormatError,
	createValidationError,
	type UserMessage,
	type AgentResponse,
} from "../message";

// ============================================================================
// Describe Blocks
// ============================================================================

describe("validateUserMessage", () => {
	it("should validate a valid user message", () => {
		const message: UserMessage = {
			type: "user_message",
			content: "Hello Agent",
			sessionId: "test-session-001",
			timestamp: new Date(),
		};

		expect(validateUserMessage(message)).toBe(true);
	});

	it("should reject message with wrong type", () => {
		const message = {
			type: "agent_response",
			content: "Hello Agent",
			sessionId: "test-session-001",
			timestamp: new Date(),
		};

		expect(validateUserMessage(message)).toBe(false);
	});

	it("should reject message with empty content", () => {
		const message = {
			type: "user_message",
			content: "",
			sessionId: "test-session-001",
			timestamp: new Date(),
		};

		expect(validateUserMessage(message)).toBe(false);
	});

	it("should reject message with whitespace only content", () => {
		const message = {
			type: "user_message",
			content: "   ",
			sessionId: "test-session-001",
			timestamp: new Date(),
		};

		expect(validateUserMessage(message)).toBe(false);
	});

	it("should reject message with non-string content", () => {
		const message = {
			type: "user_message",
			content: 123,
			sessionId: "test-session-001",
			timestamp: new Date(),
		};

		expect(validateUserMessage(message)).toBe(false);
	});

	it("should reject message with empty sessionId", () => {
		const message = {
			type: "user_message",
			content: "Hello Agent",
			sessionId: "",
			timestamp: new Date(),
		};

		expect(validateUserMessage(message)).toBe(false);
	});

	it("should reject message with whitespace only sessionId", () => {
		const message = {
			type: "user_message",
			content: "Hello Agent",
			sessionId: "   ",
			timestamp: new Date(),
		};

		expect(validateUserMessage(message)).toBe(false);
	});

	it("should reject message with sessionId exceeding max length (128)", () => {
		const longSessionId = "x".repeat(129);
		const message: Partial<UserMessage> = {
			type: "user_message",
			content: "Hello Agent",
			sessionId: longSessionId,
			timestamp: new Date(),
		};

		expect(validateUserMessage(message as UserMessage)).toBe(false);
	});

	it("should accept message with sessionId at max length (128)", () => {
		const maxSessionId = "x".repeat(128);
		const message: UserMessage = {
			type: "user_message",
			content: "Hello Agent",
			sessionId: maxSessionId,
			timestamp: new Date(),
		};

		expect(validateUserMessage(message)).toBe(true);
	});

	it("should accept message with valid Date timestamp", () => {
		const message: UserMessage = {
			type: "user_message",
			content: "Hello Agent",
			sessionId: "test-session",
			timestamp: new Date("2026-03-03T12:00:00Z"),
		};

		expect(validateUserMessage(message)).toBe(true);
	});

	it("should accept message with string timestamp", () => {
		const message = {
			type: "user_message" as const,
			content: "Hello Agent",
			sessionId: "test-session",
			timestamp: "2026-03-03T12:00:00Z",
			metadata: {},
		};

		expect(validateUserMessage(message as unknown as UserMessage)).toBe(true);
	});

	it("should accept message with optional metadata", () => {
		const message: UserMessage = {
			type: "user_message",
			content: "Hello Agent",
			sessionId: "test-session",
			timestamp: new Date(),
			metadata: { source: "test", priority: 1 },
		};

		expect(validateUserMessage(message)).toBe(true);
});

	it("should reject null message", () => {
		expect(validateUserMessage(null as unknown as UserMessage)).toBe(false);
	});

	it("should reject undefined message", () => {
		expect(validateUserMessage(undefined as unknown as UserMessage)).toBe(false);
	});

	it("should reject non-object message", () => {
		expect(validateUserMessage("string" as unknown as UserMessage)).toBe(false);
	});
});

describe("validateAgentResponse", () => {
	it("should validate a valid agent response", () => {
		const response: AgentResponse = {
			type: "agent_response",
			content: "Agent response content",
			sessionId: "test-session-001",
			agentId: "agent-001",
			timestamp: new Date(),
		};

		expect(validateAgentResponse(response)).toBe(true);
	});

	it("should reject response with wrong type", () => {
		const response = {
			type: "user_message",
			content: "Agent response content",
			sessionId: "test-session-001",
			agentId: "agent-001",
			timestamp: new Date(),
		};

		expect(validateAgentResponse(response)).toBe(false);
	});

	it("should reject response with non-string content", () => {
		const response = {
			type: "agent_response" as const,
			content: 123,
			sessionId: "test-session-001",
			agentId: "agent-001",
			timestamp: new Date(),
		};

		expect(validateAgentResponse(response as unknown as AgentResponse)).toBe(false);
	});

	it("should reject response without agentId", () => {
		const response: Partial<AgentResponse> = {
			type: "agent_response",
			content: "Agent response content",
			sessionId: "test-session-001",
			timestamp: new Date(),
		};

		expect(validateAgentResponse(response as AgentResponse)).toBe(false);
	});

	it("should accept response with optional turnId", () => {
		const response: AgentResponse = {
			type: "agent_response",
			content: "Agent response",
			sessionId: "test-session-001",
			agentId: "agent-001",
			turnId: "turn-001",
			timestamp: new Date(),
		};

		expect(validateAgentResponse(response)).toBe(true);
	});
});

describe("validateMessage", () => {
	it("should return valid for a valid user message", () => {
		const message: UserMessage = {
			type: "user_message",
			content: "Hello",
			sessionId: "test-session",
			timestamp: new Date(),
		};

		const result = validateMessage(message);
		expect(result.isValid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	it("should return valid for a valid agent response", () => {
		const response: AgentResponse = {
			type: "agent_response",
			content: "Response",
			sessionId: "test-session",
			agentId: "agent-001",
			timestamp: new Date(),
		};

		const result = validateMessage(response);
		expect(result.isValid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	it("should return invalid for null", () => {
		const result = validateMessage(null);
		expect(result.isValid).toBe(false);
		expect(result.error).toBe("Message must be an object");
	});

	it("should return invalid for wrong type", () => {
		const message = {
			type: "wrong_type",
			content: "Hello",
			sessionId: "test-session",
			timestamp: new Date(),
		};

		const result = validateMessage(message);
		expect(result.isValid).toBe(false);
		expect(result.error).toContain("must be 'user_message' or 'agent_response'");
	});

	it("should return invalid for non-string content", () => {
		const message = {
			type: "user_message",
			content: null,
			sessionId: "test-session",
			timestamp: new Date(),
		};

		const result = validateMessage(message);
		expect(result.isValid).toBe(false);
		expect(result.error).toBe("Message content must be a string");
	});

	it("should return invalid for empty sessionId", () => {
		const message = {
			type: "user_message",
			content: "Hello",
			sessionId: "",
			timestamp: new Date(),
		};

		const result = validateMessage(message);
		expect(result.isValid).toBe(false);
		expect(result.error).toContain("sessionId is required");
	});

	it("should return invalid for sessionId exceeding max length", () => {
		const message = {
			type: "user_message",
			content: "Hello",
			sessionId: "x".repeat(129),
			timestamp: new Date(),
		};

		const result = validateMessage(message);
		expect(result.isValid).toBe(false);
		expect(result.error).toContain("must be between 1 and 128 characters");
	});
});

describe("createUserMessage", () => {
	it("should create a user message with required fields", () => {
		const message = createUserMessage({
			content: "Hello Agent",
			sessionId: "test-session-001",
		});

		expect(message.type).toBe("user_message");
		expect(message.content).toBe("Hello Agent");
		expect(message.sessionId).toBe("test-session-001");
		expect(message.timestamp).toBeInstanceOf(Date);
	});

	it("should create a user message with custom timestamp", () => {
		const customDate = new Date("2026-03-03T12:00:00Z");
		const message = createUserMessage({
			content: "Hello Agent",
			sessionId: "test-session-001",
			timestamp: customDate,
		});

		expect(message.timestamp).toEqual(customDate);
	});

	it("should create a user message with metadata", () => {
		const message = createUserMessage({
			content: "Hello Agent",
			sessionId: "test-session-001",
			metadata: { source: "test", priority: 1 },
		});

		expect(message.metadata).toEqual({ source: "test", priority: 1 });
	});
});

describe("createAgentResponse", () => {
	it("should create an agent response with required fields", () => {
		const response = createAgentResponse({
			content: "Agent response",
			sessionId: "test-session-001",
			agentId: "agent-001",
		});

		expect(response.type).toBe("agent_response");
		expect(response.content).toBe("Agent response");
		expect(response.sessionId).toBe("test-session-001");
		expect(response.agentId).toBe("agent-001");
		expect(response.timestamp).toBeInstanceOf(Date);
	});

	it("should create an agent response with turnId", () => {
		const response = createAgentResponse({
			content: "Agent response",
			sessionId: "test-session-001",
			agentId: "agent-001",
			turnId: "turn-001",
		});

		expect(response.turnId).toBe("turn-001");
	});

	it("should create an agent response with metadata", () => {
		const response = createAgentResponse({
			content: "Agent response",
			sessionId: "test-session-001",
			agentId: "agent-001",
			metadata: { model: "claude-3", tokens: 150 },
		});

		expect(response.metadata).toEqual({ model: "claude-3", tokens: 150 });
	});
});

describe("userMessageToAgentMessage", () => {
	it("should convert user message to AgentMessage format", () => {
		const userMessage: UserMessage = {
			type: "user_message",
			content: "Hello Agent",
			sessionId: "test-session-001",
			timestamp: new Date(),
		};

		const agentMessage = userMessageToAgentMessage(userMessage);

		expect(agentMessage.role).toBe("user");
		expect(Array.isArray(agentMessage.content)).toBe(true);
		expect(agentMessage.content[0].type).toBe("text");
		expect(agentMessage.content[0].text).toBe("Hello Agent");
	});
});

describe("agentMessageToAgentResponse", () => {
	it("should convert AgentMessage to AgentResponse", () => {
		const agentMessage = {
			role: "assistant" as const,
			content: [{ type: "text" as const, text: "Agent response text" }],
		};

		const response = agentMessageToAgentResponse(
			agentMessage,
			"test-session-001",
			"agent-001"
		);

		expect(response.type).toBe("agent_response");
		expect(response.content).toBe("Agent response text");
		expect(response.sessionId).toBe("test-session-001");
		expect(response.agentId).toBe("agent-001");
		expect(response.timestamp).toBeInstanceOf(Date);
	});

	it("should concatenate multiple text blocks", () => {
		const agentMessage = {
			role: "assistant" as const,
			content: [
				{ type: "text" as const, text: "First " },
				{ type: "text" as const, text: "Second " },
				{ type: "text" as const, text: "Third" },
			],
		};

		const response = agentMessageToAgentResponse(
			agentMessage,
			"test-session-001",
			"agent-001"
		);

		expect(response.content).toBe("First Second Third");
	});

	it("should handle empty content array", () => {
		const agentMessage = {
			role: "assistant" as const,
			content: [],
		};

		const response = agentMessageToAgentResponse(
			agentMessage,
			"test-session-001",
			"agent-001"
		);

		expect(response.content).toBe("");
	});
});

describe("convertMessagesToAgent", () => {
	it("should convert array of user messages", () => {
		const userMessages: UserMessage[] = [
			{
				type: "user_message",
				content: "First message",
				sessionId: "test-001",
				timestamp: new Date(),
			},
			{
				type: "user_message",
				content: "Second message",
				sessionId: "test-001",
				timestamp: new Date(),
			},
		];

		const agentMessages = convertMessagesToAgent(userMessages);

		expect(agentMessages).toHaveLength(2);
		expect(agentMessages[0].role).toBe("user");
		expect(agentMessages[0].content[0].text).toBe("First message");
		expect(agentMessages[1].role).toBe("user");
		expect(agentMessages[1].content[0].text).toBe("Second message");
	});

	it("should handle empty array", () => {
		const agentMessages = convertMessagesToAgent([]);
		expect(agentMessages).toEqual([]);
	});
});

describe("MessageError", () => {
	it("should create error with code and message", () => {
		const error = new MessageError("TEST_CODE", "Test error message");

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("MessageError");
		expect(error.code).toBe("TEST_CODE");
		expect(error.message).toBe("Test error message");
	});

	it("should create error with details", () => {
		const details = { field: "content", value: "invalid" };
		const error = new MessageError(
			"TEST_CODE",
			"Test error message",
			details
		);

		expect(error.details).toEqual(details);
	});
});

describe("createFormatError", () => {
	it("should create format error", () => {
		const error = createFormatError("Invalid message format");

		expect(error.code).toBe("FORMAT_ERROR");
		expect(error.message).toBe("Invalid message format");
	});

	it("should create format error with details", () => {
		const details = { expected: "string", received: "number" };
		const error = createFormatError("Invalid format", details);

		expect(error.details).toEqual(details);
	});
});

describe("createValidationError", () => {
	it("should create validation error", () => {
		const error = createValidationError("sessionId", "");

		expect(error.code).toBe("VALIDATION_ERROR");
		expect(error.message).toContain("sessionId");
		expect(error.details).toEqual({ field: "sessionId", value: "" });
	});
});
