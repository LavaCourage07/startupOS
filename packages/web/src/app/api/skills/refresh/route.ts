/**
 * API Route: Skills Refresh
 * POST /api/skills/refresh - Force reload all skills
 */

import { NextRequest, NextResponse } from 'next/server';
import { refreshSkills } from '@originos/core/lib/features/skills';
import type { ApiResponse } from '@originos/core/types';
import type { SkillListResponse } from '@originos/core/lib/features/skills';

/**
 * POST /api/skills/refresh
 *
 * Force reload all skills from disk
 * Useful for development when skills are added/modified
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     skills: SkillListItem[],
 *     diagnostics: SkillDiagnosticItem[]
 *   },
 *   timestamp: string
 * }
 */
export async function POST(_request: NextRequest) {
  try {
    const data = refreshSkills();

    return NextResponse.json<ApiResponse<SkillListResponse>>(
      {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error('Error refreshing skills:', error);

    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
