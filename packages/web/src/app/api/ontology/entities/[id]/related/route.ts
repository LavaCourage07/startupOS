/**
 * API Route: Get Related Entities
 * GET /api/ontology/entities/[id]/related
 *
 * Gets entities related to a given entity by specified relation type
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@originos/core/types';
import { ontologyStorage } from '@originos/core/lib/features/ontology/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const relType = searchParams.get('rel') || undefined;
    const direction = (searchParams.get('dir') || 'outgoing') as 'outgoing' | 'incoming' | 'both';

    const results = ontologyStorage.getRelated(id, relType, direction);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error getting related entities:', error);

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
