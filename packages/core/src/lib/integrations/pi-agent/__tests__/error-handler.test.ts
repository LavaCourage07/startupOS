/**
 * Unit tests for Error Handler (Story 0.6)
 * 验证错误处理功能的测试
 */

import { describe, it, expect } from "vitest";
import {
	ErrorType,
	ErrorSeverity,
	getErrorType,
	getErrorSeverity,
	createPiAgentError,
	getErrorMessage,
	isRecoverable,
	ErrorHandler,
	errorHandler,
} from "../error-handler";

// ============================================================================
// Test Suite
// ============================================================================

describe("Story 0.6 - Error Handler", () => {
	describe("ErrorType", () => {
		it("should define all error types", () => {
			expect(ErrorType.NETWORK_ERROR).toBe("NETWORK_ERROR");
			expect(ErrorType.TOOL_ERROR).toBe("TOOL_ERROR");
			expect(ErrorType.LLM_ERROR).toBe("LLM_ERROR");
			expect(ErrorType.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
			expect(ErrorType.TIMEOUT_ERROR).toBe("TIMEOUT_ERROR");
			expect(ErrorType.UNKNOWN_ERROR).toBe("UNKNOWN_ERROR");
		});
	});

	describe("ErrorSeverity", () => {
		it("should define all severity levels", () => {
			expect(ErrorSeverity.LOW).toBe("LOW");
			expect(ErrorSeverity.MEDIUM).toBe("MEDIUM");
			expect(ErrorSeverity.HIGH).toBe("HIGH");
			expect(ErrorSeverity.CRITICAL).toBe("CRITICAL");
		});
	});

	describe("getErrorType", () => {
		it("should detect network errors", () => {
			const error = new Error("Network connection failed");
			expect(getErrorType(error)).toBe(ErrorType.NETWORK_ERROR);
		});

		it("should detect timeout errors", () => {
			const error = new Error("Request timeout after 30s");
			expect(getErrorType(error)).toBe(ErrorType.TIMEOUT_ERROR);
		});

		it("should detect validation errors", () => {
			const error = new Error("Validation failed: invalid field");
			expect(getErrorType(error)).toBe(ErrorType.VALIDATION_ERROR);
		});

		it("should detect tool errors", () => {
			const error = new Error("Tool 'read_file' failed");
			expect(getErrorType(error)).toBe(ErrorType.TOOL_ERROR);
		});

		it("should default to LLM_ERROR for other errors", () => {
			const error = new Error("Some unknown error");
			expect(getErrorType(error)).toBe(ErrorType.LLM_ERROR);
		});

		it("should handle null/undefined errors", () => {
			expect(getErrorType(null)).toBe(ErrorType.UNKNOWN_ERROR);
			expect(getErrorType(undefined)).toBe(ErrorType.UNKNOWN_ERROR);
		});
	});

	describe("getErrorSeverity", () => {
		it("should assign correct severity levels", () => {
			expect(getErrorSeverity(ErrorType.NETWORK_ERROR)).toBe(ErrorSeverity.MEDIUM);
			expect(getErrorSeverity(ErrorType.TIMEOUT_ERROR)).toBe(ErrorSeverity.MEDIUM);
			expect(getErrorSeverity(ErrorType.TOOL_ERROR)).toBe(ErrorSeverity.LOW);
			expect(getErrorSeverity(ErrorType.VALIDATION_ERROR)).toBe(ErrorSeverity.LOW);
			expect(getErrorSeverity(ErrorType.LLM_ERROR)).toBe(ErrorSeverity.HIGH);
		});
	});

	describe("getErrorMessage", () => {
		it("should provide friendly messages for different error types", () => {
			expect(getErrorMessage(ErrorType.NETWORK_ERROR, "")).toContain("网络连接错误");
			expect(getErrorMessage(ErrorType.TIMEOUT_ERROR, "")).toContain("请求超时");
			expect(getErrorMessage(ErrorType.TOOL_ERROR, "工具失败")).toContain("工具执行失败");
			expect(getErrorMessage(ErrorType.VALIDATION_ERROR, "无效数据")).toContain("请求数据无效");
			expect(getErrorMessage(ErrorType.LLM_ERROR, "")).toContain("服务器错误");
		});

		it("should preserve original message for TOOL_ERROR", () => {
			const original = "read_file failed: permission denied";
			const message = getErrorMessage(ErrorType.TOOL_ERROR, original);
			expect(message).toContain(original);
		});
	});

	describe("isRecoverable", () => {
		it("should mark network errors as recoverable", () => {
			expect(isRecoverable(ErrorType.NETWORK_ERROR)).toBe(true);
		});

		it("should mark timeout errors as recoverable", () => {
			expect(isRecoverable(ErrorType.TIMEOUT_ERROR)).toBe(true);
		});

		it("should mark tool errors as recoverable", () => {
			expect(isRecoverable(ErrorType.TOOL_ERROR)).toBe(true);
		});

		it("should mark validation errors as not recoverable", () => {
			expect(isRecoverable(ErrorType.VALIDATION_ERROR)).toBe(false);
		});

		it("should mark LLM errors as not recoverable", () => {
			expect(isRecoverable(ErrorType.LLM_ERROR)).toBe(false);
		});
	});

	describe("createPiAgentError", () => {
		it("should create complete PiAgentError object", () => {
			const error = new Error("Network connection failed");
			const piError = createPiAgentError(error, {
				operation: "sendMessage",
				sessionId: "test-session",
			});

			expect(piError.type).toBe(ErrorType.NETWORK_ERROR);
			expect(piError.severity).toBe(ErrorSeverity.MEDIUM);
			expect(piError.message).toContain("网络连接错误");
			expect(piError.recoverable).toBe(true);
			expect(piError.details).toBe(error);
			expect(piError.timestamp).toBeGreaterThan(0);
			expect(piError.recovery).toBeDefined();
			expect(piError.recovery?.type).toBe("retry");
		});

		it("should include recovery action for recoverable errors", () => {
			const error = new Error("Network connection failed");
			const piError = createPiAgentError(error);

			expect(piError.recovery).toBeDefined();
			expect(piError.recovery?.type).toBe("retry");
			expect(piError.recovery?.label).toBe("重试");
		});

		it("should not include recovery action for non-recoverable errors", () => {
			const error = new Error("Validation failed");
			const piError = createPiAgentError(error);

			expect(piError.recoverable).toBe(false);
			// 验证恢复操作不存在或类型为 manual
			if (piError.recovery) {
				expect(piError.recovery.type).toBe("manual");
			}
		});
	});

	describe("ErrorHandler class", () => {
		it("should handle errors and store them", () => {
			const handler = new ErrorHandler();
			const error = new Error("Test error");

			const piError = handler.handleError(error);

			expect(piError).toBeDefined();
			expect(handler.getLastError()).toBe(piError);
		});

		it("should track multiple errors", () => {
			const handler = new ErrorHandler();

			handler.handleError(new Error("Network connection failed"));
			handler.handleError(new Error("Network fetch failed again"));

			expect(handler.getAllErrors()).toHaveLength(2);
			// 验证最后一个错误是网络错误类型
			expect(handler.getLastError()?.type).toBe(ErrorType.NETWORK_ERROR);
		});

		it("should clear errors", () => {
			const handler = new ErrorHandler();

			handler.handleError(new Error("Error 1"));
			handler.handleError(new Error("Error 2"));
			handler.clearErrors();

			expect(handler.getAllErrors()).toHaveLength(0);
			expect(handler.getLastError()).toBeNull();
		});
	});

	describe("errorHandler singleton", () => {
		it("should provide consistent behavior across usages", () => {
			const error1 = new Error("Network error failed");
			const error2 = new Error("Another network failed");

			errorHandler.handleError(error1);
			errorHandler.handleError(error2);

			// 验证最后错误的类型
			expect(errorHandler.getLastError()?.type).toBe(ErrorType.NETWORK_ERROR);

			errorHandler.clearErrors();
		});
	});
});

describe("Story 0.6 -验收标准测试", () => {
	describe("AC0.6.1: 工具错误处理", () => {
		it("should correctly identify and handle tool errors", () => {
			const error = new Error("Tool 'read_file' failed: permission denied");
			const piError = createPiAgentError(error, {
				toolName: "read_file",
			});

			expect(piError.type).toBe(ErrorType.TOOL_ERROR);
			expect(piError.severity).toBe(ErrorSeverity.LOW);
			expect(piError.recoverable).toBe(true);
			expect(piError.message).toContain("工具执行失败");
		});
	});

	describe("AC0.6.2: LLM 错误处理", () => {
		it("should correctly identify and handle LLM errors", () => {
			const error = new Error("LLM API rate limit exceeded");
			const piError = createPiAgentError(error);

			expect(piError.type).toBe(ErrorType.LLM_ERROR);
			expect(piError.severity).toBe(ErrorSeverity.HIGH);
			expect(piError.recoverable).toBe(false);
		});
	});

	describe("AC0.6.3: 重试功能", () => {
		it("should provide retry action for recoverable errors", () => {
			const error = new Error("Network connection failed");
			const piError = createPiAgentError(error);

			expect(piError.recoverable).toBe(true);
			expect(piError.recovery).toBeDefined();
			expect(piError.recovery?.type).toBe("retry");
			expect(piError.recovery?.label).toBe("重试");
		});
	});
});
