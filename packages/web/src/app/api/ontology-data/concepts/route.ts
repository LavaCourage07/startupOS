import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@originos/core/types';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { isValidId } from '@originos/core/lib/features/ontology-data-store/config';
import { getDataRoot } from '@originos/core/lib/paths';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const ontologyId = request.nextUrl.searchParams.get('ontologyId');
    const domainId = request.nextUrl.searchParams.get('domainId');

    if (!ontologyId || !isValidId(ontologyId)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId is required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const projectId = ontologyId.replace(/^ontology-/, '');
    const ontologyPath = path.join(getDataRoot(), 'projects', projectId, 'ontology', 'ontology.json');

    // ontology.json 不存在时，尝试从 business-model.json 自动生成
    if (!existsSync(ontologyPath)) {
      // 尝试从 ontologyId 中解析 projectId（格式：ontology-{projectId}）
      const projectId = ontologyId.replace(/^ontology-/, '');
      const businessModelPath = path.join(getDataRoot(), 'projects', projectId, 'output', 'business-model.json');

      if (existsSync(businessModelPath)) {
        await syncBusinessModelToOntology(businessModelPath, ontologyId, projectId);
      } else {
        return NextResponse.json<ApiResponse<{ concepts: never[]; count: number }>>({
          success: true,
          data: { concepts: [], count: 0 },
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      // ontology.json 已存在，尝试从 business-model.json 更新 relations（补充可能缺失的关系定义）
      const projectId = ontologyId.replace(/^ontology-/, '');
      const businessModelPath = path.join(getDataRoot(), 'projects', projectId, 'output', 'business-model.json');

      if (existsSync(businessModelPath)) {
        await syncRelationsFromBusinessModel(ontologyPath, businessModelPath);
      }
    }

    const content = await fs.readFile(ontologyPath, 'utf-8');
    const ontology = JSON.parse(content) as {
      concepts?: Array<{ id: string; name: string; domainId: string; type: string; description?: string }>;
    };

    let concepts = ontology.concepts ?? [];
    if (domainId) {
      concepts = concepts.filter((c) => c.domainId === domainId);
    }

    return NextResponse.json<ApiResponse<{ concepts: typeof concepts; count: number }>>({
      success: true,
      data: { concepts, count: concepts.length },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to list concepts' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

/** 将 business-model.json 转换为 ontology.json 格式 */
async function syncBusinessModelToOntology(businessModelPath: string, ontologyId: string, projectId: string): Promise<void> {
  const bmContent = await fs.readFile(businessModelPath, 'utf-8');
  const bm = JSON.parse(bmContent);

  const domainId = 'domain_main';
  const now = new Date().toISOString();

  // 转换 entities → concepts
  const concepts: Array<{ id: string; domainId: string; name: string; type: string; description?: string }> = [];
  // name → conceptId 映射，用于 relations 转换
  const nameToConceptId = new Map<string, string>();

  if (bm.entities && Array.isArray(bm.entities)) {
    for (let i = 0; i < bm.entities.length; i++) {
      const entity = bm.entities[i];
      if (typeof entity === 'string') {
        concepts.push({ id: `concept_${i}`, domainId, name: entity, type: 'entity', description: '' });
        nameToConceptId.set(entity, `concept_${i}`);
      } else {
        const conceptId = `concept_${i}`;
        concepts.push({
          id: conceptId,
          domainId,
          name: entity.name || entity.label || `实体${i}`,
          type: 'entity',
          description: entity.definition || entity.description || '',
        });
        if (entity.name) nameToConceptId.set(entity.name, conceptId);
        if (entity.label) nameToConceptId.set(entity.label, conceptId);
      }
    }
  }

  // 转换 relationships → relations
  const relations: Array<{ id: string; sourceId: string; targetId: string; type: string; cardinality: string }> = [];
  if (bm.relationships && Array.isArray(bm.relationships)) {
    for (let i = 0; i < bm.relationships.length; i++) {
      const rel = bm.relationships[i];
      const sourceId = nameToConceptId.get(rel.from);
      const targetId = nameToConceptId.get(rel.to);
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

  const ontologyData = {
    version: '1.0.0',
    projectId,
    ontologyId,
    domains: [{ id: domainId, name: bm.projectName || '主域', description: bm.background || '', confidence: 0.8 }],
    concepts,
    instances: [],
    relations,
    metadata: { synced_from: 'business-model.json', synced_at: now },
    createdAt: now,
    updatedAt: now,
  };

  const ontologyDir = path.join(getDataRoot(), 'projects', projectId, 'ontology');
  if (!existsSync(ontologyDir)) {
    await fs.mkdir(ontologyDir, { recursive: true });
  }

  await fs.writeFile(
    path.join(ontologyDir, 'ontology.json'),
    JSON.stringify(ontologyData, null, 2),
    'utf-8'
  );

  // 为每个 concept 创建数据目录和空 _index.json
  for (const concept of concepts) {
    const conceptDataDir = path.join(ontologyDir, 'data', domainId, concept.id);
    if (!existsSync(conceptDataDir)) {
      await fs.mkdir(conceptDataDir, { recursive: true });
    }

    const indexPath = path.join(conceptDataDir, '_index.json');
    if (!existsSync(indexPath)) {
      await fs.writeFile(indexPath, JSON.stringify({ instanceIds: [] }), 'utf-8');
    }
  }

  // 创建空的实例关系文件
  const relPath = path.join(ontologyDir, 'instance-relations.json');
  if (!existsSync(relPath)) {
    await fs.writeFile(relPath, JSON.stringify({ relations: [] }), 'utf-8');
  }
}

/** 从 business-model.json 更新已存在 ontology.json 的 relations（不覆盖 concepts/instances） */
async function syncRelationsFromBusinessModel(ontologyPath: string, businessModelPath: string): Promise<void> {
  const ontologyContent = await fs.readFile(ontologyPath, 'utf-8');
  const ontology = JSON.parse(ontologyContent);
  const bmContent = await fs.readFile(businessModelPath, 'utf-8');
  const bm = JSON.parse(bmContent);

  if (!bm.relationships || !Array.isArray(bm.relationships) || bm.relationships.length === 0) {
    return; // 没有 relationships 需要更新
  }

  // 构建 name → conceptId 映射
  const nameToConceptId = new Map<string, string>();
  if (ontology.concepts && Array.isArray(ontology.concepts)) {
    for (const concept of ontology.concepts) {
      nameToConceptId.set(concept.name, concept.id);
    }
  }

  // 转换 relationships → relations
  const relations: Array<{ id: string; sourceId: string; targetId: string; type: string; cardinality: string }> = [];
  for (let i = 0; i < bm.relationships.length; i++) {
    const rel = bm.relationships[i];
    const sourceId = nameToConceptId.get(rel.from);
    const targetId = nameToConceptId.get(rel.to);
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

  // 只有当 relations 有变化时才更新
  const currentRelations = ontology.relations || [];
  if (relations.length > 0 && JSON.stringify(relations) !== JSON.stringify(currentRelations)) {
    ontology.relations = relations;
    ontology.updatedAt = new Date().toISOString();
    await fs.writeFile(ontologyPath, JSON.stringify(ontology, null, 2), 'utf-8');
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const body = await request.json();
    const { ontologyId, domainId, name, description, attributes } = body;

    if (!ontologyId || !isValidId(ontologyId)) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'ontologyId is required' }, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }
    if (!domainId || !name) {
      return NextResponse.json<ApiResponse<unknown>>(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'domainId and name are required' }, timestamp: new Date().toISOString() },
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

    const conceptId = `concept_${Date.now()}`;
    const newConcept: { id: string; domainId: string; name: string; type: string; description?: string; attributes?: Record<string, unknown> } = {
      id: conceptId,
      domainId,
      name,
      type: 'entity',
      description: description || '',
    };
    if (attributes && Object.keys(attributes).length > 0) {
      newConcept.attributes = attributes;
    }

    ontology.concepts = ontology.concepts ?? [];
    ontology.concepts.push(newConcept);
    ontology.updatedAt = new Date().toISOString();

    await fs.writeFile(ontologyPath, JSON.stringify(ontology, null, 2), 'utf-8');

    // 创建数据目录和空 _index.json
    const ontologyDir = path.dirname(ontologyPath);
    const conceptDataDir = path.join(ontologyDir, 'data', domainId, conceptId);
    if (!existsSync(conceptDataDir)) {
      await fs.mkdir(conceptDataDir, { recursive: true });
    }
    await fs.writeFile(path.join(conceptDataDir, '_index.json'), JSON.stringify({ instanceIds: [] }), 'utf-8');

    return NextResponse.json<ApiResponse<{ id: string; domainId: string; name: string }>>({
      success: true,
      data: { id: conceptId, domainId, name },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json<ApiResponse<unknown>>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to create concept' }, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
