/**
 * API Route: Concept Schema
 * GET  /api/ontology-data/concepts/[id]/schema?ontologyId=xxx — 获取 schema
 * PUT  /api/ontology-data/concepts/[id]/schema?ontologyId=xxx&domainId=xxx — 更新 schema
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@originos/core/types';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import * as schemaValidator from '@originos/core/lib/features/ontology-data-store/schema-validator';
import { isValidId } from '@originos/core/lib/features/ontology-data-store/config';
import type { ConceptField } from '@originos/core/lib/features/ontology-data-store/types';
import { getDataRoot } from '@originos/core/lib/paths';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id: conceptId } = await params;
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');

    if (!ontologyId || !isValidId(ontologyId) || !isValidId(conceptId)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId and conceptId are required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const schema = await schemaValidator.loadConceptSchema(ontologyId, conceptId);
    return NextResponse.json<ApiResponse<typeof schema>>({
      success: true,
      data: schema,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'NOT_FOUND', message: error instanceof Error ? error.message : 'Concept schema not found' }, timestamp: new Date().toISOString() },
      { status: 404 }
    );
  }
}

export async function PUT(
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

    const body = await request.json();
    const fields: ConceptField[] = body.fields;
    if (!Array.isArray(fields)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'fields array is required' }, timestamp: new Date().toISOString() },
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

    const concept = (ontology.concepts ?? []).find((c: { id: string }) => c.id === conceptId);
    if (!concept) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'NOT_FOUND', message: 'Concept not found' }, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // Convert ConceptField[] → attributes format
    const attributes: Record<string, { type: string; required?: boolean; description?: string; enum?: string[] }> = {};
    for (const field of fields) {
      attributes[field.name] = {
        type: field.type,
        required: field.required,
        description: field.description,
        enum: field.enum,
      };
    }

    concept.attributes = attributes;
    ontology.updatedAt = new Date().toISOString();

    await fs.writeFile(ontologyPath, JSON.stringify(ontology, null, 2), 'utf-8');

    return NextResponse.json<ApiResponse<{ conceptId: string; fieldCount: number }>>({
      success: true,
      data: { conceptId, fieldCount: fields.length },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to update schema' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
