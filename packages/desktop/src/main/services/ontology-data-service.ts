import { ipcMain } from 'electron';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { IPC_CHANNELS } from '../ipc-protocol';
import type { IpcResponse } from '../../../../core/src/lib/integrations/electron/ipc-protocol';
import { schemaPath, projectIdFromOntologyId } from '../../../../core/src/lib/features/ontology-data-store/config';
import { getDataRoot } from '../../../../core/src/lib/paths';
import {
  createDomain,
  deleteDomain,
  loadOrCreateOntology,
  createConcept,
  deleteConcept,
  updateConceptSchema,
  createConceptRelation,
  deleteConceptRelation,
} from '../../../../core/src/lib/features/ontology-data-store/ontology-ops';
import {
  createInstance,
  updateInstance,
  deleteInstance,
} from '../../../../core/src/lib/features/ontology-data-store/store';
import {
  listInstanceRelations,
  createInstanceRelation,
  deleteInstanceRelation,
} from '../../../../core/src/lib/features/ontology-data-store/instance-relations';
import {
  queryInstances,
} from '../../../../core/src/lib/features/ontology-data-store/query-engine';
import { loadConceptSchema } from '../../../../core/src/lib/features/ontology-data-store/schema-validator';
import type { ConceptField } from '../../../../core/src/lib/features/ontology-data-store/types';

type ConceptAttributes = Record<string, { type: string; required?: boolean; description?: string; enum?: string[] }>;

function fieldsToAttributes(fields: unknown[]): ConceptAttributes {
  const attributes: ConceptAttributes = {};
  for (const field of fields) {
    if (!field || typeof field !== 'object') continue;
    const typedField = field as Partial<ConceptField>;
    if (!typedField.name || !typedField.type) continue;
    attributes[typedField.name] = {
      type: typedField.type,
      required: typedField.required,
      description: typedField.description,
      enum: typedField.enum,
    };
  }
  return attributes;
}

