/**
 * API Route: Get, Update, or Delete Ontology Entity
 * GET/PATCH/DELETE /api/ontology/entities/[id]
 *
 * Gets, updates, or deletes a specific entity in the ontology
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@originos/core/types';
import { ontologyStorage } from '@originos/core/lib/features/ontology/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const entity = ontologyStorage.getEntity(id);

    if (!entity) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Entity not found: ${id}`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: entity,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error getting ontology entity:', error);

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

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const body = await _request.json();

    if (body.op === 'update' && body.properties) {
      const entity = ontologyStorage.updateEntity(id, body.properties);

      if (!entity) {
        return NextResponse.json<ApiResponse<unknown>>(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Entity not found: ${id}`,
            },
            timestamp: new Date().toISOString(),
          },
          { status: 404 },
        );
      }

      return NextResponse.json<ApiResponse>(
        {
          success: true,
          data: entity,
          timestamp: new Date().toISOString(),
        },
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
    console.error('Error updating ontology entity:', error);

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const deleted = ontologyStorage.deleteEntity(id);

    if (!deleted) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Entity not found: ${id}`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: { deleted: true },
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error('Error deleting ontology entity:', error);

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
