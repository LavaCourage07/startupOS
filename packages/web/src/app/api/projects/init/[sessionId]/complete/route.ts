/**
 * API Route: Complete Project Initialization Session
 * POST /api/projects/init/[sessionId]/complete
 *
 * Finalizes a project initialization interview and activates the project
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

    // Complete the interview
    const session = await projectInitializationSkill.completeInterview(sessionId);

    if (!session) {
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
        data: {
          sessionId,
          status: 'completed',
          projectId: session.projectContext?.projectId,
          projectName: session.projectContext?.projectName,
          projectEntityId: session.projectContext?.projectEntityId,
        },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error completing project initialization:', error);

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
