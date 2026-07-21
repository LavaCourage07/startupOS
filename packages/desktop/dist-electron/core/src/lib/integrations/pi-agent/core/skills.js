"use strict";
/**
 * Skill Framework for OriginOS pi-agent Integration
 *
 * This module provides the core skill loading and execution framework
 * for OriginOS, adapted from Agent Skills standard (agentskills.io)
 *
 * Features:
 * - Load skills from multiple sources (bundled, user, project)
 * - Parse SKILL.md files with frontmatter
 * - Format skills for agent context injection
 * - Manage skill lifecycle and validation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_DESCRIPTION_LENGTH = exports.MAX_NAME_LENGTH = void 0;
exports.parseFrontmatter = parseFrontmatter;
exports.loadSkillsFromDir = loadSkillsFromDir;
exports.formatSkillsForPrompt = formatSkillsForPrompt;
exports.loadSkillContent = loadSkillContent;
exports.getDefaultSkillPaths = getDefaultSkillPaths;
exports.getBundledSkillSeedDir = getBundledSkillSeedDir;
exports.syncBundledSkillsToUserDirectory = syncBundledSkillsToUserDirectory;
exports.loadSkills = loadSkills;
const fs_1 = require("fs");
const ignore_1 = __importDefault(require("ignore"));
const path_1 = require("path");
const paths_1 = require("../../../paths");
/**
 * Constants per Agent Skills spec
 */
exports.MAX_NAME_LENGTH = 64;
exports.MAX_DESCRIPTION_LENGTH = 1024;
const IGNORE_FILE_NAMES = [".gitignore", ".ignore", ".fdignore"];
/**
 * Convert path to POSIX format for consistent comparison
 */
function toPosixPath(p) {
    return p.split(path_1.sep).join("/");
}
/**
 * Prefix ignore patterns with a base directory
 */
function prefixIgnorePattern(line, prefix) {
    const trimmed = line.trim();
    if (!trimmed)
        return null;
    if (trimmed.startsWith("#") && !trimmed.startsWith("\\#"))
        return null;
    let pattern = line;
    let negated = false;
    if (pattern.startsWith("!")) {
        negated = true;
        pattern = pattern.slice(1);
    }
    else if (pattern.startsWith("\\!")) {
        pattern = pattern.slice(1);
    }
    if (pattern.startsWith("/")) {
        pattern = pattern.slice(1);
    }
    const prefixed = prefix ? `${prefix}${pattern}` : pattern;
    return negated ? `!${prefixed}` : prefixed;
}
/**
 * Load ignore patterns from .gitignore and related files
 */
function addIgnoreRules(ig, dir, rootDir) {
    const relativeDir = (0, path_1.relative)(rootDir, dir);
    const prefix = relativeDir ? `${toPosixPath(relativeDir)}/` : "";
    for (const filename of IGNORE_FILE_NAMES) {
        const ignorePath = (0, path_1.join)(dir, filename);
        if (!(0, fs_1.existsSync)(ignorePath))
            continue;
        try {
            const content = (0, fs_1.readFileSync)(ignorePath, "utf-8");
            const patterns = content
                .split(/\r?\n/)
                .map((line) => prefixIgnorePattern(line, prefix))
                .filter((line) => Boolean(line));
            if (patterns.length > 0) {
                ig.add(patterns);
            }
        }
        catch { }
    }
}
/**
 * Validate skill name per Agent Skills spec
 */
function validateName(name, parentDirName) {
    const errors = [];
    if (name !== parentDirName) {
        errors.push(`name "${name}" does not match parent directory "${parentDirName}"`);
    }
    if (name.length > exports.MAX_NAME_LENGTH) {
        errors.push(`name exceeds ${exports.MAX_NAME_LENGTH} characters (${name.length})`);
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
        errors.push(`name contains invalid characters (must be lowercase a-z, 0-9, hyphens only)`);
    }
    if (name.startsWith("-") || name.endsWith("-")) {
        errors.push(`name must not start or end with a hyphen`);
    }
    if (name.includes("--")) {
        errors.push(`name must not contain consecutive hyphens`);
    }
    return errors;
}
/**
 * Validate description per Agent Skills spec
 */
