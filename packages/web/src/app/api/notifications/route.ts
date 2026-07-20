/**
 * API Route: Notifications Management
 * GET /api/notifications - List all notifications
 * POST /api/notifications - Create a new notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNotificationManager, NotificationType, NotificationStatus } from '@originos/core/lib/integrations/pi-agent/notification-system';
import type { ApiResponse } from '@originos/core/types';

/**
 * GET /api/notifications
 * List all notifications with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as NotificationStatus | null;
    const type = searchParams.get('type') as NotificationType | null;
    const sessionId = searchParams.get('sessionId');
    const projectId = searchParams.get('projectId');

    const notificationManager = getNotificationManager();

    const notifications = await notificationManager.listNotifications({
      status: status || undefined,
      type: type || undefined,
      sessionId: sessionId || undefined,
      projectId: projectId || undefined,
    });

    return NextResponse.json<ApiResponse<{ notifications: typeof notifications }>>(
      {
        success: true,
        data: { notifications },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error listing notifications:', error);

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
 * POST /api/notifications
 * Create a new notification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.type || !body.title || !body.message) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'type, title, and message are required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const notificationManager = getNotificationManager();

    const notification = await notificationManager.createNotification(
      body.type as NotificationType,
      body.title,
      body.message,
      body.payload || {},
      {
        sessionId: body.sessionId,
        projectId: body.projectId,
      }
    );

    return NextResponse.json<ApiResponse<{ notification: typeof notification }>>(
      {
        success: true,
        data: { notification },
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating notification:', error);

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
