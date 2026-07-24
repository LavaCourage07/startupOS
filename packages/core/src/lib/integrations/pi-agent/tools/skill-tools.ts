/**
 * 技能查询工具
 * 查询当前用户可用的所有技能（内置技能 + 用户创建/安装的技能）
 */

import type { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import type { AgentToolResult, AgentToolUpdateCallback } from "@mariozechner/agent";
import type { ToolRegistration } from "../types";
import { loadSkills } from "../core/skills";
import { existsSync, readFileSync, symlinkSync, mkdirSync } from "fs";
import path from "path";
import { getDataRoot } from '../../../paths';
import { getToolContext } from "./context";

// ============================================================================
// 工具执行辅助
// ============================================================================

interface ToolExecutionContext {
	toolCallId: string;
	toolName: string;
	signal?: AbortSignal;
	onUpdate?: AgentToolUpdateCallback<unknown>;
}

function createToolContext(
	toolCallId: string,
	toolName: string,
	signal?: AbortSignal,
	onUpdate?: AgentToolUpdateCallback<unknown>
): ToolExecutionContext {
	return { toolCallId, toolName, signal, onUpdate };
}

function checkAbort(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new DOMException("Tool execution was aborted", "AbortError");
	}
}

function logToolStart(ctx: ToolExecutionContext, params: Record<string, unknown>): void {
	console.error(`[Tool:${ctx.toolName}] START_CALL_ID=${ctx.toolCallId}`, JSON.stringify(params, null, 2));
}

function logToolEnd(ctx: ToolExecutionContext, result: Record<string, unknown>): void {
	console.error(`[Tool:${ctx.toolName}] END_CALL_ID=${ctx.toolCallId}`, JSON.stringify(result, null, 2));
}

// ============================================================================
// 工具: 查询可用技能
// ============================================================================

const ListSkillsParamsSchema = Type.Object({}, {
	description: "无参数 — 仅返回用户安装的技能（data/skills/ 目录）",
});

/**
 * 列出可用技能工具
 */
const ListSkillsTool: ToolRegistration = {
	name: "list_skills",
	label: "查询可用技能",
	description: "查询当前用户可用的所有技能列表。仅返回用户安装的技能（data/skills/ 目录），不包含系统内置技能。",
	parameters: ListSkillsParamsSchema,
	category: "system",
	enabled: true,
	scopes: ['assistant', 'role-agent'],
	async execute(
		toolCallId: string,
		params: Static<typeof ListSkillsParamsSchema>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<unknown>
	): Promise<AgentToolResult<unknown>> {
		const ctx = createToolContext(toolCallId, "list_skills", signal, onUpdate);

		try {
			logToolStart(ctx, params);
			checkAbort(ctx.signal);

			// 直接访问根目录下的 data/skills/
			const userSkillsDir = path.resolve(getDataRoot(), "skills");
			const result = loadSkills({
				cwd: getDataRoot(),
				includeDefaults: false,
				skillPaths: existsSync(userSkillsDir) ? [userSkillsDir] : [],
			});
			const { skills, diagnostics } = result;

			const filtered = skills.filter(skill => !skill.systemManaged);

			const skillsList = filtered.map(s => ({
				name: s.name,
				description: s.description,
				source: "user" as const,
				path: s.baseDir,
			}));

			const warnings = diagnostics.length > 0
				? diagnostics.filter(d => d.type === "warning").map(d => d.message)
				: [];

			const response = {
				success: true,
				count: skillsList.length,
				skills: skillsList,
				...(warnings.length > 0 && { warnings }),
			};

			logToolEnd(ctx, response);

			return {
				content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
				details: response,
			};
		} catch (error) {
			console.error(`[Tool:list_skills] ERROR_CALL_ID=${toolCallId}`, error);
			return {
				content: [{
					type: "text" as const,
					text: JSON.stringify({
						success: false,
						error: error instanceof Error ? error.message : String(error),
					}),
				}],
				details: {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				},
			};
		}
	},
};

// ============================================================================
// 工具: Skill 元工具
// ============================================================================

const SkillParamsSchema = Type.Object({
	skill: Type.String({ description: "技能名称或代码（例如：'commit', 'search-and-install-skill'）" }),
	args: Type.Optional(Type.String({ description: "传递给技能的参数（可选）" })),
});

/**
 * Skill 元工具
 *
 * 这是一个"元工具"（meta-tool），它本身不执行具体操作，
 * 而是加载指定技能的 SKILL.md 内容并注入到对话中，
 * 让 LLM 按照技能的指令去调用其他真实工具（Bash/Read/Write 等）。
 *
 * 工作流程：
 * 1. LLM 调用 Skill 工具：<tool_use><name>Skill</name><input>{"skill":"commit","args":"-m 'fix'"}</input></tool_use>
 * 2. 工具查找对应的技能文件（SKILL.md）
 * 3. 读取技能内容，注入 Base directory 提示
 * 4. 替换 ${CLAUDE_SKILL_DIR} 变量
 * 5. 将技能内容作为 tool_result 返回给 LLM
 * 6. LLM 收到技能指令后，按照指令执行后续操作
 */
