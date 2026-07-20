/**
 * API Route: Import Project
 * POST /api/projects/import
 *
 * Import a project from JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@originos/core/lib/features/services/project-service-real';
import type { ApiResponse } from '@originos/core/types';

/**
 * POST /api/projects/import
 *
 * Import a project from uploaded JSON
 *
 * Request body:
 * {
 *   exportJson: string,
 *   overwrite?: boolean,
 *   newId?: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.exportJson || typeof body.exportJson !== 'string') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'exportJson is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const options = {
      overwrite: body.overwrite || false,
      newId: body.newId || false,
    };

    const project = await projectService.importProject(body.exportJson, options);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: project,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error importing project:', error);

    if (error instanceof Error && error.message === 'Invalid export format') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid export format',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