export class OntologyDataService {
  constructor() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_DOMAIN_CREATE,
      async (_event, request: { ontologyId: string; name: string; description?: string }): Promise<IpcResponse<unknown>> => {
        try {
          if (!request.ontologyId || !request.name) {
            return {
              success: false,
              error: { code: 'INVALID_REQUEST', message: 'ontologyId and name are required' },
              timestamp: new Date().toISOString(),
            };
          }
          const domain = await createDomain(request.ontologyId, request.name, request.description);
          return {
            success: true,
            data: domain,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Create domain failed');
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_DOMAIN_DELETE,
      async (_event, request: { ontologyId: string; domainId: string }): Promise<IpcResponse<unknown>> => {
        try {
          if (!request.ontologyId || !request.domainId) {
            return {
              success: false,
              error: { code: 'INVALID_REQUEST', message: 'ontologyId and domainId are required' },
              timestamp: new Date().toISOString(),
            };
          }
          await deleteDomain(request.ontologyId, request.domainId);
          return {
            success: true,
            data: { deleted: true },
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Delete domain failed');
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_LIST,
      async (_event, ontologyId: string): Promise<IpcResponse<unknown>> => {
        try {
          console.log('[OntologyDataService] concept:list request', {
            ontologyId,
            schemaPath: ontologyId ? schemaPath(ontologyId) : null,
            exists: ontologyId ? existsSync(schemaPath(ontologyId)) : false,
          });
          const ontology = await loadOrCreateOntology(ontologyId);
          console.log('[OntologyDataService] concept:list result', {
            ontologyId,
            conceptsCount: ontology.concepts.length,
            domainsCount: ontology.domains.length,
            relationsCount: ontology.relations?.length ?? 0,
          });
          return {
            success: true,
            data: { concepts: ontology.concepts, count: ontology.concepts.length },
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] List concepts failed', { ontologyId });
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_CREATE,
      async (_event, request: { ontologyId: string; domainId: string; name: string; type: string; description?: string; attributes?: Record<string, unknown> }): Promise<IpcResponse<unknown>> => {
        try {
          if (!request.ontologyId || !request.domainId || !request.name || !request.type) {
            return {
              success: false,
              error: { code: 'INVALID_REQUEST', message: 'ontologyId, domainId, name, and type are required' },
              timestamp: new Date().toISOString(),
            };
          }
          const concept = await createConcept(
            request.ontologyId,
            request.domainId,
            request.name,
            request.type,
            request.description,
            request.attributes as Record<string, { type: string; required?: boolean; description?: string; enum?: string[] }> | undefined
          );
          return {
            success: true,
            data: concept,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Create concept failed');
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_INSTANCE_LIST,
      async (_event, request: { ontologyId: string; conceptId: string; page?: number; limit?: number }): Promise<IpcResponse<unknown>> => {
        try {
          if (!request.ontologyId || !request.conceptId) {
            return {
              success: false,
              error: { code: 'INVALID_REQUEST', message: 'ontologyId and conceptId are required' },
              timestamp: new Date().toISOString(),
            };
          }
          const result = await queryInstances(request.ontologyId, request.conceptId, {
            page: request.page,
            limit: request.limit,
          });
          return {
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] List instances failed');
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_INSTANCE_CREATE,
      async (_event, request: { ontologyId: string; conceptId: string; fields: Record<string, unknown>; createdBy?: 'user' | 'agent' | 'skill' }): Promise<IpcResponse<unknown>> => {
        try {
          if (!request.ontologyId || !request.conceptId || !request.fields) {
            return {
              success: false,
              error: { code: 'INVALID_REQUEST', message: 'ontologyId, conceptId, and fields are required' },
              timestamp: new Date().toISOString(),
            };
          }
          const instance = await createInstance(request.ontologyId, request.conceptId, request.fields, request.createdBy ?? 'user');
          return {
            success: true,
            data: instance,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Create instance failed');
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_INSTANCE_UPDATE,
      async (_event, request: { ontologyId: string; instanceId: string; conceptId: string; domainId: string; fields: Record<string, unknown> }): Promise<IpcResponse<unknown>> => {
        try {
          if (!request.ontologyId || !request.instanceId || !request.conceptId || !request.fields) {
            return {
              success: false,
              error: { code: 'INVALID_REQUEST', message: 'ontologyId, instanceId, conceptId, and fields are required' },
              timestamp: new Date().toISOString(),
            };
          }
          const updated = await updateInstance(request.ontologyId, request.conceptId, request.instanceId, request.fields);
          return {
            success: true,
            data: updated,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Update instance failed');
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_INSTANCE_DELETE,
      async (_event, request: { ontologyId: string; instanceId: string; conceptId: string; domainId: string }): Promise<IpcResponse<unknown>> => {
        try {
          if (!request.ontologyId || !request.instanceId || !request.conceptId) {
            return {
              success: false,
              error: { code: 'INVALID_REQUEST', message: 'ontologyId, instanceId, and conceptId are required' },
              timestamp: new Date().toISOString(),
            };
          }
          await deleteInstance(request.ontologyId, request.conceptId, request.instanceId);
          return {
            success: true,
            data: { deleted: true },
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Delete instance failed');
        }
      }
    );

    // ── Sync ──────────────────────────────────────────────────────

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_SYNC,
      async (_event, request: { ontologyId: string }): Promise<IpcResponse<unknown>> => {
        try {
          const { ontologyId } = request;
          const projectId = projectIdFromOntologyId(ontologyId);
          const ontologyPath = schemaPath(ontologyId);
          const businessModelPath = path.join(getDataRoot(), 'projects', projectId, 'output', 'business-model.json');

          if (!existsSync(ontologyPath) || !existsSync(businessModelPath)) {
            return {
              success: true,
              data: { conceptsCount: 0, relationsCount: 0, skipped: true },
              timestamp: new Date().toISOString(),
            };
          }

          const ontology = JSON.parse(await fs.readFile(ontologyPath, 'utf-8'));
          const bm = JSON.parse(await fs.readFile(businessModelPath, 'utf-8'));

          const domainId = 'domain_main';
          const now = new Date().toISOString();

          // name → existing conceptId 映射（保留已有 id）
          const nameToConceptId = new Map<string, string>();
          for (const concept of (ontology.concepts ?? [])) {
            nameToConceptId.set(concept.name, concept.id);
          }

          // 构建 concepts
          const newConcepts: Array<{ id: string; domainId: string; name: string; type: string; description?: string; attributes?: Record<string, unknown> }> = [];
          const newNameToConceptId = new Map<string, string>();

          if (Array.isArray(bm.entities)) {
            for (let i = 0; i < bm.entities.length; i++) {
              const entity = bm.entities[i];
              const entityName = typeof entity === 'string' ? entity : (entity.name || entity.label || `实体${i}`);
              const entityDef = typeof entity === 'string' ? '' : (entity.definition || entity.description || '');
              const conceptId = nameToConceptId.get(entityName) ?? `concept_${Date.now()}_${i}`;
              const newConcept: typeof newConcepts[number] = { id: conceptId, domainId, name: entityName, type: 'entity', description: entityDef };
              const entityAttrs = typeof entity === 'string' ? {} : (entity.properties ?? {});
              const attrs: Record<string, unknown> = {};
              for (const [attrName, attrDesc] of Object.entries(entityAttrs)) {
                attrs[attrName] = { type: 'string', description: typeof attrDesc === 'string' ? attrDesc : '' };
              }
              if (Object.keys(attrs).length > 0) newConcept.attributes = attrs;
              newConcepts.push(newConcept);
              newNameToConceptId.set(entityName, conceptId);

              const conceptDataDir = path.join(getDataRoot(), 'projects', projectId, 'ontology', 'data', domainId, conceptId);
              if (!existsSync(conceptDataDir)) {
                await fs.mkdir(conceptDataDir, { recursive: true });
                const indexFilePath = path.join(conceptDataDir, '_index.json');
                if (!existsSync(indexFilePath)) {
                  await fs.writeFile(indexFilePath, JSON.stringify({ instanceIds: [] }), 'utf-8');
                }
              }
            }
          }

          // 构建 relations
          const relations: Array<{ id: string; sourceId: string; targetId: string; type: string; cardinality: string }> = [];
          if (Array.isArray(bm.relationships)) {
            for (let i = 0; i < bm.relationships.length; i++) {
              const rel = bm.relationships[i];
              const sourceId = newNameToConceptId.get(rel.from);
              const targetId = newNameToConceptId.get(rel.to);
              if (sourceId && targetId) {
                relations.push({ id: `rel_${i}`, sourceId, targetId, type: rel.type || 'related_to', cardinality: rel.cardinality || 'N:M' });
              }
            }
          }

          const domains = [{ id: domainId, name: bm.projectName || '主域', description: bm.background || '' }];

          ontology.concepts = newConcepts;
          ontology.relations = relations;
          ontology.domains = domains;
          ontology.updatedAt = now;
          ontology.metadata = { synced_from: 'business-model.json', synced_at: now };

          await fs.writeFile(ontologyPath, JSON.stringify(ontology, null, 2), 'utf-8');

          return {
            success: true,
            data: { synced: true, conceptsCount: newConcepts.length, relationsCount: relations.length },
            timestamp: now,
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Sync ontology data failed');
        }
      }
    );

    // ── Concept Schema ────────────────────────────────────────────

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_SCHEMA_GET,
      async (_event, request: { conceptId: string; ontologyId: string }): Promise<IpcResponse<unknown>> => {
        try {
          console.log('[OntologyDataService] concept:schema:get request', {
            ontologyId: request.ontologyId,
            conceptId: request.conceptId,
            schemaPath: schemaPath(request.ontologyId),
            exists: existsSync(schemaPath(request.ontologyId)),
          });
          const schema = await loadConceptSchema(request.ontologyId, request.conceptId);
          console.log('[OntologyDataService] concept:schema:get result', {
            ontologyId: request.ontologyId,
            conceptId: request.conceptId,
            fieldsCount: schema.fields.length,
          });
          return {
            success: true,
            data: schema,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Get concept schema failed', request);
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_SCHEMA_UPDATE,
      async (_event, request: { conceptId: string; ontologyId: string; domainId: string; fields: unknown[] }): Promise<IpcResponse<unknown>> => {
        try {
          await updateConceptSchema(request.ontologyId, request.conceptId, fieldsToAttributes(request.fields));
          return {
            success: true,
            data: { updated: true },
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Update concept schema failed');
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_DELETE,
      async (_event, request: { conceptId: string; ontologyId: string; domainId: string }): Promise<IpcResponse<unknown>> => {
        try {
          await deleteConcept(request.ontologyId, request.conceptId);
          return {
            success: true,
            data: { deleted: true },
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Delete concept failed');
        }
      }
    );

    // ── Relations ─────────────────────────────────────────────────

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_RELATION_INSTANCE_LIST,
      async (_event, request: { ontologyId: string }): Promise<IpcResponse<unknown>> => {
        try {
          const relations = await listInstanceRelations(request.ontologyId);
          return {
            success: true,
            data: relations,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] List instance relations failed');
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_RELATION_CONCEPT_LIST,
      async (_event, request: { ontologyId: string }): Promise<IpcResponse<unknown>> => {
        try {
          console.log('[OntologyDataService] relation:concept:list request', {
            ontologyId: request.ontologyId,
            schemaPath: request.ontologyId ? schemaPath(request.ontologyId) : null,
            exists: request.ontologyId ? existsSync(schemaPath(request.ontologyId)) : false,
          });
          const ontology = await loadOrCreateOntology(request.ontologyId);
          console.log('[OntologyDataService] relation:concept:list result', {
            ontologyId: request.ontologyId,
            relationsCount: ontology.relations?.length ?? 0,
          });
          return {
            success: true,
            data: { relations: ontology.relations ?? [] },
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] List concept relations failed', request);
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_RELATION_CONCEPT_CREATE,
      async (_event, request: { ontologyId: string; sourceId: string; targetId: string; type: string; cardinality: string }): Promise<IpcResponse<unknown>> => {
        try {
          const result = await createConceptRelation(request.ontologyId, request.sourceId, request.targetId, request.type, request.cardinality || 'N:M');
          return {
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Create concept relation failed');
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_RELATION_CONCEPT_DELETE,
      async (_event, request: { ontologyId: string; relationId: string }): Promise<IpcResponse<unknown>> => {
        try {
          await deleteConceptRelation(request.ontologyId, request.relationId);
          return {
            success: true,
            data: { deleted: true },
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Delete concept relation failed');
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_RELATION_INSTANCE_CREATE,
      async (_event, request: { ontologyId: string; sourceInstanceId: string; targetInstanceId: string; type: string; sourceConceptId: string; targetConceptId: string }): Promise<IpcResponse<unknown>> => {
        try {
          const relation = await createInstanceRelation(request.ontologyId, {
            sourceInstanceId: request.sourceInstanceId,
            targetInstanceId: request.targetInstanceId,
            type: request.type,
            sourceConceptId: request.sourceConceptId,
            targetConceptId: request.targetConceptId,
          });
          return {
            success: true,
            data: relation,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Create instance relation failed');
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.ONTOLOGY_DATA_RELATION_INSTANCE_DELETE,
      async (_event, request: { ontologyId: string; relationId: string }): Promise<IpcResponse<unknown>> => {
        try {
          await deleteInstanceRelation(request.ontologyId, request.relationId);
          return {
            success: true,
            data: { deleted: true },
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          return this.toErrorResponse(error, '[OntologyDataService] Delete instance relation failed');
        }
      }
    );
  }

  private toErrorResponse<T>(error: unknown, logMessage: string, context?: unknown): IpcResponse<T> {
    console.error(logMessage, context ?? '', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