function validateDescription(description) {
    const errors = [];
    if (!description || description.trim() === "") {
        errors.push("description is required");
    }
    else if (description.length > exports.MAX_DESCRIPTION_LENGTH) {
        errors.push(`description exceeds ${exports.MAX_DESCRIPTION_LENGTH} characters (${description.length})`);
    }
    return errors;
}
/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    if (!match) {
        return { frontmatter: {}, body: content };
    }
    const frontmatterText = match[1] || "";
    const body = match[2] || "";
    try {
        const frontmatter = frontmatterText.split("\n").reduce((acc, line) => {
            const colonIndex = line.indexOf(":");
            if (colonIndex === -1) {
                return acc;
            }
            const key = line.slice(0, colonIndex).trim();
            const value = line.slice(colonIndex + 1).trim();
            // Handle simple quoted values
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                acc[key] = value.slice(1, -1);
            }
            else {
                acc[key] = value;
            }
            return acc;
        }, {});
        return { frontmatter, body };
    }
    catch (error) {
        console.error("Failed to parse frontmatter:", error);
        return { frontmatter: {}, body: content };
    }
}
/**
 * Load a skill from a file path
 */
function loadSkillFromFile(filePath, source) {
    const diagnostics = [];
    try {
        const rawContent = (0, fs_1.readFileSync)(filePath, "utf-8");
        const { frontmatter } = parseFrontmatter(rawContent);
        const skillDir = (0, path_1.dirname)(filePath);
        const parentDirName = (0, path_1.basename)(skillDir);
        // Validate description
        const descErrors = validateDescription(frontmatter.description);
        for (const error of descErrors) {
            diagnostics.push({ type: "warning", message: error, path: filePath });
        }
        // Use name from frontmatter, or fall back to parent directory name
        const name = frontmatter.name || parentDirName;
        const code = frontmatter.code;
        // Validate name
        const nameErrors = validateName(name, parentDirName);
        for (const error of nameErrors) {
            diagnostics.push({ type: "warning", message: error, path: filePath });
        }
        // Don't load skill if description is missing
        if (!frontmatter.description || frontmatter.description.trim() === "") {
            return { skill: null, diagnostics };
        }
        return {
            skill: {
                name,
                code,
                description: frontmatter.description,
                filePath,
                baseDir: skillDir,
                source,
                disableModelInvocation: frontmatter["disable-model-invocation"] === true,
                outputDir: typeof frontmatter["outputDir"] === "string" ? frontmatter["outputDir"] : undefined,
            },
            diagnostics,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "failed to parse skill file";
        diagnostics.push({ type: "warning", message, path: filePath });
        return { skill: null, diagnostics };
    }
}
/**
 * Load skills from a directory (internal, recursive)
 */
function loadSkillsFromDirInternal(dir, source, includeRootFiles, ignoreMatcher, rootDir) {
    const skills = [];
    const diagnostics = [];
    if (!(0, fs_1.existsSync)(dir)) {
        return { skills, diagnostics };
    }
    const root = rootDir ?? dir;
    const ig = ignoreMatcher ?? (0, ignore_1.default)();
    addIgnoreRules(ig, dir, root);
    try {
        const entries = (0, fs_1.readdirSync)(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith(".")) {
                continue;
            }
            if (entry.name === "node_modules") {
                continue;
            }
            const fullPath = (0, path_1.join)(dir, entry.name);
            // Handle symlinks
            let isDirectory = entry.isDirectory();
            let isFile = entry.isFile();
            if (entry.isSymbolicLink()) {
                try {
                    const stats = (0, fs_1.statSync)(fullPath);
                    isDirectory = stats.isDirectory();
                    isFile = stats.isFile();
                }
                catch {
                    continue;
                }
            }
            const relPath = toPosixPath((0, path_1.relative)(root, fullPath));
            const ignorePath = isDirectory ? `${relPath}/` : relPath;
            if (ig.ignores(ignorePath)) {
                continue;
            }
            if (isDirectory) {
                const subResult = loadSkillsFromDirInternal(fullPath, source, false, ig, root);
                skills.push(...subResult.skills);
                diagnostics.push(...subResult.diagnostics);
                continue;
            }
            if (!isFile) {
                continue;
            }
            const isRootMd = includeRootFiles && entry.name.endsWith(".md");
            const isSkillMd = !includeRootFiles && entry.name === "SKILL.md";
            if (!isRootMd && !isSkillMd) {
                continue;
            }
            const result = loadSkillFromFile(fullPath, source);
            if (result.skill) {
                skills.push(result.skill);
            }
            diagnostics.push(...result.diagnostics);
        }
    }
    catch { }
    return { skills, diagnostics };
}
/**
 * Load skills from a directory
 */
