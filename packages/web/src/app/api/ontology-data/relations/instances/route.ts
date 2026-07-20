/**
 * Instance Relations API
 * GET  /api/ontology-data/relations/instances?ontologyId=xxx — 列表
 * POST /api/ontology-data/relations/instances?ontologyId=xxx — 创建
 * DELETE /api/ontology-data/relations/instances?ontologyId=xxx — 删除（body 传 relationId）
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@originos/core/types';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import {
  validateInstanceRelation,
  getAllowedRelationTypes,
  type ConceptRelation,
  type InstanceRelation,
} from '@originos/core/lib/features/ontology-data-store/relation-validator';
import { getDataRoot } from '@originos/core/lib/paths';

function getRelationsPath(ontologyId: string): string {
  const projectId = ontologyId.replace(/^ontology-/, '');
  return path.join(getDataRoot(), 'projects', projectId, 'ontology', 'instance-relations.json');
}

function getOntologyPath(ontologyId: string): string {
  const projectId = ontologyId.replace(/^ontology-/, '');
  return path.join(getDataRoot(), 'projects', projectId, 'ontology', 'ontology.json');
}

async function readInstanceRelations(ontologyId: string): Promise<InstanceRelation[]> {
  const filePath = getRelationsPath(ontologyId);
  if (!existsSync(filePath)) return [];
  const content = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(content);
  return data.relations ?? [];
}

async function writeInstanceRelations(ontologyId: string, relations: InstanceRelation[]): Promise<void> {
  const dir = path.dirname(getRelationsPath(ontologyId));
  if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getRelationsPath(ontologyId), JSON.stringify({ relations }, null, 2), 'utf-8');
}

async function loadOntologyConcepts(ontologyId: string): Promise<ConceptRelation[]> {
  const filePath = getOntologyPath(ontologyId);
  if (!existsSync(filePath)) return [];
  const content = await fs.readFile(filePath, 'utf-8');
  const ontology = JSON.parse(content);
  return (ontology.relations ?? []).map((r: any) => ({
    id: r.id,
    sourceId: r.sourceId,
    targetId: r.targetId,
    type: r.type,
    cardinality: r.cardinality || 'N:M',
  })) as ConceptRelation[];
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');
    if (!ontologyId) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId is required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const relations = await readInstanceRelations(ontologyId);
    const constraints = await loadOntologyConcepts(ontologyId);
    const allowedTypes = getAllowedRelationTypes(
      request.nextUrl.searchParams.get('sourceConceptId') || '',
      request.nextUrl.searchParams.get('targetConceptId') || '',
      constraints
    );

    return NextResponse.json<ApiResponse<{ relations: InstanceRelation[]; constraints: ConceptRelation[]; allowedTypes: string[] }>>({
      success: true,
      data: { relations, constraints, allowedTypes },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to get relations' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');
    if (!ontologyId) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId is required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { sourceInstanceId, targetInstanceId, type, sourceConceptId, targetConceptId } = body;
    if (!sourceInstanceId || !targetInstanceId || !type || !sourceConceptId || !targetConceptId) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'sourceInstanceId, targetInstanceId, type, sourceConceptId, targetConceptId are required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const constraints = await loadOntologyConcepts(ontologyId);
    const existingRelations = await readInstanceRelations(ontologyId);

    const validation = validateInstanceRelation(
      { sourceInstanceId, targetInstanceId, type, sourceConceptId, targetConceptId },
      { constraints, existingRelations: existingRelations }
    );

    if (!validation.valid) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'VALIDATION_ERROR', message: validation.error || '关系验证失败' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const newRelation: InstanceRelation = {
      id: `irel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sourceInstanceId,
      targetInstanceId,
      type,
      sourceConceptId,
      targetConceptId,
    };

    await writeInstanceRelations(ontologyId, [...existingRelations, newRelation]);

    return NextResponse.json<ApiResponse<InstanceRelation>>({
      success: true,
      data: newRelation,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to create relation' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');
    if (!ontologyId) {
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

    const existing = await readInstanceRelations(ontologyId);
    const filtered = existing.filter(r => r.id !== body.relationId);

    if (filtered.length === existing.length) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'NOT_FOUND', message: 'Relation not found' }, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    await writeInstanceRelations(ontologyId, filtered);

    return NextResponse.json<ApiResponse<{ deleted: true }>>({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to delete relation' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
