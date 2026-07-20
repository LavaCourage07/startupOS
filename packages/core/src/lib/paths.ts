/**
 * Monorepo 路径工具
 *
 * packages/web 和 packages/core 运行时 process.cwd() 是各自包目录，
 * 但 data/、templates/、.claude/ 等资源在 monorepo 根目录。
 * 所有需要访问根目录资源的地方必须使用这些工具函数。
 */

import path from 'path';
import { existsSync } from 'fs';

let _cachedRoot: string | null = null;

let _electronDataRoot: string | null = null;

/**
 * Electron 主进程应在启动时调用此函数，将 userData/data 路径注入 core。
 * 这样 core 代码不需要动态 require('electron')，打包后也能正确解析。
 */
export function setElectronDataRoot(dataRoot: string): void {
  _electronDataRoot = dataRoot;
}

function resolveElectronUserDataDataRoot(): string | null {
  if (process.env['DATA_ROOT']) {
    return process.env['DATA_ROOT'];
  }

  // Desktop 主进程注入的路径（最可靠）
  if (_electronDataRoot) {
    return _electronDataRoot;
  }

  const processWithElectronType = process as NodeJS.Process & { type?: string };
  const isElectronMain = Boolean(process.versions?.['electron']) && processWithElectronType.type !== 'renderer';
  if (!isElectronMain) {
    return null;
  }

  try {
    // Avoid static electron import so web/server bundles can still load this module.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron') as { app?: { isPackaged?: boolean; getPath: (name: string) => string } };
    const userData = electron.app?.isPackaged ? electron.app.getPath('userData') : null;
    return userData ? path.join(userData, 'data') : null;
  } catch {
    return null;
  }
}

/**
 * 获取 monorepo 根目录绝对路径
 * 通过向上查找包含 pnpm-workspace.yaml 的目录来定位
 */
export function getMonorepoRoot(): string {
  if (_cachedRoot) return _cachedRoot;

  // 优先使用环境变量（可用于覆盖）
  if (process.env['MONOREPO_ROOT']) {
    _cachedRoot = process.env['MONOREPO_ROOT'];
    return _cachedRoot;
  }

  // 从 cwd 向上查找 pnpm-workspace.yaml
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      _cachedRoot = dir;
      return _cachedRoot;
    }
    dir = path.dirname(dir);
  }

  // 兜底：cwd 的上两级（适用于 packages/web 或 packages/core）
  _cachedRoot = path.resolve(process.cwd(), '..', '..');
  return _cachedRoot;
}

/**
 * Electron 主进程应在启动时调用此函数，将 monorepo 根路径注入 core。
 * 打包后 skills/、templates/ 等资源通过 extraResources 放在 process.resourcesPath 下。
 */
export function setMonorepoRoot(root: string): void {
  _cachedRoot = root;
}

/**
 * 获取 data 目录根路径
 * 优先使用 DATA_ROOT 环境变量，否则使用 monorepo 根下的 data/
 */
export function getDataRoot(): string {
  if (process.env['DATA_ROOT']) {
    return process.env['DATA_ROOT'];
  }
  const electronDataRoot = resolveElectronUserDataDataRoot();
  if (electronDataRoot) {
    return electronDataRoot;
  }
  return path.join(getMonorepoRoot(), 'data');
}

/**
 * 获取项目数据目录
 */
export function getProjectDataDir(projectId: string): string {
  return path.join(getDataRoot(), 'projects', projectId);
}

/**
 * 获取 agents 数据目录
 */
export function getAgentsDataDir(): string {
  return path.join(getDataRoot(), 'agents');
}

/**
 * 获取 skills 数据目录
 */
export function getSkillsDataDir(): string {
  return path.join(getDataRoot(), 'skills');
}

/**
 * 获取模板目录
 */
export function getTemplatesDir(): string {
  return path.join(getMonorepoRoot(), 'templates', 'project-interview');
}

/**
 * 获取 .claude 目录
 */
export function getClaudeDir(): string {
  return path.join(getMonorepoRoot(), '.claude');
}
