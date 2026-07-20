/**
 * API Route: Get Session Summary
 * GET /api/agent/sessions/{sessionId}/summary
 *
 * Get summary statistics for a session
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentSessionService } from '@originos/core/lib/features/agent';
import type { ApiResponse } from '@originos/core/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;

    const summary = await agentSessionService.getSessionSummary(sessionId);

    if (!summary) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error getting summary:', error);

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
