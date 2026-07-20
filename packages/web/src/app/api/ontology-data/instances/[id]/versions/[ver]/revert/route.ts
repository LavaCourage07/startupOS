import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@originos/core/types';
import * as version from '@originos/core/lib/features/ontology-data-store/version';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ver: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id: instanceId, ver } = await params;
    const body = await request.json();
    const { ontologyId, conceptId } = body;

    if (!ontologyId || !conceptId) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId and conceptId are required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const versionNum = parseInt(ver, 10);
    if (isNaN(versionNum)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid version number' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const reverted = await version.revertToVersion(ontologyId, conceptId, instanceId, versionNum);
    return NextResponse.json<ApiResponse<typeof reverted>>({
      success: true,
      data: reverted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to revert version' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
