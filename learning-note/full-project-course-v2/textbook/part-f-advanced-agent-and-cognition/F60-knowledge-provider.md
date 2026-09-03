# F59：`UnifiedOntology` —— 统一本体模型

## 开篇场景

Agent 在对话中提取了很多知识："用户的公司叫 GrowMap"、"用户想要一个项目管理工具"、"用户的预算有限"。这些知识需要结构化的方式存储，才能被查询和利用。`UnifiedOntology` 就是 OriginOS 的知识存储基础——它定义了实体、属性、关系和规则的统一模型。

## 核心问题

**`UnifiedOntology` 如何表示知识？Entity、Attribute、Relation、Rule 分别是什么？如何查询和验证？**

## 概念阶梯

### 1. 核心概念

```
Entity（实体）
  ├── id: "entity-0"
  ├── type: "Company"
  ├── name: "GrowMap"
  ├── attributes: [Attribute]
  │     ├── key: "industry", value: "SaaS", type: "string"
  │     └── key: "founded", value: 2024, type: "number"
  ├── createdAt: 1690000000000
  └── updatedAt: 1690000000000

Relation（关系）
  ├── id: "relation-0"
  ├── sourceId: "entity-0"     // GrowMap
  ├── targetId: "entity-1"     // Project Management Tool
  ├── type: "needs"
  └── weight: 1.0

Rule（规则）
  ├── id: "rule-0"
  ├── name: "budget_constraint"
  ├── type: "constraint"
  ├── description: "预算不能超过 10 万"
  ├── expression: { format: "json-logic", body: {...} }
  ├── severity: "error"
  └── enabled: true
```

### 2. Type Schema（类型约束）

```typescript
interface TypeSchema {
  typeName: 'Company';
  description: '公司实体';
  attributes: [
    { key: 'industry', type: 'string', required: true },
    { key: 'founded', type: 'number', required: false },
  ];
}
```

## 源码精读

### 1. Entity 创建

[packages/core/src/lib/integrations/pi-agent/cognitive/unified-ontology.ts 第 167-193 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/unified-ontology.ts#L167)

```typescript
createEntity(type: string, name: string, attributes: Partial<Record<string, unknown>> = {}): Entity {
  const schema = this.typeSchemas[type];
  const now = Date.now();
  const id = `entity-${this.nextEntitySeq++}`;

  const attrs: Attribute[] = [];
  if (schema) {
    // 有 schema：按 schema 验证必填属性
    for (const as of schema.attributes) {
      const val = attributes[as.key];
      if (as.required && val === undefined) {
        throw new Error(`Missing required attribute '${as.key}' for type '${type}'`);
      }
      if (val !== undefined) {
        attrs.push({ key: as.key, value: val, type: as.type, ... });
      }
    }
  } else {
    // 无 schema：自动推断类型
    for (const [key, val] of Object.entries(attributes)) {
      attrs.push({ key, value: val, type: inferType(val) });
    }
  }

  const entity: Entity = { id, type, name, attributes: attrs, createdAt: now, updatedAt: now };
  this.entities.push(entity);
  return entity;
}
```

**关键点**：
- 有 schema 时按 schema 验证必填属性
- 无 schema 时自动推断类型（`inferType`）
- 自动分配 ID（`entity-${seq}`）

### 2. Query 查询

[packages/core/src/lib/integrations/pi-agent/cognitive/unified-ontology.ts 第 294-319 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/unified-ontology.ts#L294)

```typescript
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
    // 通过关系过滤
    const relatedIds = new Set<string>();
    for (const r of this.relations) {
      if (r.sourceId === filter.relatedTo) relatedIds.add(r.targetId);
      if (r.targetId === filter.relatedTo) relatedIds.add(r.sourceId);
    }
    results = results.filter(e => relatedIds.has(e.id));
  }

  return results;
}
```

**查询维度**：
- 按类型过滤
- 按属性键过滤
- 按属性值过滤
- 按关系过滤（找到与某实体相关的所有实体）

### 3. JSON-Logic 规则验证

[packages/core/src/lib/integrations/pi-agent/cognitive/unified-ontology.ts 第 562-606 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/unified-ontology.ts#L562)

```typescript
function evaluateJsonLogic(expr: unknown, ctx: unknown): unknown {
  const obj = expr as Record<string, unknown>;
  const op = Object.keys(obj)[0];
  const args = Object.values(obj)[0] as unknown[];

  switch (op) {
    case '==': return JSON.stringify(evaluateJsonLogic(args[0], ctx)) === JSON.stringify(evaluateJsonLogic(args[1], ctx));
    case '>': return (evaluateJsonLogic(args[0], ctx) as number) > (evaluateJsonLogic(args[1], ctx) as number);
    case 'and': return (args as unknown[]).every(a => evaluateJsonLogic(a, ctx));
    case 'filter': /* ... */
    case 'var': /* ... */
  }
}
```

**支持的运算符**：`==`, `!=`, `>`, `<`, `>=`, `<=`, `and`, `or`, `not`, `if`, `filter`, `count`, `var`

### 4. fromBusinessModel 工厂方法

[packages/core/src/lib/integrations/pi-agent/cognitive/unified-ontology.ts 第 458-519 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/unified-ontology.ts#L458)

```typescript
static fromBusinessModel(json: string, projectId?: string): UnifiedOntology {
  const data = JSON.parse(json);
  const ontology = new UnifiedOntology({
    id: `ontology-${Date.now()}`,
    projectId: projectId ?? 'default',
    name: data.name ?? 'Business Ontology',
  });

  // 注册业务类型 schema
  const domains: unknown[] = data.domains ?? [];
  for (const domain of domains) {
    // 创建 BusinessDomain 实体
    // 创建 BusinessConcept 实体
    // 建立 contains 关系
  }

  // 业务规则
  const bizRules: unknown[] = data['rules'] ?? [];
  for (const br of bizRules) {
    ontology.rules.push({ ... });
  }

  return ontology;
}
```

## 真实调用链

```
KnowledgeProvider.sync_turn(data)
  → extractKnowledge(data)          // 从对话中提取实体
  → ontology.createEntity(type, name, attributes)  // 创建实体
  → ontology.saveToFile(path)       // 持久化到 ontology.json
  → exportSnapshot()                // 生成 Knowledge.md
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| 缺少必填属性 | 抛出 Error | `createEntity` 检查 `as.required` |
| 属性类型不匹配 | 自动推断或报错 | 有 schema 时按 schema，无 schema 时推断 |
| 查询无结果 | 返回空数组 | `query` 返回过滤后的结果 |
| JSON-Logic 语法错误 | 返回 true（默认通过） | `evaluateJsonLogic` 的 default 分支 |
| ontology.json 损坏 | 创建新的空本体 | `loadOrCreateOntology` 有 fallback |

## 练习与验收

1. **创建实体**：用 `UnifiedOntology` 创建一个 "Product" 类型的实体，包含 name、price、category 属性。
2. **查询练习**：查询所有 type 为 "Company" 且属性 "industry" 为 "SaaS" 的实体。
3. **规则设计**：设计一个 JSON-Logic 规则，检查 "budget" 属性是否小于 100000。

**验收标准**：能使用 UnifiedOntology 创建实体、查询、验证规则。

## 章节收束

`UnifiedOntology` 讲完了。下一节课（F60）看 `KnowledgeProvider` 如何从对话中提取知识并存储到本体。
