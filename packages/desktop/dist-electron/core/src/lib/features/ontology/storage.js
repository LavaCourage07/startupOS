"use strict";
/**
 * Memory Ontology Storage
 *
 * Shared in-memory storage for ontology entities and relations.
 * This should be replaced with proper persistent storage in production.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ontologyStorage = void 0;
class MemoryOntologyStorage {
    constructor() {
        this.entities = new Map();
        this.relations = [];
    }
    // Entity operations
    createEntity(entity) {
        const now = new Date().toISOString();
        this.entities.set(entity.id, {
            ...entity,
            created: entity.created || now,
            updated: entity.updated || now,
        });
        return this.entities.get(entity.id);
    }
    getEntity(id) {
        return this.entities.get(id) || null;
    }
    updateEntity(id, properties) {
        const entity = this.entities.get(id);
        if (!entity)
            return null;
        entity.properties = { ...entity.properties, ...properties };
        entity.updated = new Date().toISOString();
        return entity;
    }
    deleteEntity(id) {
        const deleted = this.entities.delete(id);
        // Also remove relations involving this entity
        this.relations = this.relations.filter((r) => r.from !== id && r.to !== id);
        return deleted;
    }
    listEntities(type) {
        const entities = Array.from(this.entities.values());
        if (!type)
            return entities;
        return entities.filter((e) => e.type === type);
    }
    queryEntities(type, where) {
        const entities = this.listEntities(type);
        return entities.filter((entity) => {
            for (const [key, value] of Object.entries(where)) {
                if (entity.properties[key] !== value) {
                    return false;
                }
            }
            return true;
        });
    }
    // Relation operations
    createRelation(relation) {
        this.relations.push(relation);
        return relation;
    }
    getRelations(from, relType, to) {
        return this.relations.filter((r) => {
            if (from && r.from !== from)
                return false;
            if (relType && r.rel !== relType)
                return false;
            if (to && r.to !== to)
                return false;
            return true;
        });
    }
    getRelated(entityId, relType, direction = 'outgoing') {
        const results = [];
        const matchingRelations = relType ? this.getRelations(undefined, relType) : this.relations;
        for (const rel of matchingRelations) {
            if (direction === 'outgoing' || direction === 'both') {
                if (rel.from === entityId) {
                    const entity = this.getEntity(rel.to);
                    if (entity) {
                        results.push({ relation: rel.rel, entity });
                    }
                }
            }
            if (direction === 'incoming' || direction === 'both') {
                if (rel.to === entityId) {
                    const entity = this.getEntity(rel.from);
                    if (entity) {
                        results.push({ relation: rel.rel, entity });
                    }
                }
            }
        }
        return results;
    }
    deleteRelation(from, rel, to) {
        const initialLength = this.relations.length;
        this.relations = this.relations.filter((r) => !(r.from === from && r.rel === rel && r.to === to));
        return this.relations.length < initialLength;
    }
    // Validation
    validateGraph() {
        const errors = [];
        // Check for dangling relations
        for (const rel of this.relations) {
            if (!this.entities.has(rel.from)) {
                errors.push(`Relation from non-existent entity: ${rel.from}`);
            }
            if (!this.entities.has(rel.to)) {
                errors.push(`Relation to non-existent entity: ${rel.to}`);
            }
        }
        // Check for self-loops (optional, might be valid)
        // if (this.relations.some(r => r.from === r.to)) {
        //   errors.push('Self-loops detected');
        // }
        return errors;
    }
    // Utility
    clear() {
        this.entities.clear();
        this.relations.length = 0;
    }
    getStats() {
        return {
            entityCount: this.entities.size,
            relationCount: this.relations.length,
            entityTypes: Array.from(new Set(Array.from(this.entities.values()).map((e) => e.type))),
        };
    }
}
// Export singleton
exports.ontologyStorage = new MemoryOntologyStorage();
