/**
 * API Route: Get Project Initialization Context
 * GET /api/projects/init/[sessionId]/context
 *
 * Retrieves the current state and context of a project initialization session
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectInitializationSkill } from '@originos/core/lib/features/skills/project-initialization';
import type { ApiResponse } from '@originos/core/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const { sessionId } = params;

    // Get interview context
    const context = await projectInitializationSkill.getInterviewContext(sessionId);

    if (!context) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: context,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error getting project initialization context:', error);

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
