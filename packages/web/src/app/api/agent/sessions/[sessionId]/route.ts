/**
 * API Route: Get Agent Session
 * GET /api/agent/sessions/{sessionId}
 *
 * Load a specific agent session
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

    // Get projectId from query params if provided
    const { searchParams } = new URL(_request.url);
    const projectId = searchParams.get('projectId') || undefined;

    const session = await agentSessionService.getSession(sessionId, projectId);

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

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: session,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error getting session:', error);

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
 * API Route: Update Session
 * PUT /api/agent/sessions/{sessionId}
 */
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await _request.json();

    // Get projectId from query params if provided
    const { searchParams } = new URL(_request.url);
    const projectId = searchParams.get('projectId') || undefined;

    const session = await agentSessionService.updateSession(sessionId, body, projectId);

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

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: session,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error updating session:', error);

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
 * API Route: Delete Session
 * DELETE /api/agent/sessions/{sessionId}
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;

    const deleted = await agentSessionService.deleteSession(sessionId);

    if (!deleted) {
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

    return NextResponse.json<ApiResponse<{ deleted: true }>>(
      {
        success: true,
        data: { deleted: true },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error deleting session:', error);

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
