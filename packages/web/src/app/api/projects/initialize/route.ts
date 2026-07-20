/**
 * API Route: Initialize Project
 * POST /api/projects/initialize
 *
 * 基于访谈结果创建完整的项目结构，包括：
 * - 标准目录结构
 * - AGENT.md 配置
 * - 业务模型保存
 * - 技能文件复制
 * - Agent 会话初始化
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectInitializationService } from '@originos/core/lib/features/services/project-initialization-service';
import type { ApiResponse } from '@originos/core/types';
import type { BusinessModel, InitializeProjectResult } from '@originos/core/lib/features/services/project-initialization-service';

/**
 * POST /api/projects/initialize
 *
 * Request body:
 * {
 *   businessModel: BusinessModel,
 *   skillsToInclude?: string[],
 *   userId?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     project: Project,
 *     agentSessionId: string,
 *     projectPath: string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证必需字段
    if (!body.businessModel) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'businessModel is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const businessModel = body.businessModel as BusinessModel;

    // 验证业务模型必需字段
    if (!businessModel.projectName && !businessModel.industry) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'businessModel must contain projectName or industry',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!businessModel.entities || businessModel.entities.length === 0) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'businessModel must contain at least one entity',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // 初始化项目
    console.log('[API] Initializing project with business model:', {
      projectName: businessModel.projectName,
      industry: businessModel.industry,
      entityCount: businessModel.entities.length,
    });

    const result = await projectInitializationService.initializeProject({
      businessModel,
      skillsToInclude: body.skillsToInclude || ['project-initialization'],
      userId: body.userId,
    });

    console.log('[API] Project initialized successfully:', {
      projectId: result.project.id,
      agentSessionId: result.agentSessionId,
    });

    return NextResponse.json<ApiResponse<InitializeProjectResult>>(
      {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error initializing project:', error);

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
