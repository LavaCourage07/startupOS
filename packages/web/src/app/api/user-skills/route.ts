/**
 * API Route: User Skills
 * GET /api/user-skills - List user-created skills from data/skills/
 */

import { NextResponse } from 'next/server';
import { listUserSkills } from '@originos/core/lib/features/user-registry';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: { skills: listUserSkills() },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error listing user skills:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
