/**
 * API Route: Initialize Project with Project Initialization Skill
 * POST /api/projects/init
 *
 * Creates a new agent session with the project-initialization composite skill
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectInitializationSkill } from '@originos/core/lib/features/skills/project-initialization';
import type { ApiResponse } from '@originos/core/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.projectName) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'projectName is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const {
      projectName,
      projectId,
      initialContext,
      customSystemPrompt,
    } = body;

    // Initialize the project initialization skill session
    const session = await projectInitializationSkill.initialize({
      projectId,
      projectName,
      initialContext,
      customSystemPrompt,
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          sessionId: session.sessionId,
          projectId: session.projectContext?.projectId,
          projectName: session.projectContext?.projectName,
          currentPhase: session.projectContext?.phase,
          agentType: session.agentType,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error initializing project:', error);

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
