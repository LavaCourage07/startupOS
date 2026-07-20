/**
 * API Route: Sync Business Model to Ontology Data Store
 * POST /api/projects/[id]/sync-ontology
 *
 * Converts business-model.json (interview output) into ontology.json
 * format readable by the ontology-data-store.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { ApiResponse } from '@originos/core/types';
import { getDataRoot } from '@originos/core/lib/paths';

/** Infer primitive field type from value shape */
function inferFieldType(value: unknown): string {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object' && value !== null) return 'object';
  return 'string';
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await params;

    // 读取 business-model.json
    const businessModelPath = path.join(
      getDataRoot(), 'projects', projectId, 'output', 'business-model.json'
    );

    if (!existsSync(businessModelPath)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'business-model.json not found' },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    const content = await readFile(businessModelPath, 'utf-8');
    const bm = JSON.parse(content);

    // 转换为 ontology-data-store 格式
    const ontologyId = `ontology-${projectId}`;
    const now = new Date().toISOString();

    // 创建默认 domain
    const domainId = 'domain_main';
    const domains = [
      {
        id: domainId,
        name: bm.projectName || '主域',
        description: bm.background || bm.description || '',
        confidence: 0.8,
      },
    ];

    // 转换 entities → concepts（schema validator 读取 concept.attributes）
    const concepts: Array<{
      id: string;
      domainId: string;
      name: string;
      type: string;
      description?: string;
      attributes?: Record<string, { type: string; required?: boolean; description?: string }>;
    }> = [];

    if (bm.entities && Array.isArray(bm.entities)) {
      for (let i = 0; i < bm.entities.length; i++) {
        const entity = bm.entities[i];
        if (typeof entity === 'string') {
          concepts.push({
            id: `concept_${i}`,
            domainId,
            name: entity,
            type: 'entity',
            description: '',
          });
        } else {
          // 将 entity.properties → attributes 格式（供 schema validator 使用）
          const attributes: Record<string, { type: string; required?: boolean; description?: string }> = {};
          if (entity.properties && typeof entity.properties === 'object') {
            for (const [key, value] of Object.entries(entity.properties)) {
              attributes[key] = {
                type: inferFieldType(value),
                description: typeof value === 'string' ? value : undefined,
              };
            }
          }
          concepts.push({
            id: `concept_${i}`,
            domainId,
            name: entity.name || entity.label || `实体${i}`,
            type: 'entity',
            description: entity.definition || entity.description || '',
            attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
          });
        }
      }
    }

    const ontologyData = {
      version: '1.0.0',
      projectId,
      ontologyId,
      domains,
      concepts,
      instances: [],
      relations: [],
      metadata: {
        synced_from: 'business-model.json',
        synced_at: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    // 写入 ontology-data-store 目录
    const ontologyDir = path.join(
      getDataRoot(), 'projects', projectId, 'ontology'
    );

    if (!existsSync(ontologyDir)) {
      await mkdir(ontologyDir, { recursive: true });
    }

    await writeFile(
      path.join(ontologyDir, 'ontology.json'),
      JSON.stringify(ontologyData, null, 2),
      'utf-8'
    );

    // 为每个 concept 创建数据目录和空的 _index.json
    for (const concept of concepts) {
      const conceptDataDir = path.join(
        ontologyDir, 'data', domainId, concept.id
      );
      if (!existsSync(conceptDataDir)) {
        await mkdir(conceptDataDir, { recursive: true });
      }

      const indexPath = path.join(conceptDataDir, '_index.json');
      if (!existsSync(indexPath)) {
        await writeFile(indexPath, JSON.stringify({ instanceIds: [] }), 'utf-8');
      }
    }

    return NextResponse.json<ApiResponse<{ ontologyId: string; conceptCount: number }>>({
      success: true,
      data: { ontologyId, conceptCount: concepts.length },
      timestamp: now,
    });
  } catch (error) {
    console.error('[Sync Ontology API] Error:', error);
    return NextResponse.json<ApiResponse<unknown>>({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
