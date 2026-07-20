"use strict";
/**
 * 系统配置管理
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
exports.createOriginOSAgentConfig = createOriginOSAgentConfig;
exports.validateConfig = validateConfig;
const pi_ai_1 = require("@mariozechner/pi-ai");
const prompt_1 = require("./prompt");
/**
 * 默认配置
 */
exports.DEFAULT_CONFIG = {
    model: (0, pi_ai_1.getModel)("anthropic", "claude-haiku-4-5"),
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
function createOriginOSAgentConfig(sessionId, variables, overrides) {
    const systemPromptVariables = {
        projectName: variables.projectName || "未命名项目",
        projectId: variables.projectId || "default-project",
        ontologyId: variables.ontologyId,
        projectPath: variables.projectPath,
        userName: variables.userName,
    };
    return {
        ...exports.DEFAULT_CONFIG,
        ...overrides,
        sessionId,
        systemPrompt: overrides?.systemPrompt ?? (0, prompt_1.buildSystemPrompt)(systemPromptVariables),
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
function validateConfig(config) {
    const errors = [];
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