const SkillTool: ToolRegistration = {
	name: "Skill",
	label: "执行技能",
	description: "加载并执行指定的技能。技能是预定义的工作流程或专业知识，可以帮助完成特定任务。调用此工具后，你将收到技能的完整指令，然后按照指令执行。",
	parameters: SkillParamsSchema,
	category: "skill",
	enabled: true,
	scopes: ['assistant'],
	async execute(
		toolCallId: string,
		params: Static<typeof SkillParamsSchema>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<unknown>
	): Promise<AgentToolResult<unknown>> {
		const ctx = createToolContext(toolCallId, "Skill", signal, onUpdate);

		try {
			logToolStart(ctx, params);
			checkAbort(ctx.signal);

			const { skill: skillNameOrCode, args } = params;

			// Only load skills from user-installed skills directory: data/skills/
			const skillUserSkillsDir = path.resolve(getDataRoot(), "skills");
			const result = loadSkills({
				cwd: getDataRoot(),
				includeDefaults: false,
				skillPaths: existsSync(skillUserSkillsDir) ? [skillUserSkillsDir] : [],
			});
			const { skills } = result;

			// 查找技能（按 name 或 code 匹配）
			const targetSkill = skills.find(
				s => !s.systemManaged && (s.name === skillNameOrCode || s.code === skillNameOrCode)
			);

			if (!targetSkill) {
				const availableSkills = skills.map(s => s.name).join(", ");
				return {
					content: [{
						type: "text" as const,
						text: JSON.stringify({
							success: false,
							error: `Skill "${skillNameOrCode}" not found. Available skills: ${availableSkills}`,
						}),
					}],
					details: { success: false, error: `Skill "${skillNameOrCode}" not found. Available skills: ${availableSkills}` },
				};
			}

			// 读取技能文件内容（必须在软链接创建之前）
			const skillFilePath = targetSkill.filePath;
			if (!existsSync(skillFilePath)) {
				return {
					content: [{
						type: "text" as const,
						text: JSON.stringify({
							success: false,
							error: `Skill file not found: ${skillFilePath}`,
						}),
					}],
					details: { success: false, error: `Skill file not found: ${skillFilePath}` },
				};
			}

			let skillContent = readFileSync(skillFilePath, "utf-8");
			const originalBaseDir = targetSkill.baseDir;

			const toolContext = getToolContext();
			const workingDir = toolContext.workingDirectory || getDataRoot();

			const skillCode = targetSkill.code || targetSkill.name;

			// 使用 Agent 目录下的软链接路径作为 baseDir
			// 软链接：{workingDir}/.skills/{skillCode}/ → {originalBaseDir}
			const skillsDir = path.join(workingDir, ".skills");
			const skillLinkPath = path.join(skillsDir, skillCode);
			const resolvedBaseDir = existsSync(skillLinkPath) ? skillLinkPath : originalBaseDir;

			// 创建持久化软链接
			try {
				if (!existsSync(skillsDir)) {
					mkdirSync(skillsDir, { recursive: true });
				}
				if (!existsSync(skillLinkPath)) {
					symlinkSync(originalBaseDir, skillLinkPath, "dir");
					console.error(`[Tool:Skill] Created symlink: ${skillLinkPath} -> ${originalBaseDir}`);
				}
			} catch (error) {
				console.warn(`[Tool:Skill] Failed to create skill symlink:`, error);
				// 软链接创建失败不影响技能执行，继续
			}

			// 构建 skill output 目录：workingDir/output/{skillCode}
			const outputDir = path.join(workingDir, "output", skillCode);

			// 系统内置 skills 写入 data/ 时指向项目根目录（通过 workingDirectory 已保证）

			// 构建技能提示词（注入 Base directory 和 Output directory 信息）
			const lines: string[] = [];

			// === Base Directory ===
			if (resolvedBaseDir) {
				lines.push(`Base directory for this skill: ${resolvedBaseDir}`);
				lines.push("");
				lines.push("You are running in the skill's directory. All relative paths are resolved from this directory.");
				lines.push("You can also use ${CLAUDE_SKILL_DIR} in shell commands to reference this directory.");
				lines.push("");
			}

			// === Output Directory ===
			lines.push(`**Output Directory**: ${outputDir}`);
			lines.push("");
			lines.push("All generated artifacts MUST be saved to the output directory above.");
			lines.push("Use paths relative to the working directory when calling file tools, for example `output/{skillCode}/result.md`.");
			lines.push("For shell commands, use the concrete output directory path shown above.");
			lines.push("The output directory will be automatically created if it doesn't exist.");
			lines.push("");

			// === Skill Content ===
			lines.push("# Skill Instructions");
			lines.push("");
			lines.push(skillContent);

			// === Arguments ===
			if (args) {
				lines.push("");
				lines.push("# Arguments Provided");
				lines.push("");
				lines.push(`The user provided the following arguments: ${args}`);
				lines.push("Use these arguments as needed when executing the skill.");
			}

			let finalContent = lines.join("\n");

			// 替换 ${CLAUDE_SKILL_DIR} 变量
			if (resolvedBaseDir) {
				finalContent = finalContent.replace(/\$\{CLAUDE_SKILL_DIR\}/g, resolvedBaseDir);
			}

			const response = {
				success: true,
				skill: targetSkill.name,
				description: targetSkill.description,
				baseDir: resolvedBaseDir,
				outputDir,
				args: args || null,
			};

			logToolEnd(ctx, response);

			// 返回技能内容作为 tool_result
			// LLM 会将这个内容作为指令来执行
			return {
				content: [{ type: "text" as const, text: finalContent }],
				details: response,
			};
		} catch (error) {
			console.error(`[Tool:Skill] ERROR_CALL_ID=${toolCallId}`, error);
			return {
				content: [{
					type: "text" as const,
					text: JSON.stringify({
						success: false,
						error: error instanceof Error ? error.message : String(error),
					}),
				}],
				details: {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				},
			};
		}
	},
};

// ============================================================================
// 导出
// ============================================================================

export const skillTools: ToolRegistration[] = [
	ListSkillsTool,
	SkillTool,
];
