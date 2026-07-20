/**
 * API Route: Export Project
 * GET /api/projects/[id]/export
 *
 * Export a project as JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@originos/core/lib/features/services/project-service-real';
import type { ApiResponse } from '@originos/core/types';

/**
 * GET /api/projects/[id]/export
 *
 * Export a project as downloadable JSON file
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const exportJson = await projectService.exportProject(id);

    const project = await projectService.getProject(id);
    const filename = project ? `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.json` : 'project_export.json';

    return new NextResponse(exportJson, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting project:', error);

    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
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
