/**
 * API Route: Confirm Ontology
 * POST /api/ontology/[id]/confirm
 *
 * Confirm the generated/edited ontology
 */

import { NextRequest, NextResponse } from 'next/server';
import { ontologyService } from '@originos/core/lib/features/ontology';
import type { ConfirmOntologyRequest, ApiResponse } from '@originos/core/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: ontologyId } = await params;
    const body: ConfirmOntologyRequest = await request.json();

    // Validate request
    if (typeof body.confirmed !== 'boolean') {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'confirmed boolean field is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const ontology = await ontologyService.getOntology(ontologyId);
    if (!ontology) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Ontology not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // For now, confirmation is a metadata operation
    // In future implementations, this could trigger other actions

    const response: ApiResponse = {
      success: true,
      data: {
        ontologyId,
        confirmed: body.confirmed,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json<ApiResponse>(response);
  } catch (error) {
    console.error('Error confirming ontology:', error);

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