function loadSkillsFromDir(options) {
    const { dir, source } = options;
    return loadSkillsFromDirInternal(dir, source, true);
}
/**
 * Escape XML special characters
 */
function escapeXml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
/**
 * Format skills for inclusion in agent context
 * Uses XML format per Agent Skills standard
 */
function formatSkillsForPrompt(skills) {
    const visibleSkills = skills.filter((s) => !s.disableModelInvocation);
    if (visibleSkills.length === 0) {
        return "";
    }
    const lines = [
        "\n\nThe following skills provide specialized instructions for specific tasks.",
        "Use the read tool to load a skill's file when the task matches its description.",
        "When a skill file references a relative path, resolve it against the skill directory.",
        "",
        "<available_skills>",
    ];
    for (const skill of visibleSkills) {
        lines.push("  <skill>");
        lines.push(`    <name>${escapeXml(skill.name)}</name>`);
        lines.push(`    <description>${escapeXml(skill.description)}</description>`);
        lines.push(`    <location>${escapeXml(skill.filePath)}</location>`);
        lines.push("  </skill>");
    }
    lines.push("</available_skills>");
    return lines.join("\n");
}
/**
 * Get skill content for direct invocation
 */
function loadSkillContent(skill) {
    const rawContent = (0, fs_1.readFileSync)(skill.filePath, "utf-8");
    return parseFrontmatter(rawContent);
}
/**
 * Default skill directories for OriginOS
 */
function getDefaultSkillPaths(cwd) {
    return {
        bundled: (0, path_1.resolve)(cwd, "skills"),
        user: (0, paths_1.getSkillsDataDir)(),
        project: (0, path_1.resolve)(cwd, ".originos", "skills"),
    };
}
function getBundledSkillSeedDir() {
    // 打包环境下从 extraResources 的 templates/skills 读取
    // 开发环境下从 monorepo 根目录的 templates/skills 读取
    const resourcesPath = process.resourcesPath;
    if (resourcesPath && process.env?.['ELECTRON_RUN_AS_NODE'] !== '1') {
        return (0, path_1.join)(resourcesPath, 'templates', 'skills');
    }
    return (0, path_1.join)((0, paths_1.getMonorepoRoot)(), "templates", "skills");
}
function hasSkillDefinition(dir) {
    return (0, fs_1.existsSync)((0, path_1.join)(dir, "SKILL.md"));
}
/**
 * Seed bundled skills into the user skill directory.
 *
 * Runtime must load skills from data/skills so bundled skills and user-installed
 * skills share the same startup path. Existing user skill directories are never
 * overwritten.
 */
