import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { ApiResponse } from '@originos/core/types';
import type { FileContentResponse } from '@originos/core/types';
import { getDataRoot } from '@originos/core/lib/paths';

const DATA_DIR = path.join(getDataRoot(), 'projects');

/**
 * Get project files directory path
 */
function getProjectFilesPath(projectId: string): string {
  return path.join(DATA_DIR, projectId, 'files');
}

/**
 * GET /api/projects/[id]/files/[...path]
 * Read file content
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id: projectId, path: pathSegments } = await params;
    const filePath = pathSegments.join('/');

    // Get full file path
    const filesDir = getProjectFilesPath(projectId);
    const fullPath = path.join(filesDir, filePath);

    // Security check: ensure path is within project directory
    const normalizedPath = path.normalize(fullPath);
    if (!normalizedPath.startsWith(filesDir)) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_PATH',
            message: 'Invalid file path',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Read file
    const content = await fs.readFile(fullPath, 'utf-8');
    const stats = await fs.stat(fullPath);

    return NextResponse.json<ApiResponse<FileContentResponse>>({
      success: true,
      data: {
        file: {
          id: Buffer.from(filePath).toString('base64'),
          projectId,
          path: filePath,
          name: path.basename(filePath),
          size: stats.size,
          createdAt: stats.birthtimeMs,
          modifiedAt: stats.mtimeMs,
          type: 'file',
          extension: path.extname(filePath).slice(1),
          parentPath: path.dirname(filePath) !== '.' ? path.dirname(filePath) : undefined,
        },
        content,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'File not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    console.error('Failed to read file:', error);
    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to read file',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[id]/files/[...path]
 * Update file content
 */
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id: projectId, path: pathSegments } = await params;
    const filePath = pathSegments.join('/');
    const body = await _request.json();

    // Validate _request
    if (typeof body.content !== 'string') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Content is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Get full file path
    const filesDir = getProjectFilesPath(projectId);
    const fullPath = path.join(filesDir, filePath);

    // Security check
    const normalizedPath = path.normalize(fullPath);
    if (!normalizedPath.startsWith(filesDir)) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_PATH',
            message: 'Invalid file path',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Write file
    await fs.writeFile(fullPath, body.content, 'utf-8');
    const stats = await fs.stat(fullPath);

    return NextResponse.json<ApiResponse<FileContentResponse>>({
      success: true,
      data: {
        file: {
          id: Buffer.from(filePath).toString('base64'),
          projectId,
          path: filePath,
          name: path.basename(filePath),
          size: stats.size,
          createdAt: stats.birthtimeMs,
          modifiedAt: stats.mtimeMs,
          type: 'file',
          extension: path.extname(filePath).slice(1),
          parentPath: path.dirname(filePath) !== '.' ? path.dirname(filePath) : undefined,
        },
        content: body.content,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to update file:', error);
    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update file',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/files/[...path]
 * Delete a file
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id: projectId, path: pathSegments } = await params;
    const filePath = pathSegments.join('/');

    // Get full file path
    const filesDir = getProjectFilesPath(projectId);
    const fullPath = path.join(filesDir, filePath);

    // Security check
    const normalizedPath = path.normalize(fullPath);
    if (!normalizedPath.startsWith(filesDir)) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_PATH',
            message: 'Invalid file path',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'File not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Delete file
    await fs.unlink(fullPath);

    return NextResponse.json<ApiResponse<{ deleted: boolean }>>({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to delete file:', error);
    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete file',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
