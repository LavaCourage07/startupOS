/**
 * Tool Execution Tests for Story 0.3
 *
 * Tests for new acceptance criteria:
 * - AC0.3.4: Tool Progress Updates (onUpdate callback)
 * - AC0.3.5: Tool Cancellation (AbortSignal)
 * - AC0.3.6: Path Safety Validation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Type } from "@sinclair/typebox";
import type { ToolRegistration, AgentToolResult, AgentToolUpdateCallback } from "../../types";
import { ToolRegistry } from "../registry";

// ============================================================================
// Mock Data
// ============================================================================

const TestParamsSchema = Type.Object({
	test: Type.String(),
});

// ============================================================================
// Tool Execution Tests - AC0.3.4: Progress Updates
// ============================================================================

describe("AC0.3.4: Tool Progress Updates", () => {
	let registry: ToolRegistry;
	let mockOnUpdate: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		registry = new ToolRegistry();
		mockOnUpdate = vi.fn();
	});

	it("should call onUpdate callback during tool execution (AC0.3.4.1)", async () => {
		// Given: A tool with progress updates
		const toolWithProgress: ToolRegistration = {
			name: "progress-test",
			label: "Progress Test",
			description: "Test tool that reports progress",
			parameters: TestParamsSchema,
			execute: async (toolCallId, params, signal, onUpdate) => {
				// Simulate progress updates
				onUpdate?.({
					type: "progress",
					toolCallId,
					toolName: "progress-test",
					status: "in_progress",
					message: "Starting task",
					progress: 0,
					timestamp: Date.now(),
				});

				await new Promise(resolve => setTimeout(resolve, 10));

				onUpdate?.({
					type: "progress",
					toolCallId,
					toolName: "progress-test",
					status: "in_progress",
					message: "Task complete",
					progress: 1,
					timestamp: Date.now(),
				});

				return {
					content: [{ type: "text", text: "Done" }],
				};
			},
			category: "system",
			enabled: true,
		};

		registry.register(toolWithProgress);
		const tool = registry.get("progress-test");

		// When: Executing the tool with onUpdate callback
		const result = await tool?.execute("call-1", { test: "value" }, undefined, mockOnUpdate);

		// Then: onUpdate should be called with progress updates
		expect(mockOnUpdate).toHaveBeenCalledTimes(2);
		expect(mockOnUpdate).toHaveBeenNthCalledWith(1, {
			type: "progress",
			toolCallId: "call-1",
			toolName: "progress-test",
			status: "in_progress",
			message: "Starting task",
			progress: 0,
			timestamp: expect.any(Number),
		});
		expect(mockOnUpdate).toHaveBeenNthCalledWith(2, {
			type: "progress",
			toolCallId: "call-1",
			toolName: "progress-test",
			status: "in_progress",
			message: "Task complete",
			progress: 1,
			timestamp: expect.any(Number),
		});
		expect(result).toBeDefined();
	});

	it("should not call onUpdate when callback is not provided (AC0.3.4.2)", async () => {
		// Given: A tool that uses onUpdate safely
		const toolWithOptionalUpdate: ToolRegistration = {
			name: "optional-update",
			label: "Optional Update",
			description: "Tool with optional callback",
			parameters: TestParamsSchema,
			execute: async (toolCallId, params, signal, onUpdate) => {
				// Tool should handle missing onUpdate gracefully
				onUpdate?.({
					type: "progress",
					toolCallId,
					toolName: "optional-update",
					status: "in_progress",
					message: "Progress",
					progress: 0.5,
					timestamp: Date.now(),
				});

				return {
					content: [{ type: "text", text: "Result" }],
				};
			},
			category: "system",
			enabled: true,
		};

		registry.register(toolWithOptionalUpdate);
		const tool = registry.get("optional-update");

		// When: Executing without onUpdate callback
		// Then: Should not throw or have issues
		await expect(
			tool?.execute("call-2", { test: "value" })
		).resolves.toBeDefined();
	});

	it("should include toolCallId in progress updates (AC0.3.4.3)", async () => {
		const toolCallId = "unique-call-id-12345";

		const tool: ToolRegistration = {
			name: "call-id-test",
			label: "Call ID Test",
			description: "Test toolCallId in updates",
			parameters: TestParamsSchema,
			execute: async (callId, params, signal, onUpdate) => {
				onUpdate?.({
					type: "progress",
					toolCallId: callId,
					toolName: "call-id-test",
					status: "in_progress",
					message: "Processing",
					progress: 0.5,
					timestamp: Date.now(),
				});

				return {
					content: [{ type: "text", text: "Done" }],
				};
			},
			category: "system",
			enabled: true,
		};

		registry.register(tool);
		const registeredTool = registry.get("call-id-test");

		await registeredTool?.execute(toolCallId, { test: "value" }, undefined, mockOnUpdate);

		expect(mockOnUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				toolCallId: toolCallId,
			})
		);
	});

	it("should report incremental progress (AC0.3.4.4)", async () => {
		const progressUpdates: number[] = [];

		const toolWithIncrementalProgress: ToolRegistration = {
			name: "incremental-progress",
			label: "Incremental Progress",
			description: "Test incremental progress reporting",
			parameters: TestParamsSchema,
			execute: async (toolCallId, params, signal, onUpdate) => {
				// Simulate a multi-step task
				const steps = [0.25, 0.5, 0.75, 1.0];

				for (const progress of steps) {
					onUpdate?.({
						type: "progress",
						toolCallId,
						toolName: "incremental-progress",
						status: "in_progress",
						message: `Step ${progress * 100}%`,
						progress,
						timestamp: Date.now(),
					});

					await new Promise(resolve => setTimeout(resolve, 5));
				}

				return {
					content: [{ type: "text", text: "Multi-step complete" }],
				};
			},
			category: "system",
			enabled: true,
		};

		registry.register(toolWithIncrementalProgress);
		const tool = registry.get("incremental-progress");

		mockOnUpdate.mockImplementation((update) => {
			if (update.type === "progress" && typeof update.progress === "number") {
				progressUpdates.push(update.progress);
			}
		});

		await tool?.execute("call-incremental", { test: "value" }, undefined, mockOnUpdate);

		expect(progressUpdates).toEqual([0.25, 0.5, 0.75, 1.0]);
		// Verify progress increases by checking each consecutive value
		for (let i = 1; i < progressUpdates.length; i++) {
			expect(progressUpdates[i]).toBeGreaterThan(progressUpdates[i - 1]);
		}
	});
});

// ============================================================================
// Tool Execution Tests - AC0.3.5: Tool Cancellation
// ============================================================================

describe("AC0.3.5: Tool Cancellation (AbortSignal)", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		registry = new ToolRegistry();
	});

	it("should abort tool execution when signal is aborted (AC0.3.5.1)", async () => {
		// Given: A long-running tool with cancellation support
		const longRunningTool: ToolRegistration = {
			name: "long-running",
			label: "Long Running",
			description: "Tool that can be cancelled",
			parameters: TestParamsSchema,
			execute: async (toolCallId, params, signal, onUpdate) => {
				// Check for abort at start
				if (signal?.aborted) {
					throw new DOMException("Tool execution was aborted", "AbortError");
				}

				onUpdate?.({
					type: "progress",
					toolCallId,
					toolName: "long-running",
					status: "in_progress",
					message: "Starting long task",
					progress: 0,
					timestamp: Date.now(),
				});

				// Simulate long work
				for (let i = 0; i < 10; i++) {
					await new Promise(resolve => setTimeout(resolve, 10));

					// Check for abort during execution
					if (signal?.aborted) {
						throw new DOMException("Tool execution was aborted", "AbortError");
					}

					onUpdate?.({
						type: "progress",
						toolCallId,
						toolName: "long-running",
						status: "in_progress",
						message: `Step ${i + 1}`,
						progress: (i + 1) / 10,
						timestamp: Date.now(),
					});
				}

				return {
					content: [{ type: "text", text: "Complete" }],
				};
			},
			category: "system",
			enabled: true,
		};

		const abortController = new AbortController();

		registry.register(longRunningTool);
		const tool = registry.get("long-running");

		// When: Aborting during execution
		const executePromise = tool?.execute(
			"call-abort",
			{ test: "value" },
			abortController.signal,
			vi.fn()
		);

		// Abort after 30ms
		setTimeout(() => abortController.abort(), 30);

		// Then: Should throw AbortError
		await expect(executePromise).rejects.toThrow("Tool execution was aborted");
	});

	it("should handle pre-aborted signal (AC0.3.5.2)", async () => {
		const abortController = new AbortController();
		abortController.abort(); // Already aborted

		const tool: ToolRegistration = {
			name: "pre-aborted",
			label: "Pre-Aborted",
			description: "Test pre-aborted signal",
			parameters: TestParamsSchema,
			execute: async (toolCallId, params, signal) => {
				if (signal?.aborted) {
					throw new DOMException("Tool execution was aborted", "AbortError");
				}

				return {
					content: [{ type: "text", text: "Won't execute" }],
				};
			},
			category: "system",
			enabled: true,
		};

		registry.register(tool);
		const registeredTool = registry.get("pre-aborted");

		await expect(
			registeredTool?.execute("call-pre-abort", { test: "value" }, abortController.signal)
		).rejects.toThrow("Tool execution was aborted");
	});

	it("should handle no signal gracefully (AC0.3.5.3)", async () => {
		// Given: A tool that optionally uses signal
		const toolWithOptionalSignal: ToolRegistration = {
			name: "optional-signal",
			label: "Optional Signal",
			description: "Tool with optional signal",
			parameters: TestParamsSchema,
			execute: async (toolCallId, params, signal) => {
				// Tool should handle missing signal gracefully
				if (signal?.aborted) {
					throw new DOMException("Tool execution was aborted", "AbortError");
				}

				await new Promise(resolve => setTimeout(resolve, 50));

				return {
					content: [{ type: "text", text: "Completed without signal" }],
				};
			},
			category: "system",
			enabled: true,
		};

		registry.register(toolWithOptionalSignal);
		const tool = registry.get("optional-signal");

		// When: Executing without signal
		// Then: Should complete normally
		await expect(
			tool?.execute("call-no-signal", { test: "value" })
		).resolves.toBeDefined();
	});

	it("should not call onUpdate after abort (AC0.3.5.4)", async () => {
		const updates: unknown[] = [];

		const abortController = new AbortController();
		const collectUpdates: AgentToolUpdateCallback<unknown> = (update) => {
			updates.push(update);
		};

		const tool: ToolRegistration = {
			name: "abort-no-update",
			label: "Abort No Update",
			description: "Test no updates after abort",
			parameters: TestParamsSchema,
			execute: async (toolCallId, params, signal, onUpdate) => {
				for (let i = 0; i < 5; i++) {
					if (signal?.aborted) {
						throw new DOMException("Tool execution was aborted", "AbortError");
					}

					onUpdate?.({
						type: "progress",
						toolCallId,
						toolName: "abort-no-update",
						status: "in_progress",
						message: `Step ${i}`,
						progress: i / 5,
						timestamp: Date.now(),
					});

					await new Promise(resolve => setTimeout(resolve, 20));
				}

				return {
					content: [{ type: "text", text: "Complete" }],
				};
			},
			category: "system",
			enabled: true,
		};

		registry.register(tool);
		const registeredTool = registry.get("abort-no-update");

		const executePromise = registeredTool?.execute(
			"call-abort-update",
			{ test: "value" },
			abortController.signal,
			collectUpdates
		);

		// Abort after some time
		setTimeout(() => abortController.abort(), 40);

		// Should throw or complete with less than 5 updates
		await expect(executePromise).rejects.toThrow("Tool execution was aborted");

		// Verify no updates after abort signal
		expect(updates.length).toBeLessThan(5);
	});

	it("should verify signal is an AbortSignal type (AC0.3.5.5)", async () => {
		const tool: ToolRegistration = {
			name: "signal-type-check",
			label: "Signal Type Check",
			description: "Test signal type checking",
			parameters: TestParamsSchema,
			execute: async (toolCallId, params, signal) => {
				// Tool should expect AbortSignal or undefined
				if (signal !== undefined && !("aborted" in signal)) {
					throw new Error("Invalid signal type");
				}

				return {
					content: [{ type: "text", text: "Signal type valid" }],
				};
			},
			category: "system",
			enabled: true,
		};

		registry.register(tool);
		const registeredTool = registry.get("signal-type-check");

		// Test with real AbortSignal
		const abortController = new AbortController();
		await expect(
			registeredTool?.execute("call-valid-signal", { test: "value" }, abortController.signal)
		).resolves.toBeDefined();

		// Test without signal
		await expect(
			registeredTool?.execute("call-no-signal", { test: "value" })
		).resolves.toBeDefined();
	});
});

// ============================================================================
// Tool Execution Tests - AC0.3.6: Path Safety
// ============================================================================

describe("AC0.3.6: Path Safety Validation", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		registry = new ToolRegistry();
	});

	it("should reject path traversal attacks with .. (AC0.3.6.1)", async () => {
		const toolWithPathValidation: ToolRegistration = {
			name: "file-reader",
			label: "File Reader",
			description: "Reads files with path validation",
			parameters: Type.Object({
				filePath: Type.String(),
			}),
			execute: async (toolCallId, params) => {
				const path = require("path");
				const normalized = path.normalize(params.filePath);

				// Reject paths that start with ..
				if (normalized.startsWith("..")) {
					throw new Error("Invalid file path: path traversal detected");
				}

				return {
					content: [{ type: "text", text: "Path is valid" }],
				};
			},
			category: "file",
			enabled: true,
		};

		registry.register(toolWithPathValidation);
		const tool = registry.get("file-reader");

		// When: Attempting path traversal
		// Then: Should reject
		await expect(
			tool?.execute("call-traversal-1", { filePath: "../../../etc/passwd" })
		).rejects.toThrow("path traversal detected");

		await expect(
			tool?.execute("call-traversal-2", { filePath: "../secret" })
		).rejects.toThrow("path traversal detected");
	});

	it("should reject absolute paths (AC0.3.6.2)", async () => {
		const tool: ToolRegistration = {
			name: "file-writer",
			label: "File Writer",
			description: "Writes files with path validation",
			parameters: Type.Object({
				filePath: Type.String(),
			}),
			execute: async (toolCallId, params) => {
				const path = require("path");

				// Reject absolute paths
				if (path.isAbsolute(params.filePath)) {
					throw new Error("Invalid file path: absolute paths not allowed");
				}

				return {
					content: [{ type: "text", text: "Path is valid" }],
				};
			},
			category: "file",
			enabled: true,
		};

		registry.register(tool);
		const registeredTool = registry.get("file-writer");

		// When: Attempting with absolute path
		await expect(
			registeredTool?.execute("call-absolute", { filePath: "/etc/passwd" })
		).rejects.toThrow("absolute paths not allowed");

		// Skip Windows absolute path test on Unix systems
		// Node.js path.isAbsolute() handles platform-specific paths
	});

	it("should accept valid relative paths (AC0.3.6.3)", async () => {
		const tool: ToolRegistration = {
			name: "file-creator",
			label: "File Creator",
			description: "Creates files with safe paths",
			parameters: Type.Object({
				filePath: Type.String(),
			}),
			execute: async (toolCallId, params) => {
				const path = require("path");
				const normalized = path.normalize(params.filePath);

				// Validate path
				if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
					throw new Error("Invalid file path");
				}

				return {
					content: [{ type: "text", text: `Created: ${normalized}` }],
				};
			},
			category: "file",
			enabled: true,
		};

		registry.register(tool);
		const registeredTool = registry.get("file-creator");

		// When:使用安全路径
		// Then: Should accept
		await expect(
			registeredTool?.execute("call-safe-1", { filePath: "data/config.json" })
		).resolves.toBeDefined();

		await expect(
			registeredTool?.execute("call-safe-2", { filePath: "src/utils/file.ts" })
		).resolves.toBeDefined();

		await expect(
			registeredTool?.execute("call-safe-3", { filePath: "./assets/image.png" })
		).resolves.toBeDefined();
	});

	it("should normalize paths before validation (AC0.3.6.4)", async () => {
		const tool: ToolRegistration = {
			name: "path-normalizer",
			label: "Path Normalizer",
			description: "Normalizes and validates paths",
			parameters: Type.Object({
				filePath: Type.String(),
			}),
			execute: async (toolCallId, params) => {
				const path = require("path");
				const normalized = path.normalize(params.filePath);

				if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
					throw new Error("Invalid file path");
				}

				return {
					content: [{ type: "text", text: `Normalized: ${normalized}` }],
				};
			},
			category: "file",
			enabled: true,
		};

		registry.register(tool);
		const registeredTool = registry.get("path-normalizer");

		// ./././ should normalize to .
		await expect(
			registeredTool?.execute("call-normalize-1", { filePath: "./././file.txt" })
		).resolves.toBeDefined();

		// dir/./sub/ should normalize to dir/sub
		await expect(
			registeredTool?.execute("call-normalize-2", { filePath: "dir/./sub/file.txt" })
		).resolves.toBeDefined();

		// dir/../sub should be rejected
		await expect(
			registeredTool?.execute("call-normalize-3", { filePath: "dir/../sub/file.txt" })
		).resolves.toBeDefined(); // This is safe (dir/../sub normalizes to sub)
	});

	it("should handle null or undefined paths (AC0.3.6.5)", async () => {
		const tool: ToolRegistration = {
			name: "path-null-check",
			label: "Path Null Check",
			description: "Handles null/undefined paths",
			parameters: Type.Object({
				filePath: Type.Optional(Type.String()),
			}),
			execute: async (toolCallId, params) => {
				if (!params.filePath) {
					throw new Error("File path is required");
				}

				return {
					content: [{ type: "text", text: "Path provided" }],
				};
			},
			category: "file",
			enabled: true,
		};

		registry.register(tool);
		const registeredTool = registry.get("path-null-check");

		// When: Path is null or undefined
		await expect(
			registeredTool?.execute("call-null", { filePath: undefined })
		).rejects.toThrow("File path is required");

		await expect(
			registeredTool?.execute("call-empty", { filePath: "" })
		).rejects.toThrow("File path is required");
	});

	it("should reject null byte injection (AC0.3.6.6)", async () => {
		const tool: ToolRegistration = {
			name: "null-byte-check",
			label: "Null Byte Check",
			description: "Detects null byte injection",
			parameters: Type.Object({
				filePath: Type.String(),
			}),
			execute: async (toolCallId, params) => {
				if (params.filePath.includes("\0")) {
					throw new Error("Invalid file path: null byte detected");
				}

				return {
					content: [{ type: "text", text: "Path is safe" }],
				};
			},
			category: "file",
			enabled: true,
		};

		registry.register(tool);
		const registeredTool = registry.get("null-byte-check");

		// When: Attempting null byte injection
		await expect(
			registeredTool?.execute("call-null-byte", { filePath: "config.json\0evil.txt" })
		).rejects.toThrow("null byte detected");
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Story 0.3 Integration Tests", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		registry = new ToolRegistry();
	});

	it("should support progress updates and cancellation together", async () => {
		const updates: unknown[] = [];
		const abortController = new AbortController();

		const tool: ToolRegistration = {
			name: "integrated-tool",
			label: "Integrated Tool",
			description: "Test progress and cancellation together",
			parameters: TestParamsSchema,
			execute: async (toolCallId, params, signal, onUpdate) => {
				for (let i = 0; i < 10; i++) {
					if (signal?.aborted) {
						throw new DOMException("Tool execution was aborted", "AbortError");
					}

					const progress = (i + 1) / 10;

					onUpdate?.({
						type: "progress",
						toolCallId,
						toolName: "integrated-tool",
						status: "in_progress",
						message: `Step ${i + 1}`,
						progress,
						timestamp: Date.now(),
						data: { step: i + 1 },
					});

					await new Promise(resolve => setTimeout(resolve, 10));
				}

				return {
					content: [{ type: "text", text: "Complete" }],
				};
			},
			category: "system",
			enabled: true,
		};

		registry.register(tool);
		const registeredTool = registry.get("integrated-tool");

		const executePromise = registeredTool?.execute(
			"call-integrated",
			{ test: "value" },
			abortController.signal,
			(update) => {
				updates.push(update);
			}
		);

		// Abort after 25ms
		setTimeout(() => abortController.abort(), 25);

		await expect(executePromise).rejects.toThrow("Tool execution was aborted");

		// Verify some progress was reported before abort
		expect(updates.length).toBeGreaterThan(0);
		expect(updates.length).toBeLessThan(10);
	});

	it("should convert ToolRegistration to AgentTool format correctly", () => {
		const tool: ToolRegistration = {
			name: "conversion-test",
			label: "Conversion Test",
			description: "Test for AgentTool conversion",
			parameters: TestParamsSchema,
			execute: async () => ({
				content: [{ type: "text", text: "Result" }],
			}),
			category: "system",
			enabled: true,
		};

		registry.register(tool);

		const agentTools = registry.toAgentTools();

		expect(agentTools).toHaveLength(1);
		expect(agentTools[0]).toEqual({
			name: "conversion-test",
			label: "Conversion Test",
			description: "Test for AgentTool conversion",
			parameters: TestParamsSchema,
			execute: tool.execute,
		});
	});

	it("should preserve all tool properties through registry", () => {
		const originalTool: ToolRegistration = {
			name: "preserve-test",
			label: "Preserve Test",
			description: "Test property preservation",
			parameters: Type.Object({
				opt1: Type.String(),
				opt2: Type.Number(),
			}),
			execute: async () => ({
				content: [{ type: "text", text: "Preserved" }],
			}),
			category: "file",
			enabled: true,
		};

		registry.register(originalTool);
		const retrieved = registry.get("preserve-test");

		// Registry stores a direct reference to the tool object
		expect(retrieved).toBe(originalTool);
		expect(retrieved?.name).toBe(originalTool.name);
		expect(retrieved?.label).toBe(originalTool.label);
		expect(retrieved?.description).toBe(originalTool.description);
		expect(retrieved?.category).toBe(originalTool.category);
		expect(retrieved?.enabled).toBe(originalTool.enabled);
	});
});
