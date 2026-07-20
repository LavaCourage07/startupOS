import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@originos/core/types';
import * as store from '@originos/core/lib/features/ontology-data-store/store';
import * as schemaValidator from '@originos/core/lib/features/ontology-data-store/schema-validator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id: instanceId } = await params;
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');
    const conceptId = request.nextUrl.searchParams.get('conceptId');

    if (!ontologyId || !conceptId) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId and conceptId are required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const instance = await store.getInstance(ontologyId, conceptId, instanceId);
    return NextResponse.json<ApiResponse<typeof instance>>({
      success: true,
      data: instance,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'NOT_FOUND', message: error instanceof Error ? error.message : 'Instance not found' }, timestamp: new Date().toISOString() },
      { status: 404 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id: instanceId } = await params;
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');
    const conceptId = request.nextUrl.searchParams.get('conceptId');

    if (!ontologyId || !conceptId) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId and conceptId are required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const body = await request.json();
    if (!body.fields) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'fields are required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const schema = await schemaValidator.loadConceptSchema(ontologyId, conceptId);
    const updated = await store.updateInstance(ontologyId, conceptId, instanceId, body.fields, schema);
    return NextResponse.json<ApiResponse<typeof updated>>({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to update instance' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id: instanceId } = await params;
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');
    const conceptId = request.nextUrl.searchParams.get('conceptId');

    if (!ontologyId || !conceptId) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId and conceptId are required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    await store.deleteInstance(ontologyId, conceptId, instanceId);
    return NextResponse.json<ApiResponse<{ deleted: true }>>({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to delete instance' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
