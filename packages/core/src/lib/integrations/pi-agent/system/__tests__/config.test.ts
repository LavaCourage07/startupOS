/**
 * Unit tests for system/config
 *
 * Tests cover:
 * - DEFAULT_CONFIG validation
 * - createOriginOSAgentConfig function
 * - validateConfig function
 * - ProjectContext handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	DEFAULT_CONFIG,
	createOriginOSAgentConfig,
	validateConfig,
	type OriginOSAgentConfig,
	type ProjectContext,
} from "../../system/config";

// Mock external dependencies
vi.mock("@mariozechner/pi-ai", () => ({
	getModel: vi.fn((provider: string, id: string) => ({
		provider,
		id,
	})),
}));

// Note: We don't mock local module ../../system/prompt
// Tests should be adapted to not depend on specific system prompt content

// ============================================================================
// Test Data
// ============================================================================

const mockSystemPromptVariables: any = {
	projectName: "Test Project",
	projectId: "project-123",
	ontologyId: "ontology-456",
	projectPath: "/data/projects/test",
	userName: "Test User",
	// userId omitted to test optional field handling
};

const mockProjectContext: ProjectContext = {
	projectId: "project-123",
	ontologyId: "ontology-456",
	projectName: "Test Project",
	currentPath: "/data/projects/test",
	// userId omitted as it's optional
};

// ============================================================================
// Test Suite
// ============================================================================

describe("DEFAULT_CONFIG", () => {
	it("should have model property", () => {
		expect(DEFAULT_CONFIG.model).toBeDefined();
		expect(DEFAULT_CONFIG.model).toHaveProperty("provider");
		expect(DEFAULT_CONFIG.model).toHaveProperty("id");
	});

	it("should use claude-haiku as default model", () => {
		expect(DEFAULT_CONFIG.model.provider).toBe("anthropic");
		expect(DEFAULT_CONFIG.model.id).toBe("claude-haiku-4-5");
	});

	it("should have default project context", () => {
		expect(DEFAULT_CONFIG.projectContext).toBeDefined();
		expect(DEFAULT_CONFIG.projectContext.projectId).toBe("default");
	});

	it("should have default project name", () => {
		expect(DEFAULT_CONFIG.projectContext.projectName).toBe("默认项目");
	});

	it("should have default current path", () => {
		expect(DEFAULT_CONFIG.projectContext.currentPath).toBe("/data/projects/default");
	});

	it("should have low thinking level", () => {
		expect(DEFAULT_CONFIG.thinkingLevel).toBe("low");
	});

	it("should have empty tools array", () => {
		expect(DEFAULT_CONFIG.tools).toEqual([]);
	});

	it("should have all required properties except sessionId and systemPrompt", () => {
		expect(DEFAULT_CONFIG).toHaveProperty("model");
		expect(DEFAULT_CONFIG).toHaveProperty("projectContext");
		expect(DEFAULT_CONFIG).toHaveProperty("thinkingLevel");
		expect(DEFAULT_CONFIG).toHaveProperty("tools");
	});
});

describe("createOriginOSAgentConfig", () => {
	it("should create config with sessionId", () => {
		const config = createOriginOSAgentConfig(
			"session-123",
			mockSystemPromptVariables
		);

		expect(config.sessionId).toBe("session-123");
	});

	it("should create config with system prompt", () => {
		const config = createOriginOSAgentConfig(
			"session-123",
			mockSystemPromptVariables
		);

		expect(config.systemPrompt).toBeDefined();
		expect(typeof config.systemPrompt).toBe("string");
		// System prompt will be built by the actual function
	});

	it("should include model from DEFAULT_CONFIG", () => {
		const config = createOriginOSAgentConfig(
			"session-123",
			mockSystemPromptVariables
		);

		expect(config.model).toEqual(DEFAULT_CONFIG.model);
	});

	it("should include project context from variables", () => {
		const config = createOriginOSAgentConfig(
			"session-123",
			mockSystemPromptVariables
		);

		expect(config.projectContext).toEqual({
			projectId: "project-123",
			ontologyId: "ontology-456",
			projectName: "Test Project",
			currentPath: "/data/projects/test",
			userId: undefined, // Not in variables
		});
	});

	it("should include thinking level from DEFAULT_CONFIG", () => {
		const config = createOriginOSAgentConfig(
			"session-123",
			mockSystemPromptVariables
		);

		expect(config.thinkingLevel).toBe(DEFAULT_CONFIG.thinkingLevel);
	});

	it("should include tools from DEFAULT_CONFIG", () => {
		const config = createOriginOSAgentConfig(
			"session-123",
			mockSystemPromptVariables
		);

		expect(config.tools).toEqual(DEFAULT_CONFIG.tools);
	});

	it("should apply overrides", () => {
		const overrides: Partial<OriginOSAgentConfig> = {
			thinkingLevel: "high",
			tools: ["tool1", "tool2"],
		};

		const config = createOriginOSAgentConfig(
			"session-123",
			mockSystemPromptVariables,
			overrides
		);

		expect(config.thinkingLevel).toBe("high");
		expect(config.tools).toEqual(["tool1", "tool2"]);
	});

	it("should apply model override", () => {
		const customModel = { provider: "google" as const, id: "gemini-pro" };

		const config = createOriginOSAgentConfig(
			"session-123",
			mockSystemPromptVariables,
			{ model: customModel }
		);

		expect(config.model).toEqual(customModel);
	});

	it("should handle partial project context in variables", () => {
		const partialVariables = {
			projectName: "Partial Project",
			projectId: "partial-project",
			// Missing: ontologyId, projectPath, userName
		};

		const config = createOriginOSAgentConfig(
			"session-123",
			partialVariables as any
		);

		expect(config.projectContext).toBeDefined();
		expect(config.projectContext.projectId).toBe("partial-project");
	});

	it("should handle missing optional variables with defaults", () => {
		const minimalVariables = {
			projectId: "minimal-project",
		};

		const config = createOriginOSAgentConfig(
			"session-123",
			minimalVariables as any
		);

		// Verify config was created successfully
		expect(config.sessionId).toBe("session-123");
		expect(config.projectContext.projectId).toBe("minimal-project");
	});

	it("should use DEFAULT_CONFIG for missing props", () => {
		const config = createOriginOSAgentConfig(
			"session-123",
			{} as any
		);

		expect(config.model).toEqual(DEFAULT_CONFIG.model);
		expect(config.thinkingLevel).toEqual(DEFAULT_CONFIG.thinkingLevel);
		expect(config.tools).toEqual(DEFAULT_CONFIG.tools);
	});

	it("should handle system prompt variables with userId", () => {
		const variablesWithUserId: any = {
			...mockSystemPromptVariables,
			userId: "user-001",
		};

		const config = createOriginOSAgentConfig(
			"session-123",
			variablesWithUserId
		);

		expect(config.projectContext.userId).toBe("user-001");
	});

	it("should merge project context from overrides", () => {
		const overrides: Partial<OriginOSAgentConfig> = {
			projectContext: {
				projectId: "override-project",
				projectName: "Override Name",
			},
		};

		const config = createOriginOSAgentConfig(
			"session-123",
			mockSystemPromptVariables,
			overrides
		);

		expect(config.projectContext.projectId).toBe("override-project");
		expect(config.projectContext.projectName).toBe("Override Name");
	});
});

describe("validateConfig", () => {
	describe("Validation Rules", () => {
		it("should pass for valid config", () => {
			const validConfig: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "You are a helpful assistant",
				model: { provider: "anthropic" as const, id: "claude-3" },
				projectContext: {
					projectId: "project-123",
				},
				thinkingLevel: "low",
			};

			const errors = validateConfig(validConfig);

			expect(errors).toEqual([]);
		});

		it("should fail for empty sessionId", () => {
			const invalidConfig: OriginOSAgentConfig = {
				sessionId: "",
				systemPrompt: "Test prompt",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: { projectId: "test" },
			};

			const errors = validateConfig(invalidConfig);

			expect(errors).toContain("sessionId不能为空");
		});

		it("should fail for whitespace-only sessionId", () => {
			const invalidConfig: OriginOSAgentConfig = {
				sessionId: "   ",
				systemPrompt: "Test prompt",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: { projectId: "test" },
			};

			const errors = validateConfig(invalidConfig);

			expect(errors).toContain("sessionId不能为空");
		});

		it("should fail for empty systemPrompt", () => {
			const invalidConfig: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: { projectId: "test" },
			};

			const errors = validateConfig(invalidConfig);

			expect(errors).toContain("systemPrompt不能为空");
		});

		it("should fail for whitespace-only systemPrompt", () => {
			const invalidConfig: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "   ",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: { projectId: "test" },
			};

			const errors = validateConfig(invalidConfig);

			expect(errors).toContain("systemPrompt不能为空");
		});

		it("should fail for missing model", () => {
			const invalidConfig: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "Test prompt",
				model: undefined as any,
				projectContext: { projectId: "test" },
			};

			const errors = validateConfig(invalidConfig);

			expect(errors).toContain("model不能为空");
		});

		it("should fail for null model", () => {
			const invalidConfig: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "Test prompt",
				model: null as any,
				projectContext: { projectId: "test" },
			};

			const errors = validateConfig(invalidConfig);

			expect(errors).toContain("model不能为空");
		});

		it("should fail for missing projectContext", () => {
			const invalidConfig: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "Test prompt",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: undefined as any,
			};

			const errors = validateConfig(invalidConfig);

			expect(errors).toContain("需要指定projectId");
		});

		it("should fail for missing projectId in projectContext", () => {
			const invalidConfig: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "Test prompt",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: {} as any,
			};

			const errors = validateConfig(invalidConfig);

			expect(errors).toContain("需要指定projectId");
		});

		it("should fail for empty projectId in projectContext", () => {
			const invalidConfig: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "Test prompt",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: { projectId: "" },
			};

			const errors = validateConfig(invalidConfig);

			expect(errors).toContain("需要指定projectId");
		});

		it("should return multiple errors for multiple validation failures", () => {
			const invalidConfig: OriginOSAgentConfig = {
				sessionId: "",
				systemPrompt: "",
				model: undefined as any,
				projectContext: undefined as any,
			};

			const errors = validateConfig(invalidConfig);

			expect(errors.length).toBeGreaterThan(1);
			expect(errors).toContain("sessionId不能为空");
			expect(errors).toContain("systemPrompt不能为空");
			expect(errors).toContain("model不能为空");
			expect(errors).toContain("需要指定projectId");
		});
	});

	describe("Valid Thinking Levels", () => {
		const validLevels: Array<"off" | "minimal" | "low" | "medium" | "high"> = [
			"off",
			"minimal",
			"low",
			"medium",
			"high",
		];

		validLevels.forEach((level) => {
			it(`should accept thinking level: ${level}`, () => {
				const config: OriginOSAgentConfig = {
					sessionId: "session-123",
					systemPrompt: "Test prompt",
					model: { provider: "anthropic" as const, id: "test" },
					projectContext: { projectId: "test" },
					thinkingLevel: level,
				};

				const errors = validateConfig(config);

				expect(errors).toEqual([]);
			});
		});
	});

	describe("Optional Properties", () => {
		it("should pass when optional properties are missing", () => {
			const minimalConfig: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "Test prompt",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: { projectId: "test" },
			};

			const errors = validateConfig(minimalConfig);

			expect(errors).toEqual([]);
		});

		it("should pass with empty ontologyId in projectContext", () => {
			const config: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "Test prompt",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: {
					projectId: "test",
					// ontologyId is optional
				},
			};

			const errors = validateConfig(config);

			expect(errors).toEqual([]);
		});

		it("should pass with empty currentPath in projectContext", () => {
			const config: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "Test prompt",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: {
					projectId: "test",
					// currentPath is optional
				},
			};

			const errors = validateConfig(config);

			expect(errors).toEqual([]);
		});

		it("should pass with empty projectName in projectContext", () => {
			const config: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "Test prompt",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: {
					projectId: "test",
					// projectName is optional
				},
			};

			const errors = validateConfig(config);

			expect(errors).toEqual([]);
		});

		it("should pass with empty userId in projectContext", () => {
			const config: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "Test prompt",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: {
					projectId: "test",
					// userId is optional
				},
			};

			const errors = validateConfig(config);

			expect(errors).toEqual([]);
		});

		it("should pass with empty tools array", () => {
			const config: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "Test prompt",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: { projectId: "test" },
				tools: [],
			};

			const errors = validateConfig(config);

			expect(errors).toEqual([]);
		});

		it("should pass when thinkingLevel is not specified", () => {
			const config: OriginOSAgentConfig = {
				sessionId: "session-123",
				systemPrompt: "Test prompt",
				model: { provider: "anthropic" as const, id: "test" },
				projectContext: { projectId: "test" },
			};

			const errors = validateConfig(config);

			expect(errors).toEqual([]);
		});
	});
});

describe("ProjectContext", () => {
	it("should have projectId property", () => {
		const context: ProjectContext = {
			projectId: "test-project-123",
		};

		expect(context.projectId).toBe("test-project-123");
	});

	it("should accept optional ontologyId", () => {
		const context: ProjectContext = {
			projectId: "test",
			ontologyId: "test-ontology",
		};

		expect(context.ontologyId).toBe("test-ontology");
	});

	it("should accept optional currentPath", () => {
		const context: ProjectContext = {
			projectId: "test",
			currentPath: "/data/projects/test",
		};

		expect(context.currentPath).toBe("/data/projects/test");
	});

	it("should accept optional projectName", () => {
		const context: ProjectContext = {
			projectId: "test",
			projectName: "Test Project",
		};

		expect(context.projectName).toBe("Test Project");
	});

	it("should accept optional userId", () => {
		const context: ProjectContext = {
			projectId: "test",
			userId: "user-123",
		};

		expect(context.userId).toBe("user-123");
	});

	it("should support all optional properties simultaneously", () => {
		const context: ProjectContext = {
			projectId: "test",
			ontologyId: "ontology-123",
			currentPath: "/data/projects/test",
			projectName: "Test Project",
			userId: "user-123",
		};

		expect(context).toEqual({
			projectId: "test",
			ontologyId: "ontology-123",
			currentPath: "/data/projects/test",
			projectName: "Test Project",
			userId: "user-123",
		});
	});
});

describe("Edge Cases", () => {
	it("should handle very long sessionId", () => {
		const longSessionId = "a".repeat(1000);

		const config: OriginOSAgentConfig = {
			sessionId: longSessionId,
			systemPrompt: "Test prompt",
			model: { provider: "anthropic" as const, id: "test" },
			projectContext: { projectId: "test" },
		};

		const errors = validateConfig(config);

		// long session IDs should still be valid
		expect(errors).toEqual([]);
	});

	it("should handle very long systemPrompt", () => {
		const longPrompt = "a".repeat(10000);

		const config: OriginOSAgentConfig = {
			sessionId: "session-123",
			systemPrompt: longPrompt,
			model: { provider: "anthropic" as const, id: "test" },
			projectContext: { projectId: "test" },
		};

		const errors = validateConfig(config);

		expect(errors).toEqual([]);
	});

	it("should handle special characters in projectId", () => {
		const specialProjectId = "my_project-123.456";

		const config: OriginOSAgentConfig = {
			sessionId: "session-123",
			systemPrompt: "Test prompt",
			model: { provider: "anthropic" as const, id: "test" },
			projectContext: { projectId: specialProjectId },
		};

		const errors = validateConfig(config);

		expect(errors).toEqual([]);
	});

	it("should handle unicode in systemPrompt", () => {
		const unicodePrompt = "你好，我是助手。こんにちは、アシスタントです。";

		const config: OriginOSAgentConfig = {
			sessionId: "session-123",
			systemPrompt: unicodePrompt,
			model: { provider: "anthropic" as const, id: "test" },
			projectContext: { projectId: "test" },
		};

		const errors = validateConfig(config);

		expect(errors).toEqual([]);
	});

	it("should handle null values for optional properties", () => {
		const config: OriginOSAgentConfig = {
			sessionId: "session-123",
			systemPrompt: "Test prompt",
			model: { provider: "anthropic" as const, id: "test" },
			projectContext: {
				projectId: "test",
				ontologyId: null as any,
				currentPath: null as any,
				projectName: null as any,
				userId: null as any,
			},
		};

		const errors = validateConfig(config);

		// Optional null values should be acceptable
		expect(errors).toEqual([]);
	});
});

describe("Integration Tests", () => {
	it("should create and validate config successfully", () => {
		const config = createOriginOSAgentConfig(
			"session-123",
			mockSystemPromptVariables
		);

		const errors = validateConfig(config);

		expect(errors).toEqual([]);
	});

	it("should handle overrides in validateConfig", () => {
		const config = createOriginOSAgentConfig(
			"session-123",
			mockSystemPromptVariables,
			{
				thinkingLevel: "high",
				tools: ["tool1"],
			}
		);

		const errors = validateConfig(config);

		expect(errors).toEqual([]);
	});

	it("should detect validation errors after creation", () => {
		const invalidVariables: any = {
			projectName: "",
			projectId: "",  // Will cause validation to fail
		};

		const config = createOriginOSAgentConfig(
			"session-123",
			invalidVariables
		);

		const errors = validateConfig(config);

		// Should detect empty projectId
		expect(errors.length).toBeGreaterThan(0);
	});
});
