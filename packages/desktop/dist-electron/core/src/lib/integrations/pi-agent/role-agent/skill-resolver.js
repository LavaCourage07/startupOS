"use strict";
/**
 * 技能扫描器（Story R.3）
 *
 * 扫描角色目录下 `.skills/` 中的已安装技能，
 * 为 system prompt 注入可用技能清单。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanInstalledSkills = scanInstalledSkills;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
/** 从技能目录读取 SKILL.md 提取 name/description + frontmatter */
function extractSkillInfo(skillLinkPath) {
    const skillMdPath = path_1.default.join(skillLinkPath, 'SKILL.md');
    if (!(0, fs_1.existsSync)(skillMdPath))
        return null;
    try {
        const content = (0, fs_1.readFileSync)(skillMdPath, 'utf-8');
        const frontmatter = {};
        // 解析 YAML frontmatter
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch?.[1]) {
            const lines = fmMatch[1].split('\n');
            for (const line of lines) {
                const kvMatch = line.match(/^(\w[\w-]*):\s*(.+)$/);
                if (kvMatch) {
                    frontmatter[kvMatch[1].toLowerCase()] = kvMatch[2].trim();
                }
            }
        }
        const nameMatch = content.match(/^name:\s*(.+)$/m);
        const descMatch = content.match(/^description:\s*(.+)$/m);
        const name = nameMatch?.[1]?.trim() ?? path_1.default.basename(skillLinkPath);
        const description = descMatch?.[1]?.trim() ?? '';
        const icon = frontmatter['icon'] || undefined;
        const category = frontmatter['category'] || undefined;
        const tagsRaw = frontmatter['tags'];
        const tags = tagsRaw
            ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
            : undefined;
        return {
            name,
            description,
            code: path_1.default.basename(skillLinkPath),
            path: skillLinkPath,
            icon,
            category,
            tags,
            frontmatter,
        };
    }
    catch {
        return null;
    }
}
/**
 * 扫描角色目录下 `.skills/` 中的已安装技能。
 * `.skills/` 中为软链接，每个链接指向 `data/skills/{skillCode}/`。
 *
 * @param baseDir 角色工作目录
 * @returns 技能列表，`.skills/` 不存在时返回空数组
 */
function scanInstalledSkills(baseDir) {
    const skillsDir = path_1.default.join(baseDir, '.skills');
    if (!(0, fs_1.existsSync)(skillsDir))
        return [];
    const skills = [];
    try {
        const entries = (0, fs_1.readdirSync)(skillsDir);
        for (const entry of entries) {
            const entryPath = path_1.default.join(skillsDir, entry);
            if (!(0, fs_1.lstatSync)(entryPath).isSymbolicLink())
                continue;
            const info = extractSkillInfo(entryPath);
            if (info)
                skills.push(info);
        }
    }
    catch {
        // 目录读取失败，返回空数组
    }
    return skills;
}
