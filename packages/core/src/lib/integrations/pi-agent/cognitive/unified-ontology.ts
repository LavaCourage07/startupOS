/**
 * Unified Ontology Model — Entity / Attribute / Relation / Rule
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// Core Types
// ============================================================================

/** 属性值类型 */
export type AttributeValueType = 'string' | 'number' | 'boolean' | 'date' | 'reference' | 'array';

/** 属性：实体的特征 */
export interface Attribute {
  key: string;
  value: unknown;
  type: AttributeValueType;
  required?: boolean;
  description?: string;
}

/** 实体：任何有独立身份的事物 */
export interface Entity {
  id: string;
  type: string;
  name: string;
  attributes: Attribute[];
  createdAt: number;
  updatedAt: number;
}

/** 关系：实体之间的连接 */
export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight?: number;
  attributes: Record<string, unknown>;
}

/** 结构化规则表达式（混合模式） */
export interface RuleExpression {
  format: 'json-logic' | 'cel' | 'custom';
  body: unknown;
}

/** 规则类型 */
export type RuleType = 'invariant' | 'precondition' | 'postcondition' | 'constraint' | 'derivation';
export type RuleSeverity = 'error' | 'warning' | 'info';

/** 规则：业务约束、不变量、前提/后置条件 */
export interface Rule {
  id: string;
  name: string;
  type: RuleType;
  description: string;
  expression?: RuleExpression;
  severity: RuleSeverity;
  enabled: boolean;
}

/** 属性 schema 定义 */
export interface AttributeSchema {
  key: string;
  type: AttributeValueType;
  required: boolean;
  description?: string;
  refType?: string; // 当 type === 'reference' 时，指向的实体类型
}

/** 实体类型 schema：定义某类实体必须有哪些属性 */
export interface TypeSchema {
  typeName: string;
  description: string;
  attributes: AttributeSchema[];
}

// ============================================================================
// Unified Ontology
// ============================================================================

export interface UnifiedOntologyInit {
  id: string;
  projectId: string;
  name: string;
  version?: string;
  entities?: Entity[];
  relations?: Relation[];
  rules?: Rule[];
  typeSchemas?: Record<string, TypeSchema>;
}

export interface ValidationResult {
  valid: boolean;
  violations: RuleViolation[];
}

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  severity: RuleSeverity;
  message: string;
  entityIds?: string[];
}

export interface QueryFilter {
  type?: string;
  attributeKey?: string;
  attributeValue?: unknown;
  relationType?: string;
  relatedTo?: string; // entity id
}

export class UnifiedOntology {
  id: string;
  projectId: string;
  name: string;
  entities: Entity[];
  relations: Relation[];
  rules: Rule[];
  typeSchemas: Record<string, TypeSchema>;
  version: string;
  createdAt: number;
  updatedAt: number;

  private nextEntitySeq = 0;
  private nextRelationSeq = 0;
  private nextRuleSeq = 0;

