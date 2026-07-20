/**
 * GET /api/project/create/[sessionId]/question
 * Get current question for a session
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

    const session = await projectCreationService.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);
    if (now > expiresAt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session has expired',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 410 }
      );
    }

    const question = projectCreationService.getCurrentQuestion(session);

    return NextResponse.json({
      sessionId: session.sessionId,
      currentStep: session.currentStep,
      question,
      progress: {
        current: session.currentStep,
        total: session.maxSteps,
        percentage: calculateProgress(session.currentStep, session.maxSteps),
      },
      canGoBack: session.currentStep > 1,
      canSkip: question?.allowSkip ?? false,
    });
  } catch (error) {
    console.error('[Project Creation] Get question error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_QUESTION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get question',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
