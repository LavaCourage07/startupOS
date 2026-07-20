/**
 * API Route: Launch Agent Entry
 *
 * POST /api/launch
 * 统一入口启动端点，根据 entryType 路由到对应的 Launcher
 *
 * Request:
 * {
 *   "entryType": "role-agent" | "project" | "agent" | "skill",
 *   "entryId": "xiaofengjun",
 *   "sessionId": "optional-session-id"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "sessionId": "...",
 *     "agentType": "role-agent",
 *     "systemPrompt": "...",
 *     "baseDir": "...",
 *     "tools": ["read", "write", ...]
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { launch } from '@originos/core/lib/features/services/launcher/registry';
import type { ApiResponse } from '@originos/core/types';
import type { EntryType } from '@originos/core/lib/features/services/launcher/base';

const VALID_ENTRY_TYPES: EntryType[] = ['project', 'agent', 'role-agent', 'skill'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 校验必填字段
    if (!body.entryType) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'entryType is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    if (!body.entryId) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'entryId is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // 校验 entryType 合法性
    if (!VALID_ENTRY_TYPES.includes(body.entryType)) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: `Invalid entryType: ${body.entryType}. Must be one of: ${VALID_ENTRY_TYPES.join(', ')}`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // 调用对应 Launcher
    const result = await launch({
      entryType: body.entryType,
      entryId: body.entryId,
      sessionId: body.sessionId,
      restoreSessionId: body.restoreSessionId,
      agentBaseDir: body.agentBaseDir,
      projectId: body.projectId,
      isWindowBound: body.isWindowBound,
    });

    if (!result.success) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'LAUNCH_FAILED',
            message: result.error || 'Failed to launch entry',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          sessionId: result.sessionId,
          agentType: result.agentType,
          systemPrompt: result.systemPrompt,
          baseDir: result.baseDir,
          tools: result.tools,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[API /launch] Error:', error);

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