  constructor(init: UnifiedOntologyInit) {
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
        if (m) this.nextEntitySeq = Math.max(this.nextEntitySeq, parseInt(m[1]!) + 1);
      }
    }
    for (const r of this.relations) {
      const m = r.id.match(/-(\d+)$/);
      if (m) this.nextRelationSeq = Math.max(this.nextRelationSeq, parseInt(m[1]!) + 1);
    }
    for (const r of this.rules) {
      const m = r.id.match(/-(\d+)$/);
      if (m) this.nextRuleSeq = Math.max(this.nextRuleSeq, parseInt(m[1]!) + 1);
    }
  }

  // ---- Entity CRUD ----

  createEntity(type: string, name: string, attributes: Partial<Record<string, unknown>> = {}): Entity {
    const schema = this.typeSchemas[type];
    const now = Date.now();
    const id = `entity-${this.nextEntitySeq++}`;

    const attrs: Attribute[] = [];
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
    } else {
      for (const [key, val] of Object.entries(attributes)) {
        attrs.push({ key, value: val, type: inferType(val) });
      }
    }

    const entity: Entity = { id, type, name, attributes: attrs, createdAt: now, updatedAt: now };
    this.entities.push(entity);
    this.updatedAt = now;
    return entity;
  }

  updateEntity(entityId: string, attributes: Partial<Record<string, unknown>>): Entity | null {
    const entity = this.entities.find(e => e.id === entityId);
    if (!entity) return null;

    for (const [key, val] of Object.entries(attributes)) {
      const existing = entity.attributes.find(a => a.key === key);
      if (existing) {
        existing.value = val;
        existing.type = inferType(val);
      } else {
        entity.attributes.push({ key, value: val, type: inferType(val) });
      }
    }
    entity.updatedAt = Date.now();
    this.updatedAt = entity.updatedAt;
    return entity;
  }

  deleteEntity(entityId: string): boolean {
    const idx = this.entities.findIndex(e => e.id === entityId);
    if (idx === -1) return false;
    this.entities.splice(idx, 1);
    // 删除关联关系
    this.relations = this.relations.filter(r => r.sourceId !== entityId && r.targetId !== entityId);
    this.updatedAt = Date.now();
    return true;
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.find(e => e.id === id);
  }

  // ---- Relations ----

  addRelation(sourceId: string, targetId: string, type: string, weight?: number, attributes: Record<string, unknown> = {}): Relation {
    const id = `relation-${this.nextRelationSeq++}`;
    const relation: Relation = { id, sourceId, targetId, type, weight, attributes };
    this.relations.push(relation);
    this.updatedAt = Date.now();
    return relation;
  }

  removeRelation(relationId: string): boolean {
    const idx = this.relations.findIndex(r => r.id === relationId);
    if (idx === -1) return false;
    this.relations.splice(idx, 1);
    this.updatedAt = Date.now();
    return true;
  }

  getRelationsForEntity(entityId: string): Relation[] {
    return this.relations.filter(r => r.sourceId === entityId || r.targetId === entityId);
  }

  // ---- Rules ----

  addRule(rule: Omit<Rule, 'id'>): Rule {
    const id = `rule-${this.nextRuleSeq++}`;
    const fullRule: Rule = { ...rule, id };
    this.rules.push(fullRule);
    this.updatedAt = Date.now();
    return fullRule;
  }

  removeRule(ruleId: string): boolean {
    const idx = this.rules.findIndex(r => r.id === ruleId);
    if (idx === -1) return false;
    this.rules.splice(idx, 1);
    this.updatedAt = Date.now();
    return true;
  }

  // ---- Validation ----

  validateRules(): ValidationResult {
    const violations: RuleViolation[] = [];
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      const v = this.evaluateRule(rule);
      if (v) violations.push(v);
    }
    return { valid: violations.length === 0, violations };
  }

  private evaluateRule(rule: Rule): RuleViolation | null {
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

  query(filter: QueryFilter): Entity[] {
    let results = [...this.entities];

    if (filter.type) {
      results = results.filter(e => e.type === filter.type);
    }
    if (filter.attributeKey !== undefined) {
      results = results.filter(e => e.attributes.some(a => a.key === filter.attributeKey));
    }
    if (filter.attributeValue !== undefined) {
      results = results.filter(e =>
        e.attributes.some(a => a.key === filter.attributeKey && JSON.stringify(a.value) === JSON.stringify(filter.attributeValue))
      );
    }
    if (filter.relatedTo) {
      const relatedIds = new Set<string>();
      for (const r of this.relations) {
        const rt = filter.relationType;
        if (rt && r.type !== rt) continue;
        if (r.sourceId === filter.relatedTo) relatedIds.add(r.targetId);
        if (r.targetId === filter.relatedTo) relatedIds.add(r.sourceId);
      }
      results = results.filter(e => relatedIds.has(e.id));
    }

    return results;
  }

  // ---- Type Schema ----

  registerTypeSchema(schema: TypeSchema): void {
    this.typeSchemas[schema.typeName] = schema;
  }

  /** 注册内置结构约定（知识本体基础类型） */
  private registerDefaultSchemas(): void {
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

  merge(other: UnifiedOntology): void {
    const entityMap = new Map<string, Entity>(this.entities.map(e => [e.id, e]));
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

  toMarkdown(): string {
    const lines: string[] = [];
    lines.push(`# ${this.name}`);
    lines.push('');

    // Entities
    lines.push('## Entities');
    lines.push('');
    const byType = new Map<string, Entity[]>();
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

  toJSON(): string {
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

  static fromJSON(json: string, projectId?: string): UnifiedOntology {
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

  static fromBusinessModel(json: string, projectId?: string): UnifiedOntology {
    const data = JSON.parse(json);
    const id = `ontology-${Date.now()}`;
    const ontology = new UnifiedOntology({
      id,
      projectId: projectId ?? 'default',
      name: data.name ?? 'Business Ontology',
    });

    // 注册业务类型 schema
    const domains: unknown[] = data.domains ?? [];
    for (const domain of domains) {
      const d = domain as Record<string, unknown>;
      const domainName = (d['name'] as string) ?? 'Unknown';
      const domainId = `entity-${ontology.nextEntitySeq++}`;
      ontology.entities.push({
        id: domainId,
        type: 'BusinessDomain',
        name: domainName,
        attributes: buildAttributes(d),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const concepts: unknown[] = (d['concepts'] as unknown[]) ?? [];
      for (const concept of concepts) {
        const c = concept as Record<string, unknown>;
        const conceptName = (c['name'] as string) ?? 'Unknown';
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
    const bizRules: unknown[] = data['rules'] ?? [];
    for (const br of bizRules) {
      const b = br as Record<string, unknown>;
      ontology.rules.push({
        id: `rule-${ontology.nextRuleSeq++}`,
        name: (b['name'] as string) ?? 'Unnamed Rule',
        type: ((b['ruleType'] as string) ?? 'constraint') as RuleType,
        description: (b['description'] as string) ?? '',
        severity: ((b['severity'] as RuleSeverity) ?? 'warning'),
        enabled: true,
      });
    }

    return ontology;
  }

  saveToFile(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, this.toJSON(), 'utf-8');
  }

  static loadFromFile(filePath: string, projectId?: string): UnifiedOntology {
    const content = fs.readFileSync(filePath, 'utf-8');
    return UnifiedOntology.fromJSON(content, projectId);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function inferType(val: unknown): AttributeValueType {
  if (typeof val === 'string') return 'string';
  if (typeof val === 'number') return 'number';
  if (typeof val === 'boolean') return 'boolean';
  if (val instanceof Date) return 'date';
  if (Array.isArray(val)) return 'array';
  return 'string';
}

function formatValue(val: unknown): string {
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

function buildAttributes(obj: Record<string, unknown>): Attribute[] {
  const attrs: Attribute[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'name' || key === 'id') continue;
    attrs.push({ key, value: val, type: inferType(val) });
  }
  return attrs;
}

// 简易 json-logic 求值器（支持基础操作符）
function evaluateJsonLogic(expr: unknown, ctx: unknown): unknown {
  if (typeof expr !== 'object' || expr === null || Array.isArray(expr)) {
    return expr;
  }

  const obj = expr as Record<string, unknown>;
  const keys = Object.keys(obj);

  if (keys.length !== 1) return true;
  const op = keys[0];
  const argsVal = Object.values(obj)[0];
  const args = Array.isArray(argsVal) ? argsVal : [];

  switch (op) {
    case '==': return JSON.stringify(evaluateJsonLogic(args[0], ctx)) === JSON.stringify(evaluateJsonLogic(args[1], ctx));
    case '!=': return JSON.stringify(evaluateJsonLogic(args[0], ctx)) !== JSON.stringify(evaluateJsonLogic(args[1], ctx));
    case '>': return (evaluateJsonLogic(args[0], ctx) as number) > (evaluateJsonLogic(args[1], ctx) as number);
    case '<': return (evaluateJsonLogic(args[0], ctx) as number) < (evaluateJsonLogic(args[1], ctx) as number);
    case '>=': return (evaluateJsonLogic(args[0], ctx) as number) >= (evaluateJsonLogic(args[1], ctx) as number);
    case '<=': return (evaluateJsonLogic(args[0], ctx) as number) <= (evaluateJsonLogic(args[1], ctx) as number);
    case 'and': return (args as unknown[]).every(a => evaluateJsonLogic(a, ctx));
    case 'or': return (args as unknown[]).some(a => evaluateJsonLogic(a, ctx));
    case 'not': return !evaluateJsonLogic(args[0], ctx);
    case 'if': {
      const cond = evaluateJsonLogic(args[0], ctx);
      return cond ? evaluateJsonLogic(args[1], ctx) : evaluateJsonLogic(args[2] ?? null, ctx);
    }
    case 'filter': {
      const entityType = args[0] as string;
      const predicate = args[1];
      const o = ctx as Record<string, unknown>;
      const entities = (o['entities'] as Entity[])?.filter((e: Entity) => e.type === entityType) ?? [];
      return entities.filter((e: Entity) => evaluateJsonLogic(predicate, e));
    }
    case 'count': {
      const arr = evaluateJsonLogic(args[0], ctx);
      return Array.isArray(arr) ? arr.length : 0;
    }
    case 'var': {
      const varPath = args[0] as string;
      return resolveVar(ctx, varPath);
    }
    default: return true;
  }
}

function resolveVar(ctx: unknown, varPath: string): unknown {
  if (ctx instanceof UnifiedOntology) {
    if (varPath === 'entities') return ctx.entities;
    if (varPath === 'relations') return ctx.relations;
    if (varPath === 'rules') return ctx.rules;
    if (varPath === 'entityCount') return ctx.entities.length;
    if (varPath === 'relationCount') return ctx.relations.length;
    if (varPath === 'ruleCount') return ctx.rules.length;
  }
  // Entity field access
  const parts = varPath.split('.');
  let current: unknown = ctx;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    const obj = current as Record<string, unknown>;
    current = obj[part];
  }
  return current;
}
