"use strict";
/**
 * Project Launcher
 *
 * 启动流程（data/projects/{id}/）：
 * 1. 读取项目 Agent.md / 本体文件
 * 2. 读取 ontology/business-model.json → 注入本体上下文
 * 3. 读取 Tool.md → 注册本体工具集
 * 4. 读取 Memory.md / Taste.md
 * 5. 创建会话（projectId = entryId, agentType = 'project'）
 * 6. 返回 LaunchResult
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectLauncher = void 0;
const path_1 = __importDefault(require("path"));
const base_1 = require("./base");
const user_preferences_1 = require("../../../../lib/integrations/pi-agent/user-preferences");
const paths_1 = require("../../../paths");
const PROJECTS_DIR = path_1.default.join((0, paths_1.getDataRoot)(), 'projects');
class ProjectLauncher extends base_1.Launcher {
    constructor() {
        super(...arguments);
        this.entryType = 'project';
    }
    async launch(ctx) {
        try {
            const projectBaseDir = path_1.default.join(PROJECTS_DIR, ctx.entryId);
            // 1. 读取入口内容
            const content = await this.loadEntryContent(ctx.entryId);
            const agentMd = content['Agent.md'] || '';
            // 2. 构建系统提示词
            let systemPrompt = agentMd;
            // 注入本体上下文
            if (content['business-model.json']) {
                systemPrompt += '\n\n## 本体上下文\n\n';
                systemPrompt += 'The following business model ontology is loaded:\n\n';
                systemPrompt += '```json\n' + content['business-model.json'] + '\n```\n';
            }
            // 注入 Memory.md
            if (content['Memory.md']) {
                systemPrompt += '\n\n## 历史记忆\n\n' + content['Memory.md'];
            }
            // 注入 Taste.md
            if (content['Taste.md']) {
                systemPrompt += '\n\n## 风格偏好\n\n' + content['Taste.md'];
            }
            systemPrompt = (0, user_preferences_1.appendGlobalUserPreferencesPrompt)(systemPrompt);
            // 3. 创建/恢复会话
            const { sessionId } = await this.createOrRestoreSession({
                projectId: ctx.entryId,
                projectName: ctx.entryId,
                systemPrompt,
                agentType: 'project',
                agentBaseDir: projectBaseDir,
                sessionId: ctx.restoreSessionId || ctx.sessionId,
            });
            // 4. 注册 Agent 到 AgentManager
            const tools = await this.registerAgent(sessionId, ctx.entryId, {
                systemPrompt,
                agentType: 'project',
                agentBaseDir: projectBaseDir,
                isWindowBound: ctx.isWindowBound,
            });
            return {
                success: true,
                sessionId,
                systemPrompt,
                agentType: 'project',
                baseDir: projectBaseDir,
                tools,
            };
        }
        catch (error) {
            return {
                success: false,
                sessionId: '',
                systemPrompt: '',
                agentType: 'project',
                baseDir: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async loadEntryContent(id) {
        const projectBaseDir = path_1.default.join(PROJECTS_DIR, id);
        const result = {};
        for (const file of ['Agent.md', 'Tool.md', 'Memory.md', 'Taste.md']) {
            const content = this.readMdFile(projectBaseDir, file);
            if (content !== null) {
                result[file] = content;
            }
        }
        // 读取本体文件
        const ontologyContent = this.readMdFile(path_1.default.join(projectBaseDir, 'ontology'), 'business-model.json');
        if (ontologyContent !== null) {
            result['business-model.json'] = ontologyContent;
        }
        return result;
    }
}
exports.ProjectLauncher = ProjectLauncher;
