"use strict";
/**
 * Desktop (Electron) 路径工具
 *
 * 与 packages/core/src/lib/paths.ts 逻辑一致，
 * 但为 CJS Electron 主进程提供可运行时解析的版本。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMonorepoRoot = getMonorepoRoot;
exports.getDataRoot = getDataRoot;
exports.getProjectDataDir = getProjectDataDir;
exports.getAgentsDataDir = getAgentsDataDir;
exports.getSkillsDataDir = getSkillsDataDir;
exports.getTemplatesDir = getTemplatesDir;
exports.getClaudeDir = getClaudeDir;
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const electron_1 = require("electron");
let _cachedRoot = null;
/**
 * 获取 monorepo 根目录绝对路径
 */
function getMonorepoRoot() {
    if (_cachedRoot)
        return _cachedRoot;
    if (process.env['MONOREPO_ROOT']) {
        _cachedRoot = process.env['MONOREPO_ROOT'];
        return _cachedRoot;
    }
    // Electron dev: __dirname is dist-electron/desktop/src/main/
    // Walk up to find pnpm-workspace.yaml
    let dir = __dirname;
    for (let i = 0; i < 8; i++) {
        if ((0, fs_1.existsSync)(path_1.default.join(dir, 'pnpm-workspace.yaml'))) {
            _cachedRoot = dir;
            return _cachedRoot;
        }
        dir = path_1.default.dirname(dir);
    }
    // Fallback: from __dirname go up to monorepo root
    // __dirname = dist-electron/desktop/src/main → go up 6 levels
    _cachedRoot = path_1.default.resolve(__dirname, '..', '..', '..', '..', '..', '..');
    return _cachedRoot;
}
/**
 * 获取 data 目录根路径
 */
function getDataRoot() {
    if (process.env['DATA_ROOT']) {
        return process.env['DATA_ROOT'];
    }
    if (electron_1.app.isPackaged) {
        return path_1.default.join(electron_1.app.getPath('userData'), 'data');
    }
    return path_1.default.join(getMonorepoRoot(), 'data');
}
/**
 * 获取项目数据目录
 */
function getProjectDataDir(projectId) {
    return path_1.default.join(getDataRoot(), 'projects', projectId);
}
/**
 * 获取 agents 数据目录
 */
function getAgentsDataDir() {
    return path_1.default.join(getDataRoot(), 'agents');
}
/**
 * 获取 skills 数据目录
 */
function getSkillsDataDir() {
    return path_1.default.join(getDataRoot(), 'skills');
}
/**
 * 获取模板目录
 */
function getTemplatesDir() {
    return path_1.default.join(getMonorepoRoot(), 'templates', 'project-interview');
}
/**
 * 获取 .claude 目录
 */
function getClaudeDir() {
    return path_1.default.join(getMonorepoRoot(), '.claude');
}
