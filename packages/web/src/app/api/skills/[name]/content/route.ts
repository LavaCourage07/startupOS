/**
 * API Route: Skill Content
 * GET /api/skills/:name/content - Get skill content only
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSkillContent, SkillServiceError } from '@originos/core/lib/features/skills';
import type {
  ApiResponse,
} from '@originos/core/types';
import type { SkillContentResponse } from '@originos/core/lib/features/skills';

/**
 * GET /api/skills/:name/content
 *
 * Get raw markdown content of a skill (including frontmatter)
 * Useful for direct skill file reading by agents
 *
 * Params:
 * - name: Skill name
 *
 * Query params:
 * - includeFrontmatter: Include YAML frontmatter in response (default: false)
 * - format: Response format ('raw' or 'json', default: 'raw')
 *
 * Response (format=json):
 * {
 *   success: true,
 *   data: {
 *     content: string,
 *     frontmatter?: object
 *   },
 *   timestamp: string
 * }
 *
 * Response (format=raw, default):
 * Returns raw markdown file content with Content-Type: text/markdown
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const name = params.name;
    const { searchParams } = new URL(request.url);

    const includeFrontmatter = searchParams.get('includeFrontmatter') === 'true';
    const format = (searchParams.get('format') as 'raw' | 'json') || 'raw';

    const data = getSkillContent({ name, includeFrontmatter });

    if (format === 'raw') {
      return new NextResponse(data.content, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    return NextResponse.json<ApiResponse<SkillContentResponse>>(
      {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') as 'raw' | 'json') || 'raw';
    const status = error instanceof SkillServiceError ? error.status : 500;

    if (format === 'raw') {
      return new NextResponse(
        error instanceof SkillServiceError ? error.message : 'Internal error',
        { status }
      );
    }

    console.error(`Error fetching skill content ${params.name}:`, error);

    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: error instanceof SkillServiceError ? error.code : 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date().toISOString(),
      },
      { status }
    );
  }
}
