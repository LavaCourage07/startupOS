/**
 * API Route: User Agents
 * GET /api/user-agents - List user-created agents/roles from data/agents/
 */

import { NextResponse } from 'next/server';
import { listUserAgents } from '@originos/core/lib/features/user-registry';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: { agents: listUserAgents() },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error listing user agents:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
