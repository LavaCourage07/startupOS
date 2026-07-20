"use strict";
/**
 * 多 Agent 协作上下文加载器
 *
 * 在项目 Agent 启动时加载协作场景所需的所有 .md 文件
 * （Agent.md + Data.md + Process.md + Tool.md + Taste.md + Memory.md）
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadProjectCollaborationContext = loadProjectCollaborationContext;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const skill_resolver_1 = require("../role-agent/skill-resolver");
/** 安全读取 .md 文件 */
function readMdFile(dir, fileName) {
    const filePath = path_1.default.join(dir, fileName);
    if (!(0, fs_1.existsSync)(filePath)) {
        return null;
    }
    try {
        return (0, fs_1.readFileSync)(filePath, 'utf-8');
    }
    catch {
        return null;
    }
}
/** 从 Tool.md frontmatter 提取 allowedTools */
function parseAllowedTools(toolMd) {
    if (toolMd === null) {
        return [];
    }
    const match = toolMd.match(/^---\n([\s\S]*?)\n---/);
    if (match === null || match[1] === undefined) {
        return [];
    }
    const frontmatter = match[1];
    const keyMatch = frontmatter.match(/^allowedTools:\s*\[([^\]]*)\]/m);
    if (keyMatch === null || keyMatch[1] === undefined) {
        return [];
    }
    return keyMatch[1]
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
}
/**
 * 加载多 Agent 协作上下文
 * @param projectDir 项目工作目录
 * @param projectId 项目 ID
 * @param agentId Agent ID
 * @returns ProjectCollaborationContext，若 Agent.md 不存在则返回 null
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function loadProjectCollaborationContext(projectDir, projectId, agentId) {
    const agentMd = readMdFile(projectDir, 'Agent.md');
    if (agentMd === null) {
        return null;
    }
    const dataMd = readMdFile(projectDir, 'Data.md') ?? '';
    const processMd = readMdFile(projectDir, 'Process.md') ?? '';
    const toolMd = readMdFile(projectDir, 'Tool.md');
    const tasteMd = readMdFile(projectDir, 'Taste.md');
    const memoryMd = readMdFile(projectDir, 'Memory.md');
    const knowledgeMd = readMdFile(projectDir, 'Knowledge.md');
    const patternsMd = readMdFile(projectDir, 'Patterns.md');
    const allowedTools = parseAllowedTools(toolMd);
    const installedSkills = (0, skill_resolver_1.scanInstalledSkills)(projectDir);
    // 尝试从 project-collaboration-context.json 读取 originosProjectId
    let originosProjectId = null;
    const contextJsonPath = path_1.default.join(projectDir, 'project-collaboration-context.json');
    if ((0, fs_1.existsSync)(contextJsonPath)) {
        try {
            const contextJson = JSON.parse((0, fs_1.readFileSync)(contextJsonPath, 'utf-8'));
            originosProjectId = contextJson.originosProjectId ?? null;
        }
        catch {
            // 忽略解析错误
        }
    }
    return {
        agentMd,
        dataMd,
        processMd,
        toolMd,
        tasteMd,
        memoryMd,
        knowledgeMd,
        patternsMd,
        installedSkills,
        allowedTools,
        workingDirectory: projectDir,
        projectId,
        agentId,
        originosProjectId,
    };
}
