import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@originos/core/types';
import * as version from '@originos/core/lib/features/ontology-data-store/version';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id: instanceId } = await params;
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');

    if (!ontologyId) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId is required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const versions = await version.getVersions(ontologyId, instanceId);
    return NextResponse.json<ApiResponse<typeof versions>>({
      success: true,
      data: versions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to get versions' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id: instanceId } = await params;
    const body = await request.json();
    const { ontologyId, conceptId, label } = body;

    if (!ontologyId || !conceptId) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId and conceptId are required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const snapshot = await version.saveVersion(ontologyId, conceptId, instanceId, label);
    return NextResponse.json<ApiResponse<typeof snapshot>>({
      success: true,
      data: snapshot,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to save version' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
