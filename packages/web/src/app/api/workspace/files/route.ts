/**
 * GET /api/workspace/files?basePath=...
 * List files in any allowed directory (data/, skills/, tmp/)
 */
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { ApiResponse } from '@originos/core/types';
import type { FileListResponse, ProjectFile } from '@originos/core/types';
import { getDataRoot, getMonorepoRoot } from '@originos/core/lib/paths';

const ALLOWED_BASES = [
  getDataRoot(),
  path.join(getMonorepoRoot(), 'skills'),
  path.join(getMonorepoRoot(), 'tmp'),
];

function assertAllowed(p: string) {
  // Resolve relative paths against cwd()
  const resolved = path.isAbsolute(p) ? p : path.join(getMonorepoRoot(), p);
  const normalized = path.normalize(resolved);
  if (!ALLOWED_BASES.some(b => normalized.startsWith(b + path.sep) || normalized === b)) {
    throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
  }
}

async function scanDir(dir: string, contextId: string, rel = ''): Promise<ProjectFile[]> {
  const files: ProjectFile[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      const stats = await fs.stat(full);
      files.push({
        id: Buffer.from(relPath).toString('base64'),
        projectId: contextId,
        path: relPath,
        name: e.name,
        size: e.isDirectory() ? 0 : stats.size,
        createdAt: stats.birthtimeMs,
        modifiedAt: stats.mtimeMs,
        type: e.isDirectory() ? 'folder' : 'file',
        extension: e.isFile() ? path.extname(e.name).slice(1) : undefined,
        parentPath: rel || undefined,
      });
      if (e.isDirectory()) {
        files.push(...await scanDir(full, contextId, relPath));
      }
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  return files;
}

export async function GET(req: NextRequest) {
  try {
    const basePath = req.nextUrl.searchParams.get('basePath');
    if (!basePath) return NextResponse.json({ success: false, error: { code: 'MISSING_PARAM', message: 'basePath is required' }, timestamp: new Date().toISOString() }, { status: 400 });

    assertAllowed(basePath);

    const files = await scanDir(basePath, basePath);
    files.sort((a, b) => b.modifiedAt - a.modifiedAt);

    return NextResponse.json<ApiResponse<FileListResponse>>({
      success: true,
      data: { files, total: files.length },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'FORBIDDEN') return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' }, timestamp: new Date().toISOString() }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, timestamp: new Date().toISOString() }, { status: 500 });
  }
}
