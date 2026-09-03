# G15：本体适配器——访谈结果如何对接 `OntologyModel`

> 本课核心问题：`ontology-adapter.ts` 如何把 `Ontology`（领域/概念/实例三层结构）转换成 `OntologyModel`（节点树结构）？两种结构有什么本质区别？

## 1. 开篇场景：小王看到本体图谱

小王完成访谈后，系统显示了一个本体图谱：
- 根节点："社区咖啡馆本体"
- 子节点："领域" → "餐饮零售"
- 子节点："任务" → "采购原料"、"制作咖啡"、"服务顾客"、"管理库存"

但这个图谱不是直接从小王的答案生成的。中间经历了两次转换：
1. 访谈答案 → `Ontology`（领域/概念/实例三层结构）
2. `Ontology` → `OntologyModel`（节点树结构，供前端展示）

`ontology-adapter.ts` 负责第二次转换。

## 2. 两种本体表示

### 2.1 `Ontology`——领域/概念/实例三层结构

```ts
interface Ontology {
  id: string;
  name: string;
  domains: Domain[];      // 领域层
  concepts: Concept[];    // 概念对象层
  instances: Instance[];  // 实例数据层
}
```

这是 OriginOS 的内部存储格式，对应 AGENTS.md 中定义的“三层结构”。

### 2.2 `OntologyModel`——节点树结构

```ts
interface OntologyModel {
  id: string;
  name: string;
  description: string;
  nodes: OntologyNode[];  // 树形节点
  createdAt: number;
}
```

这是前端展示格式，每个节点可以有子节点，形成树形结构。

### 2.3 为什么需要转换？

| 维度 | `Ontology` | `OntologyModel` |
| --- | --- | --- |
| 用途 | 内部存储、CRUD | 前端展示、可视化 |
| 结构 | 扁平（domains + concepts + instances） | 树形（nodes + children） |
| 关系 | 通过 ID 引用（domainId, conceptId） | 通过嵌套（children） |
| 消费者 | 后端服务、Agent | 前端组件、图谱可视化 |

`Ontology` 适合数据库存储和业务逻辑处理，`OntologyModel` 适合前端渲染。适配器负责两者之间的转换。

## 3. 源码精读：`adaptOntologyForDisplay`

打开 [packages/core/src/lib/features/interview/ontology-adapter.ts](../../../../packages/core/src/lib/features/interview/ontology-adapter.ts)。

```ts
export function adaptOntologyForDisplay(ontology: Ontology): OntologyModel {
  // Build tree structure from domains and concepts
  const nodes: OntologyNode[] = ontology.domains.map((domain: Domain) => {
    // Find concepts for this domain
    const domainConcepts = ontology.concepts.filter((c: Concept) => c.domainId === domain.id);

    // Convert concepts to nodes
    const children: OntologyNode[] = domainConcepts.map((concept: Concept) => ({
      id: concept.id,
      name: concept.name,
      type: concept.type as OntologyNode['type'],
      description: concept.description,
      children: [], // Concepts don't have children in this simple model
    }));

    return {
      id: domain.id,
      name: domain.name,
      type: 'entity' as const,
      description: domain.description,
      children,
    };
  });

  return {
    id: ontology.id,
    name: ontology.name,
    description: `Generated from interview with ${ontology.concepts.length} concepts`,
    nodes,
    createdAt: Date.now(),
  };
}
```

