import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { getDataRoot, getMonorepoRoot } from '@originos/core/lib/paths';

const ALLOWED_BASES = [
  getDataRoot(),
  path.join(getMonorepoRoot(), 'skills'),
  path.join(getMonorepoRoot(), 'tmp'),
];

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const filePath = path.join(getMonorepoRoot(), ...params.path);

  const allowed = ALLOWED_BASES.some(base => filePath.startsWith(base + path.sep) || filePath === base);
  if (!allowed) return new NextResponse('Forbidden', { status: 403 });
  if (!existsSync(filePath)) return new NextResponse('Not Found', { status: 404 });

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_MAP[ext] ?? 'application/octet-stream';

  return new NextResponse(readFileSync(filePath), {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
