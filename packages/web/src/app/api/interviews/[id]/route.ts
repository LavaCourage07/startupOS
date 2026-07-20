/**
 * API Route: Get Interview by ID
 * GET /api/interviews/[id]
 *
 * Get a single interview session
 */

import { NextRequest, NextResponse } from 'next/server';
import { interviewService } from '@originos/core/lib/features/ontology';
import type { ApiResponse } from '@originos/core/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const interview = await interviewService.getInterview(id);

    if (!interview) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Interview not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: interview,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error getting interview:', error);

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
 * API Route: Delete Interview
 * DELETE /api/interviews/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const deleted = await interviewService.deleteInterview(id);

    if (!deleted) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Interview not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse<{ deleted: true }>>(
      {
        success: true,
        data: { deleted: true },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error deleting interview:', error);

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
