/**
 * API Route: Create Ontology Entity
 * POST /api/ontology/entities
 *
 * Creates a new entity in the ontology graph
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@originos/core/types';
import { ontologyStorage } from '@originos/core/lib/features/ontology/storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.op === 'create' && body.entity) {
      const entity = ontologyStorage.createEntity(body.entity);

      return NextResponse.json<ApiResponse>(
        {
          success: true,
          data: entity,
          timestamp: new Date().toISOString(),
        },
        { status: 201 },
      );
    }

    if (body.op === 'relate' && body.from && body.rel && body.to) {
      const relation = ontologyStorage.createRelation({
        from: body.from,
        rel: body.rel,
        to: body.to,
        properties: body.properties,
      });

      return NextResponse.json<ApiResponse>(
        {
          success: true,
          data: relation,
          timestamp: new Date().toISOString(),
        },
        { status: 201 },
      );
    }

    return NextResponse.json<ApiResponse<unknown>>(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Unknown operation',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 400 },
    );
  } catch (error) {
    console.error('Error creating ontology entity:', error);

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

/**
 * GET /api/ontology/entities - List all entities
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');

    const entityList = ontologyStorage.listEntities(type || undefined);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: entityList,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error listing ontology entities:', error);

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
