import { NextRequest, NextResponse } from 'next/server';
import { DefaultSchedulerActionRunner, SchedulerService, type ScheduledTaskRun } from '@originos/core/modules/scheduler';
import type { ApiResponse } from '@originos/core/types';

const scheduler = new SchedulerService(undefined, new DefaultSchedulerActionRunner());

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const run = await scheduler.runTask(params.id);
    return NextResponse.json<ApiResponse<{ run: ScheduledTaskRun }>>({
      success: true,
      data: { run },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
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
