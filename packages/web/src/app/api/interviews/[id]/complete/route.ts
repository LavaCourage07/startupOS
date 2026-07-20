/**
 * API Route: Complete Interview
 * PUT /api/interviews/[id]/complete
 *
 * Mark interview as completed
 */

import { NextRequest, NextResponse } from 'next/server';
import { interviewService } from '@originos/core/lib/features/ontology';
import type { ApiResponse } from '@originos/core/types';

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const interview = await interviewService.completeInterview(id);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: interview,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error completing interview:', error);

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
