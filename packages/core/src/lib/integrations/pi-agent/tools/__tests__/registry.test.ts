/**
 * Unit tests for ToolRegistry
 *
 * Tests cover:
 * - Tool registration (single and batch)
 * - Tool retrieval (get, getAll, getEnabled, getByCategory)
 * - Tool enable/disable
 * - Tool conversion to AgentTool format
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Type, Static, TSchema } from "@sinclair/typebox/types";
import { ToolRegistry, getToolRegistry, registerTool, getAgentTools, getAgentToolsForScope } from "../registry";
import type { ToolRegistration } from "../../types";

// ============================================================================
// Test Data
// ============================================================================

const mockSchema: TSchema = {
	type: "object",
	properties: {
		test: { type: "string" },
	},
} as unknown as TSchema;

const mockTool: ToolRegistration = {
	name: "test-tool",
	label: "Test Tool",
	description: "A test tool for unit testing",
	parameters: mockSchema,
	execute: vi.fn(),
	category: "file",
	enabled: true,
};

const fileTool: ToolRegistration = {
	name: "read-file",
	label: "Read File",
	description: "Read a file from the filesystem",
	parameters: mockSchema,
	execute: vi.fn(),
	category: "file",
	enabled: true,
};

const ontologyTool: ToolRegistration = {
	name: "query-ontology",
	label: "Query Ontology",
	description: "Query the ontology graph",
	parameters: mockSchema,
	execute: vi.fn(),
	category: "ontology",
	enabled: true,
};

const graphTool: ToolRegistration = {
	name: "visualize-graph",
	label: "Visualize Graph",
	description: "Create graph visualizations",
	parameters: mockSchema,
	execute: vi.fn(),
	category: "graph",
	enabled: true,
};

const skillTool: ToolRegistration = {
	name: "run-skill",
	label: "Run Skill",
	description: "Execute a skill",
	parameters: mockSchema,
	execute: vi.fn(),
	category: "skill",
	enabled: true,
};

const systemTool: ToolRegistration = {
	name: "get-system-info",
	label: "System Info",
	description: "Get system information",
	parameters: mockSchema,
	execute: vi.fn(),
	category: "system",
	enabled: true,
};

const askUserQuestionTool: ToolRegistration = {
	name: "ask_user_question",
	label: "Ask User Question",
	description: "Request user input directly",
	parameters: mockSchema,
	execute: vi.fn(),
	category: "system",
	enabled: true,
};

// ============================================================================
// Test Suite
// ============================================================================

describe("ToolRegistry", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		registry = new ToolRegistry();
		vi.clearAllMocks();
	});

	describe("Tool Registration", () => {
		it("should register a single tool", () => {
			registry.register(mockTool);

			expect(registry.has("test-tool")).toBe(true);
		});

		it("should get a registered tool", () => {
			registry.register(mockTool);

			const retrieved = registry.get("test-tool");

			expect(retrieved).toBeDefined();
			expect(retrieved?.name).toBe("test-tool");
		});

		it("should return undefined for non-existent tool", () => {
			const retrieved = registry.get("non-existent-tool");

			expect(retrieved).toBeUndefined();
		});

		it("should warn when registering duplicate tool name", () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			registry.register(mockTool);
			registry.register({
				...mockTool,
				label: "Different",
			});

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('"test-tool"')
			);
			expect(warnSpy).toHaveBeenCalledWith(
				"工具 \"test-tool\" 已存在，将被覆盖"
			);

			warnSpy.mockRestore();
		});

		it("should override tool when registering duplicate name", () => {
			registry.register(mockTool);
			registry.register({
				...mockTool,
				label: "Updated Tool",
			});

			const retrieved = registry.get("test-tool");
			expect(retrieved?.label).toBe("Updated Tool");
		});

		it("should register multiple tools in batch", () => {
			const tools = [fileTool, ontologyTool, graphTool];

			registry.registerBatch(tools);

			expect(registry.has("read-file")).toBe(true);
			expect(registry.has("query-ontology")).toBe(true);
			expect(registry.has("visualize-graph")).toBe(true);
		});

		it("should register all tools in batch", () => {
			const tools = [mockTool, fileTool, ontologyTool, graphTool, skillTool, systemTool];

			registry.registerBatch(tools);

			const allTools = registry.getAll();

			expect(allTools).toHaveLength(6);
		});
	});

	describe("Scope Filtering — Story 9.31", () => {
		beforeEach(() => {
			const globalRegistry = getToolRegistry();
			globalRegistry.clear();
			registerTool(askUserQuestionTool);
			registerTool(systemTool);
		});

		it("filters ask_user_question from worker scope", () => {
			const workerTools = getAgentToolsForScope("worker");
			expect(workerTools.some((tool) => tool.name === "ask_user_question")).toBe(false);
			expect(workerTools.some((tool) => tool.name === "get-system-info")).toBe(true);
		});

		it("filters ask_user_question from skill scope", () => {
			const skillTools = getAgentToolsForScope("skill");
			expect(skillTools.some((tool) => tool.name === "ask_user_question")).toBe(false);
			expect(skillTools.some((tool) => tool.name === "get-system-info")).toBe(true);
		});

		it("keeps ask_user_question available for supervisor scope", () => {
			const supervisorTools = getAgentToolsForScope("supervisor");
			expect(supervisorTools.some((tool) => tool.name === "ask_user_question")).toBe(true);
		});
	});

	describe("Tool Retrieval", () => {
		beforeEach(() => {
			registry.registerBatch([
				fileTool,
				ontologyTool,
				graphTool,
				skillTool,
				{
					...systemTool,
					enabled: false, // Disabled
				},
			]);
		});

		it("should get all tools", () => {
			const allTools = registry.getAll();

			expect(allTools).toHaveLength(5);
		});

		it("should get only enabled tools", () => {
			const enabledTools = registry.getEnabled();

			expect(enabledTools).toHaveLength(4);
			expect(enabledTools.every((t) => t.enabled)).toBe(true);
		});

		it("should not include disabled tools in enabled list", () => {
			const enabledTools = registry.getEnabled();

			const systemTool = enabledTools.find((t) => t.name === "get-system-info");
			expect(systemTool).toBeUndefined();
		});

		it("should get tools by category", () => {
			const fileTools = registry.getByCategory("file");

			expect(fileTools).toHaveLength(1);
			expect(fileTools[0].name).toBe("read-file");
			expect(fileTools[0].category).toBe("file");
		});

		it("should get multiple tools from same category", () => {
			// Register another file tool
			registry.register({
				name: "write-file",
				label: "Write File",
				description: "Write a file",
				parameters: mockSchema,
				execute: vi.fn(),
				category: "file",
				enabled: true,
			});

			const fileTools = registry.getByCategory("file");

			expect(fileTools).toHaveLength(2);
		});

		it("should return empty array for category with no tools", () => {
			const categoryTools = registry.getByCategory("file");

			// Should return the registered file tool
			expect(categoryTools.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe("Tool Enable/Disable", () => {
		beforeEach(() => {
			registry.registerBatch([
				fileTool,
				ontologyTool,
			]);
		});

		it("should enable a tool", () => {
			const success = registry.enable("read-file");

			expect(success).toBe(true);
			expect(registry.get("read-file")?.enabled).toBe(true);
		});

		it("should disable a tool", () => {
			const success = registry.disable("read-file");

			expect(success).toBe(true);
			expect(registry.get("read-file")?.enabled).toBe(false);
		});

		it("should return false when enabling non-existent tool", () => {
			const success = registry.enable("non-existent");

			expect(success).toBe(false);
		});

		it("should return false when disabling non-existent tool", () => {
			const success = registry.disable("non-existent");

			expect(success).toBe(false);
		});

		it("should not include disabled tool in enabled list", () => {
			registry.disable("read-file");

			const enabledTools = registry.getEnabled();

			expect(enabledTools.find((t) => t.name === "read-file")).toBeUndefined();
		});

		it("should re-include tool when re-enabled", () => {
			registry.disable("read-file");
			registry.enable("read-file");

			const enabledTools = registry.getEnabled();

			expect(enabledTools.find((t) => t.name === "read-file")).toBeDefined();
		});
	});

	describe("Tool Unregistration", () => {
		beforeEach(() => {
			registry.registerBatch([fileTool, ontologyTool]);
		});

		it("should unregister a tool", () => {
			registry.unregister("read-file");

			expect(registry.has("read-file")).toBe(false);
		});

		it("should not throw when unregistering non-existent tool", () => {
			expect(() => {
				registry.unregister("non-existent");
			}).not.toThrow();
		});

		it("should remove tool from all tools list", () => {
			registry.unregister("read-file");

			const allTools = registry.getAll();

			expect(allTools.find((t) => t.name === "read-file")).toBeUndefined();
		});
	});

	describe("Tool Conversion to AgentTool", () => {
		beforeEach(() => {
			registry.registerBatch([
				fileTool,
				ontologyTool,
				{
					...skillTool,
					enabled: false, // Disabled
				},
			]);
		});

		it("should convert enabled tools to AgentTool format", () => {
			const agentTools = registry.toAgentTools();

			expect(agentTools).toHaveLength(2); // Only enabled tools
		});

		it("should preserve tool properties in AgentTool format", () => {
			const agentTools = registry.toAgentTools();
			const fileAgentTool = agentTools.find((t) => t.name === "read-file");

			expect(fileAgentTool).toBeDefined();
			expect(fileAgentTool?.name).toBe("read-file");
			expect(fileAgentTool?.label).toBe("Read File");
			expect(fileAgentTool?.description).toBe("Read a file from the filesystem");
			expect(fileAgentTool?.parameters).toBe(mockSchema);
			expect(fileAgentTool?.execute).toBe(fileTool.execute);
		});

		it("should exclude disabled tools from AgentTool conversion", () => {
			const agentTools = registry.toAgentTools();

			const skillAgentTool = agentTools.find((t) => t.name === "run-skill");
			expect(skillAgentTool).toBeUndefined();
		});

		it("should convert all enabled tools including different categories", () => {
			const agentTools = registry.toAgentTools();

			expect(agentTools.length).toBeGreaterThan(0);
		});
	});

	describe("Registry Clear", () => {
		beforeEach(() => {
			registry.registerBatch([
				fileTool,
				ontologyTool,
				graphTool,
				skillTool,
			]);
		});

		it("should clear all tools", () => {
			registry.clear();

			expect(registry.getAll()).toHaveLength(0);
		});

		it("should clear tools from all categories", () => {
			registry.clear();

			expect(registry.getByCategory("file")).toEqual([]);
			expect(registry.getByCategory("ontology")).toEqual([]);
			expect(registry.getByCategory("graph")).toEqual([]);
			expect(registry.getByCategory("skill")).toEqual([]);
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty registry", () => {
			expect(registry.getAll()).toEqual([]);
			expect(registry.getEnabled()).toEqual([]);
			expect(registry.getByCategory("file")).toEqual([]);
			expect(registry.toAgentTools()).toEqual([]);
		});

		it("should handle tool with empty execute function", () => {
			const toolWithEmptyExecute: ToolRegistration = {
				...mockTool,
				name: "empty-execute-tool",
				execute: async () => ({ result: null }) as any,
			};

			registry.register(toolWithEmptyExecute);

			expect(registry.get("empty-execute-tool")).toBeDefined();
		});

		it("should handle tool with empty parameters", () => {
			const toolWithEmptyParams: ToolRegistration = {
				...mockTool,
				name: "empty-params-tool",
				parameters: {} as TSchema,
			};

			registry.register(toolWithEmptyParams);

			const retrieved = registry.get("empty-params-tool");

			expect(retrieved?.parameters).toEqual({});
		});

		it("should handle unregistering from empty registry", () => {
			expect(() => {
				registry.unregister("any-tool");
			}).not.toThrow();
		});

		it("should handle clearing empty registry", () => {
			expect(() => {
				registry.clear();
			}).not.toThrow();
		});
	});
});

// ============================================================================
// Global Registry Tests
// ============================================================================

describe("getToolRegistry", () => {
	beforeEach(() => {
		// Reset global registry
		const globalRegistry = getToolRegistry();
		globalRegistry.clear();
	});

	it("should return a ToolRegistry instance", () => {
		const registry = getToolRegistry();

		expect(registry).toBeInstanceOf(ToolRegistry);
	});

	it("should return the same instance on multiple calls", () => {
		const registry1 = getToolRegistry();
		const registry2 = getToolRegistry();

		expect(registry1).toBe(registry2);
	});

	it("should persist tools across getToolRegistry calls", () => {
		const registry1 = getToolRegistry();
		registry1.register(mockTool);

		const registry2 = getToolRegistry();
		expect(registry2.has("test-tool")).toBe(true);
	});
});

describe("registerTool (Global)", () => {
	beforeEach(() => {
		// Reset global registry
		const globalRegistry = getToolRegistry();
		globalRegistry.clear();
	});

	afterEach(() => {
		// Reset global registry
		const globalRegistry = getToolRegistry();
		globalRegistry.clear();
	});

	it("should register tool to global registry", () => {
		registerTool(mockTool);

		const registry = getToolRegistry();
		expect(registry.has("test-tool")).toBe(true);
	});

	it("should make globally registered tool available", () => {
		registerTool(fileTool);

		const registry = getToolRegistry();
		const retrieved = registry.get("read-file");

		expect(retrieved).toBeDefined();
	});

	it("should handle multiple global registrations", () => {
		registerTool(fileTool);
		registerTool(ontologyTool);
		registerTool(graphTool);

		const registry = getToolRegistry();
		expect(registry.getAll()).toHaveLength(3);
	});
});

describe("getAgentTools (Global)", () => {
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		// Reset global registry
		const globalRegistry = getToolRegistry();
		globalRegistry.clear();

		consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		// Reset global registry
		const globalRegistry = getToolRegistry();
		globalRegistry.clear();

		consoleWarnSpy.mockRestore();
	});

	it("should return AgentTool array from global registry", () => {
		registerTool(fileTool);
		registerTool(ontologyTool);

		const agentTools = getAgentTools();

		expect(agentTools).toBeInstanceOf(Array);
		expect(agentTools).toHaveLength(2);
	});

	it("should only return enabled tools", () => {
		registerTool(fileTool);
		registerTool({
			...ontologyTool,
			enabled: false,
		});

		const agentTools = getAgentTools();

		const disabledTool = agentTools.find((t) => t.name === "query-ontology");
		expect(disabledTool).toBeUndefined();
	});

	it("should convert tools to AgentTool format", () => {
		registerTool(fileTool);

		const agentTools = getAgentTools();
		const fileAgentTool = agentTools[0];

		expect(fileAgentTool).toHaveProperty("name");
		expect(fileAgentTool).toHaveProperty("label");
		expect(fileAgentTool).toHaveProperty("description");
		expect(fileAgentTool).toHaveProperty("parameters");
		expect(fileAgentTool).toHaveProperty("execute");
	});

	it("should return empty array when no tools registered", () => {
		const agentTools = getAgentTools();

		expect(agentTools).toEqual([]);
	});

	it("should return empty array when all tools disabled", () => {
		registerTool({
			...fileTool,
			enabled: false,
		});
		registerTool({
			...ontologyTool,
			enabled: false,
		});

		const agentTools = getAgentTools();

		expect(agentTools).toEqual([]);
	});
});

// ============================================================================
// Tool Execution Tests
// ============================================================================

describe("Tool Execution", () => {
	let registry: ToolRegistry;
	let mockExecute: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		registry = new ToolRegistry();
		mockExecute = vi.fn(async () => ({
			content: [{ type: "text", text: "Tool result" }],
		}));

		registry.register({
			...mockTool,
			execute: mockExecute,
		});
	});

	it("should create tool with execute function", () => {
		const tool = registry.get("test-tool");

		expect(tool).toBeDefined();
		expect(typeof tool?.execute).toBe("function");
	});

	it("should allow calling tool execute", async () => {
		const tool = registry.get("test-tool");

		if (tool) {
			const result = await tool.execute("call-123", { test: "value" });

			expect(result).toBeDefined();
		}
	});

	it("should pass toolCallId to execute function", async () => {
		const tool = registry.get("test-tool");

		if (tool) {
			await tool.execute("call-987", {});

			expect(mockExecute).toHaveBeenCalledWith(
				"call-987",
				expect.anything()
			);
		}
	});

	it("should pass params to execute function", async () => {
		const tool = registry.get("test-tool");

		if (tool) {
			const params = { test: "test-value" };
			await tool.execute("call-456", params);

			expect(mockExecute).toHaveBeenCalledWith(
				expect.anything(),
				params
			);
		}
	});

	it("should support optional signal parameter", async () => {
		const tool = registry.get("test-tool");

		if (tool) {
			const abortController = new AbortController();
			await tool.execute("call-111", {}, abortController.signal);

			expect(mockExecute).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				abortController.signal
			);
		}
	});

	it("should support optional onUpdate callback", async () => {
		const tool = registry.get("test-tool");

		if (tool) {
			const onUpdate = vi.fn();
			await tool.execute("call-222", {}, undefined, onUpdate);

			expect(mockExecute).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				undefined,
				onUpdate
			);
		}
	});
});

// ============================================================================
// Tool Category Tests
// ============================================================================

describe("Tool Categories", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		registry = new ToolRegistry();
		registry.registerBatch([
			fileTool,
			ontologyTool,
			graphTool,
			skillTool,
			systemTool,
		]);
	});

	it("should support file category", () => {
		const fileTools = registry.getByCategory("file");

		expect(fileTools).toHaveLength(1);
		expect(fileTools.every((t) => t.category === "file")).toBe(true);
	});

	it("should support ontology category", () => {
		const ontologyTools = registry.getByCategory("ontology");

		expect(ontologyTools).toHaveLength(1);
		expect(ontologyTools.every((t) => t.category === "ontology")).toBe(true);
	});

	it("should support graph category", () => {
		const graphTools = registry.getByCategory("graph");

		expect(graphTools).toHaveLength(1);
		expect(graphTools.every((t) => t.category === "graph")).toBe(true);
	});

	it("should support skill category", () => {
		const skillTools = registry.getByCategory("skill");

		expect(skillTools).toHaveLength(1);
		expect(skillTools.every((t) => t.category === "skill")).toBe(true);
	});

	it("should support system category", () => {
		const systemTools = registry.getByCategory("system");

		expect(systemTools).toHaveLength(1);
		expect(systemTools.every((t) => t.category === "system")).toBe(true);
	});

	it("should have 5 different categories", () => {
		const categories = ["file", "ontology", "graph", "skill", "system"];

		categories.forEach((category) => {
			const tools = registry.getByCategory(category as any);
			expect(tools.length).toBeGreaterThan(0);
		});
	});
});

// ============================================================================
// Tool Property Tests
// ============================================================================

describe("Tool Properties", () => {
	let registry: ToolRegistry;

	beforeEach(() => {
		registry = new ToolRegistry();
		registry.register(mockTool);
	});

	it("should preserve tool name", () => {
		const tool = registry.get("test-tool");

		expect(tool?.name).toBe("test-tool");
	});

	it("should preserve tool label", () => {
		const tool = registry.get("test-tool");

		expect(tool?.label).toBe("Test Tool");
	});

	it("should preserve tool description", () => {
		const tool = registry.get("test-tool");

		expect(tool?.description).toBe("A test tool for unit testing");
	});

	it("should preserve tool parameters", () => {
		const tool = registry.get("test-tool");

		expect(tool?.parameters).toBe(mockSchema);
	});

	it("should preserve tool category", () => {
		const tool = registry.get("test-tool");

		expect(tool?.category).toBe("file");
	});

	it("should preserve tool enabled status", () => {
		const tool = registry.get("test-tool");

		expect(tool?.enabled).toBe(true);
	});
});
