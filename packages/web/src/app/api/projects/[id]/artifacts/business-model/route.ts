/**
 * API Route: Project Business Model Artifact
 * GET /api/projects/{id}/artifacts/business-model - 读取业务模型
 * POST /api/projects/{id}/artifacts/business-model - 保存业务模型
 *
 * 从项目 output 目录读取/保存业务模型产出物
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { ApiResponse } from '@originos/core/types';
import { getDataRoot } from '@originos/core/lib/paths';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await params;

    // 项目 output 目录路径
    const projectDir = path.join(getDataRoot(), 'projects', projectId);
    const outputDir = path.join(projectDir, 'output');
    const businessModelPath = path.join(outputDir, 'business-model.json');

    // 检查文件是否存在
    if (!existsSync(businessModelPath)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Business model artifact not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // 读取业务模型文件
    const content = await readFile(businessModelPath, 'utf-8');
    const businessModel = JSON.parse(content);

    return NextResponse.json<ApiResponse<any>>(
      {
        success: true,
        data: businessModel,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error loading business model artifact:', error);

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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await params;
    const businessModel = await _request.json();

    // 项目 output 目录路径
    const projectDir = path.join(getDataRoot(), 'projects', projectId);
    const outputDir = path.join(projectDir, 'output');
    const businessModelPath = path.join(outputDir, 'business-model.json');

    // 确保 output 目录存在
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    // 保存业务模型文件
    await writeFile(
      businessModelPath,
      JSON.stringify(businessModel, null, 2),
      'utf-8'
    );

    console.log('[API] Business model saved to:', businessModelPath);

    return NextResponse.json<ApiResponse<{ saved: true }>>(
      {
        success: true,
        data: { saved: true },
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error saving business model artifact:', error);

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
