/**
 * API Route: Full Sync from business-model.json → ontology.json
 * POST /api/ontology-data/sync?ontologyId=xxx
 *
 * 同步 concepts（名称、描述、属性）、relations、domains。
 * 保留现有实例数据，仅更新本体结构。
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

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
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

    const projectId = ontologyId.replace(/^ontology-/, '');
    const businessModelPath = path.join(getDataRoot(), 'projects', projectId, 'output', 'business-model.json');

    if (!existsSync(businessModelPath)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'NOT_FOUND', message: 'business-model.json not found' }, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const ontologyContent = await fs.readFile(ontologyPath, 'utf-8');
    const ontology = JSON.parse(ontologyContent);
    const bmContent = await fs.readFile(businessModelPath, 'utf-8');
    const bm = JSON.parse(bmContent);

    const domainId = 'domain_main';
    const now = new Date().toISOString();

    // name → conceptId 映射
    const nameToConceptId = new Map<string, string>();
    const oldConcepts = ontology.concepts ?? [];

    for (const concept of oldConcepts) {
      nameToConceptId.set(concept.name, concept.id);
    }

    // 构建新的 concepts
    const newConcepts: Array<{
      id: string; domainId: string; name: string; type: string; description?: string; attributes?: Record<string, unknown>;
    }> = [];
    const newNameToConceptId = new Map<string, string>();

    if (bm.entities && Array.isArray(bm.entities)) {
      for (let i = 0; i < bm.entities.length; i++) {
        const entity = bm.entities[i];
        const entityName = typeof entity === 'string' ? entity : (entity.name || entity.label || `实体${i}`);
        const entityDef = typeof entity === 'string' ? '' : (entity.definition || entity.description || '');
        const entityAttrs = typeof entity === 'string' ? {} : (entity.properties ?? {});

        const conceptId = nameToConceptId.get(entityName) ?? `concept_${Date.now()}_${i}`;
        const newConcept: typeof newConcepts[number] = {
          id: conceptId,
          domainId,
          name: entityName,
          type: 'entity',
          description: entityDef,
        };

        // 转换 attributes
        const attrs: Record<string, unknown> = {};
        for (const [attrName, attrDesc] of Object.entries(entityAttrs)) {
          attrs[attrName] = { type: 'string', description: typeof attrDesc === 'string' ? attrDesc : '' };
        }
        if (Object.keys(attrs).length > 0) {
          newConcept.attributes = attrs;
        }

        newConcepts.push(newConcept);
        newNameToConceptId.set(entityName, conceptId);

        // 创建新概念的数据目录
        const conceptDataDir = path.join(getDataRoot(), 'projects', projectId, 'ontology', 'data', domainId, conceptId);
        if (!existsSync(conceptDataDir)) {
          await fs.mkdir(conceptDataDir, { recursive: true });
          const indexPath = path.join(conceptDataDir, '_index.json');
          if (!existsSync(indexPath)) {
            await fs.writeFile(indexPath, JSON.stringify({ instanceIds: [] }), 'utf-8');
          }
        }
      }
    }

    // 删除已不在 business-model.json 中的概念的数据目录
    for (const oldConcept of oldConcepts) {
      if (!newNameToConceptId.has(oldConcept.name)) {
        // 删除概念文件但保留实例关系文件（不删除 data/ 目录下的实例文件）
        const conceptFile = path.join(getDataRoot(), 'projects', projectId, 'ontology', 'data', oldConcept.domainId, oldConcept.id + '.json');
        if (existsSync(conceptFile)) {
          await fs.unlink(conceptFile).catch(() => {});
        }
      }
    }

    // 构建 relations
    const relations: Array<{ id: string; sourceId: string; targetId: string; type: string; cardinality: string }> = [];
    if (bm.relationships && Array.isArray(bm.relationships)) {
      for (let i = 0; i < bm.relationships.length; i++) {
        const rel = bm.relationships[i];
        const sourceId = newNameToConceptId.get(rel.from);
        const targetId = newNameToConceptId.get(rel.to);
        if (sourceId && targetId) {
          relations.push({
            id: `rel_${i}`,
            sourceId,
            targetId,
            type: rel.type || 'related_to',
            cardinality: rel.cardinality || 'N:M',
          });
        }
      }
    }

    // 更新 domains
    const domains = [
      {
        id: domainId,
        name: bm.projectName || '主域',
        description: bm.background || '',
        confidence: 0.8,
      },
    ];

    // 写回 ontology.json
    ontology.concepts = newConcepts;
    ontology.relations = relations;
    ontology.domains = domains;
    ontology.updatedAt = now;
    ontology.metadata = { synced_from: 'business-model.json', synced_at: now };

    await fs.writeFile(ontologyPath, JSON.stringify(ontology, null, 2), 'utf-8');

    return NextResponse.json<ApiResponse<{ synced: true; conceptsCount: number; relationsCount: number }>>({
      success: true,
      data: { synced: true, conceptsCount: newConcepts.length, relationsCount: relations.length },
      timestamp: now,
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : '同步失败' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
