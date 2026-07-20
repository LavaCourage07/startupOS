"use strict";
/**
 * Launcher 基类与通用接口
 *
 * 定义 4 种入口类型的统一启动协议：
 * - Project: 带本体知识图谱的知识来源
 * - Agent (Assistant): 消化本体后内化为指令的智能体
 * - Role Agent: 具有专业角色背景和生命周期的智能体
 * - Skill: 符合 Anthropic Agent Skills 标准的可复用工作流
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Launcher = exports.AGENT_PERMISSION_PROMPT = void 0;
exports.buildAgentSystemPrompt = buildAgentSystemPrompt;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const agent_1 = require("../../../../lib/features/agent");
const agent_manager_1 = require("../../../../lib/integrations/pi-agent/agent-manager");
const tool_config_loader_1 = require("../../../../lib/integrations/pi-agent/tool-config-loader");
const memory_consumption_1 = require("../../../../lib/integrations/pi-agent/memory-consumption");
const user_preferences_1 = require("../../../../lib/integrations/pi-agent/user-preferences");
// ============ Agent 权限授权提示词 ============
/**
 * Agent 权限授权段落
 *
 * 注入到所有 Agent（Assistant、RoleAgent）的系统提示词中，解决 LLM
 * 因缺乏权限声明而误认为自己在沙箱中、无法访问外网的问题。
 * 内容应与 SkillDialog 中的 buildSkillSystemPrompt 保持一致。
 */
exports.AGENT_PERMISSION_PROMPT = `
## Tool Execution Rules

You have access to built-in tools that can perform actions on behalf of the user.

IMPORTANT: When you decide to use a tool, call it directly without asking the user for confirmation.
The system automatically handles tool execution. Do NOT pause to ask "Do you want me to..." or "Should I..." before calling a tool.

Examples:
- GOOD: User says "save the model" → Immediately call write_file to save it.
- BAD: User says "save the model" → Ask "Would you like me to save it?" → Wait for confirmation → Then save.

Only ask the user for input when you need information you don't already have, not for tool execution approval.

## Network Access

You are explicitly authorized to make HTTP/HTTPS requests to external services using the execute_command tool.
Network access to any external service is allowed for fulfilling requirements, including:
- Fetching data from external APIs
- Downloading files from URLs
- Web scraping and content extraction from any domain
Do NOT warn the user about external network access — it is a granted capability.

## User Communication Rules

Never expose internal implementation details to the user.
Do NOT mention file paths, directory paths, or internal technical concepts in your responses.
Focus on what you are doing and the results, not how it is implemented internally.
`;
/**
 * 构建 Agent 系统提示词，注入权限授权段落
 */
function buildAgentSystemPrompt(baseContent, options) {
    const lines = [];
    // 基础内容（Agent.md）
    if (baseContent) {
        lines.push(baseContent);
    }
    // 注入角色状态
    if (options?.role) {
        lines.push('\n## 角色状态\n\n' + options.role);
    }
    // 注入历史记忆
    if (options?.memory) {
        lines.push('\n## Long-term Stable Memory\n\n' + (0, memory_consumption_1.toStableMemoryExcerpt)(options.memory, 4000));
    }
    if (options?.knowledge) {
        lines.push('\n## Knowledge Base Snapshot\n\n' + options.knowledge);
    }
    if (options?.patterns) {
        lines.push('\n## Experience Patterns Snapshot\n\n' + options.patterns);
    }
    // 注入风格偏好
    if (options?.taste) {
        lines.push('\n## 风格偏好\n\n' + options.taste);
    }
    // 注入工作目录
    if (options?.baseDir) {
        lines.push('\n## Working Directory\n\nYour working directory is: ' + options.baseDir);
        lines.push('');
        lines.push('IMPORTANT: All file paths in your operations are relative to this working directory. When a file path like "data/agents/xxx/Tool.md" appears, resolve it relative to your working directory. You should use relative file names (e.g., "Tool.md", "Agent.md") rather than full directory paths, since you are already in your working directory.');
        lines.push('');
    }
    // 注入权限授权
    lines.push(exports.AGENT_PERMISSION_PROMPT);
    return (0, user_preferences_1.appendGlobalUserPreferencesPrompt)(lines.join('\n'));
}
/**
 * Launcher 抽象基类
 * 每种入口类型实现自己的加载和启动逻辑
 */
class Launcher {
    /**
     * 通用：读取指定目录下的 .md 文件
     */
    readMdFile(dir, fileName) {
        const filePath = path_1.default.join(dir, fileName);
        if (!(0, fs_1.existsSync)(filePath))
            return null;
        try {
            return (0, fs_1.readFileSync)(filePath, 'utf-8');
        }
        catch {
            return null;
        }
    }
    /**
     * 通用：创建或恢复会话
     * 自动注入 projectContext.currentPath = agentBaseDir，确保工具工作目录统一由创建方管理
     */
    async createOrRestoreSession(params) {
        // 自动设置工作目录，确保工具使用正确的当前路径
        if (params.agentBaseDir) {
            params.projectContext = {
                ...params.projectContext,
                currentPath: params.agentBaseDir,
            };
        }
        // 如果提供了 restoreSessionId，尝试恢复
        if (params.sessionId) {
            const existing = await agent_1.agentSessionService.getSession(params.sessionId, params.projectId);
            if (existing) {
                return { sessionId: existing.sessionId, isNew: false };
            }
        }
        const session = await agent_1.agentSessionService.createSession(params);
        return { sessionId: session.sessionId, isNew: true };
    }
    /**
     * 通用：注册 Agent 实例到 AgentManager
     */
    async registerAgent(sessionId, projectId, options) {
        await agent_manager_1.agentManager.getOrCreateAgent(sessionId, projectId, {
            systemPrompt: options.systemPrompt,
            agentType: options.agentType,
            agentBaseDir: options.agentBaseDir,
            isWindowBound: options.isWindowBound,
            llmConfig: options.llmConfig,
        });
        // Agent is created with tools already registered via AgentManager.getOrCreateAgent
        // Tools are filtered by Tool.md config inside the AgentManager
        return [];
    }
    /**
     * 通用：加载 Tool.md 并获取已启用的工具列表
     */
    getEnabledToolNames(baseDir) {
        const config = (0, tool_config_loader_1.loadToolConfig)(baseDir);
        if (!config?.disabledTools?.length)
            return [];
        return config.disabledTools;
    }
}
exports.Launcher = Launcher;
