"use strict";
/**
 * Agent (Assistant) Launcher
 *
 * 启动流程（data/agents/{id}/）：
 * 1. 读取 Agent.md → systemPrompt
 * 2. 读取 Tool.md → 过滤/注册工具
 * 3. 读取 Memory.md / Knowledge.md / Patterns.md → 注入长期稳定记忆快照
 * 4. 创建会话（projectId = entryId, agentType = 'assistant'）
 * 5. 返回 LaunchResult
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentLauncher = void 0;
const path_1 = __importDefault(require("path"));
const base_1 = require("./base");
const paths_1 = require("../../../paths");
const AGENTS_DIR = (0, paths_1.getAgentsDataDir)();
class AgentLauncher extends base_1.Launcher {
    constructor() {
        super(...arguments);
        this.entryType = 'agent';
    }
    async launch(ctx) {
        try {
            const agentBaseDir = path_1.default.join(AGENTS_DIR, ctx.entryId);
            // 1. 读取入口内容
            const content = await this.loadEntryContent(ctx.entryId);
            const agentMd = content['Agent.md'] || '';
            // 2. 构建系统提示词（注入权限授权）
            const systemPrompt = (0, base_1.buildAgentSystemPrompt)(agentMd, {
                memory: content['Memory.md'],
                knowledge: content['Knowledge.md'],
                patterns: content['Patterns.md'],
                baseDir: agentBaseDir,
            });
            // 3. 创建/恢复会话
            const { sessionId } = await this.createOrRestoreSession({
                projectId: ctx.entryId,
                projectName: ctx.entryId,
                systemPrompt,
                agentType: 'assistant',
                agentBaseDir,
                sessionId: ctx.restoreSessionId || ctx.sessionId,
            });
            // 4. 注册 Agent 到 AgentManager
            const tools = await this.registerAgent(sessionId, ctx.entryId, {
                systemPrompt,
                agentType: 'assistant',
                agentBaseDir,
                isWindowBound: ctx.isWindowBound,
            });
            return {
                success: true,
                sessionId,
                systemPrompt,
                agentType: 'assistant',
                baseDir: agentBaseDir,
                tools,
            };
        }
        catch (error) {
            return {
                success: false,
                sessionId: '',
                systemPrompt: '',
                agentType: 'assistant',
                baseDir: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async loadEntryContent(id) {
        const agentBaseDir = path_1.default.join(AGENTS_DIR, id);
        const result = {};
        for (const file of ['Agent.md', 'Tool.md', 'Memory.md', 'Knowledge.md', 'Patterns.md']) {
            const content = this.readMdFile(agentBaseDir, file);
            if (content !== null) {
                result[file] = content;
            }
        }
        return result;
    }
}
exports.AgentLauncher = AgentLauncher;
