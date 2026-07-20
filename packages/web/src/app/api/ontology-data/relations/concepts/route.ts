/**
 * API Route: Concept Relations CRUD
 * POST   /api/ontology-data/relations/concepts?ontologyId=xxx — 创建
 * DELETE /api/ontology-data/relations/concepts?ontologyId=xxx — 删除
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@originos/core/types';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { isValidId } from '@originos/core/lib/features/ontology-data-store/config';
import { getDataRoot } from '@originos/core/lib/paths';

function getOntologyPath(ontologyId: string): string {
  const projectId = ontologyId.replace(/^ontology-/, '');
  return path.join(getDataRoot(), 'projects', projectId, 'ontology', 'ontology.json');
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');
    if (!ontologyId || !isValidId(ontologyId)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId is required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const ontologyPath = getOntologyPath(ontologyId);
    if (!existsSync(ontologyPath)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'NOT_FOUND', message: 'Ontology not found' }, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const content = await fs.readFile(ontologyPath, 'utf-8');
    const ontology = JSON.parse(content);

    return NextResponse.json<ApiResponse<{ relations: unknown[] }>>({
      success: true,
      data: { relations: ontology.relations ?? [] },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to read concept relations' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');
    if (!ontologyId || !isValidId(ontologyId)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId is required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { sourceId, targetId, type, cardinality } = body;
    if (!sourceId || !targetId || !type) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'sourceId, targetId, and type are required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const ontologyPath = getOntologyPath(ontologyId);
    if (!existsSync(ontologyPath)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'NOT_FOUND', message: 'Ontology not found' }, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const content = await fs.readFile(ontologyPath, 'utf-8');
    const ontology = JSON.parse(content);

    // 检查是否已存在相同关系
    const exists = (ontology.relations ?? []).find(
      (r: { sourceId: string; targetId: string; type: string }) =>
        r.sourceId === sourceId && r.targetId === targetId && r.type === type
    );
    if (exists) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'CONFLICT', message: '该概念关系已存在' }, timestamp: new Date().toISOString() },
        { status: 409 }
      );
    }

    const relationId = `rel_${Date.now()}`;
    const newRelation = {
      id: relationId,
      sourceId,
      targetId,
      type,
      cardinality: cardinality || 'N:M',
    };

    ontology.relations = ontology.relations ?? [];
    ontology.relations.push(newRelation);
    ontology.updatedAt = new Date().toISOString();

    await fs.writeFile(ontologyPath, JSON.stringify(ontology, null, 2), 'utf-8');

    return NextResponse.json<ApiResponse<{ id: string; sourceId: string; targetId: string; type: string }>>({
      success: true,
      data: { id: relationId, sourceId, targetId, type },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to create concept relation' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');
    if (!ontologyId || !isValidId(ontologyId)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId is required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const body = await request.json();
    if (!body.relationId) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'relationId is required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const ontologyPath = getOntologyPath(ontologyId);
    if (!existsSync(ontologyPath)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'NOT_FOUND', message: 'Ontology not found' }, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const content = await fs.readFile(ontologyPath, 'utf-8');
    const ontology = JSON.parse(content);

    const existing = ontology.relations ?? [];
    const filtered = existing.filter((r: { id: string }) => r.id !== body.relationId);

    if (filtered.length === existing.length) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'NOT_FOUND', message: 'Relation not found' }, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    ontology.relations = filtered;
    ontology.updatedAt = new Date().toISOString();
    await fs.writeFile(ontologyPath, JSON.stringify(ontology, null, 2), 'utf-8');

    return NextResponse.json<ApiResponse<{ deleted: true }>>({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to delete concept relation' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
