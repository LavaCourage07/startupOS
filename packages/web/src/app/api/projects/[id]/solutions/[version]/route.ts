/**
 * GET /api/projects/[id]/solutions/[version]
 * Read a solution version bundle (manifest + agents + skills merged).
 *
 * Supports both new folder format and legacy single-file format.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import type { ApiResponse } from '@originos/core/types';
import { getDataRoot } from '@originos/core/lib/paths';

const PROJECTS_DIR = path.join(getDataRoot(), 'projects');

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> },
) {
  try {
    const { id: projectId, version } = await params;
    const solutionsDir = path.join(PROJECTS_DIR, projectId, 'solutions');

    // Try new folder format first
    const versionDir = path.join(solutionsDir, version);
    const manifestPath = path.join(versionDir, 'manifest.json');
    const agentsPath = path.join(versionDir, 'agents.json');
    const skillsPath = path.join(versionDir, 'skills.json');

    if (existsSync(manifestPath)) {
      const [manifest, agentsData, skillsData] = await Promise.all([
        fs.readFile(manifestPath, 'utf-8').then((c) => JSON.parse(c)),
        existsSync(agentsPath)
          ? fs.readFile(agentsPath, 'utf-8').then((c) => JSON.parse(c)).then((d) => d.agents || [])
          : Promise.resolve([]),
        existsSync(skillsPath)
          ? fs.readFile(skillsPath, 'utf-8').then((c) => JSON.parse(c)).then((d) => d.skills || [])
          : Promise.resolve([]),
      ]);

      return NextResponse.json<ApiResponse<{
        manifest: unknown;
        agents: unknown[];
        skills: unknown[];
        solutionVersion: string;
      }>>({
        success: true,
        data: {
          manifest,
          agents: agentsData,
          skills: skillsData,
          solutionVersion: version,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Fallback: legacy single-file format
    const legacyFile = path.join(solutionsDir, `solution-${version}.json`);
    if (existsSync(legacyFile)) {
      const content = await fs.readFile(legacyFile, 'utf-8');
      const raw = JSON.parse(content);
      const data = raw.data || raw;

      return NextResponse.json<ApiResponse<{
        manifest: unknown;
        agents: unknown[];
        skills: unknown[];
        solutionVersion: string;
      }>>({
        success: true,
        data: {
          manifest: {
            status: data.status,
            solutionVersion: data.solutionVersion || version,
            modeling: data.modeling,
            executionMode: data.executionMode,
            changesFromPrevious: data.changesFromPrevious,
          },
          agents: data.agents || [],
          skills: Array.isArray(data.skills) ? data.skills : [],
          solutionVersion: version,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json<ApiResponse<unknown>>({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Solution version ${version} not found`,
      },
      timestamp: new Date().toISOString(),
    }, { status: 404 });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
