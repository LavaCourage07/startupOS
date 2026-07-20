/**
 * API Route: Initialize Project Output Structure
 * POST /api/projects/{id}/initialize
 *
 * 确保项目的 output 目录结构正确创建
 */

import { NextRequest, NextResponse } from 'next/server';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { ApiResponse } from '@originos/core/types';
import { getDataRoot } from '@originos/core/lib/paths';

const OUTPUT_SUBDIRS = [
  'documents',  // 文档输出
  'diagrams',    // 图表输出
  'code',        // 代码输出
  'interim',     // 中间过程数据
];

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await params;

    // 项目目录路径
    const projectDir = path.join(getDataRoot(), 'projects', projectId);

    // 创建 output 目录和子目录
    for (const subdir of OUTPUT_SUBDIRS) {
      const dirPath = path.join(projectDir, 'output', subdir);
      if (!existsSync(dirPath)) {
        await mkdir(dirPath, { recursive: true });
      }
    }

    // 确保 agents 目录也存在
    const agentsDir = path.join(projectDir, 'agents');
    if (!existsSync(agentsDir)) {
      await mkdir(agentsDir, { recursive: true });
    }

    return NextResponse.json<ApiResponse<{ initialized: true }>>(
      { success: true, data: { initialized: true }, timestamp: new Date().toISOString() },
    );
  } catch (error) {
    console.error('[Project Output Init API] Error:', error);

    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
