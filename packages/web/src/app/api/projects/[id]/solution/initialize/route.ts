/**
 * API Route: Initialize Solution Design Session
 * POST /api/projects/{id}/solution/initialize
 *
 * 1. 复制 solution-design skill 到项目 skills 目录
 * 2. 创建 solutions/ 目录
 * 3. 调用 /api/launch（entryType: skill, agentBaseDir: 项目目录）
 * 4. 返回 sessionId
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { launch } from '@originos/core/lib/features/services/launcher/registry';
import type { ApiResponse } from '@originos/core/types';
import { getDataRoot, getMonorepoRoot } from '@originos/core/lib/paths';

const PROJECTS_DIR = path.join(getDataRoot(), 'projects');
const SKILLS_DIR = path.join(getMonorepoRoot(), 'skills');
const SOLUTION_SKILL_NAME = 'solution-design';
const PROJECT_SKILL_CREATOR_NAME = 'project-skill-creator';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await params;
    const projectDir = path.join(PROJECTS_DIR, projectId);

    if (!existsSync(projectDir)) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: `Project ${projectId} not found` },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // 1. Copy solution-design + project-skill-creator to project skills directory
    const copySkill = async (name: string) => {
      const srcDir = path.join(SKILLS_DIR, name);
      const dstDir = path.join(projectDir, 'skills', name);

      // Skip if already copied (SKILL.md exists in destination)
      if (existsSync(path.join(dstDir, 'SKILL.md'))) return;

      await fs.mkdir(dstDir, { recursive: true });

      // Copy SKILL.md
      const srcMd = path.join(srcDir, 'SKILL.md');
      if (existsSync(srcMd)) {
        await fs.copyFile(srcMd, path.join(dstDir, 'SKILL.md'));
      }

      // Copy references/ directory if present
      const srcRefs = path.join(srcDir, 'references');
      if (existsSync(srcRefs)) {
        const dstRefs = path.join(dstDir, 'references');
        await fs.cp(srcRefs, dstRefs, { recursive: true });
      }

      // Copy agents/ directory if present
      const srcAgents = path.join(srcDir, 'agents');
      if (existsSync(srcAgents)) {
        const dstAgents = path.join(dstDir, 'agents');
        await fs.cp(srcAgents, dstAgents, { recursive: true });
      }

      // Copy assets/ directory if present
      const srcAssets = path.join(srcDir, 'assets');
      if (existsSync(srcAssets)) {
        const dstAssets = path.join(dstDir, 'assets');
        await fs.cp(srcAssets, dstAssets, { recursive: true });
      }

      // Copy scripts/ directory if present
      const srcScripts = path.join(srcDir, 'scripts');
      if (existsSync(srcScripts)) {
        const dstScripts = path.join(dstDir, 'scripts');
        await fs.cp(srcScripts, dstScripts, { recursive: true });
      }

      // Copy eval-viewer/ directory if present
      const srcEvalViewer = path.join(srcDir, 'eval-viewer');
      if (existsSync(srcEvalViewer)) {
        const dstEvalViewer = path.join(dstDir, 'eval-viewer');
        await fs.cp(srcEvalViewer, dstEvalViewer, { recursive: true });
      }
    };

    await copySkill(SOLUTION_SKILL_NAME);
    await copySkill(PROJECT_SKILL_CREATOR_NAME);
    await copySkill('role-agent-creator');
    await copySkill('agent-creator');

    // 2. Create solutions/ directory
    await fs.mkdir(path.join(projectDir, 'solutions'), { recursive: true });

    // 2. Launch via SkillLauncher with project dir as agentBaseDir and projectId
    const result = await launch({
      entryType: 'skill',
      entryId: SOLUTION_SKILL_NAME,
      agentBaseDir: projectDir,
      projectId,
    });

    if (!result.success) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: { code: 'LAUNCH_FAILED', message: result.error || 'Failed to launch skill' },
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: { sessionId: result.sessionId, projectDir },
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[solution/initialize] Error:', error);
    return NextResponse.json<ApiResponse<unknown>>(
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
