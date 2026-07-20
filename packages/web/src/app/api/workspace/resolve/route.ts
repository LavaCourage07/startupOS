/**
 * GET /api/workspace/resolve?entryType=role-agent&entryId=xxx
 * Resolve workspace directory for an entry (agent, role-agent, project, skill)
 * Returns the absolute baseDir — frontend never constructs paths
 */
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import type { ApiResponse } from '@originos/core/types';
import { loadSkills } from '@originos/core/lib/integrations/pi-agent/core/skills';
import { getDataRoot } from '@originos/core/lib/paths';

const ENTRY_DIR_MAP: Record<string, (entryId: string) => string> = {
  'agent': (id: string) => path.join(getDataRoot(), 'agents', id),
  'role-agent': (id: string) => path.join(getDataRoot(), 'agents', id),
  'project': (id: string) => path.join(getDataRoot(), 'projects', id),
};

async function resolveProjectDir(entryId: string): Promise<{ baseDir: string; entryId: string; ontologyId: string }> {
  const projectsRoot = path.join(getDataRoot(), 'projects');
  const candidates = [
    entryId,
    entryId.startsWith('project-') ? entryId.slice('project-'.length) : null,
    `project-${entryId}`,
  ].filter((id): id is string => Boolean(id));

  for (const candidate of [...new Set(candidates)]) {
    const baseDir = path.join(projectsRoot, candidate);
    try {
      const stats = await import('fs/promises').then((fs) => fs.stat(baseDir));
      if (stats.isDirectory()) {
        return { baseDir, entryId: candidate, ontologyId: `ontology-${candidate}` };
      }
    } catch {
      // Try next compatibility candidate.
    }
  }

  const fallbackId = entryId.startsWith('project-') ? entryId.slice('project-'.length) : entryId;
  return {
    baseDir: path.join(projectsRoot, fallbackId),
    entryId: fallbackId,
    ontologyId: `ontology-${fallbackId}`,
  };
}

export async function GET(req: NextRequest) {
  try {
    const entryType = req.nextUrl.searchParams.get('entryType');
    const entryId = req.nextUrl.searchParams.get('entryId');

    if (!entryType || !entryId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_PARAM', message: 'entryType and entryId are required' },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // Special handling for skills: use the skills loader to find the actual baseDir
    if (entryType === 'skill') {
      const result = loadSkills({ includeDefaults: true });
      const skill = result.skills.find((s) => s.name === entryId || s.code === entryId);

      if (!skill) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: `Skill "${entryId}" not found` },
            timestamp: new Date().toISOString(),
          },
          { status: 404 },
        );
      }

      return NextResponse.json<ApiResponse<{ baseDir: string; entryType: string; entryId: string }>>({
        success: true,
        data: { baseDir: skill.baseDir, entryType, entryId },
        timestamp: new Date().toISOString(),
      });
    }

    if (entryType === 'project') {
      const resolved = await resolveProjectDir(entryId);
      return NextResponse.json<ApiResponse<{ baseDir: string; entryType: string; entryId: string; ontologyId: string }>>({
        success: true,
        data: { ...resolved, entryType },
        timestamp: new Date().toISOString(),
      });
    }

    const resolver = ENTRY_DIR_MAP[entryType];
    if (!resolver) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_ENTRY_TYPE', message: `Unknown entryType: ${entryType}` },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const baseDir = resolver(entryId);

    return NextResponse.json<ApiResponse<{ baseDir: string; entryType: string; entryId: string }>>({
      success: true,
      data: { baseDir, entryType, entryId },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
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