对应源码位置：[packages/core/src/lib/features/interview/ontology-adapter.ts 第 13—44 行](../../../../packages/core/src/lib/features/interview/ontology-adapter.ts#L13-L44)。

### 3.1 转换逻辑

```
Ontology (三层结构)                    OntologyModel (节点树)
├─ domains[0]                          ├─ nodes[0] (type: 'entity')
│   ├─ id                              │   ├─ id
│   ├─ name                            │   ├─ name
│   └─ description                     │   ├─ type: 'entity'
│                                      │   ├─ description
│                                      │   └─ children[]
│                                      │       ├─ nodes[0] (type: concept.type)
│                                      │       │   ├─ id
│                                      │       │   ├─ name
│                                      │       │   ├─ type
│                                      │       │   ├─ description
│                                      │       │   └─ children: []
│                                      │       └─ ...
└─ concepts[]                          └─ ...
    ├─ id (with domainId)
    ├─ name
    ├─ type
    └─ description
```

### 3.2 关键转换点

| Ontology 字段 | OntologyModel 字段 | 转换方式 |
| --- | --- | --- |
| `ontology.id` | `ontologyModel.id` | 直接传递 |
| `ontology.name` | `ontologyModel.name` | 直接传递 |
| `ontology.domains` | `ontologyModel.nodes` | 每个 domain 变成一个根节点 |
| `concept.domainId` | 节点的父子关系 | 通过 `filter(c => c.domainId === domain.id)` 建立 |
| `concept.type` | `OntologyNode.type` | 类型断言 `as OntologyNode['type']` |
| `ontology.concepts.length` | `description` | 用于生成描述文本 |
| 无 | `ontologyModel.createdAt` | 使用 `Date.now()` |

注意：**`instances` 层完全被忽略**。`Ontology` 中的 `instances` 数组在转换过程中没有被使用。这意味着实例数据不会出现在前端展示中。

### 3.3 类型断言

```ts
type: concept.type as OntologyNode['type'],
```

这里有一个类型断言：`Concept.type` 是 `string`，而 `OntologyNode.type` 是 `"entity" | "class" | "property" | "relationship" | "rule"`。如果 `concept.type` 的值不在 `OntologyNode['type']` 的联合类型中，运行时会出现类型不匹配。

### 3.4 描述生成

```ts
description: `Generated from interview with ${ontology.concepts.length} concepts`,
```

描述是动态生成的，包含概念数量。但如果 `ontology.concepts` 为空，描述会变成 "Generated from interview with 0 concepts"，这看起来不太对。

## 4. 源码精读：`OntologyNode` 类型

打开 [packages/core/src/types/interview.ts](../../../../packages/core/src/types/interview.ts)。

```ts
export interface OntologyNode {
  id: string;
  name: string;
  type: "entity" | "class" | "property" | "relationship" | "rule";
  description?: string;
  children?: OntologyNode[];
}
```

对应源码位置：[packages/core/src/types/interview.ts 第 8—14 行](../../../../packages/core/src/types/interview.ts#L8-L14)。

`OntologyNode` 有 5 个字段：
- `id`：节点唯一标识。
- `name`：节点名称。
- `type`：节点类型，限定为 5 种之一。
- `description`：可选描述。
- `children`：可选子节点数组，形成树形结构。

注意：`children` 是可选的，但 `adaptOntologyForDisplay` 总是给 concept 节点设置 `children: []`（空数组），给 domain 节点设置 `children`（包含 concept 节点）。

## 5. 图解：适配器转换流程

```mermaid
flowchart TD
    subgraph Input["Ontology (输入)"]
        D1[Domain: id=d1, name="餐饮零售"]
        D2[Domain: id=d2, name="任务管理"]
        C1[Concept: id=c1, name="社区咖啡馆", domainId=d1]
        C2[Concept: id=c2, name="采购原料", domainId=d2]
        C3[Concept: id=c3, name="制作咖啡", domainId=d2]
        I1[Instance: id=i1, conceptId=c1]
    end

    subgraph Adapter["adaptOntologyForDisplay"]
        A1[遍历 domains]
        A2[filter concepts by domainId]
        A3[map concepts → OntologyNode]
        A4[组装 nodes]
    end

    subgraph Output["OntologyModel (输出)"]
        N1[Node: id=d1, name="餐饮零售", type='entity', children=[N3]]
        N2[Node: id=d2, name="任务管理", type='entity', children=[N4, N5]]
        N3[Node: id=c1, name="社区咖啡馆", type=..., children=[]]
        N4[Node: id=c2, name="采购原料", type=..., children=[]]
        N5[Node: id=c3, name="制作咖啡", type=..., children=[]]
    end

    D1 --> A1
    D2 --> A1
    C1 --> A2
    C2 --> A2
    C3 --> A2
    I1 -.->|被忽略| A2
    A1 --> A2
    A2 --> A3
    A3 --> A4
    A4 --> N1
    A4 --> N2
```

## 6. 失败路径与边界

### 6.1 `instances` 层被忽略

```ts
// 代码中没有使用 ontology.instances
```

如果 `Ontology` 包含实例数据（如具体的订单记录、客户信息等），这些数据在转换后完全丢失。前端无法展示实例层。

### 6.2 类型断言风险

```ts
type: concept.type as OntologyNode['type'],
```

如果 `concept.type` 的值是 `"unknown"` 或其他不在联合类型中的值，TypeScript 编译时不会报错（因为 `as` 是强制类型断言），但运行时会导致前端渲染异常。

### 6.3 空概念列表

```ts
description: `Generated from interview with ${ontology.concepts.length} concepts`,
```

如果 `ontology.concepts` 为空，描述会变成 "Generated from interview with 0 concepts"。虽然语法正确，但用户体验不佳。

### 6.4 空 domain 列表

```ts
const nodes: OntologyNode[] = ontology.domains.map((domain: Domain) => {
```

如果 `ontology.domains` 为空，`nodes` 会是空数组。`OntologyModel` 会变成没有节点的空树。

### 6.5 概念没有匹配的 domain

```ts
const domainConcepts = ontology.concepts.filter((c: Concept) => c.domainId === domain.id);
```

如果某个 concept 的 `domainId` 不匹配任何 domain 的 `id`，这个 concept 会被忽略，不会出现在 `OntologyModel` 中。

## 7. 测试证据与缺口

### 已覆盖

- `ontology-adapter.ts` 没有直接单元测试。
- `adaptOntologyForDisplay` 的各种输入组合没有自动化断言。

### 缺口

- 多 domain + 多 concept 的复杂转换没有测试。
- `instances` 被忽略的情况没有测试。
- `concept.type` 不在 `OntologyNode['type']` 中的情况没有测试。
- 空 `domains` 和空 `concepts` 的边界没有测试。
- `domainId` 不匹配的 concept 被忽略的情况没有测试。

## 8. 小实验：验证本体适配器

### 步骤一：基本转换

```ts
import { adaptOntologyForDisplay } from '@originos/core/lib/features/interview';

const ontology = {
  id: 'ont-1',
  name: '社区咖啡馆本体',
  domains: [
    { id: 'd1', name: '餐饮零售', description: '咖啡馆业务' },
  ],
  concepts: [
    { id: 'c1', name: '社区咖啡馆', domainId: 'd1', type: 'entity', description: '社区精品咖啡馆' },
  ],
  instances: [],
};

const model = adaptOntologyForDisplay(ontology);
console.log(model.nodes.length);        // 1
console.log(model.nodes[0].name);       // "餐饮零售"
console.log(model.nodes[0].children.length);  // 1
console.log(model.nodes[0].children[0].name); // "社区咖啡馆"
```

### 步骤二：验证 instances 被忽略

```ts
const ontologyWithInstances = {
  ...ontology,
  instances: [
    { id: 'i1', conceptId: 'c1', data: { name: '实例1' } },
  ],
};

const model2 = adaptOntologyForDisplay(ontologyWithInstances);
// model2 和 model 完全一样，instances 没有被使用
```

### 步骤三：验证空概念列表

```ts
const ontologyEmpty = {
  id: 'ont-2',
  name: '空本体',
  domains: [{ id: 'd1', name: '测试' }],
  concepts: [],
  instances: [],
};

const model3 = adaptOntologyForDisplay(ontologyEmpty);
console.log(model3.description);  // "Generated from interview with 0 concepts"
```

### 实验结论

适配器逻辑简单直接，但有一些边界情况需要注意：
- `instances` 层被完全忽略。
- 空概念列表时描述不友好。
- 类型断言存在运行时风险。

## 9. 口头验收

读完本课后，应能不看书稿回答：

1. `Ontology` 和 `OntologyModel` 有什么区别？为什么需要转换？
2. `adaptOntologyForDisplay` 是怎么把 domain 和 concept 映射成树形节点的？
3. `instances` 层在转换过程中发生了什么？
4. 如果 `concept.type` 的值不在 `OntologyNode['type']` 中，会发生什么？
5. 如果 `ontology.domains` 为空，输出会是什么？

## 10. 章节收束

本课的核心认知是：**`ontology-adapter.ts` 是一个简单的“结构转换器”，它把领域/概念两层结构映射成前端可展示的树形节点，但忽略了实例层，且存在类型断言风险**。

我们看到的几个关键设计：

- `Ontology`（三层结构）→ `OntologyModel`（节点树）的转换是单向的。
- Domain 变成根节点，Concept 变成子节点，Instance 被忽略。
- 类型断言 `as OntologyNode['type']` 存在运行时风险。
- 描述是动态生成的，但空概念列表时用户体验不佳。
- 没有测试覆盖，边界行为需要人工审计。

下一课（G16）我们会讨论访谈流程的失败路径：访谈未完成、答案缺失、API 调用失败时会怎样？
