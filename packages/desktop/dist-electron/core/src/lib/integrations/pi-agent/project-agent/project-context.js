"use strict";
/**
 * 项目上下文加载器
 *
 * 在项目 Agent 启动时加载完整上下文（.md 文件 + 已安装技能）
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadProjectContext = loadProjectContext;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const skill_resolver_1 = require("../role-agent/skill-resolver");
const memory_tracker_1 = require("../role-agent/memory-tracker");
/** 安全读取 .md 文件 */
function readMdFile(dir, fileName) {
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
/** 兼容历史命名，优先读取 Memory Core 当前使用的 Memory.md */
function readProjectMemoryFile(dir) {
    return readMdFile(dir, 'Memory.md') ?? readMdFile(dir, 'MEMORY.md');
}
/** 从 Tool.md frontmatter 提取 allowedTools */
function parseAllowedTools(toolMd) {
    if (!toolMd)
        return [];
    const match = toolMd.match(/^---\n([\s\S]*?)\n---/);
    if (!match?.[1])
        return [];
    const frontmatter = match[1];
    const keyMatch = frontmatter.match(/^allowedTools:\s*\[([^\]]*)\]/m);
    if (!keyMatch?.[1])
        return [];
    return keyMatch[1]
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
}
/** 从 Memory.md 解析 Memory Blocks */
function parseMemoryBlocks(memoryMd) {
    if (!memoryMd)
        return null;
    try {
        const blocks = (0, memory_tracker_1.parseBlocksFromMarkdown)(memoryMd);
        return Array.from(blocks.values());
    }
    catch {
        return null;
    }
}
/**
 * 加载项目上下文
 * @param projectDir 项目工作目录
 * @param projectId 项目 ID（可选）
 * @param agentId Agent ID（可选）
 * @returns ProjectContext，若 Agent.md 不存在则返回 null
 */
async function loadProjectContext(projectDir, projectId, agentId) {
    const agentMd = readMdFile(projectDir, 'Agent.md');
    if (!agentMd)
        return null;
    const toolMd = readMdFile(projectDir, 'Tool.md');
    const tasteMd = readMdFile(projectDir, 'Taste.md');
    const memoryMd = readProjectMemoryFile(projectDir);
    const knowledgeMd = readMdFile(projectDir, 'Knowledge.md');
    const patternsMd = readMdFile(projectDir, 'Patterns.md');
    const allowedTools = parseAllowedTools(toolMd);
    const installedSkills = (0, skill_resolver_1.scanInstalledSkills)(projectDir);
    const memoryBlocks = parseMemoryBlocks(memoryMd);
    // 尝试从 project-collaboration-context.json 读取上下文信息
    let contextProjectId = projectId ?? null;
    let contextAgentId = agentId ?? null;
    let originosProjectId = null;
    const contextJsonPath = path_1.default.join(projectDir, 'project-collaboration-context.json');
    if ((0, fs_1.existsSync)(contextJsonPath)) {
        try {
            const contextJson = JSON.parse((0, fs_1.readFileSync)(contextJsonPath, 'utf-8'));
            if (contextJson.projectId && !contextProjectId) {
                contextProjectId = contextJson.projectId;
            }
            if (contextJson.agentId && !contextAgentId) {
                contextAgentId = contextJson.agentId;
            }
            if (contextJson.originosProjectId) {
                originosProjectId = contextJson.originosProjectId;
            }
        }
        catch {
            // 忽略解析错误
        }
    }
    return {
        agentMd,
        toolMd,
        tasteMd,
        memoryMd,
        knowledgeMd,
        patternsMd,
        memoryBlocks,
        installedSkills,
        allowedTools,
        workingDirectory: projectDir,
        projectId: contextProjectId ?? '',
        agentId: contextAgentId ?? '',
        originosProjectId,
    };
}
