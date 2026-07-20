/**
 * API Route: Get Skill Execution Timeline
 * GET /api/skills/executions/[executionId]/timeline?sessionId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSkillExecutionTimeline,
  SkillServiceError,
} from '@originos/core/lib/features/skills';
import type {
  SkillExecutionTimelineResponse,
} from '@originos/core/lib/features/skills';
import type { ApiResponse } from '@originos/core/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> },
) {
  try {
    const { executionId } = await params;
    const { searchParams } = new URL(request.url);
    const data = await getSkillExecutionTimeline({
      executionId,
      sessionId: searchParams.get('sessionId') ?? undefined,
    });

    return NextResponse.json<ApiResponse<SkillExecutionTimelineResponse>>(
      {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error getting skill execution timeline:', error);
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
