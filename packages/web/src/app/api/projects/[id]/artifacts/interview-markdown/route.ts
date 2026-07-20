/**
 * API Route: Interview Markdown File
 * POST /api/projects/{projectId}/artifacts/interview-markdown
 *   - Saves interview progress markdown content
 * GET /api/projects/{projectId}/artifacts/interview-markdown
 *   - Retrieves interview progress markdown content
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { ApiResponse } from '@originos/core/types';
import { getDataRoot } from '@originos/core/lib/paths';

// Interview markdown file path
function getInterviewMarkdownPath(projectId: string): string {
  const outputDir = path.join(getDataRoot(), 'projects', projectId, 'output');
  return path.join(outputDir, 'interview-progress.md');
}

/**
 * GET - Retrieve interview markdown content
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const filePath = getInterviewMarkdownPath(projectId);

    // Check if file exists
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return NextResponse.json<ApiResponse<{ content: string }>>(
        {
          success: true,
          data: { content },
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    } catch (error) {
      // File doesn't exist yet
      return NextResponse.json<ApiResponse<{ content: string }>>(
        {
          success: true,
          data: { content: '' },
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('[InterviewMarkdown] Error loading markdown:', error);

    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Save interview markdown content
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const filePath = getInterviewMarkdownPath(projectId);

    const body = await _request.json();
    const { content } = body;

    if (typeof content !== 'string') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Content must be a string',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Ensure output directory exists
    const outputDir = path.dirname(filePath);
    await fs.mkdir(outputDir, { recursive: true });

    // Write content to file
    await fs.writeFile(filePath, content, 'utf-8');

    console.log('[InterviewMarkdown] Saved interview markdown for project:', projectId);

    return NextResponse.json<ApiResponse<{ path: string }>>(
      {
        success: true,
        data: { path: filePath },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[InterviewMarkdown] Error saving markdown:', error);

    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
