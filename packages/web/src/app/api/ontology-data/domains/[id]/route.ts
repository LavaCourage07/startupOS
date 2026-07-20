/**
 * API Route: Delete Domain
 * DELETE /api/ontology-data/domains/[id]?ontologyId=xxx
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
    const { id: domainId } = await params;
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');

    if (!ontologyId || !isValidId(ontologyId) || !domainId) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId and domainId are required' }, timestamp: new Date().toISOString() },
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

    const domainIdx = (ontology.domains ?? []).findIndex((d: { id: string }) => d.id === domainId);
    if (domainIdx === -1) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'NOT_FOUND', message: 'Domain not found' }, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // 找出该 domain 下的所有 concepts
    const conceptIdsInDomain = new Set(
      (ontology.concepts ?? [])
        .filter((c: { domainId: string }) => c.domainId === domainId)
        .map((c: { id: string }) => c.id)
    );

    // 删除 domain
    ontology.domains.splice(domainIdx, 1);

    // 删除该 domain 下的所有 concepts
    ontology.concepts = (ontology.concepts ?? []).filter((c: { domainId: string }) => c.domainId !== domainId);

    // 删除关联的概念关系
    ontology.relations = (ontology.relations ?? []).filter(
      (r: { sourceId: string; targetId: string }) => !conceptIdsInDomain.has(r.sourceId) && !conceptIdsInDomain.has(r.targetId)
    );

    ontology.updatedAt = new Date().toISOString();
    await fs.writeFile(ontologyPath, JSON.stringify(ontology, null, 2), 'utf-8');

    // 删除数据目录
    const dataDir = path.join(path.dirname(ontologyPath), 'data', domainId);
    if (existsSync(dataDir)) {
      await fs.rm(dataDir, { recursive: true });
    }

    return NextResponse.json<ApiResponse<{ deleted: true }>>({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to delete domain' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
