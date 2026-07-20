/**
 * API Route: Project Agent Definition
 * GET /api/projects/{id}/agent - Get project agent definition
 *
 * Returns project-specific agent.md or default template
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { ApiResponse } from '@originos/core/types';
import { getDataRoot, getMonorepoRoot } from '@originos/core/lib/paths';

const DEFAULT_AGENT_PATH = path.join(getMonorepoRoot(), 'src/lib/agents/definitions/project-agent.md');

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await params;

    // 项目 agents 目录路径
    const projectDir = path.join(getDataRoot(), 'projects', projectId);
    const agentsDir = path.join(projectDir, 'agents');
    const agentMdPath = path.join(agentsDir, 'agent.md');

    // 检查项目特定的 agent.md 是否存在
    if (existsSync(agentMdPath)) {
      const content = await readFile(agentMdPath, 'utf-8');
      return NextResponse.json<ApiResponse<{ content: string; source: 'project' }>>(
        {
          success: true,
          data: {
            content,
            source: 'project',
          },
          timestamp: new Date().toISOString(),
        },
      );
    }

    // 返回默认模板
    const defaultContent = await readFile(DEFAULT_AGENT_PATH, 'utf-8');
    return NextResponse.json<ApiResponse<{ content: string; source: 'default' }>>(
      {
        success: true,
        data: {
          content: defaultContent,
          source: 'default',
        },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('[Agent Definition API] Error:', error);

    // 即使出错也返回默认模板
    try {
      const defaultContent = await readFile(DEFAULT_AGENT_PATH, 'utf-8');
      return NextResponse.json<ApiResponse<{ content: string; source: 'default' }>>(
        {
          success: true,
          data: {
            content: defaultContent,
            source: 'default',
          },
          timestamp: new Date().toISOString(),
        },
      );
    } catch {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to load agent definition',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await params;
    const body = await _request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'content is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // 确保 agents 目录存在
    const projectDir = path.join(getDataRoot(), 'projects', projectId);
    const agentsDir = path.join(projectDir, 'agents');

    try {
      await mkdir(agentsDir, { recursive: true });
    } catch {
      // Directory might already exist, ignore
    }

    // 写入 agent.md
    const agentMdPath = path.join(agentsDir, 'agent.md');
    await writeFile(agentMdPath, content, 'utf-8');

    return NextResponse.json<ApiResponse<{ saved: true }>>(
      {
        success: true,
        data: { saved: true },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('[Agent Definition API] Error saving:', error);

    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
