/**
 * GET /api/project/create/[sessionId]/status
 * Get session status
 *
 * @see docs/specs/epic-C/story-C.5/api-design.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectCreationService } from '@originos/core/lib/features/project/project-creation-service';
import { calculateProgress } from '@originos/core/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const { session, canResume } = await projectCreationService.getSessionStatus(sessionId);

    return NextResponse.json({
      sessionId: session.sessionId,
      projectId: session.projectId,
      status: session.status,
      currentStep: session.currentStep,
      progress: {
        current: session.currentStep,
        total: session.maxSteps,
        percentage: calculateProgress(session.currentStep, session.maxSteps),
      },
      data: {
        name: session.data.name ?? undefined,
        background: session.data.background ?? undefined,
        priorities: session.data.priorities.length > 0 ? session.data.priorities : undefined,
        workMode: session.data.workMode ?? undefined,
      },
      canResume,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error('[Project Creation] Get status error:', error);

    const errorCode = error instanceof Error ? error.message : 'GET_STATUS_FAILED';
    const statusCode = errorCode === 'SESSION_NOT_FOUND' ? 404 : 500;

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Failed to get session status',
        },
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }
}
