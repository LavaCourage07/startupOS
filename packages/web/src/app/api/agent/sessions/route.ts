/**
 * API Route: List Agent Sessions
 * GET /api/agent/sessions?projectId=xxx
 *
 * List all agent sessions, optionally filtered by project
 */

import { NextRequest, NextResponse } from 'next/server';
import { mkdirSync } from 'fs';
import { agentSessionService } from '@originos/core/lib/features/agent';
import { persistRuntimeLLMConfig, readUserConfig } from '@originos/core/lib/features/user-config';
import type { ApiResponse } from '@originos/core/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    const sessions = await agentSessionService.listSessions(
      projectId ?? undefined,
    );

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          sessions,
          count: sessions.length,
        },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error listing sessions:', error);

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

/**
 * API Route: Create New Session
 * POST /api/agent/sessions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.projectId || !body.projectName) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'projectId and projectName are required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    persistRuntimeLLMConfig(body.llmConfig);

    // 从用户配置中读取 mapping 并合并到 llmConfig
    const userConfig = readUserConfig();
    const llmConfigWithMapping = {
      ...body.llmConfig,
      ...(userConfig.llm?.mapping && !body.llmConfig?.mapping ? { mapping: userConfig.llm.mapping } : {}),
    };

    // If sessionId provided, return existing session if it exists
    if (body.sessionId) {
      const existing = await agentSessionService.getSession(body.sessionId, body.projectId);
      if (existing) {
        existing.projectContext = {
          ...existing.projectContext,
          ...body.projectContext,
          ...(body.agentBaseDir ? { currentPath: body.agentBaseDir } : {}),
          ...(body.outputDir ? { outputDir: body.outputDir } : {}),
        };
        if (body.agentType) existing.agentType = body.agentType;
        if (body.llmConfig) existing.llmConfig = llmConfigWithMapping;
        await agentSessionService.saveSession(existing);
        return NextResponse.json<ApiResponse>(
          { success: true, data: existing, timestamp: new Date().toISOString() },
          { status: 200 },
        );
      }
    }

    // 确保 agentBaseDir 目录存在（bash-tools 在目录不存在时会回退到 cwd）
    if (body.agentBaseDir) {
      mkdirSync(body.agentBaseDir, { recursive: true });
    }

    const createRequest = {
      projectId: body.projectId,
      projectName: body.projectName,
      systemPrompt: body.systemPrompt,
      agentType: body.agentType,
      projectContext: {
        ...body.projectContext,
        ...(body.agentBaseDir ? { currentPath: body.agentBaseDir } : {}),
        ...(body.outputDir ? { outputDir: body.outputDir } : {}),
      },
      sessionId: body.sessionId,
      llmConfig: llmConfigWithMapping,
    };

    const session = await agentSessionService.createSession(createRequest);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: session,
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating session:', error);

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
