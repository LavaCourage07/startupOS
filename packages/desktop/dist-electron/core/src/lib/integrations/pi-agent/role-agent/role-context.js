"use strict";
/**
 * 角色上下文加载器（Story R.1）
 *
 * 在角色启动时加载完整的角色上下文（5 个 .md 文件 + 已安装技能），
 * 为后续的状态恢复、system prompt 构建提供数据基础。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeBlocksToMarkdown = exports.parseBlocksFromMarkdown = exports.scanInstalledSkills = void 0;
exports.parseToolMdTools = parseToolMdTools;
exports.loadRoleContext = loadRoleContext;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const skill_resolver_1 = require("./skill-resolver");
const memory_tracker_1 = require("./memory-tracker");
// Re-export scanInstalledSkills so callers can use it from this module too
var skill_resolver_2 = require("./skill-resolver");
Object.defineProperty(exports, "scanInstalledSkills", { enumerable: true, get: function () { return skill_resolver_2.scanInstalledSkills; } });
// Re-export Memory Block parser
var memory_tracker_2 = require("./memory-tracker");
Object.defineProperty(exports, "parseBlocksFromMarkdown", { enumerable: true, get: function () { return memory_tracker_2.parseBlocksFromMarkdown; } });
Object.defineProperty(exports, "serializeBlocksToMarkdown", { enumerable: true, get: function () { return memory_tracker_2.serializeBlocksToMarkdown; } });
// ============================================================================
// 内部辅助
// ============================================================================
/** 安全读取 .md 文件，不存在时返回 null */
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
/** 从 Markdown frontmatter 中提取指定键的值 */
function parseFrontmatterArray(content, key) {
    if (!content)
        return [];
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match?.[1])
        return [];
    const frontmatter = match[1];
    const keyMatch = frontmatter.match(new RegExp(`^${key}:\\s*\\[([^\\]]*)\\]`, 'm'));
    if (!keyMatch?.[1])
        return [];
    return keyMatch[1]
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
}
/**
 * 从 Tool.md frontmatter 中提取 allowedTools / disabledTools。
 * 返回 allowedTools 列表（如果未定义则返回空数组）。
 */
function parseToolMdTools(toolMd) {
    return {
        allowedTools: parseFrontmatterArray(toolMd, 'allowedTools'),
        disabledTools: parseFrontmatterArray(toolMd, 'disabledTools'),
    };
}
/**
 * 从 Role.md 中提取当前阶段名。
 * 若 Role.md 中未定义阶段，返回默认阶段 'default'。
 */
function extractCurrentPhase(roleMd) {
    if (!roleMd)
        return 'default';
    const fmPhase = parseFrontmatterArray(roleMd, 'currentPhase');
    if (fmPhase.length > 0)
        return fmPhase[0];
    const match = roleMd.match(/^---\n([\s\S]*?)\n---/);
    if (match?.[1]) {
        const phaseMatch = match[1].match(/^currentPhase:\s*(.+)$/m);
        if (phaseMatch?.[1])
            return phaseMatch[1].trim();
    }
    return 'default';
}
// ============================================================================
// 公开 API
// ============================================================================
/**
 * 从 Memory.md 解析 Memory Blocks 数组。
 */
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
 * 加载角色上下文。
 *
 * @param agentDir 角色工作目录（data/agents/{id}/）
 * @returns RoleContext 对象，若 Agent.md 不存在则返回 null
 */
async function loadRoleContext(agentDir) {
    const agentMd = readMdFile(agentDir, 'Agent.md');
    if (!agentMd)
        return null;
    const roleMd = readMdFile(agentDir, 'Role.md');
    const tasteMd = readMdFile(agentDir, 'Taste.md');
    const memoryMd = readMdFile(agentDir, 'Memory.md');
    const toolMd = readMdFile(agentDir, 'Tool.md');
    const knowledgeMd = readMdFile(agentDir, 'Knowledge.md');
    const patternsMd = readMdFile(agentDir, 'Patterns.md');
    const { allowedTools } = parseToolMdTools(toolMd);
    const installedSkills = (0, skill_resolver_1.scanInstalledSkills)(agentDir);
    const currentPhase = extractCurrentPhase(roleMd);
    // C.9: 解析 Memory Blocks
    const memoryBlocks = parseMemoryBlocks(memoryMd);
    return {
        agentMd,
        roleMd,
        tasteMd,
        memoryMd,
        toolMd,
        knowledgeMd,
        patternsMd,
        memoryBlocks,
        currentPhase,
        installedSkills,
        allowedTools,
        agentBaseDir: agentDir,
    };
}
