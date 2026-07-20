/**
 * POST /api/project/create/start
 * Start a new project creation session
 *
 * @see docs/specs/epic-C/story-C.5/api-design.md
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  StartProjectCreationRequestSchema,
} from '@originos/core/types';
import { projectCreationService } from '@originos/core/lib/features/project/project-creation-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validated = StartProjectCreationRequestSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid request body',
            details: validated.error.errors,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { session, question } = await projectCreationService.startSession(validated.data);

    return NextResponse.json({
      sessionId: session.sessionId,
      projectId: session.projectId,
      currentStep: session.currentStep,
      question,
      progress: {
        current: session.currentStep,
        total: session.maxSteps,
        percentage: 25,
      },
    });
  } catch (error) {
    console.error('[Project Creation] Start error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'START_FAILED',
          message: error instanceof Error ? error.message : 'Failed to start project creation',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
