/**
 * Sandbox app scanner — discovers HTML apps under /data
 */

import { readdirSync, statSync, existsSync } from 'fs';
import path from 'path';
import { getDataRoot } from '../../paths';

export interface SandboxAppInfo {
  id: string;
  name: string;
  path: string;
  updatedAt: number;
}

export function listSandboxApps(): SandboxAppInfo[] {
  const dataDir = getDataRoot();
  const apps: SandboxAppInfo[] = [];

  const scanRoots = ['skills', 'agents'];

  function scan(dir: string, relPath: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    if (entries.includes('index.html')) {
      const stat = statSync(dir);
      const appId = relPath.replace(/^data\//, '');
      apps.push({
        id: appId,
        name: path.basename(dir),
        path: relPath,
        updatedAt: stat.mtimeMs,
      });
    }

    for (const entry of entries) {
      if (entry.endsWith('.html') && entry !== 'index.html') {
        const htmlPath = path.join(dir, entry);
        const stat = statSync(htmlPath);
        const appId = relPath.replace(/^data\//, '') + '/' + entry;
        apps.push({
          id: appId,
          name: entry.replace(/\.html$/, ''),
          path: relPath + '/' + entry,
          updatedAt: stat.mtimeMs,
        });
      }
    }

    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const entryPath = path.join(dir, entry);
      const entryStat = statSync(entryPath);
      if (entryStat.isDirectory()) {
        const depth = relPath.split('/').length;
        if (depth < 4) {
          scan(entryPath, path.join(relPath, entry));
        }
      }
    }
  }

  for (const root of scanRoots) {
    const rootPath = path.join(dataDir, root);
    if (existsSync(rootPath)) {
      scan(rootPath, path.join('data', root));
    }
  }

  apps.sort((a, b) => b.updatedAt - a.updatedAt);
  return apps;
}
