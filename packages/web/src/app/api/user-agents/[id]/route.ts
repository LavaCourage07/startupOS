/**
 * API Route: Delete User Agent
 * DELETE /api/user-agents/{id} - Delete a user-created agent from data/agents/
 */

import { NextResponse } from 'next/server';
import { deleteUserAgent } from '@originos/core/lib/features/user-registry';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = deleteUserAgent(params.id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: `Agent "${params.id}" not found`, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      data: { agentId: params.id },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error deleting user agent:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
