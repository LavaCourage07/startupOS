# G19：本体类型系统——Domain、Concept、Instance 三层结构

> 本课核心问题：`types/ontology.ts` 定义了哪些类型？三层结构是怎么设计的？为什么需要三层而不是两层或四层？

## 1. 开篇场景：小王的咖啡馆知识骨架

小王回答完访谈问题后，系统需要把原始文本转换成结构化的知识。但知识不是平面的，而是分层的：

- **领域层**："餐饮零售，社区咖啡馆"——定义了业务的边界。
- **概念层**："采购原料"、"制作咖啡"、"服务顾客"、"管理库存"——定义了业务中的概念类型。
- **实例层**："XX咖啡豆供应商"、"拿铁咖啡"、"张三"——定义了具体的实例数据。

这三层结构就是 OriginOS 的本体（Ontology）设计。

## 2. 两种本体设计

### 2.1 两层结构

```
Category（分类）
  └── Item（条目）
```

优点：简单，只有分类和条目两层。
缺点：无法区分"概念类型"和"具体实例"。比如"咖啡"既是概念类型（饮品类别），又是具体实例（一杯拿铁）。

### 2.2 四层结构

```
Domain（领域）
  └── Category（分类）
        └── Concept（概念）
              └── Instance（实例）
```

优点：更细粒度，可以区分分类和概念。
缺点：过于复杂，实际使用中 Category 和 Concept 经常混淆。

### 2.3 OriginOS 的三层结构

```
Domain（领域）
  └── Concept（概念）
        └── Instance（实例）
```

OriginOS 选择了**三层结构**，在简洁性和表达力之间取得平衡。

## 3. 源码精读：`types/ontology.ts`

打开 [packages/core/src/types/ontology.ts](../../../../packages/core/src/types/ontology.ts)。

### 3.1 Domain（领域层）

