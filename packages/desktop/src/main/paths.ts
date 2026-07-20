/**
 * Desktop (Electron) 路径工具
 *
 * 与 packages/core/src/lib/paths.ts 逻辑一致，
 * 但为 CJS Electron 主进程提供可运行时解析的版本。
 */

import path from 'path';
import { existsSync } from 'fs';
import { app } from 'electron';

let _cachedRoot: string | null = null;

/**
 * 获取 monorepo 根目录绝对路径
 */
export function getMonorepoRoot(): string {
  if (_cachedRoot) return _cachedRoot;

  if (process.env['MONOREPO_ROOT']) {
    _cachedRoot = process.env['MONOREPO_ROOT'];
    return _cachedRoot;
  }

  // Electron dev: __dirname is dist-electron/desktop/src/main/
  // Walk up to find pnpm-workspace.yaml
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      _cachedRoot = dir;
      return _cachedRoot;
    }
    dir = path.dirname(dir);
  }

  // Fallback: from __dirname go up to monorepo root
  // __dirname = dist-electron/desktop/src/main → go up 6 levels
  _cachedRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
  return _cachedRoot;
}

/**
 * 获取 data 目录根路径
 */
export function getDataRoot(): string {
  if (process.env['DATA_ROOT']) {
    return process.env['DATA_ROOT'];
  }
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'data');
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
