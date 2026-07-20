/**
 * API Route: Generate Ontology
 * POST /api/ontology/generate
 *
 * Generate initial ontology from completed interview
 */

import { NextRequest, NextResponse } from 'next/server';
import { ontologyService, interviewService } from '@originos/core/lib/features/ontology';
import type { GenerateOntologyRequest, ApiResponse } from '@originos/core/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body: GenerateOntologyRequest = await request.json();

    // Validate request
    if (!body.projectId) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'projectId is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // For new interview flow, answers are passed directly
    if (body.answers) {
      // Create a mock interview session from answers
      const mockInterview = {
        id: body.interviewId || uuidv4(),
        projectId: body.projectId,
        status: 'completed' as const,
        questions: [],
        currentQuestionIndex: 3,
        answers: {
          work_domain: { answer: body.answers.work_domain || '' },
          work_mode: { answer: body.answers.work_mode || '' },
          main_tasks: { answer: body.answers.main_tasks || '' },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      // Generate ontology
      const result = await ontologyService.generateFromInterview(mockInterview as any);

      // Validate generation time is within 5 seconds as required
      if (result.generationTime > 5000) {
        console.warn(
          `Ontology generation took ${result.generationTime}ms (exceeds 5s limit)`,
        );
      }

      return NextResponse.json<ApiResponse>(
        {
          success: true,
          data: {
            ontology: result.ontology,
            generationTime: result.generationTime,
            source: result.source,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 201 },
      );
    }

    // Legacy flow: Get interview from storage
    if (!body.interviewId) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Either interviewId or answers must be provided',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const interview = await interviewService.getInterview(body.interviewId);
    if (!interview) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Interview not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // Check if interview is completed
    if (interview.status !== 'completed') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: 'Interview must be completed before generating ontology',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // Generate ontology
    const result = await ontologyService.generateFromInterview(interview);

    // Validate generation time is within 5 seconds as required
    if (result.generationTime > 5000) {
      console.warn(
        `Ontology generation took ${result.generationTime}ms (exceeds 5s limit)`,
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          ontology: result.ontology,
          generationTime: result.generationTime,
          source: result.source,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error generating ontology:', error);

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
