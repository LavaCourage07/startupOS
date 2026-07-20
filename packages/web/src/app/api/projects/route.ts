/**
 * API Route: Projects
 * GET /api/projects - List projects
 * POST /api/projects - Create a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@originos/core/lib/features/services/project-service-real';
import type { ApiResponse, ProjectListItem, CreateProjectRequest } from '@originos/core/types';

/**
 * GET /api/projects
 *
 * List projects with optional filtering
 *
 * Query params:
 * - status: Filter by status (active, archived, etc.)
 * - userId: Filter by user ID
 * - domain: Filter by domain (substring match)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 *
 * Response:
 * {
 *   success: true,
 *   data: ProjectListItem[],
 *   timestamp: string
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = {
      status: searchParams.get('status') as 'active' | 'archived' | undefined,
      userId: searchParams.get('userId') || undefined,
      domain: searchParams.get('domain') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '20', 10),
    };

    const projects = await projectService.listProjects(query);

    return NextResponse.json<ApiResponse<ProjectListItem[]>>(
      {
        success: true,
        data: projects,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error('Error listing projects:', error);

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
 * POST /api/projects
 *
 * Create a new project
 *
 * Request body:
 * {
 *   name: string,
 *   description?: string,
 *   domain: string,
 *   type?: string,
 *   userId?: string,
 *   ontologyId?: string,
 *   status?: string,
 *   color?: string,
 *   icon?: string,
 *   metadata?: object
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: Project,
 *   timestamp: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateProjectRequest = await request.json();

    // Validation
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Project name is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (body.name.trim().length === 0) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Project name cannot be empty',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!body.domain || typeof body.domain !== 'string') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Project domain is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const project = await projectService.createProject(body);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: project,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating project:', error);

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
