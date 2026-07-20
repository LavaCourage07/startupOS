/**
 * API Route: Create Interview
 * POST /api/interviews
 *
 * Create a new interview session
 */

import { NextRequest, NextResponse } from 'next/server';
import { interviewService } from '@originos/core/lib/features/ontology';
import type { CreateInterviewRequest, ApiResponse } from '@originos/core/types';

export async function POST(request: NextRequest) {
  try {
    const body: CreateInterviewRequest = await request.json();

    // Validate request
    if (!body.projectId) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'projectId is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const interview = await interviewService.createInterview(
      body.projectId,
      body.skipOptionalQuestions ?? false,
    );

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: interview,
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating interview:', error);

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

/**
 * API Route: List Interviews
 * GET /api/interviews?projectId=xxx
 *
 * List all interviews for a project
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'projectId query parameter is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const interviews = await interviewService.getProjectInterviews(projectId);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: interviews,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error listing interviews:', error);

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
