"use strict";
/**
 * Monorepo 路径工具
 *
 * packages/web 和 packages/core 运行时 process.cwd() 是各自包目录，
 * 但 data/、templates/、.claude/ 等资源在 monorepo 根目录。
 * 所有需要访问根目录资源的地方必须使用这些工具函数。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setElectronDataRoot = setElectronDataRoot;
exports.getMonorepoRoot = getMonorepoRoot;
exports.setMonorepoRoot = setMonorepoRoot;
exports.getDataRoot = getDataRoot;
exports.getProjectDataDir = getProjectDataDir;
exports.getAgentsDataDir = getAgentsDataDir;
exports.getSkillsDataDir = getSkillsDataDir;
exports.getTemplatesDir = getTemplatesDir;
exports.getClaudeDir = getClaudeDir;
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
let _cachedRoot = null;
let _electronDataRoot = null;
/**
 * Electron 主进程应在启动时调用此函数，将 userData/data 路径注入 core。
 * 这样 core 代码不需要动态 require('electron')，打包后也能正确解析。
 */
function setElectronDataRoot(dataRoot) {
    _electronDataRoot = dataRoot;
}
function resolveElectronUserDataDataRoot() {
    if (process.env['DATA_ROOT']) {
        return process.env['DATA_ROOT'];
    }
    // Desktop 主进程注入的路径（最可靠）
    if (_electronDataRoot) {
        return _electronDataRoot;
    }
    const processWithElectronType = process;
    const isElectronMain = Boolean(process.versions?.['electron']) && processWithElectronType.type !== 'renderer';
    if (!isElectronMain) {
        return null;
    }
    try {
        // Avoid static electron import so web/server bundles can still load this module.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const electron = require('electron');
        const userData = electron.app?.isPackaged ? electron.app.getPath('userData') : null;
        return userData ? path_1.default.join(userData, 'data') : null;
    }
    catch {
        return null;
    }
}
/**
 * 获取 monorepo 根目录绝对路径
 * 通过向上查找包含 pnpm-workspace.yaml 的目录来定位
 */
function getMonorepoRoot() {
    if (_cachedRoot)
        return _cachedRoot;
    // 优先使用环境变量（可用于覆盖）
    if (process.env['MONOREPO_ROOT']) {
        _cachedRoot = process.env['MONOREPO_ROOT'];
        return _cachedRoot;
    }
    // 从 cwd 向上查找 pnpm-workspace.yaml
    let dir = process.cwd();
    for (let i = 0; i < 5; i++) {
        if ((0, fs_1.existsSync)(path_1.default.join(dir, 'pnpm-workspace.yaml'))) {
            _cachedRoot = dir;
            return _cachedRoot;
        }
        dir = path_1.default.dirname(dir);
    }
    // 兜底：cwd 的上两级（适用于 packages/web 或 packages/core）
    _cachedRoot = path_1.default.resolve(process.cwd(), '..', '..');
    return _cachedRoot;
}
/**
 * Electron 主进程应在启动时调用此函数，将 monorepo 根路径注入 core。
 * 打包后 skills/、templates/ 等资源通过 extraResources 放在 process.resourcesPath 下。
 */
function setMonorepoRoot(root) {
    _cachedRoot = root;
}
/**
 * 获取 data 目录根路径
 * 优先使用 DATA_ROOT 环境变量，否则使用 monorepo 根下的 data/
 */
function getDataRoot() {
    if (process.env['DATA_ROOT']) {
        return process.env['DATA_ROOT'];
    }
    const electronDataRoot = resolveElectronUserDataDataRoot();
    if (electronDataRoot) {
        return electronDataRoot;
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
