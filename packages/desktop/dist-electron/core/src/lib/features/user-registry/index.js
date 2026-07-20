"use strict";
/**
 * User Registry — 用户自定义 Agent 和 Skill 的发现与解析
 *
 * 从 data/agents/ 和 data/skills/ 目录扫描，解析 Agent.md / SKILL.md frontmatter。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUserAgents = listUserAgents;
exports.getUserAgent = getUserAgent;
exports.deleteUserAgent = deleteUserAgent;
exports.listUserSkills = listUserSkills;
exports.getUserSkill = getUserSkill;
exports.deleteUserSkill = deleteUserSkill;
const fs_1 = require("fs");
const path_1 = require("path");
const paths_1 = require("../../paths");
// ============================================================================
// Frontmatter Parser
// ============================================================================
function parseFrontmatter(content) {
    const match = /^---\n([\s\S]*?)\n---/.exec(content);
    if (!match)
        return {};
    const result = {};
    for (const line of (match[1] || '').split('\n')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1)
            continue;
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
}
function extractFirstParagraph(content) {
    const bodyMatch = /^---\n[\s\S]*?\n---\n([\s\S]*)$/.exec(content);
    if (!bodyMatch)
        return '';
    const body = (bodyMatch[1] || '').trim();
    return body.split('\n').find((line) => line.trim() && !line.startsWith('#')) || '';
}
// ============================================================================
// User Agents
// ============================================================================
function listUserAgents() {
    const agentsDir = (0, path_1.join)((0, paths_1.getDataRoot)(), 'agents');
    const agents = [];
    if (!(0, fs_1.existsSync)(agentsDir))
        return agents;
    const entries = (0, fs_1.readdirSync)(agentsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.'))
            continue;
        const dirPath = (0, path_1.join)(agentsDir, entry.name);
        const agentMdPath = (0, path_1.join)(dirPath, 'Agent.md');
        const skillMdPath = (0, path_1.join)(dirPath, 'SKILL.md');
        if (!(0, fs_1.existsSync)(agentMdPath))
            continue;
        try {
            const content = (0, fs_1.readFileSync)(agentMdPath, 'utf-8');
            const frontmatter = parseFrontmatter(content);
            agents.push({
                id: entry.name,
                name: frontmatter['name'] || entry.name,
                description: extractFirstParagraph(content) || `User-created agent: ${frontmatter['name'] || entry.name}`,
                agentType: frontmatter['agentType'] || 'unknown',
                role: frontmatter['role'],
                domain: frontmatter['domain'],
                version: frontmatter['version'],
                dirPath,
                hasSkillMd: (0, fs_1.existsSync)(skillMdPath),
            });
        }
        catch (err) {
            console.error(`Failed to parse Agent.md in ${entry.name}:`, err);
        }
    }
    return agents;
}
function getUserAgent(id) {
    const agents = listUserAgents();
    return agents.find((a) => a.id === id) || null;
}
function deleteUserAgent(id) {
    const agentDir = (0, path_1.join)((0, paths_1.getDataRoot)(), 'agents', id);
    if (!(0, fs_1.existsSync)(agentDir))
        return false;
    (0, fs_1.rmSync)(agentDir, { recursive: true, force: true });
    return true;
}
// ============================================================================
// User Skills
// ============================================================================
function listUserSkills() {
    const skillsDir = (0, path_1.join)((0, paths_1.getDataRoot)(), 'skills');
    const skills = [];
    if (!(0, fs_1.existsSync)(skillsDir))
        return skills;
    const entries = (0, fs_1.readdirSync)(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.'))
            continue;
        const dirPath = (0, path_1.join)(skillsDir, entry.name);
        const skillMdPath = (0, path_1.join)(dirPath, 'SKILL.md');
        if (!(0, fs_1.existsSync)(skillMdPath))
            continue;
        try {
            const content = (0, fs_1.readFileSync)(skillMdPath, 'utf-8');
            const frontmatter = parseFrontmatter(content);
            const tags = frontmatter['tags'];
            skills.push({
                id: entry.name,
                name: frontmatter['name'] || entry.name,
                code: frontmatter['code'] || entry.name,
                description: frontmatter['description'] || `User-created skill: ${entry.name}`,
                type: frontmatter['type'],
                tags: tags ? tags.split(',').map((t) => t.trim()) : undefined,
                dirPath,
            });
        }
        catch (err) {
            console.error(`Failed to parse SKILL.md in ${entry.name}:`, err);
        }
    }
    return skills;
}
function getUserSkill(id) {
    const skills = listUserSkills();
    return skills.find((s) => s.id === id) || null;
}
function deleteUserSkill(id) {
    const skillDir = (0, path_1.join)((0, paths_1.getDataRoot)(), 'skills', id);
    if (!(0, fs_1.existsSync)(skillDir))
        return false;
    (0, fs_1.rmSync)(skillDir, { recursive: true, force: true });
    return true;
}
