/**
 * Sandbox 路径解析 — 安全地定位 /data 下的应用文件
 * 防止目录穿越攻击
 */

import { existsSync, statSync } from 'fs';
import path from 'path';
import { getDataRoot } from '../../paths';

const DATA_DIR = getDataRoot();

/**
 * 解析沙箱应用文件路径
 * @param appId 应用目录名
 * @param filePath 相对文件路径（如 style.css 或 js/app.js）
 * @returns 绝对路径，或 null 如果文件不存在或不安全
 */
export function resolveSandboxFilePath(appId: string, filePath: string): string | null {
  // Normalize and reject path traversal
  const normalizedAppId = path.basename(appId);
  const normalizedFile = path.normalize(filePath);
  if (normalizedFile.startsWith('..') || normalizedFile.startsWith('/')) {
    return null;
  }

  const fullPath = path.join(DATA_DIR, normalizedAppId, normalizedFile);

  // Ensure the resolved path is still under /data
  if (!fullPath.startsWith(DATA_DIR)) {
    return null;
  }

  if (!existsSync(fullPath)) {
    return null;
  }

  // Block directories
  if (statSync(fullPath).isDirectory()) {
    return null;
  }

  return fullPath;
}
