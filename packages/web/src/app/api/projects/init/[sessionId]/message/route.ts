/**
 * API Route: Send Message to Project Initialization Session
 * POST /api/projects/init/[sessionId]/message
 *
 * Processes a user message in the project initialization interview
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectInitializationSkill } from '@originos/core/lib/features/skills/project-initialization';
import type { ApiResponse } from '@originos/core/types';

interface SendMessageBody {
  message: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const { sessionId } = params;
    const body = await request.json() as SendMessageBody;

    // Validate required fields
    if (!body.message) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'message is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // Process the message
    const response = await projectInitializationSkill.processMessage(
      sessionId,
      body.message,
    );

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          response,
          sessionId,
        },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error processing message:', error);

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