function syncBundledSkillsToUserDirectory() {
    const sourceDir = getBundledSkillSeedDir();
    if (!(0, fs_1.existsSync)(sourceDir))
        return;
    const targetRoot = (0, paths_1.getSkillsDataDir)();
    (0, fs_1.mkdirSync)(targetRoot, { recursive: true });
    for (const entry of (0, fs_1.readdirSync)(sourceDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith("."))
            continue;
        const sourceSkillDir = (0, path_1.join)(sourceDir, entry.name);
        if (!hasSkillDefinition(sourceSkillDir))
            continue;
        const targetSkillDir = (0, path_1.join)(targetRoot, entry.name);
        // 只有目标目录里确实存在 SKILL.md 才跳过，否则重新同步
        // （防止空目录或损坏的残留目录导致技能加载失败）
        if (hasSkillDefinition(targetSkillDir))
            continue;
        (0, fs_1.rmSync)(targetSkillDir, { recursive: true, force: true });
        (0, fs_1.cpSync)(sourceSkillDir, targetSkillDir, {
            recursive: true,
            errorOnExist: false,
            force: true,
        });
    }
}
/**
 * Load skills from all configured locations
 */
function loadSkills(options = {}) {
    const { cwd = (0, paths_1.getDataRoot)(), skillPaths = [], includeDefaults = true } = options;
    const skillMap = new Map();
    const realPathSet = new Set();
    const allDiagnostics = [];
    const collisionDiagnostics = [];
    function addSkills(result) {
        allDiagnostics.push(...result.diagnostics);
        for (const skill of result.skills) {
            let realPath;
            try {
                realPath = (0, fs_1.realpathSync)(skill.filePath);
            }
            catch {
                realPath = skill.filePath;
            }
            if (realPathSet.has(realPath)) {
                continue;
            }
            const existing = skillMap.get(skill.name);
            if (existing) {
                collisionDiagnostics.push({
                    type: "collision",
                    message: `name "${skill.name}" collision`,
                    path: skill.filePath,
                    collision: {
                        resourceType: "skill",
                        name: skill.name,
                        winnerPath: existing.filePath,
                        loserPath: skill.filePath,
                    },
                });
            }
            else {
                skillMap.set(skill.name, skill);
                realPathSet.add(realPath);
            }
        }
    }
    if (includeDefaults) {
        // 内置技能直接从模板目录加载，不复制到 data/skills
        // 这样内置技能保持 source: "bundled"，与用户安装的技能区分开
        const bundledSkillDir = getBundledSkillSeedDir();
        if ((0, fs_1.existsSync)(bundledSkillDir)) {
            addSkills(loadSkillsFromDir({ dir: bundledSkillDir, source: "bundled" }));
        }
        // 用户数据目录下用户安装的技能（不再包含内置技能）
        const dataSkillsDir = (0, path_1.join)((0, paths_1.getDataRoot)(), "skills");
        if ((0, fs_1.existsSync)(dataSkillsDir)) {
            addSkills(loadSkillsFromDir({ dir: dataSkillsDir, source: "user" }));
        }
        // Project-local skills
        const defaults = getDefaultSkillPaths(cwd);
        if ((0, fs_1.existsSync)(defaults.project)) {
            addSkills(loadSkillsFromDir({ dir: defaults.project, source: "project" }));
        }
    }
    // Explicit skill paths
    for (const rawPath of skillPaths) {
        const resolvedPath = (0, path_1.resolve)(cwd, rawPath);
        if (!(0, fs_1.existsSync)(resolvedPath)) {
            allDiagnostics.push({ type: "warning", message: "skill path does not exist", path: resolvedPath });
            continue;
        }
        try {
            const stats = (0, fs_1.statSync)(resolvedPath);
            if (stats.isDirectory()) {
                addSkills(loadSkillsFromDir({ dir: resolvedPath, source: "project" }));
            }
            else if (stats.isFile() && resolvedPath.endsWith(".md")) {
                const result = loadSkillFromFile(resolvedPath, "project");
                if (result.skill) {
                    addSkills({ skills: [result.skill], diagnostics: result.diagnostics });
                }
                else {
                    allDiagnostics.push(...result.diagnostics);
                }
            }
            else {
                allDiagnostics.push({ type: "warning", message: "skill path is not a markdown file", path: resolvedPath });
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "failed to load skill";
            allDiagnostics.push({ type: "warning", message, path: resolvedPath });
        }
    }
    allDiagnostics.push(...collisionDiagnostics);
    return {
        skills: Array.from(skillMap.values()),
        diagnostics: allDiagnostics,
    };
}
