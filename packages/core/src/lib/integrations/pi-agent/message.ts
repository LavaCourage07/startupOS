/**
 * 通信协议模块
 * 定义消息类型、格式验证和编码/解码
 */

import type { AgentMessage } from "@originos/pi-agent-adapter";
import { extractDisplayContent } from "./display-content";

// ============================================================================
// Message Schemas
// ============================================================================

/**
 * 用户消息 Schema
 */
export interface UserMessage {
	type: "user_message";
	content: string;
	sessionId: string;
	timestamp: Date;
	metadata?: Record<string, unknown>;
}

/**
 * Agent 响应 Schema
 */
export interface AgentResponse {
	type: "agent_response";
	content: string;
	sessionId: string;
	timestamp: Date;
	agentId: string;
	turnId?: string;
	metadata?: Record<string, unknown>;
}

// ============================================================================
// Message Validation
// ============================================================================

/**
 * 验证用户消息
 */
export function validateUserMessage(message: unknown): message is UserMessage {
	if (!message || typeof message !== "object") {
		return false;
	}

	const msg = message as Record<string, unknown>;

	// 检查必需字段
	if (msg['type'] !== "user_message") {
		return false;
	}

	if (typeof msg['content'] !== "string" || (msg['content'] as string).trim().length === 0) {
		return false;
	}

	if (typeof msg['sessionId'] !== "string" || (msg['sessionId'] as string).trim().length === 0) {
		return false;
	}

	// 验证 sessionId 长度限制 (1-128 字符)
	if ((msg['sessionId'] as string).length > 128) {
		return false;
	}

	if (!(msg['timestamp'] instanceof Date) && typeof msg['timestamp'] !== "string") {
		return false;
	}

	return true;
}

/**
 * 验证 Agent 响应
 */
export function validateAgentResponse(message: unknown): message is AgentResponse {
	if (!message || typeof message !== "object") {
		return false;
	}

	const msg = message as Record<string, unknown>;

	// 检查必需字段
	if (msg['type'] !== "agent_response") {
		return false;
	}

	if (typeof msg['content'] !== "string") {
		return false;
	}

	if (typeof msg['sessionId'] !== "string") {
		return false;
	}

	if (typeof msg['agentId'] !== "string") {
		return false;
	}

	if (!(msg['timestamp'] instanceof Date) && typeof msg['timestamp'] !== "string") {
		return false;
	}

	return true;
}

/**
 * 验证消息并返回错误信息
 */
export function validateMessage(message: unknown): {
	isValid: boolean;
	error?: string;
} {
	if (validateUserMessage(message)) {
		return { isValid: true };
	}

	if (validateAgentResponse(message)) {
		return { isValid: true };
	}

	// 检查具体错误
	if (!message || typeof message !== "object") {
		return { isValid: false, error: "Message must be an object" };
	}

	const msg = message as Record<string, unknown>;

	if (msg['type'] !== "user_message" && msg['type'] !== "agent_response") {
		return { isValid: false, error: "Message type must be 'user_message' or 'agent_response'" };
	}

	if (typeof msg['content'] !== "string") {
		return { isValid: false, error: "Message content must be a string" };
	}

	if (typeof msg['sessionId'] !== "string" || (msg['sessionId'] as string).trim().length === 0) {
		return { isValid: false, error: "Message sessionId is required and cannot be empty" };
	}

	if (typeof msg['sessionId'] === "string" && (msg['sessionId'] as string).length > 128) {
		return { isValid: false, error: "Message sessionId must be between 1 and 128 characters" };
	}

	return { isValid: false, error: "Invalid message format" };
}

// ============================================================================
// Message Creation
// ============================================================================

/**
 * 创建用户消息
 */
export function createUserMessage(params: {
	content: string;
	sessionId: string;
	timestamp?: Date;
	metadata?: Record<string, unknown>;
}): UserMessage {
	return {
		type: "user_message",
		content: params.content,
		sessionId: params.sessionId,
		timestamp: params.timestamp ?? new Date(),
		metadata: params.metadata,
	};
}

/**
 * 创建 Agent 响应
 */
export function createAgentResponse(params: {
	content: string;
	sessionId: string;
	agentId: string;
	turnId?: string;
	timestamp?: Date;
	metadata?: Record<string, unknown>;
}): AgentResponse {
	return {
		type: "agent_response",
		content: params.content,
		sessionId: params.sessionId,
		agentId: params.agentId,
		turnId: params.turnId,
		timestamp: params.timestamp ?? new Date(),
		metadata: params.metadata,
	};
}

// ============================================================================
// Message Conversion
// ============================================================================

/**
 * 将 UserMessage 转换为 AgentMessage (pi-agent-core 格式)
 */
export function userMessageToAgentMessage(message: UserMessage): AgentMessage {
	return {
		id: `msg-${Date.now()}`,
		role: "user",
		content: message.content,
		timestamp: Date.now(),
	} as AgentMessage;
}

/**
 * 将 AgentMessage 转换为 AgentResponse
 */
export function agentMessageToAgentResponse(
	agentMessage: AgentMessage,
	sessionId: string,
	agentId: string = "unknown"
): AgentResponse {
	const content = extractDisplayContent((agentMessage as any).content, {
		allowThinkingFallback: false,
	});

	return {
		type: "agent_response",
		content,
		sessionId,
		agentId,
		timestamp: new Date(),
	};
}

/**
 * 批量转换消息
 */
export function convertMessagesToAgent(messages: UserMessage[]): AgentMessage[] {
	return messages.map(userMessageToAgentMessage);
}

// ============================================================================
// Message Errors
// ============================================================================

/**
 * 消息错误类型
 */
export class MessageError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly details?: Record<string, unknown>
	) {
		super(message);
		this.name = "MessageError";
	}
}

/**
 * 创建格式错误
 */
export function createFormatError(
	error: string,
	details?: Record<string, unknown>
): MessageError {
	return new MessageError("FORMAT_ERROR", error, details);
}

/**
 * 创建验证错误
 */
export function createValidationError(
	field: string,
	value: unknown
): MessageError {
	return new MessageError(
		"VALIDATION_ERROR",
		`Invalid value for field '${field}'`,
		{ field, value: String(value) }
	);
}