```ts
export interface Domain {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

对应源码位置：[packages/core/src/types/ontology.ts 第 20—28 行](../../../../packages/core/src/types/ontology.ts#L20-L28)。

`Domain` 定义了一个领域：
- `id`：唯一标识。
- `name`：领域名称（如"餐饮零售，社区咖啡馆"）。
- `description`：描述。
- `icon`：可选图标。
- `color`：可选颜色。
- `createdAt` / `updatedAt`：时间戳。

注意：`Domain` 没有 `parentId` 或 `children` 字段，意味着领域之间没有层级关系。所有 Concept 都直接关联到某个 Domain。

### 3.2 Concept（概念对象层）

```ts
export interface Concept {
  id: string;
  domainId: string;
  name: string;
  type: string; // Concept type category
  attributes: Record<string, any>;
  description?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

对应源码位置：[packages/core/src/types/ontology.ts 第 33—42 行](../../../../packages/core/src/types/ontology.ts#L33-L42)。

`Concept` 定义了一个概念：
- `id`：唯一标识。
- `domainId`：关联的 Domain ID。
- `name`：概念名称（如"采购原料"）。
- `type`：概念类型（如"task"、"tool"、"goal"）。
- `attributes`：属性字典，灵活存储额外信息。
- `description`：可选描述。

注意：`type` 是 `string` 而不是枚举。这意味着 Concept 的类型是开放的，可以自定义。

### 3.3 Instance（实例数据层）

```ts
export interface Instance {
  id: string;
  conceptId: string;
  data: Record<string, any>;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

对应源码位置：[packages/core/src/types/ontology.ts 第 47—53 行](../../../../packages/core/src/types/ontology.ts#L47-L53)。

`Instance` 定义了一个具体实例：
- `id`：唯一标识。
- `conceptId`：关联的 Concept ID。
- `data`：实例数据，灵活存储。

注意：`Instance` 没有 `name` 字段，名称存储在 `data` 中。这使得 Instance 的结构非常灵活，但也意味着无法直接通过 `instance.name` 获取名称。

### 3.4 Relation（关系）

```ts
export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  metadata?: Record<string, any>;
  createdAt: string; // ISO 8601
}
```

对应源码位置：[packages/core/src/types/ontology.ts 第 58—65 行](../../../../packages/core/src/types/ontology.ts#L58-L65)。

`Relation` 定义了实体之间的关系：
- `id`：唯一标识。
- `sourceId`：源实体 ID。
- `targetId`：目标实体 ID。
- `type`：关系类型（`RelationType`）。
- `metadata`：可选元数据。

关系类型：

```ts
export type RelationType = 'dependency' | 'contains' | 'association' | 'inheritance';
```

| 类型 | 说明 |
| --- | --- |
| `contains` | 包含关系（Domain contains Concept） |
| `dependency` | 依赖关系（Task A depends on Task B） |
| `association` | 关联关系 |
| `inheritance` | 继承关系 |

### 3.5 Ontology（完整本体）

```ts
export interface Ontology {
  id: string;
  projectId: string;
  name: string;
  domains: Domain[];
  concepts: Concept[];
  instances: Instance[];
  relations: Relation[];
  version: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

对应源码位置：[packages/core/src/types/ontology.ts 第 70—81 行](../../../../packages/core/src/types/ontology.ts#L70-L81)。

`Ontology` 是完整的本体结构，包含：
- `id` / `projectId`：本体和项目的关联。
- `name`：本体名称。
- `domains` / `concepts` / `instances` / `relations`：四层数据。
- `version`：版本号。

注意：Ontology 的顶层是扁平的数组结构，不是树形结构。Domain、Concept、Instance 之间的关系通过 ID 引用（`domainId`、`conceptId`、`sourceId`、`targetId`）来建立。

## 4. 图解：三层结构示例

```
Ontology: "社区咖啡馆本体"
├── id: "ont-xxx"
├── projectId: "proj-xxx"
├── name: "社区咖啡馆"
│
├── domains: [
│     { id: "dom-1", name: "餐饮零售，社区咖啡馆", ... }
│   ]
│
├── concepts: [
│     { id: "con-1", domainId: "dom-1", name: "采购原料", type: "task", ... },
│     { id: "con-2", domainId: "dom-1", name: "制作咖啡", type: "task", ... },
│     { id: "con-3", domainId: "dom-1", name: "服务顾客", type: "task", ... },
│     { id: "con-4", domainId: "dom-1", name: "管理库存", type: "task", ... }
│   ]
│
├── instances: [
│     { id: "ins-1", conceptId: "con-1", data: { name: "XX咖啡豆供应商" } },
│     { id: "ins-2", conceptId: "con-2", data: { name: "拿铁咖啡" } }
│   ]
│
└── relations: [
      { id: "rel-1", sourceId: "dom-1", targetId: "con-1", type: "contains" },
      { id: "rel-2", sourceId: "con-1", targetId: "con-2", type: "dependency" }
    ]
```

## 5. 关键类型对比

| 类型 | 对应业务概念 | 示例 | 层级 |
| --- | --- | --- | --- |
| `Domain` | 领域/业务范围 | "餐饮零售，社区咖啡馆" | 顶层 |
| `Concept` | 概念/任务类型 | "采购原料"、"制作咖啡" | 中层 |
| `Instance` | 具体实例 | "XX咖啡豆供应商"、"拿铁咖啡" | 底层 |
| `Relation` | 关系 | "contains"、"dependency" | 连接层 |

## 6. 失败路径与边界

### 6.1 ID 引用不一致

```ts
// Concept 引用了不存在的 Domain
{ id: "con-1", domainId: "dom-nonexistent", ... }
```

如果 `domainId` 不存在，Concept 会变成"孤儿"——没有归属的领域。

### 6.2 Instance 缺少 name

```ts
{ id: "ins-1", conceptId: "con-1", data: { price: 100 } }
```

`Instance` 没有 `name` 字段，如果 `data` 中没有 `name`，前端展示时无法显示名称。

### 6.3 Relation 指向不存在的实体

```ts
{ id: "rel-1", sourceId: "nonexistent", targetId: "con-1", type: "contains" }
```

如果 `sourceId` 或 `targetId` 不存在，关系会变成"悬空"——指向不存在的实体。

### 6.4 类型开放的风险

```ts
type: string; // 不是枚举
```

`Concept.type` 是 `string` 而不是枚举，意味着可以输入任意值。这提供了灵活性，但也可能导致类型不一致（如有人用 `"Task"`，有人用 `"task"`）。

## 7. 测试证据与缺口

### 已覆盖

- `types/ontology.ts` 是类型定义文件，没有逻辑代码，不需要单元测试。
- 但类型之间的约束关系（如 `domainId` 必须对应存在的 Domain）没有类型级别保证。

### 缺口

- ID 引用一致性没有运行时验证。
- `Concept.type` 的开放设计没有类型约束。
- `Instance.data` 的结构没有 schema 验证。

## 8. 小实验：验证类型结构

### 步骤一：构造一个完整的 Ontology

```ts
import type { Ontology, Domain, Concept, Instance, Relation } from '@originos/core/types/ontology';

const domain: Domain = {
  id: 'dom-1',
  name: '餐饮零售，社区咖啡馆',
  description: '社区精品咖啡馆业务',
  icon: '☕',
  color: '#8B4513',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const concept: Concept = {
  id: 'con-1',
  domainId: 'dom-1',
  name: '采购原料',
  type: 'task',
  attributes: { priority: 'high', category: 'general' },
  description: '采购咖啡豆、牛奶等原料',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const instance: Instance = {
  id: 'ins-1',
  conceptId: 'con-1',
  data: { name: 'XX咖啡豆供应商', contact: '138-xxxx-xxxx' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const relation: Relation = {
  id: 'rel-1',
  sourceId: 'dom-1',
  targetId: 'con-1',
  type: 'contains',
  createdAt: new Date().toISOString(),
};

const ontology: Ontology = {
  id: 'ont-1',
  projectId: 'proj-1',
  name: '社区咖啡馆本体',
  domains: [domain],
  concepts: [concept],
  instances: [instance],
  relations: [relation],
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

console.log(ontology.domains[0].name);  // "餐饮零售，社区咖啡馆"
console.log(ontology.concepts[0].name); // "采购原料"
```

### 步骤二：验证 ID 引用

```ts
// 检查 concept.domainId 是否对应存在的 domain
const domainIds = new Set(ontology.domains.map(d => d.id));
const orphanConcepts = ontology.concepts.filter(c => !domainIds.has(c.domainId));
console.log(orphanConcepts.length);  // 0 表示没有孤儿

// 检查 instance.conceptId 是否对应存在的 concept
const conceptIds = new Set(ontology.concepts.map(c => c.id));
const orphanInstances = ontology.instances.filter(i => !conceptIds.has(i.conceptId));
console.log(orphanInstances.length);  // 0 表示没有孤儿
```

### 实验结论

类型结构清晰，但 ID 引用的完整性需要运行时验证。目前代码中没有自动化的引用完整性检查。

## 9. 口头验收

读完本课后，应能不看书稿回答：

1. OriginOS 的本体有几层？每层分别是什么？
2. `Domain`、`Concept`、`Instance` 之间是怎么关联的？
3. `Relation` 的 `sourceId` 和 `targetId` 可以指向哪些类型的实体？
4. `Concept.type` 为什么是 `string` 而不是枚举？有什么优缺点？
5. `Instance` 为什么没有 `name` 字段？这会带来什么问题？

## 10. 章节收束

本课的核心认知是：**OriginOS 的本体采用三层结构（Domain → Concept → Instance），通过 ID 引用建立关联，Relation 连接实体之间的关系。这种设计在简洁性和灵活性之间取得了平衡，但缺乏引用完整性保证**。

我们看到的几个关键设计：

- **三层结构**：Domain（领域）→ Concept（概念）→ Instance（实例）。
- **扁平数组**：Ontology 的顶层是四个数组，不是树形结构。
- **ID 引用**：Domain、Concept、Instance 之间通过 `domainId`、`conceptId` 关联。
- **Relation 连接**：`sourceId` + `targetId` + `type` 定义实体间的关系。
- **类型开放**：`Concept.type` 是 `string`，`Instance.data` 是 `Record<string, any>`，提供了灵活性但牺牲了类型安全。

下一课（G20）我们会打开 `ontology-builder.ts`，看看 `OntologyService` 是怎么从访谈答案生成本体的。
