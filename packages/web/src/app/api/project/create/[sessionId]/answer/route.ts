/**
 * POST /api/project/create/[sessionId]/answer
 * Submit answer for current step
 *
 * @see docs/specs/epic-C/story-C.5/api-design.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { SubmitAnswerRequestSchema, calculateProgress } from '@originos/core/types';
import { projectCreationService } from '@originos/core/lib/features/project/project-creation-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();

    // Validate request
    const validated = SubmitAnswerRequestSchema.safeParse({
      ...body,
      sessionId,
    });

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ANSWER',
            message: 'Invalid answer format',
            details: validated.error.errors,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { session, nextQuestion } = await projectCreationService.submitAnswer(
      sessionId,
      validated.data
    );

    return NextResponse.json({
      sessionId: session.sessionId,
      step: validated.data.step,
      saved: true,
      nextStep: session.currentStep > validated.data.step ? session.currentStep : null,
      nextQuestion: nextQuestion ?? undefined,
      progress: {
        current: session.currentStep,
        total: session.maxSteps,
        percentage: calculateProgress(session.currentStep, session.maxSteps),
      },
    });
  } catch (error) {
    console.error('[Project Creation] Submit answer error:', error);

    const errorCode = error instanceof Error ? error.message : 'SUBMIT_ANSWER_FAILED';
    const statusCode = errorCode === 'SESSION_NOT_FOUND' ? 404 :
                       errorCode === 'SESSION_EXPIRED' ? 410 :
                       errorCode === 'INVALID_STEP' ? 400 : 500;

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Failed to submit answer',
        },
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }
}
