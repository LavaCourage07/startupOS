"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OntologyDataService = void 0;
const electron_1 = require("electron");
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const ipc_protocol_1 = require("../ipc-protocol");
const config_1 = require("../../../../core/src/lib/features/ontology-data-store/config");
const paths_1 = require("../../../../core/src/lib/paths");
const ontology_ops_1 = require("../../../../core/src/lib/features/ontology-data-store/ontology-ops");
const store_1 = require("../../../../core/src/lib/features/ontology-data-store/store");
const instance_relations_1 = require("../../../../core/src/lib/features/ontology-data-store/instance-relations");
const query_engine_1 = require("../../../../core/src/lib/features/ontology-data-store/query-engine");
const schema_validator_1 = require("../../../../core/src/lib/features/ontology-data-store/schema-validator");
function fieldsToAttributes(fields) {
    const attributes = {};
    for (const field of fields) {
        if (!field || typeof field !== 'object')
            continue;
        const typedField = field;
        if (!typedField.name || !typedField.type)
            continue;
        attributes[typedField.name] = {
            type: typedField.type,
            required: typedField.required,
            description: typedField.description,
            enum: typedField.enum,
        };
    }
    return attributes;
}
class OntologyDataService {
    constructor() {
        this.registerHandlers();
    }
    registerHandlers() {
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_DOMAIN_CREATE, async (_event, request) => {
            try {
                if (!request.ontologyId || !request.name) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'ontologyId and name are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const domain = await (0, ontology_ops_1.createDomain)(request.ontologyId, request.name, request.description);
                return {
                    success: true,
                    data: domain,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Create domain failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_DOMAIN_DELETE, async (_event, request) => {
            try {
                if (!request.ontologyId || !request.domainId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'ontologyId and domainId are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                await (0, ontology_ops_1.deleteDomain)(request.ontologyId, request.domainId);
                return {
                    success: true,
                    data: { deleted: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Delete domain failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_LIST, async (_event, ontologyId) => {
            try {
                console.log('[OntologyDataService] concept:list request', {
                    ontologyId,
                    schemaPath: ontologyId ? (0, config_1.schemaPath)(ontologyId) : null,
                    exists: ontologyId ? (0, fs_1.existsSync)((0, config_1.schemaPath)(ontologyId)) : false,
                });
                const ontology = await (0, ontology_ops_1.loadOrCreateOntology)(ontologyId);
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
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] List concepts failed', { ontologyId });
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_CREATE, async (_event, request) => {
            try {
                if (!request.ontologyId || !request.domainId || !request.name || !request.type) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'ontologyId, domainId, name, and type are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const concept = await (0, ontology_ops_1.createConcept)(request.ontologyId, request.domainId, request.name, request.type, request.description, request.attributes);
                return {
                    success: true,
                    data: concept,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Create concept failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_INSTANCE_LIST, async (_event, request) => {
            try {
                if (!request.ontologyId || !request.conceptId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'ontologyId and conceptId are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const result = await (0, query_engine_1.queryInstances)(request.ontologyId, request.conceptId, {
                    page: request.page,
                    limit: request.limit,
                });
                return {
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] List instances failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_INSTANCE_CREATE, async (_event, request) => {
            try {
                if (!request.ontologyId || !request.conceptId || !request.fields) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'ontologyId, conceptId, and fields are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const instance = await (0, store_1.createInstance)(request.ontologyId, request.conceptId, request.fields, request.createdBy ?? 'user');
                return {
                    success: true,
                    data: instance,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Create instance failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_INSTANCE_UPDATE, async (_event, request) => {
            try {
                if (!request.ontologyId || !request.instanceId || !request.conceptId || !request.fields) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'ontologyId, instanceId, conceptId, and fields are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                const updated = await (0, store_1.updateInstance)(request.ontologyId, request.conceptId, request.instanceId, request.fields);
                return {
                    success: true,
                    data: updated,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Update instance failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_INSTANCE_DELETE, async (_event, request) => {
            try {
                if (!request.ontologyId || !request.instanceId || !request.conceptId) {
                    return {
                        success: false,
                        error: { code: 'INVALID_REQUEST', message: 'ontologyId, instanceId, and conceptId are required' },
                        timestamp: new Date().toISOString(),
                    };
                }
                await (0, store_1.deleteInstance)(request.ontologyId, request.conceptId, request.instanceId);
                return {
                    success: true,
                    data: { deleted: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Delete instance failed');
            }
        });
        // ── Sync ──────────────────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_SYNC, async (_event, request) => {
            try {
                const { ontologyId } = request;
                const projectId = (0, config_1.projectIdFromOntologyId)(ontologyId);
                const ontologyPath = (0, config_1.schemaPath)(ontologyId);
                const businessModelPath = path_1.default.join((0, paths_1.getDataRoot)(), 'projects', projectId, 'output', 'business-model.json');
                if (!(0, fs_1.existsSync)(ontologyPath) || !(0, fs_1.existsSync)(businessModelPath)) {
                    return {
                        success: true,
                        data: { conceptsCount: 0, relationsCount: 0, skipped: true },
                        timestamp: new Date().toISOString(),
                    };
                }
                const ontology = JSON.parse(await promises_1.default.readFile(ontologyPath, 'utf-8'));
                const bm = JSON.parse(await promises_1.default.readFile(businessModelPath, 'utf-8'));
                const domainId = 'domain_main';
                const now = new Date().toISOString();
                // name → existing conceptId 映射（保留已有 id）
                const nameToConceptId = new Map();
                for (const concept of (ontology.concepts ?? [])) {
                    nameToConceptId.set(concept.name, concept.id);
                }
                // 构建 concepts
                const newConcepts = [];
                const newNameToConceptId = new Map();
                if (Array.isArray(bm.entities)) {
                    for (let i = 0; i < bm.entities.length; i++) {
                        const entity = bm.entities[i];
                        const entityName = typeof entity === 'string' ? entity : (entity.name || entity.label || `实体${i}`);
                        const entityDef = typeof entity === 'string' ? '' : (entity.definition || entity.description || '');
                        const conceptId = nameToConceptId.get(entityName) ?? `concept_${Date.now()}_${i}`;
                        const newConcept = { id: conceptId, domainId, name: entityName, type: 'entity', description: entityDef };
                        const entityAttrs = typeof entity === 'string' ? {} : (entity.properties ?? {});
                        const attrs = {};
                        for (const [attrName, attrDesc] of Object.entries(entityAttrs)) {
                            attrs[attrName] = { type: 'string', description: typeof attrDesc === 'string' ? attrDesc : '' };
                        }
                        if (Object.keys(attrs).length > 0)
                            newConcept.attributes = attrs;
                        newConcepts.push(newConcept);
                        newNameToConceptId.set(entityName, conceptId);
                        const conceptDataDir = path_1.default.join((0, paths_1.getDataRoot)(), 'projects', projectId, 'ontology', 'data', domainId, conceptId);
                        if (!(0, fs_1.existsSync)(conceptDataDir)) {
                            await promises_1.default.mkdir(conceptDataDir, { recursive: true });
                            const indexFilePath = path_1.default.join(conceptDataDir, '_index.json');
                            if (!(0, fs_1.existsSync)(indexFilePath)) {
                                await promises_1.default.writeFile(indexFilePath, JSON.stringify({ instanceIds: [] }), 'utf-8');
                            }
                        }
                    }
                }
                // 构建 relations
                const relations = [];
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
                await promises_1.default.writeFile(ontologyPath, JSON.stringify(ontology, null, 2), 'utf-8');
                return {
                    success: true,
                    data: { synced: true, conceptsCount: newConcepts.length, relationsCount: relations.length },
                    timestamp: now,
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Sync ontology data failed');
            }
        });
        // ── Concept Schema ────────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_SCHEMA_GET, async (_event, request) => {
            try {
                console.log('[OntologyDataService] concept:schema:get request', {
                    ontologyId: request.ontologyId,
                    conceptId: request.conceptId,
                    schemaPath: (0, config_1.schemaPath)(request.ontologyId),
                    exists: (0, fs_1.existsSync)((0, config_1.schemaPath)(request.ontologyId)),
                });
                const schema = await (0, schema_validator_1.loadConceptSchema)(request.ontologyId, request.conceptId);
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
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Get concept schema failed', request);
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_SCHEMA_UPDATE, async (_event, request) => {
            try {
                await (0, ontology_ops_1.updateConceptSchema)(request.ontologyId, request.conceptId, fieldsToAttributes(request.fields));
                return {
                    success: true,
                    data: { updated: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Update concept schema failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_CONCEPT_DELETE, async (_event, request) => {
            try {
                await (0, ontology_ops_1.deleteConcept)(request.ontologyId, request.conceptId);
                return {
                    success: true,
                    data: { deleted: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Delete concept failed');
            }
        });
        // ── Relations ─────────────────────────────────────────────────
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_RELATION_INSTANCE_LIST, async (_event, request) => {
            try {
                const relations = await (0, instance_relations_1.listInstanceRelations)(request.ontologyId);
                return {
                    success: true,
                    data: relations,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] List instance relations failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_RELATION_CONCEPT_LIST, async (_event, request) => {
            try {
                console.log('[OntologyDataService] relation:concept:list request', {
                    ontologyId: request.ontologyId,
                    schemaPath: request.ontologyId ? (0, config_1.schemaPath)(request.ontologyId) : null,
                    exists: request.ontologyId ? (0, fs_1.existsSync)((0, config_1.schemaPath)(request.ontologyId)) : false,
                });
                const ontology = await (0, ontology_ops_1.loadOrCreateOntology)(request.ontologyId);
                console.log('[OntologyDataService] relation:concept:list result', {
                    ontologyId: request.ontologyId,
                    relationsCount: ontology.relations?.length ?? 0,
                });
                return {
                    success: true,
                    data: { relations: ontology.relations ?? [] },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] List concept relations failed', request);
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_RELATION_CONCEPT_CREATE, async (_event, request) => {
            try {
                const result = await (0, ontology_ops_1.createConceptRelation)(request.ontologyId, request.sourceId, request.targetId, request.type, request.cardinality || 'N:M');
                return {
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Create concept relation failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_RELATION_CONCEPT_DELETE, async (_event, request) => {
            try {
                await (0, ontology_ops_1.deleteConceptRelation)(request.ontologyId, request.relationId);
                return {
                    success: true,
                    data: { deleted: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Delete concept relation failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_RELATION_INSTANCE_CREATE, async (_event, request) => {
            try {
                const relation = await (0, instance_relations_1.createInstanceRelation)(request.ontologyId, {
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
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Create instance relation failed');
            }
        });
        electron_1.ipcMain.handle(ipc_protocol_1.IPC_CHANNELS.ONTOLOGY_DATA_RELATION_INSTANCE_DELETE, async (_event, request) => {
            try {
                await (0, instance_relations_1.deleteInstanceRelation)(request.ontologyId, request.relationId);
                return {
                    success: true,
                    data: { deleted: true },
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return this.toErrorResponse(error, '[OntologyDataService] Delete instance relation failed');
            }
        });
    }
    toErrorResponse(error, logMessage, context) {
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
exports.OntologyDataService = OntologyDataService;
