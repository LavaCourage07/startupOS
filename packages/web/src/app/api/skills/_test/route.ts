/**
 * API Route: Skills Tests
 * POST /api/skills/_test - Test skill loading (development only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadSkills } from '@originos/core/lib/integrations/pi-agent/core/skills';

/**
 * POST /api/skills/_test
 *
 * Test endpoint for skill framework (development only)
 *
 * Response: Diagnostics and skill count
 */
export async function POST(_request: NextRequest) {
  try {
    const result = loadSkills({ includeDefaults: true });

    return NextResponse.json({
      success: true,
      data: {
        totalSkills: result.skills.length,
        diagnosticsCount: result.diagnostics.length,
        errors: result.diagnostics.filter((d) => d.type === 'error').length,
        warnings: result.diagnostics.filter((d) => d.type === 'warning').length,
        collisions: result.diagnostics.filter((d) => d.type === 'collision').length,
        skillsBySource: {
          bundled: result.skills.filter((s) => s.source === 'bundled').length,
          user: result.skills.filter((s) => s.source === 'user').length,
          project: result.skills.filter((s) => s.source === 'project').length,
        },
        diagnostics: result.diagnostics,
        skillNames: result.skills.map((s) => ({
          name: s.name,
          source: s.source,
          filePath: s.filePath,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error testing skills:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
