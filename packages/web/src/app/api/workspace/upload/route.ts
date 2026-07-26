/**
 * POST /api/workspace/upload?basePath=...
 * Upload one or more files to a workspace directory
 */
import { promises as fs } from 'fs';
import path from 'path';

import { NextRequest, NextResponse } from 'next/server';

import {
  assertRealPathWithin,
  assertSafeWorkspaceFileName,
  assertWorkspacePathCanBeCreated,
  isPathWithin,
  resolveWorkspaceBasePath,
  writeWorkspaceUploadFile,
} from '@originos/core/lib/integrations/electron/workspace-paths';
import { recordUploads } from '@originos/core/lib/integrations/pi-agent/upload-tracker';
import { getDataRoot, getMonorepoRoot } from '@originos/core/lib/paths';

import type { ApiResponse } from '@originos/core/types';

const ALLOWED_BASES = [
  getDataRoot(),
  path.join(getMonorepoRoot(), 'skills'),
  path.join(getMonorepoRoot(), 'tmp'),
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/json',
  'text/markdown',
  // Images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  // Code / text files
  'text/javascript',
  'text/typescript',
  'text/x-python',
  'text/x-python-script',
  'text/x-java',
  'text/x-go',
  'text/x-rust',
  'text/html',
  'text/css',
  'text/xml',
  'application/x-yaml',
  'application/yaml',
];

// Simple in-memory rate limiter (20 requests per minute per IP)
const uploadCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const record = uploadCounts.get(clientIp);

  if (!record || now > record.resetAt) {
    uploadCounts.set(clientIp, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }

  if (record.count >= 20) {
    return false;
  }

  record.count++;
  return true;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesMimeType(mimeType: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.endsWith('/*')) {
      return mimeType.startsWith(pattern.slice(0, -2));
    }
    return mimeType === pattern;
  });
}

function resolveAndCheck(basePath: string): string {
  const norm = resolveWorkspaceBasePath(basePath, {
    dataRoot: getDataRoot(),
    monorepoRoot: getMonorepoRoot(),
  });
  if (!ALLOWED_BASES.some((base) => isPathWithin(norm, base))) {
    throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
  }
  return norm;
}

function uploadErrorResponse(err: NodeJS.ErrnoException): NextResponse {
  // eslint-disable-next-line no-console
  console.warn('[workspace-upload] rejected', {
    code: err.code,
    message: err.message,
  });
  if (err.code === 'FORBIDDEN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' }, timestamp: new Date().toISOString() },
      { status: 403 }
    );
  }
  if (err.code === 'INVALID_FILE_NAME') {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_FILE_NAME', message: err.message }, timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: err.message }, timestamp: new Date().toISOString() },
    { status: 500 }
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const basePath = req.nextUrl.searchParams.get('basePath');
    if (!basePath) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'basePath is required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // Rate limiting
    const clientIp = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: '上传请求过于频繁，请稍后再试' }, timestamp: new Date().toISOString() },
        { status: 429 }
      );
    }

    const resolvedBase = resolveAndCheck(basePath);
    // eslint-disable-next-line no-console
    console.log('[workspace-upload] path resolved', {
      basePath,
      resolvedBase,
      dataRoot: getDataRoot(),
    });

    // Ensure directory exists
    await assertWorkspacePathCanBeCreated(resolvedBase, ALLOWED_BASES);
    await fs.mkdir(resolvedBase, { recursive: true });
    await assertRealPathWithin(resolvedBase, ALLOWED_BASES);

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'No files provided' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const uploadedFiles: Array<{ name: string; path: string; size: number }> = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        continue;
      }

      const fileName = file.name;
      assertSafeWorkspaceFileName(fileName);
      // File size validation
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: { code: 'FILE_TOO_LARGE', message: `文件 "${fileName}" 超过 ${formatFileSize(MAX_FILE_SIZE)} 大小限制` }, timestamp: new Date().toISOString() },
          { status: 413 }
        );
      }

      // File type validation (skip validation for empty mime types)
      const fileType = (file as File).type;
      if (fileType && !matchesMimeType(fileType, ALLOWED_MIME_TYPES)) {
        return NextResponse.json(
          { success: false, error: { code: 'UNSUPPORTED_FILE_TYPE', message: `文件 "${fileName}" 的类型 "${fileType}" 不被支持` }, timestamp: new Date().toISOString() },
          { status: 415 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const writtenFile = await writeWorkspaceUploadFile(
        resolvedBase,
        fileName,
        buffer,
      );

      uploadedFiles.push({
        name: writtenFile.fileName,
        path: path.relative(resolvedBase, writtenFile.fullPath),
        size: buffer.length,
      });
    }

    // 持久化上传记录到 agent 上下文
    await recordUploads(resolvedBase, uploadedFiles);

    return NextResponse.json<ApiResponse<{ files: typeof uploadedFiles }>>({
      success: true,
      data: { files: uploadedFiles },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return uploadErrorResponse(e as NodeJS.ErrnoException);
  }
}
