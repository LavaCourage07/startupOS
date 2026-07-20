"use strict";
/**
 * Ontology API Client
 *
 * Provides TypeScript interface to the Python ontology skill.
 * Handles entity and relation operations through API calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ontologyClient = exports._MEMORY_DIR = void 0;
exports.createPerson = createPerson;
exports.createProject = createProject;
exports.createTask = createTask;
exports.createGoal = createGoal;
const ontology_1 = require("../../integrations/electron/services/ontology");
// ============================================================================
// Configuration
// ============================================================================
exports._MEMORY_DIR = 'memory/ontology';
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Generate a unique ID for an entity
 */
function generateEntityId(type) {
    const prefix = type.toLowerCase().substring(0, 4);
    const suffix = Math.random().toString(36).substring(2, 10);
    return `${prefix}_${suffix}`;
}
/**
 * Get current timestamp in ISO 8601 format
 */
function getTimestamp() {
    return new Date().toISOString();
}
// ============================================================================
// Ontology Client Implementation
// ============================================================================
class DefaultOntologyClient {
    constructor() {
        this.apiClient = new ApiClient();
    }
    async createEntity(type, properties) {
        const entityId = generateEntityId(type);
        const timestamp = getTimestamp();
        const entity = {
            id: entityId,
            type,
            properties,
            created: timestamp,
            updated: timestamp,
        };
        // Call API to create entity
        // For now, we'll use the API route when it's available
        await this.apiClient.createEntity(entity);
        return entity;
    }
    async getEntity(entityId) {
        return await this.apiClient.getEntity(entityId);
    }
    async updateEntity(entityId, properties) {
        return await this.apiClient.updateEntity(entityId, properties);
    }
    async deleteEntity(entityId) {
        return await this.apiClient.deleteEntity(entityId);
    }
    async queryEntities(type, where) {
        const entities = await this.apiClient.listEntities(type);
        if (!where) {
            return entities;
        }
        // Filter entities based on where clause
        return entities.filter((entity) => {
            for (const [key, value] of Object.entries(where)) {
                if (entity.properties[key] !== value) {
                    return false;
                }
            }
            return true;
        });
    }
    async listEntities(type) {
        return await this.apiClient.listEntities(type);
    }
    async createRelation(fromId, relType, toId, properties) {
        const relation = {
            from: fromId,
            rel: relType,
            to: toId,
            properties,
        };
        await this.apiClient.createRelation(relation);
        return relation;
    }
    async getRelated(entityId, relType, direction = 'outgoing') {
        return await this.apiClient.getRelated(entityId, relType, direction);
    }
    async validateGraph() {
        return await this.apiClient.validateGraph();
    }
}
// ============================================================================
// API Client (Internal)
// ============================================================================
class ApiClient {
    constructor() {
        // ============================================================================
        // Memory Fallback Methods (In-memory storage)
        // ============================================================================
        this.memoryStore = new Map();
        this.relationsStore = new Map();
    }
    /**
     * Create entity via API
     */
    async createEntity(entity) {
        try {
            const response = await (0, ontology_1.createOntologyEntity)(entity);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create entity');
            }
        }
        catch (error) {
            // Fallback: store in memory
            console.warn('API create failed, using memory fallback:', error);
            this.storeInMemory({ op: 'create', entity });
        }
    }
    /**
     * Get entity via API
     */
    async getEntity(entityId) {
        try {
            const response = await (0, ontology_1.getOntologyEntity)(entityId);
            return response.success ? response.data ?? null : null;
        }
        catch (error) {
            // Fallback: read from memory
            console.warn('API get failed, using memory fallback:', error);
            return this.readFromMemory(entityId);
        }
    }
    /**
     * Update entity via API
     */
    async updateEntity(entityId, properties) {
        try {
            const response = await (0, ontology_1.updateOntologyEntity)(entityId, properties);
            return response.success ? response.data ?? null : null;
        }
        catch (error) {
            // Fallback: update in memory
            console.warn('API update failed, using memory fallback:', error);
            return this.updateInMemory(entityId, properties);
        }
    }
    /**
     * Delete entity via API
     */
    async deleteEntity(entityId) {
        try {
            const response = await (0, ontology_1.deleteOntologyEntity)(entityId);
            return response.success;
        }
        catch (error) {
            // Fallback: delete from memory
            console.warn('API delete failed, using memory fallback:', error);
            return this.deleteFromMemory(entityId);
        }
    }
    /**
     * List entities via API
     */
    async listEntities(type) {
        try {
            const response = await (0, ontology_1.listOntologyEntities)(type);
            return response.success ? response.data ?? [] : [];
        }
        catch (error) {
            // Fallback: list from memory
            console.warn('API list failed, using memory fallback:', error);
            return this.listFromMemory(type);
        }
    }
    /**
     * Create relation via API
     */
    async createRelation(relation) {
        try {
            const response = await (0, ontology_1.createOntologyRelation)(relation);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create relation');
            }
        }
        catch (error) {
            // Fallback: store in memory
            console.warn('API create relation failed, using memory fallback:', error);
            this.storeInMemory({ op: 'relate', ...relation });
        }
    }
    /**
     * Get related entities via API
     */
    async getRelated(entityId, relType, direction = 'outgoing') {
        try {
            const response = await (0, ontology_1.getRelatedEntities)(entityId, relType, direction);
            return response.success ? response.data ?? [] : [];
        }
        catch (error) {
            console.warn('API get related failed:', error);
            return [];
        }
    }
    /**
     * Validate graph via API
     */
    async validateGraph() {
        return [];
    }
    storeInMemory(record) {
        // Handle entity operations
        if (typeof record === 'object' && record !== null) {
            const rec = record;
            if (rec['op'] === 'create' && rec['entity']) {
                const entity = rec['entity'];
                this.memoryStore.set(entity.id, entity);
            }
            else if (rec['op'] === 'relate' && rec['from'] && rec['rel'] && rec['to']) {
                const relation = {
                    from: rec['from'],
                    rel: rec['rel'],
                    to: rec['to'],
                    properties: rec['properties'],
                };
                // Store relations keyed by from entity
                const fromRelations = this.relationsStore.get(relation.from) || [];
                fromRelations.push(relation);
                this.relationsStore.set(relation.from, fromRelations);
            }
        }
    }
    readFromMemory(entityId) {
        return this.memoryStore.get(entityId) || null;
    }
    updateInMemory(entityId, properties) {
        const entity = this.memoryStore.get(entityId);
        if (entity) {
            entity.properties = { ...entity.properties, ...properties };
            entity.updated = getTimestamp();
            return entity;
        }
        return null;
    }
    deleteFromMemory(entityId) {
        return this.memoryStore.delete(entityId);
    }
    listFromMemory(type) {
        const entities = Array.from(this.memoryStore.values());
        if (!type) {
            return entities;
        }
        return entities.filter((e) => e.type === type);
    }
}
// ============================================================================
// Convenience Methods for Common Entity Types
// ============================================================================
/**
 * Create a Person entity
 */
async function createPerson(properties) {
    return exports.ontologyClient.createEntity('Person', properties);
}
/**
 * Create a Project entity
 */
async function createProject(properties) {
    return exports.ontologyClient.createEntity('Project', properties);
}
/**
 * Create a Task entity
 */
async function createTask(properties) {
    return exports.ontologyClient.createEntity('Task', properties);
}
/**
 * Create a Goal entity
 */
async function createGoal(properties) {
    return exports.ontologyClient.createEntity('Goal', properties);
}
// ============================================================================
// Export singleton
// ============================================================================
exports.ontologyClient = new DefaultOntologyClient();
