/**
 * API Route: Complete Skill Execution
 * POST /api/skills/executions/[executionId]/complete
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  completeSkillExecution,
  SkillServiceError,
} from '@originos/core/lib/features/skills';
import type {
  SkillExecutionCompleteRequest,
  SkillExecutionCompleteResponse,
} from '@originos/core/lib/features/skills';
import type { ApiResponse } from '@originos/core/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> },
) {
  try {
    const { executionId } = await params;
    const body = (await request.json()) as Omit<SkillExecutionCompleteRequest, 'executionId'>;
    const data = await completeSkillExecution({
      ...body,
      executionId,
    });

    return NextResponse.json<ApiResponse<SkillExecutionCompleteResponse>>(
      {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error completing skill execution:', error);
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
