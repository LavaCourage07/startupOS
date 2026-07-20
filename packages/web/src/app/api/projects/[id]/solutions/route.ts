/**
 * GET /api/projects/[id]/solutions
 * List all solution versions in the project's solutions/ directory.
 *
 * Supports both new folder format ({version}/manifest.json) and legacy
 * single-file format (solution-{version}.json).
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import type { ApiResponse } from '@originos/core/types';
import type { SolutionListItem } from '@originos/core/types';
import { getDataRoot } from '@originos/core/lib/paths';

const PROJECTS_DIR = path.join(getDataRoot(), 'projects');

interface ManifestLite {
  status?: string;
  solutionVersion?: string;
  modeling?: { dimension?: string };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await params;
    const solutionsDir = path.join(PROJECTS_DIR, projectId, 'solutions');

    if (!existsSync(solutionsDir)) {
      return NextResponse.json<ApiResponse<SolutionListItem[]>>({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });
    }

    const entries = await fs.readdir(solutionsDir, { withFileTypes: true });
    const solutions: SolutionListItem[] = [];

    // Scan version folders (new format)
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const versionDir = path.join(solutionsDir, entry.name);
      const manifestPath = path.join(versionDir, 'manifest.json');
      const agentsPath = path.join(versionDir, 'agents.json');

      if (!existsSync(manifestPath)) continue;

      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const manifest: ManifestLite = JSON.parse(manifestContent);

        let agentCount = 0;
        if (existsSync(agentsPath)) {
          const agentsContent = await fs.readFile(agentsPath, 'utf-8');
          const agentsData = JSON.parse(agentsContent);
          agentCount = Array.isArray(agentsData?.agents) ? agentsData.agents.length : 0;
        }

        const version = manifest.solutionVersion || entry.name;
        const modelDim = (manifest as any).modeling?.dimension || 'task';

        solutions.push({
          id: version,
          projectId,
          name: `方案 ${version}`,
          version,
          status: (manifest.status as any) || 'draft',
          modelingDimension: modelDim,
          agentCount,
          createdAt: (manifest as any).createdAt ? new Date((manifest as any).createdAt).getTime() : 0,
          updatedAt: (manifest as any).updatedAt ? new Date((manifest as any).updatedAt).getTime() : 0,
        });
      } catch {
        // Skip malformed
      }
    }

    // Also scan legacy single-file format
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.startsWith('solution-v') || !entry.name.endsWith('.json')) continue;
      if (entry.name.includes('-manifest') || entry.name.includes('-incomplete') || entry.name.includes('-dataflow')) continue;

      const versionMatch = entry.name.match(/solution-(v[\d.]+)\.json/);
      if (!versionMatch) continue;
      const version = versionMatch[1]!;

      // Skip if already migrated (folder exists)
      if (solutions.some((s) => s.version === version)) continue;

      try {
        const content = await fs.readFile(path.join(solutionsDir, entry.name), 'utf-8');
        const raw = JSON.parse(content);
        const data = raw.data || raw;
        const agents = data.agents || [];

        solutions.push({
          id: version,
          projectId,
          name: `方案 ${version}`,
          version,
          status: data.status || 'draft',
          modelingDimension: data.modeling?.dimension || data.modelingDimension || 'task',
          agentCount: Array.isArray(agents) ? agents.length : 0,
          createdAt: data.createdAt ?? 0,
          updatedAt: data.updatedAt ?? 0,
        });
      } catch {
        // Skip malformed
      }
    }

    solutions.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json<ApiResponse<SolutionListItem[]>>({
      success: true,
      data: solutions,
      timestamp: new Date().toISOString(),
    });
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
