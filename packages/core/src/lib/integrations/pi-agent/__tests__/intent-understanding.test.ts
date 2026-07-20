/**
 * Unit tests for Intent Understanding (Story 0.4)
 * 验证系统提示词和意图理解功能的测试
 */

import { describe, it, expect } from "vitest";
import { ORIGINOS_SYSTEM_PROMPT, buildSystemPrompt } from "../system/prompt";

// ============================================================================
// Test Suite
// ============================================================================

describe("Story 0.4 - Intent Understanding", () => {
	describe("System Prompt", () => {
		it("should contain intent understanding guidelines", () => {
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("意图理解与路由");
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("识别用户意图类别");
		});

		it("should define common intent categories", () => {
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("文件操作");
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("本体操作");
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("查询操作");
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("编辑操作");
		});

		it("should map intents to tools", () => {
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("read_file");
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("write_file");
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("create_ontology_node");
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("query_ontology");
		});

		it("should define parameter extraction rules", () => {
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("参数提取规则");
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("实体、类或关系");
		});

		it("should include multi-tool coordination instructions", () => {
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("多工具协调");
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("确定步骤的执行顺序");
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("汇总所有工具的执行结果");
		});

		it("should include intent clarification guidelines", () => {
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("意图澄清");
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("缺少必要参数");
			expect(ORIGINOS_SYSTEM_PROMPT).toContain("主动提出澄清问题");
		});
	});

	describe("buildSystemPrompt", () => {
		it("should replace all variables", () => {
			const variables = {
				projectName: "测试项目",
				projectId: "test-123",
				ontologyId: "ontology-456",
				projectPath: "/data/projects/test-123",
				userName: "测试用户",
			};

			const prompt = buildSystemPrompt(variables);

			expect(prompt).toContain("测试项目");
			expect(prompt).toContain("test-123");
			expect(prompt).toContain("ontology-456");
			expect(prompt).toContain("/data/projects/test-123");
		});

		it("should handle missing variables", () => {
			const variables = {
				projectName: "测试项目",
				projectId: "test-123",
				// 缺少 ontologyId, projectPath, userName
			};

			const prompt = buildSystemPrompt(variables);

			expect(prompt).toContain("测试项目");
			expect(prompt).toContain("test-123");
		});

		it("should preserve prompt structure", () => {
			const variables = {
				projectName: "Mock Project",
				projectId: "mock-001",
				ontologyId: "mock-ontology",
			};

			const prompt = buildSystemPrompt(variables);

			expect(prompt).toContain("## 你的能力");
			expect(prompt).toContain("## 意图理解与路由");
			expect(prompt).toContain("## 工作原则");
			expect(prompt).toContain("## 项目上下文（当前会话）");
		});
	});
});

describe("Story 0.4 -验收标准测试", () => {
	describe("AC0.4.1: 简单意图路由", () => {
		it("系统提示词应包含创建本体实体的示例", () => {
			const prompt = buildSystemPrompt({
				projectName: "测试",
				projectId: "test",
			});
			expect(prompt).toContain("创建实体");
			expect(prompt).toContain("create_ontology_node");
		});
	});

	describe("AC0.4.2: 多工具协调", () => {
		it("系统提示词应包含多步骤执行说明", () => {
			const prompt = buildSystemPrompt({
				projectName: "测试",
				projectId: "test",
			});
			expect(prompt).toContain("多工具协调");
			expect(prompt).toContain("依次执行每个工具");
			expect(prompt).toContain("汇总");
		});
	});

	describe("AC0.4.3: 意图澄清", () => {
		it("系统提示词应包含缺少参数时的澄清指导", () => {
			const prompt = buildSystemPrompt({
				projectName: "测试",
				projectId: "test",
			});
			expect(prompt).toContain("缺少名称");
			expect(prompt).toContain("缺少路径");
			expect(prompt).toContain("澄清问题");
		});
	});
});
