import { NextResponse } from 'next/server';
import { SchedulerService } from '@originos/core/modules/scheduler';
import type { ScheduledTask, UpdateScheduledTaskInput } from '@originos/core/modules/scheduler';
import type { ApiResponse } from '@originos/core/types';

const scheduler = new SchedulerService();

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as UpdateScheduledTaskInput;
    const task = await scheduler.updateTask(params.id, body);
    return NextResponse.json<ApiResponse<{ task: ScheduledTask }>>({
      success: true,
      data: { task },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const notFound = message.includes('Scheduled task not found');
    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: notFound ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message,
        },
        timestamp: new Date().toISOString(),
      },
      { status: notFound ? 404 : 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const deleted = await scheduler.deleteTask(params.id);
    if (!deleted) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled task not found' },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse<{ deleted: true }>>({
      success: true,
      data: { deleted: true },
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
