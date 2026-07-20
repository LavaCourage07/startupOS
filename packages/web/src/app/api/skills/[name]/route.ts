/**
 * API Route: Skill by Name
 * GET /api/skills/:name - Get skill details
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadSkills, loadSkillContent } from '@originos/core/lib/integrations/pi-agent/core/skills';
import type {
  ApiResponse,
} from '@originos/core/types';

interface SkillDetail {
  name: string;
  description: string;
  source: string;
  filePath: string;
  baseDir: string;
  disableModelInvocation: boolean;
  content: string;
  frontmatter: Record<string, unknown>;
}

/**
 * GET /api/skills/:name
 *
 * Get detailed information about a specific skill
 *
 * Params:
 * - name: Skill name
 *
 * Query params:
 * - includeInvisible: Return skill even if disableModelInvocation=true (default: true)
 *
 * Response:
 * {
 *   success: true,
 *   data: SkillDetail,
 *   timestamp: string
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const name = params.name;
    const { searchParams } = new URL(request.url);
    const includeInvisible = searchParams.get('includeInvisible') !== 'false';

    // Load all skills and find the matching one
    const result = loadSkills({ includeDefaults: true });
    const skill = result.skills.find((s) => s.name === name);

    if (!skill) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Skill "${name}" not found`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check if skill is disabled and we shouldn't include invisible skills
    if (skill.disableModelInvocation && !includeInvisible) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'DISABLED',
            message: `Skill "${name}" has disableModelInvocation enabled`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Load skill content
    const { frontmatter, body } = loadSkillContent(skill);

    const detail: SkillDetail = {
      name: skill.name,
      description: skill.description,
      source: skill.source,
      filePath: skill.filePath,
      baseDir: skill.baseDir,
      disableModelInvocation: skill.disableModelInvocation,
      content: body,
      frontmatter,
    };

    return NextResponse.json<ApiResponse<SkillDetail>>(
      {
        success: true,
        data: detail,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error(`Error fetching skill ${params.name}:`, error);

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
