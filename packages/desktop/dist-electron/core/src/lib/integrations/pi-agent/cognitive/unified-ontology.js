"use strict";
/**
 * Unified Ontology Model — Entity / Attribute / Relation / Rule
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedOntology = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class UnifiedOntology {
    constructor(init) {
        this.nextEntitySeq = 0;
        this.nextRelationSeq = 0;
        this.nextRuleSeq = 0;
        this.id = init.id;
        this.projectId = init.projectId;
        this.name = init.name;
        this.entities = init.entities ?? [];
        this.relations = init.relations ?? [];
        this.rules = init.rules ?? [];
        this.typeSchemas = init.typeSchemas ?? {};
        this.version = init.version ?? '1.0.0';
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
        // 注册内置结构约定（知识本体基础类型）
        this.registerDefaultSchemas();
        // 从已有实体恢复序列号
        if (this.entities.length > 0) {
            for (const e of this.entities) {
                const m = e.id.match(/-(\d+)$/);
                if (m)
                    this.nextEntitySeq = Math.max(this.nextEntitySeq, parseInt(m[1]) + 1);
            }
        }
        for (const r of this.relations) {
            const m = r.id.match(/-(\d+)$/);
            if (m)
                this.nextRelationSeq = Math.max(this.nextRelationSeq, parseInt(m[1]) + 1);
        }
        for (const r of this.rules) {
            const m = r.id.match(/-(\d+)$/);
            if (m)
                this.nextRuleSeq = Math.max(this.nextRuleSeq, parseInt(m[1]) + 1);
        }
    }
    // ---- Entity CRUD ----
    createEntity(type, name, attributes = {}) {
        const schema = this.typeSchemas[type];
        const now = Date.now();
        const id = `entity-${this.nextEntitySeq++}`;
        const attrs = [];
        if (schema) {
            for (const as of schema.attributes) {
                const val = attributes[as.key];
                if (as.required && val === undefined) {
                    throw new Error(`Missing required attribute '${as.key}' for type '${type}'`);
                }
                if (val !== undefined) {
                    attrs.push({ key: as.key, value: val, type: as.type, required: as.required, description: as.description });
                }
            }
        }
        else {
            for (const [key, val] of Object.entries(attributes)) {
                attrs.push({ key, value: val, type: inferType(val) });
            }
        }
        const entity = { id, type, name, attributes: attrs, createdAt: now, updatedAt: now };
        this.entities.push(entity);
        this.updatedAt = now;
        return entity;
    }
    updateEntity(entityId, attributes) {
        const entity = this.entities.find(e => e.id === entityId);
        if (!entity)
            return null;
        for (const [key, val] of Object.entries(attributes)) {
            const existing = entity.attributes.find(a => a.key === key);
            if (existing) {
                existing.value = val;
                existing.type = inferType(val);
            }
            else {
                entity.attributes.push({ key, value: val, type: inferType(val) });
            }
        }
        entity.updatedAt = Date.now();
        this.updatedAt = entity.updatedAt;
        return entity;
    }
    deleteEntity(entityId) {
        const idx = this.entities.findIndex(e => e.id === entityId);
        if (idx === -1)
            return false;
        this.entities.splice(idx, 1);
        // 删除关联关系
        this.relations = this.relations.filter(r => r.sourceId !== entityId && r.targetId !== entityId);
        this.updatedAt = Date.now();
        return true;
    }
    getEntity(id) {
        return this.entities.find(e => e.id === id);
    }
    // ---- Relations ----
    addRelation(sourceId, targetId, type, weight, attributes = {}) {
        const id = `relation-${this.nextRelationSeq++}`;
        const relation = { id, sourceId, targetId, type, weight, attributes };
        this.relations.push(relation);
        this.updatedAt = Date.now();
        return relation;
    }
    removeRelation(relationId) {
        const idx = this.relations.findIndex(r => r.id === relationId);
        if (idx === -1)
            return false;
        this.relations.splice(idx, 1);
        this.updatedAt = Date.now();
        return true;
    }
    getRelationsForEntity(entityId) {
        return this.relations.filter(r => r.sourceId === entityId || r.targetId === entityId);
    }
    // ---- Rules ----
    addRule(rule) {
        const id = `rule-${this.nextRuleSeq++}`;
        const fullRule = { ...rule, id };
        this.rules.push(fullRule);
        this.updatedAt = Date.now();
        return fullRule;
    }
    removeRule(ruleId) {
        const idx = this.rules.findIndex(r => r.id === ruleId);
        if (idx === -1)
            return false;
        this.rules.splice(idx, 1);
        this.updatedAt = Date.now();
        return true;
    }
    // ---- Validation ----
    validateRules() {
        const violations = [];
        for (const rule of this.rules) {
            if (!rule.enabled)
                continue;
            const v = this.evaluateRule(rule);
            if (v)
                violations.push(v);
        }
        return { valid: violations.length === 0, violations };
    }
    evaluateRule(rule) {
        // 结构化规则：执行 json-logic 求值
        if (rule.expression?.format === 'json-logic') {
            const result = evaluateJsonLogic(rule.expression.body, this);
            if (result === false) {
                return { ruleId: rule.id, ruleName: rule.name, severity: rule.severity, message: rule.description };
            }
            return null;
        }
        // 自然语言规则：不做机器验证，返回 null（由 Agent 判断）
        return null;
    }
    // ---- Query ----
    query(filter) {
        let results = [...this.entities];
        if (filter.type) {
            results = results.filter(e => e.type === filter.type);
        }
        if (filter.attributeKey !== undefined) {
            results = results.filter(e => e.attributes.some(a => a.key === filter.attributeKey));
        }
        if (filter.attributeValue !== undefined) {
            results = results.filter(e => e.attributes.some(a => a.key === filter.attributeKey && JSON.stringify(a.value) === JSON.stringify(filter.attributeValue)));
        }
        if (filter.relatedTo) {
            const relatedIds = new Set();
            for (const r of this.relations) {
                const rt = filter.relationType;
                if (rt && r.type !== rt)
                    continue;
                if (r.sourceId === filter.relatedTo)
                    relatedIds.add(r.targetId);
                if (r.targetId === filter.relatedTo)
                    relatedIds.add(r.sourceId);
            }
            results = results.filter(e => relatedIds.has(e.id));
        }
        return results;
    }
    // ---- Type Schema ----
    registerTypeSchema(schema) {
        this.typeSchemas[schema.typeName] = schema;
    }
    /** 注册内置结构约定（知识本体基础类型） */
    registerDefaultSchemas() {
        // 实体/概念/规则等基础类型
        if (!this.typeSchemas['Concept']) {
            this.typeSchemas['Concept'] = {
                typeName: 'Concept',
                description: '从对话中提取的抽象概念或想法',
                attributes: [
                    { key: 'source', type: 'string', required: false, description: '来源（如 conversation, user-input）' },
                    { key: 'turn', type: 'number', required: false, description: '首次出现的 turn 编号' },
                ],
            };
        }
    }
    // ---- Merge ----
    merge(other) {
        const entityMap = new Map(this.entities.map(e => [e.id, e]));
        for (const e of other.entities) {
            if (!entityMap.has(e.id)) {
                entityMap.set(e.id, e);
            }
        }
        this.entities = Array.from(entityMap.values());
        const relationSet = new Set(this.relations.map(r => r.id));
        for (const r of other.relations) {
            if (!relationSet.has(r.id)) {
                this.relations.push(r);
            }
        }
        const ruleSet = new Set(this.rules.map(r => r.id));
        for (const r of other.rules) {
            if (!ruleSet.has(r.id)) {
                this.rules.push(r);
            }
        }
        for (const [k, v] of Object.entries(other.typeSchemas)) {
            if (!this.typeSchemas[k]) {
                this.typeSchemas[k] = v;
            }
        }
        this.updatedAt = Date.now();
    }
    // ---- Export / Import ----
    toMarkdown() {
        const lines = [];
        lines.push(`# ${this.name}`);
        lines.push('');
        // Entities
        lines.push('## Entities');
        lines.push('');
        const byType = new Map();
        for (const e of this.entities) {
            const list = byType.get(e.type) ?? [];
            list.push(e);
            byType.set(e.type, list);
        }
        for (const [type, entities] of byType) {
            lines.push(`### ${type}`);
            lines.push('');
            for (const e of entities) {
                const attrStr = e.attributes.map(a => `${a.key}: ${formatValue(a.value)}`).join(', ');
                lines.push(`- **${e.name}** (\`${e.id}\`) ${attrStr ? `— ${attrStr}` : ''}`);
            }
            lines.push('');
        }
        // Relations
        if (this.relations.length > 0) {
            lines.push('## Relations');
            lines.push('');
            for (const r of this.relations) {
                const src = this.entities.find(e => e.id === r.sourceId)?.name ?? r.sourceId;
                const tgt = this.entities.find(e => e.id === r.targetId)?.name ?? r.targetId;
                lines.push(`- ${src} → ${tgt} (${r.type})${r.weight != null ? ` [${r.weight}]` : ''}`);
            }
            lines.push('');
        }
        // Rules
        if (this.rules.length > 0) {
            lines.push('## Rules');
            lines.push('');
            for (const r of this.rules) {
                const icon = r.severity === 'error' ? '⛔' : r.severity === 'warning' ? '⚠️' : 'ℹ️';
                lines.push(`- ${icon} **${r.name}** [${r.type}] — ${r.description}`);
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    toJSON() {
        return JSON.stringify({
            id: this.id,
            projectId: this.projectId,
            name: this.name,
            version: this.version,
            entities: this.entities,
            relations: this.relations,
            rules: this.rules,
            typeSchemas: this.typeSchemas,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        }, null, 2);
    }
    static fromJSON(json, projectId) {
        const data = JSON.parse(json);
        return new UnifiedOntology({
            id: data.id,
            projectId: projectId ?? data.projectId,
            name: data.name,
            version: data.version,
            entities: data.entities ?? [],
            relations: data.relations ?? [],
            rules: data.rules ?? [],
            typeSchemas: data.typeSchemas ?? {},
        });
    }
    static fromBusinessModel(json, projectId) {
        const data = JSON.parse(json);
        const id = `ontology-${Date.now()}`;
        const ontology = new UnifiedOntology({
            id,
            projectId: projectId ?? 'default',
            name: data.name ?? 'Business Ontology',
        });
        // 注册业务类型 schema
        const domains = data.domains ?? [];
        for (const domain of domains) {
            const d = domain;
            const domainName = d['name'] ?? 'Unknown';
            const domainId = `entity-${ontology.nextEntitySeq++}`;
            ontology.entities.push({
                id: domainId,
                type: 'BusinessDomain',
                name: domainName,
                attributes: buildAttributes(d),
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            const concepts = d['concepts'] ?? [];
            for (const concept of concepts) {
                const c = concept;
                const conceptName = c['name'] ?? 'Unknown';
                const conceptId = `entity-${ontology.nextEntitySeq++}`;
                ontology.entities.push({
                    id: conceptId,
                    type: 'BusinessConcept',
                    name: conceptName,
                    attributes: buildAttributes(c),
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                });
                ontology.relations.push({
                    id: `relation-${ontology.nextRelationSeq++}`,
                    sourceId: domainId,
                    targetId: conceptId,
                    type: 'contains',
                    attributes: {},
                });
            }
        }
        // 业务规则
        const bizRules = data['rules'] ?? [];
        for (const br of bizRules) {
            const b = br;
            ontology.rules.push({
                id: `rule-${ontology.nextRuleSeq++}`,
                name: b['name'] ?? 'Unnamed Rule',
                type: (b['ruleType'] ?? 'constraint'),
                description: b['description'] ?? '',
                severity: (b['severity'] ?? 'warning'),
                enabled: true,
            });
        }
        return ontology;
    }
    saveToFile(filePath) {
        const dir = path_1.default.dirname(filePath);
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        fs_1.default.writeFileSync(filePath, this.toJSON(), 'utf-8');
    }
    static loadFromFile(filePath, projectId) {
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        return UnifiedOntology.fromJSON(content, projectId);
    }
}
exports.UnifiedOntology = UnifiedOntology;
// ============================================================================
// Helpers
// ============================================================================
function inferType(val) {
    if (typeof val === 'string')
        return 'string';
    if (typeof val === 'number')
        return 'number';
    if (typeof val === 'boolean')
        return 'boolean';
    if (val instanceof Date)
        return 'date';
    if (Array.isArray(val))
        return 'array';
    return 'string';
}
function formatValue(val) {
    if (typeof val === 'string')
        return val;
    return JSON.stringify(val);
}
function buildAttributes(obj) {
    const attrs = [];
    for (const [key, val] of Object.entries(obj)) {
        if (key === 'name' || key === 'id')
            continue;
        attrs.push({ key, value: val, type: inferType(val) });
    }
    return attrs;
}
// 简易 json-logic 求值器（支持基础操作符）
function evaluateJsonLogic(expr, ctx) {
    if (typeof expr !== 'object' || expr === null || Array.isArray(expr)) {
        return expr;
    }
    const obj = expr;
    const keys = Object.keys(obj);
    if (keys.length !== 1)
        return true;
    const op = keys[0];
    const argsVal = Object.values(obj)[0];
    const args = Array.isArray(argsVal) ? argsVal : [];
    switch (op) {
        case '==': return JSON.stringify(evaluateJsonLogic(args[0], ctx)) === JSON.stringify(evaluateJsonLogic(args[1], ctx));
        case '!=': return JSON.stringify(evaluateJsonLogic(args[0], ctx)) !== JSON.stringify(evaluateJsonLogic(args[1], ctx));
        case '>': return evaluateJsonLogic(args[0], ctx) > evaluateJsonLogic(args[1], ctx);
        case '<': return evaluateJsonLogic(args[0], ctx) < evaluateJsonLogic(args[1], ctx);
        case '>=': return evaluateJsonLogic(args[0], ctx) >= evaluateJsonLogic(args[1], ctx);
        case '<=': return evaluateJsonLogic(args[0], ctx) <= evaluateJsonLogic(args[1], ctx);
        case 'and': return args.every(a => evaluateJsonLogic(a, ctx));
        case 'or': return args.some(a => evaluateJsonLogic(a, ctx));
        case 'not': return !evaluateJsonLogic(args[0], ctx);
        case 'if': {
            const cond = evaluateJsonLogic(args[0], ctx);
            return cond ? evaluateJsonLogic(args[1], ctx) : evaluateJsonLogic(args[2] ?? null, ctx);
        }
        case 'filter': {
            const entityType = args[0];
            const predicate = args[1];
            const o = ctx;
            const entities = o['entities']?.filter((e) => e.type === entityType) ?? [];
            return entities.filter((e) => evaluateJsonLogic(predicate, e));
        }
        case 'count': {
            const arr = evaluateJsonLogic(args[0], ctx);
            return Array.isArray(arr) ? arr.length : 0;
        }
        case 'var': {
            const varPath = args[0];
            return resolveVar(ctx, varPath);
        }
        default: return true;
    }
}
function resolveVar(ctx, varPath) {
    if (ctx instanceof UnifiedOntology) {
        if (varPath === 'entities')
            return ctx.entities;
        if (varPath === 'relations')
            return ctx.relations;
        if (varPath === 'rules')
            return ctx.rules;
        if (varPath === 'entityCount')
            return ctx.entities.length;
        if (varPath === 'relationCount')
            return ctx.relations.length;
        if (varPath === 'ruleCount')
            return ctx.rules.length;
    }
    // Entity field access
    const parts = varPath.split('.');
    let current = ctx;
    for (const part of parts) {
        if (current === null || current === undefined)
            return undefined;
        if (typeof current !== 'object')
            return undefined;
        const obj = current;
        current = obj[part];
    }
    return current;
}
