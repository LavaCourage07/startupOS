/**
 * API Route: Skill Executions
 * POST /api/skills/executions - Start a skill execution
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  SkillServiceError,
  startSkillExecution,
} from '@originos/core/lib/features/skills';
import type {
  SkillExecutionStartRequest,
  SkillExecutionStartResponse,
} from '@originos/core/lib/features/skills';
import type { ApiResponse } from '@originos/core/types';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SkillExecutionStartRequest;
    const result = await startSkillExecution(body);

    return NextResponse.json<ApiResponse<SkillExecutionStartResponse>>(
      {
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      },
      { status: result.status },
    );
  } catch (error) {
    console.error('Error starting skill execution:', error);
    const status = error instanceof SkillServiceError ? error.status : 500;

    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: error instanceof SkillServiceError ? error.code : 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      },
      { status },
    );
  }
}
