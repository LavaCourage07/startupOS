/**
 * 系统配置管理
 */

import type { Model } from "@mariozechner/pi-ai";
import { getModel } from "@mariozechner/pi-ai";
import type { SystemPromptVariables } from "./prompt";
import { buildSystemPrompt } from "./prompt";

/**
 * OriginOS Agent 配置
 */
export interface OriginOSAgentConfig {
	/**
	 * 系统提示词
	 */
	systemPrompt: string;

	/**
	 * LLM 模型
	 */
	model: Model<any>;

	/**
	 * 会话ID
	 */
	sessionId: string;

	/**
	 * 项目上下文
	 */
	projectContext: ProjectContext;

	/**
	 * 思考级别
	 */
	thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high";

	/**
	 * 使用的工具
	 */
	tools?: string[];
}

/**
 * 项目上下文
 */
export interface ProjectContext {
	/**
	 * 项目ID
	 */
	projectId: string;

	/**
	 * 本体ID
	 */
	ontologyId?: string;

	/**
	 * 当前路径
	 */
	currentPath?: string;

	/**
	 * 项目名称
	 */
	projectName?: string;

	/**
	 * 用户ID
	 */
	userId?: string;
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: Omit<OriginOSAgentConfig, "sessionId" | "systemPrompt"> = {
	model: getModel("anthropic", "claude-haiku-4-5"),
	projectContext: {
		projectId: "default",
		projectName: "默认项目",
		currentPath: "/data/projects/default",
	},
	thinkingLevel: "low",
	tools: [],
};

/**
 * 创建 OriginOS Agent 配置
 */
export function createOriginOSAgentConfig(
	sessionId: string,
	variables: SystemPromptVariables,
	overrides?: Partial<OriginOSAgentConfig>
): OriginOSAgentConfig {
	const systemPromptVariables: SystemPromptVariables = {
		projectName: variables.projectName || "未命名项目",
		projectId: variables.projectId || "default-project",
		ontologyId: variables.ontologyId,
		projectPath: variables.projectPath,
		userName: variables.userName,
	};

	return {
		...DEFAULT_CONFIG,
		...overrides,
		sessionId,
		systemPrompt: overrides?.systemPrompt ?? buildSystemPrompt(systemPromptVariables),
		projectContext: {
			projectId: overrides?.projectContext?.projectId ?? variables.projectId ?? "default-project",
			ontologyId: overrides?.projectContext?.ontologyId ?? variables.ontologyId,
			projectName: overrides?.projectContext?.projectName ?? variables.projectName,
			currentPath: overrides?.projectContext?.currentPath ?? variables.projectPath,
			userId: overrides?.projectContext?.userId ?? variables.userId,
		},
	};
}

/**
 * 验证配置
 */
export function validateConfig(config: OriginOSAgentConfig): string[] {
	const errors: string[] = [];

	if (!config.sessionId || config.sessionId.trim().length === 0) {
		errors.push("sessionId不能为空");
	}

	if (!config.systemPrompt || config.systemPrompt.trim().length === 0) {
		errors.push("systemPrompt不能为空");
	}

	if (!config.model) {
		errors.push("model不能为空");
	}

	if (!config.projectContext || !config.projectContext.projectId) {
		errors.push("需要指定projectId");
	}

	return errors;
}
