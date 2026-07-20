/**
 * API Route: Project Details
 * GET /api/projects/[id] - Get a project
 * PUT /api/projects/[id] - Update a project
 * DELETE /api/projects/[id] - Delete a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@originos/core/lib/features/services/project-service-real';
import type { ApiResponse, Project, UpdateProjectRequest } from '@originos/core/types';

/**
 * GET /api/projects/[id]
 *
 * Get a specific project by ID
 *
 * Response:
 * {
 *   success: true,
 *   data: Project,
 *   timestamp: string
 * }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await projectService.getProject(id);

    if (!project) {
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

    return NextResponse.json<ApiResponse<Project>>(
      {
        success: true,
        data: project,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error('Error getting project:', error);

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

/**
 * PUT /api/projects/[id]
 *
 * Update a project
 *
 * Request body:
 * {
 *   name?: string,
 *   description?: string,
 *   status?: string,
 *   ...other fields
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: Project,
 *   timestamp: string
 * }
 */
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates: UpdateProjectRequest = await _request.json();

    // Don't allow changing ID or critical fields
    if ((updates as any).id !== undefined) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Cannot update project ID',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const project = await projectService.updateProject(id, updates);

    if (!project) {
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

    return NextResponse.json<ApiResponse<Project>>(
      {
        success: true,
        data: project,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error('Error updating project:', error);

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

/**
 * DELETE /api/projects/[id]
 *
 * Delete a project
 *
 * Response:
 * {
 *   success: true,
 *   data: { deleted: true },
 *   timestamp: string
 * }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deleted = await projectService.deleteProject(id);

    if (!deleted) {
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

    return NextResponse.json<ApiResponse<{ deleted: true }>>(
      {
        success: true,
        data: { deleted: true },
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error('Error deleting project:', error);

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
