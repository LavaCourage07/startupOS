/**
 * API Route: Agent Content
 * GET /api/agents/:id - Get agent content (Agent.md)
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { ApiResponse } from '@originos/core/types';
import { getDataRoot, getClaudeDir } from '@originos/core/lib/paths';

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterText = match![1] ?? '';
  const body = match![2] ?? '';

  // Simple YAML parser for frontmatter
  const frontmatter: Record<string, unknown> = {};
  const lines = frontmatterText.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

/**
 * GET /api/agents/:id
 *
 * Get raw markdown content of an agent's Agent.md file
 * Useful for loading Role Agent entry points
 *
 * Params:
 * - id: Agent ID (directory name in .claude/skills/)
 *
 * Query params:
 * - includeFrontmatter: Include YAML frontmatter in response (default: false)
 * - format: Response format ('raw' or 'json', default: 'raw')
 *
 * Response (format=json):
 * {
 *   success: true,
 *   data: {
 *     content: string,
 *     frontmatter?: object
 *   },
 *   timestamp: string
 * }
 *
 * Response (format=raw, default):
 * Returns raw markdown file content with Content-Type: text/markdown
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const includeFrontmatter = searchParams.get('includeFrontmatter') === 'true';
    const format = (searchParams.get('format') as 'raw' | 'json') || 'raw';

    // Construct path to Agent.md - try data/agents/ first (primary), fallback to .claude/skills/
    const dataAgentDir = path.join(getDataRoot(), 'agents', id);
    const dataAgentFilePath = path.join(dataAgentDir, 'Agent.md');
    const claudeAgentDir = path.join(getClaudeDir(), 'skills', id);
    const claudeAgentFilePath = path.join(claudeAgentDir, 'Agent.md');

    // Check data/agents/ first
    let agentDir: string;
    let agentFilePath: string;

    if (existsSync(dataAgentFilePath)) {
      agentDir = dataAgentDir;
      agentFilePath = dataAgentFilePath;
    } else if (existsSync(claudeAgentFilePath)) {
      agentDir = claudeAgentDir;
      agentFilePath = claudeAgentFilePath;
    } else {
      if (format === 'raw') {
        return new NextResponse('Agent not found', { status: 404 });
      }
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Agent "${id}" not found`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Read raw content
    const rawContent = readFileSync(agentFilePath, 'utf-8');

    if (format === 'raw') {
      return new NextResponse(rawContent, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // JSON format response
    // Agent 产物目录始终指向 data/agents/{id}，与定义源目录分离
    const outputDir = path.join(getDataRoot(), 'agents', id);

    const data: Record<string, unknown> = {
      content: rawContent,
      baseDir: agentDir,
      outputDir,
    };

    if (includeFrontmatter) {
      const { frontmatter } = parseFrontmatter(rawContent);
      data['frontmatter'] = frontmatter;
    }

    return NextResponse.json<ApiResponse<Record<string, unknown>>>(
      {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error(`Error fetching agent content ${(await params).id}:`, error);

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') as 'raw' | 'json') || 'raw';

    if (format === 'raw') {
      return new NextResponse('Internal error', { status: 500 });
    }

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
