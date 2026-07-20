/**
 * API Route: Get Project Statistics
 * GET /api/agent/sessions/{sessionId}/statistics
 *
 * Get statistics for a project
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
    const session = await agentSessionService.getSession(sessionId);

    if (!session) {
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

    const projectId = session.projectContext.projectId;
    const statistics = await agentSessionService.getProjectStatistics(projectId);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: statistics,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error getting statistics:', error);

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
