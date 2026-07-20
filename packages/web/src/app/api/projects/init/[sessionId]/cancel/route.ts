/**
 * API Route: Cancel Project Initialization Session
 * POST /api/projects/init/[sessionId]/cancel
 *
 * Cancels an ongoing project initialization interview
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectInitializationSkill } from '@originos/core/lib/features/skills/project-initialization';
import type { ApiResponse } from '@originos/core/types';

export async function POST(
  _request: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const { sessionId } = params;

    // Cancel the interview
    await projectInitializationSkill.cancelInterview(sessionId);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          sessionId,
          status: 'cancelled',
        },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error cancelling project initialization:', error);

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
