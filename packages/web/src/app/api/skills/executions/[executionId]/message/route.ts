/**
 * API Route: Send Message to Skill Execution
 * POST /api/skills/executions/[executionId]/message
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  sendSkillExecutionMessage,
  SkillServiceError,
  streamSkillExecutionMessage,
} from '@originos/core/lib/features/skills';
import type { ApiResponse } from '@originos/core/types';
import type { SkillExecutionMessageResponse } from '@originos/core/lib/features/skills';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> },
) {
  try {
    const { executionId } = await params;
    const body = await request.json();
    const acceptHeader = request.headers.get('accept') || '';
    const wantsStreaming = acceptHeader.includes('text/event-stream');

    if (!wantsStreaming) {
      const result = await sendSkillExecutionMessage({
        executionId,
        sessionId: body.sessionId,
        content: body.content,
        role: body.role,
        metadata: body.metadata,
      });

      return NextResponse.json<ApiResponse<SkillExecutionMessageResponse>>(
        {
          success: true,
          data: result.data,
          ...(result.error ? { error: result.error } : {}),
          timestamp: new Date().toISOString(),
        },
        { status: result.status },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          await streamSkillExecutionMessage(
            {
              executionId,
              sessionId: body.sessionId,
              content: body.content,
              role: body.role,
              metadata: body.metadata,
            },
            (event) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            },
          );
        } catch (error) {
          const errorEvent = {
            executionId,
            type: 'error',
            data: {
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error sending message to skill execution:', error);
    const status = error instanceof SkillServiceError ? error.status : 500;

    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: error instanceof SkillServiceError ? error.code : 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      },
      { status },
    );
  }
}
