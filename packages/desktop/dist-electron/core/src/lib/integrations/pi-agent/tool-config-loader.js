"use strict";
/**
 * Tool.md 配置加载器
 *
 * 解析 Tool.md 文件，提取工具配置：
 * - disabledTools: 禁用的系统工具列表
 * - customTools: 自定义工具定义（Bash 命令包装）
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadToolConfig = loadToolConfig;
exports.isToolDisabled = isToolDisabled;
exports.getCustomTools = getCustomTools;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
/**
 * 解析 Tool.md 的 frontmatter
 */
function parseToolFrontmatter(content) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    if (!match)
        return {};
    const frontmatterText = match[1] || '';
    const config = {};
    let currentKey = null;
    let currentArray = [];
    for (const line of frontmatterText.split('\n')) {
        const trimmed = line.trim();
        // 处理数组项
        if (trimmed.startsWith('- ')) {
            if (currentKey) {
                currentArray.push(trimmed.slice(2).trim());
            }
            continue;
        }
        // 处理键值对
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
            // 保存上一个数组
            if (currentKey && currentArray.length > 0) {
                config[currentKey] = currentArray;
                currentArray = [];
            }
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();
            // 移除引号
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (value) {
                config[key] = value;
                currentKey = null;
            }
            else {
                // 空值表示后面跟数组
                currentKey = key;
            }
        }
    }
    // 保存最后一个数组
    if (currentKey && currentArray.length > 0) {
        config[currentKey] = currentArray;
    }
    return config;
}
/**
 * 从指定目录加载 Tool.md 配置
 */
function loadToolConfig(baseDir) {
    const toolMdPath = path_1.default.join(baseDir, 'Tool.md');
    if (!(0, fs_1.existsSync)(toolMdPath)) {
        return null;
    }
    try {
        const content = (0, fs_1.readFileSync)(toolMdPath, 'utf-8');
        return parseToolFrontmatter(content);
    }
    catch (error) {
        console.error(`Failed to load Tool.md from ${baseDir}:`, error);
        return null;
    }
}
/**
 * 检查工具是否被禁用
 */
function isToolDisabled(toolName, config) {
    if (!config || !config.disabledTools)
        return false;
    return config.disabledTools.includes(toolName);
}
/**
 * 获取自定义工具列表
 */
function getCustomTools(config) {
    if (!config || !config.customTools)
        return [];
    return config.customTools;
}
