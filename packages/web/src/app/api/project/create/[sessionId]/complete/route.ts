/**
 * POST /api/project/create/[sessionId]/complete
 * Complete project creation
 *
 * @see docs/specs/epic-C/story-C.5/api-design.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { CompleteCreationRequestSchema } from '@originos/core/types';
import { projectCreationService } from '@originos/core/lib/features/project/project-creation-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();

    // Validate request
    const validated = CompleteCreationRequestSchema.safeParse({
      ...body,
      sessionId,
    });

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid request format',
            details: validated.error.errors,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check project name
    if (!validated.data.projectName || validated.data.projectName.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROJECT_NAME_REQUIRED',
            message: 'Project name is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const result = await projectCreationService.completeCreation(
      sessionId,
      validated.data
    );

    return NextResponse.json({
      success: true,
      project: result.project,
      taste: result.taste,
      ontology: result.ontology,
    });
  } catch (error) {
    console.error('[Project Creation] Complete error:', error);

    const errorCode = error instanceof Error ? error.message : 'COMPLETE_FAILED';
    const statusCode = errorCode === 'SESSION_NOT_FOUND' ? 404 :
                       errorCode === 'SESSION_EXPIRED' ? 410 : 500;

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : 'Failed to complete project creation',
        },
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }
}
