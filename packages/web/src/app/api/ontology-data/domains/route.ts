/**
 * API Route: Create Domain
 * POST /api/ontology-data/domains?ontologyId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@originos/core/types';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { isValidId } from '@originos/core/lib/features/ontology-data-store/config';
import { getDataRoot } from '@originos/core/lib/paths';

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const body = await request.json();
    const { ontologyId, name, description } = body;

    if (!ontologyId || !isValidId(ontologyId)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId is required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'name is required' }, timestamp: new Date().toISOString() },
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

    const domainId = `domain_${Date.now()}`;
    const newDomain = {
      id: domainId,
      name,
      description: description || '',
      confidence: 0.8,
    };

    ontology.domains = ontology.domains ?? [];
    ontology.domains.push(newDomain);
    ontology.updatedAt = new Date().toISOString();

    await fs.writeFile(ontologyPath, JSON.stringify(ontology, null, 2), 'utf-8');

    return NextResponse.json<ApiResponse<{ id: string; name: string }>>({
      success: true,
      data: { id: domainId, name },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to create domain' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
