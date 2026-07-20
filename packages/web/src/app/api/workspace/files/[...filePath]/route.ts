/**
 * GET/PUT/POST/DELETE /api/workspace/files/[...filePath]?basePath=...
 * Read, write, create, or delete a file in any allowed directory
 */
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { ApiResponse } from '@originos/core/types';
import type { FileContentResponse, ProjectFile } from '@originos/core/types';
import { getDataRoot, getMonorepoRoot } from '@originos/core/lib/paths';

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'avif',
]);

const MIME_TYPE_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  avif: 'image/avif',
};

function isImageExtension(ext: string): boolean {
  return IMAGE_EXTENSIONS.has(ext.toLowerCase());
}

const ALLOWED_BASES = [
  getDataRoot(),
  path.join(getMonorepoRoot(), 'skills'),
  path.join(getMonorepoRoot(), 'tmp'),
];

function resolveAndCheck(basePath: string, segments: string[]): string {
  // Resolve relative paths against cwd()
  const resolved = path.isAbsolute(basePath) ? basePath : path.join(getMonorepoRoot(), basePath);
  const norm = path.normalize(resolved);
  if (!ALLOWED_BASES.some(b => norm.startsWith(b + path.sep) || norm === b)) {
    throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
  }
  const full = path.join(norm, ...segments);
  if (!path.normalize(full).startsWith(norm)) {
    throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
  }
  return full;
}

function fileResponse(basePath: string, relPath: string, content: string, stats: Awaited<ReturnType<typeof fs.stat>>): ApiResponse<FileContentResponse> {
  return {
    success: true,
    data: {
      file: {
        id: Buffer.from(relPath).toString('base64'),
        projectId: basePath,
        path: relPath,
        name: path.basename(relPath),
        size: Number(stats.size),
        createdAt: Number(stats.birthtimeMs),
        modifiedAt: Number(stats.mtimeMs),
        type: 'file',
        extension: path.extname(relPath).slice(1),
        parentPath: path.dirname(relPath) !== '.' ? path.dirname(relPath) : undefined,
      },
      content,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest, { params }: { params: { filePath: string[] } }) {
  try {
    const basePath = req.nextUrl.searchParams.get('basePath');
    if (!basePath) return NextResponse.json({ success: false, error: { code: 'MISSING_PARAM', message: 'basePath is required' }, timestamp: new Date().toISOString() }, { status: 400 });

    const fullPath = resolveAndCheck(basePath, params.filePath);
    const stats = await fs.stat(fullPath);
    const relPath = params.filePath.join('/');
    const ext = path.extname(relPath).slice(1);

    // For image files, read as binary and return base64 data URL
    if (isImageExtension(ext)) {
      const buffer = await fs.readFile(fullPath);
      const base64 = buffer.toString('base64');
      const mimeType = MIME_TYPE_MAP[ext.toLowerCase()] || 'application/octet-stream';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return NextResponse.json({
        success: true,
        data: {
          file: {
            id: Buffer.from(relPath).toString('base64'),
            projectId: basePath,
            path: relPath,
            name: path.basename(relPath),
            size: Number(stats.size),
            createdAt: Number(stats.birthtimeMs),
            modifiedAt: Number(stats.mtimeMs),
            type: 'file',
            extension: ext,
            parentPath: path.dirname(relPath) !== '.' ? path.dirname(relPath) : undefined,
          },
          content: dataUrl,
          contentType: mimeType,
          encoding: 'base64',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // For text files, read as UTF-8
    const content = await fs.readFile(fullPath, 'utf-8');
    return NextResponse.json(fileResponse(basePath, relPath, content, stats));
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'FORBIDDEN') return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' }, timestamp: new Date().toISOString() }, { status: 403 });
    if (err.code === 'ENOENT') return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' }, timestamp: new Date().toISOString() }, { status: 404 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, timestamp: new Date().toISOString() }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { filePath: string[] } }) {
  try {
    const basePath = req.nextUrl.searchParams.get('basePath');
    if (!basePath) return NextResponse.json({ success: false, error: { code: 'MISSING_PARAM', message: 'basePath is required' }, timestamp: new Date().toISOString() }, { status: 400 });

    const body = await req.json();
    if (typeof body.content !== 'string') return NextResponse.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'content is required' }, timestamp: new Date().toISOString() }, { status: 400 });

    const fullPath = resolveAndCheck(basePath, params.filePath);
    await fs.writeFile(fullPath, body.content, 'utf-8');
    const stats = await fs.stat(fullPath);
    const relPath = params.filePath.join('/');

    return NextResponse.json(fileResponse(basePath, relPath, body.content, stats));
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'FORBIDDEN') return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' }, timestamp: new Date().toISOString() }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, timestamp: new Date().toISOString() }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { filePath: string[] } }) {
  try {
    const basePath = req.nextUrl.searchParams.get('basePath');
    if (!basePath) return NextResponse.json({ success: false, error: { code: 'MISSING_PARAM', message: 'basePath is required' }, timestamp: new Date().toISOString() }, { status: 400 });

    const body = await req.json();
    const content = typeof body.content === 'string' ? body.content : '';

    const fullPath = resolveAndCheck(basePath, params.filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    const stats = await fs.stat(fullPath);
    const relPath = params.filePath.join('/');

    return NextResponse.json({
      success: true,
      data: {
        id: Buffer.from(relPath).toString('base64'),
        projectId: basePath,
        path: relPath,
        name: path.basename(relPath),
        size: Number(stats.size),
        createdAt: Number(stats.birthtimeMs),
        modifiedAt: Number(stats.mtimeMs),
        type: 'file' as const,
        extension: path.extname(relPath).slice(1),
      } satisfies ProjectFile,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'FORBIDDEN') return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' }, timestamp: new Date().toISOString() }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, timestamp: new Date().toISOString() }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { filePath: string[] } }) {
  try {
    const basePath = req.nextUrl.searchParams.get('basePath');
    if (!basePath) return NextResponse.json({ success: false, error: { code: 'MISSING_PARAM', message: 'basePath is required' }, timestamp: new Date().toISOString() }, { status: 400 });

    const fullPath = resolveAndCheck(basePath, params.filePath);
    await fs.unlink(fullPath);

    return NextResponse.json({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'FORBIDDEN') return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' }, timestamp: new Date().toISOString() }, { status: 403 });
    if (err.code === 'ENOENT') return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' }, timestamp: new Date().toISOString() }, { status: 404 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, timestamp: new Date().toISOString() }, { status: 500 });
  }
}
