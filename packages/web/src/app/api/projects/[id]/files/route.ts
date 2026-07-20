import { NextRequest, NextResponse } from 'next/server';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import type { ApiResponse } from '@originos/core/types';
import type { FileListResponse, ProjectFile } from '@originos/core/types';
import { getDataRoot, getMonorepoRoot } from '@originos/core/lib/paths';

const PROJECTS_DIR = path.join(getDataRoot(), 'projects');
const AGENTS_DIR = path.join(getDataRoot(), 'agents');
const SKILLS_DIR = path.join(getDataRoot(), 'skills');
const BUNDLED_SKILLS_DIR = path.join(getMonorepoRoot(), 'skills');

/**
 * Resolve the files directory based on the project ID prefix pattern
 */
function resolveFilesDir(projectId: string): string | null {
  if (projectId.startsWith('project-')) {
    return path.join(PROJECTS_DIR, projectId.slice('project-'.length));
  }
  if (projectId.startsWith('agent-')) {
    return path.join(AGENTS_DIR, projectId.slice('agent-'.length));
  }
  if (projectId.startsWith('skill-')) {
    const code = projectId.slice('skill-'.length);
    const userSkillsPath = path.join(SKILLS_DIR, code);
    if (existsSync(userSkillsPath)) return userSkillsPath;
    const bundledPath = path.join(BUNDLED_SKILLS_DIR, code);
    if (existsSync(bundledPath)) return bundledPath;
    return null;
  }
  if (existsSync(path.join(PROJECTS_DIR, projectId))) {
    return path.join(PROJECTS_DIR, projectId);
  }
  return null;
}

/**
 * Scan directory recursively and build file list
 */
async function scanDirectory(
  dirPath: string,
  projectId: string,
  relativePath: string = ''
): Promise<ProjectFile[]> {
  const files: ProjectFile[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.join(relativePath, entry.name);
      const stats = await fs.stat(fullPath);

      const file: ProjectFile = {
        id: Buffer.from(relPath).toString('base64'),
        projectId,
        path: relPath,
        name: entry.name,
        size: entry.isDirectory() ? 0 : stats.size,
        createdAt: stats.birthtimeMs,
        modifiedAt: stats.mtimeMs,
        type: entry.isDirectory() ? 'folder' : 'file',
        extension: entry.isFile() ? path.extname(entry.name).slice(1) : undefined,
        parentPath: relativePath || undefined,
      };

      files.push(file);

      // Recursively scan subdirectories
      if (entry.isDirectory()) {
        const subFiles = await scanDirectory(fullPath, projectId, relPath);
        files.push(...subFiles);
      }
    }
  } catch (error) {
    // Directory doesn't exist or is empty
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return files;
}

/**
 * GET /api/projects/[id]/files
 * List all files in a project
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id: projectId } = await params;

    const filesDir = resolveFilesDir(projectId);
    if (!filesDir) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Unknown entry type for "${projectId}"`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Scan directory
    const files = await scanDirectory(filesDir, projectId);

    // Sort by modified time (newest first)
    files.sort((a, b) => b.modifiedAt - a.modifiedAt);

    return NextResponse.json<ApiResponse<FileListResponse>>({
      success: true,
      data: {
        files,
        total: files.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to list project files:', error);
    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to list files',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/files
 * Create a new file
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id: projectId } = await params;
    const body = await _request.json();

    // Validate _request
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'File name is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Default to .md extension if not provided
    let fileName = body.name;
    if (!path.extname(fileName)) {
      fileName += '.md';
    }

    // Get file path
    const filesDir = resolveFilesDir(projectId);
    if (!filesDir) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: `Unknown entry type for "${projectId}"` },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }
    const filePath = path.join(filesDir, fileName);

    // Check if file already exists
    try {
      await fs.access(filePath);
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'FILE_EXISTS',
            message: 'File already exists',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    } catch {
      // File doesn't exist, continue
    }

    // Ensure directory exists
    await fs.mkdir(filesDir, { recursive: true });

    // Create file with initial content
    const content = body.content || '';
    await fs.writeFile(filePath, content, 'utf-8');

    // Get file stats
    const stats = await fs.stat(filePath);

    const file: ProjectFile = {
      id: Buffer.from(fileName).toString('base64'),
      projectId,
      path: fileName,
      name: fileName,
      size: stats.size,
      createdAt: stats.birthtimeMs,
      modifiedAt: stats.mtimeMs,
      type: 'file',
      extension: path.extname(fileName).slice(1),
    };

    return NextResponse.json<ApiResponse<ProjectFile>>({
      success: true,
      data: file,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to create file:', error);
    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create file',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
