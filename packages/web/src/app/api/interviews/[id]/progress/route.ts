/**
 * API Route: Get Interview Progress
 * GET /api/interviews/[id]/progress
 *
 * Get interview progress information
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

    const progress = await interviewService.getProgress(id);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          interviewId: id,
          ...progress,
        },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error getting progress:', error);

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
