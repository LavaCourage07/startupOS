/**
 * API Route: Submit Interview Answers
 * PUT /api/interviews/[id]/answers
 *
 * Submit answers to interview questions
 */

import { NextRequest, NextResponse } from 'next/server';
import { interviewService } from '@originos/core/lib/features/ontology';
import type { ApiResponse, UpdateInterviewRequest } from '@originos/core/types';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body: UpdateInterviewRequest = await request.json();

    if (!body.answers || typeof body.answers !== 'object') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'answers is required and must be an object',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const interview = await interviewService.submitAnswers(id, body.answers as Record<string, string | string[]>);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: interview,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error submitting answers:', error);

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
