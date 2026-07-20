/**
 * API Route: Delete Concept
 * DELETE /api/ontology-data/concepts/[id]?ontologyId=xxx&domainId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@originos/core/types';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { isValidId } from '@originos/core/lib/features/ontology-data-store/config';
import { getDataRoot } from '@originos/core/lib/paths';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id: conceptId } = await params;
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');
    const domainId = request.nextUrl.searchParams.get('domainId');

    if (!ontologyId || !isValidId(ontologyId) || !conceptId || !domainId) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId, conceptId, and domainId are required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const projectId = ontologyId.replace(/^ontology-/, '');
    const ontologyPath = path.join(getDataRoot(), 'projects', projectId, 'ontology', 'ontology.json');

    if (!existsSync(ontologyPath)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'NOT_FOUND', message: 'Ontology not found' }, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const content = await fs.readFile(ontologyPath, 'utf-8');
    const ontology = JSON.parse(content);

    const conceptIdx = (ontology.concepts ?? []).findIndex((c: { id: string }) => c.id === conceptId);
    if (conceptIdx === -1) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'NOT_FOUND', message: 'Concept not found' }, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    ontology.concepts.splice(conceptIdx, 1);

    // 删除关联的概念关系
    ontology.relations = (ontology.relations ?? []).filter(
      (r: { sourceId: string; targetId: string }) => r.sourceId !== conceptId && r.targetId !== conceptId
    );

    ontology.updatedAt = new Date().toISOString();
    await fs.writeFile(ontologyPath, JSON.stringify(ontology, null, 2), 'utf-8');

    // 删除概念数据目录
    const conceptDataDir = path.join(path.dirname(ontologyPath), 'data', domainId, conceptId);
    if (existsSync(conceptDataDir)) {
      await fs.rm(conceptDataDir, { recursive: true });
    }

    return NextResponse.json<ApiResponse<{ deleted: true }>>({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to delete concept' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
