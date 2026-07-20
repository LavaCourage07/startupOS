/**
 * API Route: Sandbox App File Server
 * GET /api/sandbox/apps/[...appPath]
 *
 * Handles both app entry points and static assets.
 * Segments are split into appPath + filePath by finding the deepest directory
 * under /data/ that contains an index.html.
 *
 * Examples:
 *   /api/sandbox/apps/test-app              → serve data/test-app/index.html
 *   /api/sandbox/apps/skills/my-app         → serve data/skills/my-app/index.html
 *   /api/sandbox/apps/test-app/style.css    → serve data/test-app/style.css
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { getMimeType } from '@originos/core/lib/features/sandbox/mime';
import { CONSOLE_BRIDGE_SCRIPT } from '@originos/core/lib/features/sandbox/console-bridge';
import { getDataRoot } from '@originos/core/lib/paths';

const DATA_DIR = getDataRoot();

function isSafeRelPath(relPath: string): boolean {
  const normalized = path.normalize(relPath);
  return !normalized.startsWith('..') && !path.isAbsolute(normalized);
}

function resolveFile(appRelPath: string, filePath: string): string | null {
  if (!isSafeRelPath(appRelPath) || !isSafeRelPath(filePath)) return null;
  const full = path.join(DATA_DIR, appRelPath, filePath);
  if (!full.startsWith(DATA_DIR + path.sep)) return null;
  if (!existsSync(full) || statSync(full).isDirectory()) return null;
  return full;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { appPath: string[] } }
) {
  const segments = params.appPath;

  // 先检查完整路径是否直接指向一个 .html 文件（技能产出物场景）
  const fullRelPath = segments.join('/');
  if (isSafeRelPath(fullRelPath) && fullRelPath.endsWith('.html')) {
    const fullPath = path.join(DATA_DIR, fullRelPath);
    if (existsSync(fullPath) && statSync(fullPath).isFile()) {
      let content = readFileSync(fullPath, 'utf-8');
      if (content.includes('</body>')) {
        content = content.replace('</body>', `<script>${CONSOLE_BRIDGE_SCRIPT}</script></body>`);
      } else {
        content += `\n<script>${CONSOLE_BRIDGE_SCRIPT}</script>`;
      }
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }
  }

  // Try each split point from left to right.
  // If segments[0..i] is a directory containing index.html, that's the app root.
  // segments[i+1..] is the file path within the app (empty = serve index.html).
  for (let i = segments.length; i >= 1; i--) {
    const appSegments = segments.slice(0, i);
    const fileSegments = segments.slice(i);
    const appRelPath = appSegments.join('/');

    if (!isSafeRelPath(appRelPath)) continue;

    const appDir = path.join(DATA_DIR, appRelPath);
    if (!existsSync(appDir) || !statSync(appDir).isDirectory()) continue;
    if (!existsSync(path.join(appDir, 'index.html'))) continue;

    // Found the app directory
    if (fileSegments.length === 0) {
      // Serve index.html with console bridge injected
      let content = readFileSync(path.join(appDir, 'index.html'), 'utf-8');
      if (content.includes('</body>')) {
        content = content.replace('</body>', `<script>${CONSOLE_BRIDGE_SCRIPT}</script></body>`);
      } else {
        content += `\n<script>${CONSOLE_BRIDGE_SCRIPT}</script>`;
      }
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Serve a static asset
    const filePath = fileSegments.join('/');
    const resolvedPath = resolveFile(appRelPath, filePath);
    if (!resolvedPath) {
      return new NextResponse('File not found', { status: 404 });
    }
    const content = readFileSync(resolvedPath);
    return new NextResponse(content, {
      headers: {
        'Content-Type': getMimeType(filePath),
        'Cache-Control': 'public, max-age=60',
      },
    });
  }

  // 返回友好的空状态 HTML，而不是错误信息
  const emptyStateHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>暂无应用</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #fff;
      color: #374151;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    .title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 0.5rem;
    }
    .description {
      font-size: 0.875rem;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📭</div>
    <div class="title">暂无应用</div>
    <div class="description">使用 skill 或 agent 构建前端应用后将在此处显示</div>
  </div>
</body>
</html>`;

  return new NextResponse(emptyStateHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
