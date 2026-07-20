/**
 * API Route: Notification Detail
 * GET /api/notifications/{id} - Get notification by ID
 * PATCH /api/notifications/{id} - Update notification status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNotificationManager, NotificationStatus } from '@originos/core/lib/integrations/pi-agent/notification-system';
import type { ApiResponse } from '@originos/core/types';

/**
 * GET /api/notifications/{id}
 * Get notification by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const notificationManager = getNotificationManager();
    const notification = await notificationManager.getNotification(id);

    if (!notification) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Notification not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse<{ notification: typeof notification }>>(
      {
        success: true,
        data: { notification },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error fetching notification:', error);

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
 * PATCH /api/notifications/{id}
 * Update notification status
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await _request.json();

    if (!body.status) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'status is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const notificationManager = getNotificationManager();
    const notification = await notificationManager.updateNotificationStatus(
      id,
      body.status as NotificationStatus
    );

    if (!notification) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Notification not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse<{ notification: typeof notification }>>(
      {
        success: true,
        data: { notification },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error updating notification:', error);

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
