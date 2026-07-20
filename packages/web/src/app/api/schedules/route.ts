import { NextRequest, NextResponse } from 'next/server';
import { SchedulerService, type CreateScheduledTaskInput, type ScheduledTask } from '@originos/core/modules/scheduler';
import type { ApiResponse } from '@originos/core/types';

const scheduler = new SchedulerService();

export async function GET() {
  try {
    const tasks = await scheduler.listTasks();
    return NextResponse.json<ApiResponse<{ tasks: ScheduledTask[] }>>({
      success: true,
      data: { tasks },
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateScheduledTaskInput;
    if (!body.title || !body.trigger || !body.action) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'title, trigger, and action are required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const task = await scheduler.createTask(body);
    return NextResponse.json<ApiResponse<{ task: ScheduledTask }>>(
      {
        success: true,
        data: { task },
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
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
