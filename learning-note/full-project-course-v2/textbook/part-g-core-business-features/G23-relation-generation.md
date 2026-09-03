# G23：关系生成——`generateInitialRelations` 怎么建立概念之间的关联

> 本课核心问题：`generateInitialRelations` 是怎么建立 Domain 和 Concept 之间的关系的？任务之间的 dependency 关系是怎么生成的？

## 1. 开篇场景：小王的任务有了依赖关系

小王的本体生成了四个任务 Concept：
- 采购原料
- 制作咖啡
- 服务顾客
- 管理库存

系统需要建立它们之间的关系：
- Domain "餐饮零售，社区咖啡馆" **contains** 每个任务。
- 采购原料 **dependency** 制作咖啡（需要先采购原料才能制作咖啡）。
- 制作咖啡 **dependency** 服务顾客（需要先制作咖啡才能服务顾客）。
- 服务顾客 **dependency** 管理库存（服务完顾客后需要管理库存）。

这些关系是怎么生成的？

## 2. 两种关系生成策略

### 2.1 手动定义

```ts
const relations = [
  { sourceId: 'dom-1', targetId: 'task-1', type: 'contains' },
  { sourceId: 'dom-1', targetId: 'task-2', type: 'contains' },
  // ...
];
```

优点：精确控制。
缺点：需要手动维护，无法自动适应动态数据。

### 2.2 自动推断

```ts
const relations = [
  // Domain contains 每个 Concept
  ...concepts.map(c => ({ sourceId: domain.id, targetId: c.id, type: 'contains' })),
  // 相邻 task 有 dependency
  ...taskConcepts.map((c, i) => i < taskConcepts.length - 1 
    ? { sourceId: c.id, targetId: taskConcepts[i + 1].id, type: 'dependency' } 
    : null),
];
```

OriginOS 选择了**自动推断**。

## 3. 源码精读：`generateInitialRelations`

打开 [packages/core/src/lib/features/ontology/ontology-builder.ts](../../../../packages/core/src/lib/features/ontology/ontology-builder.ts)。

```ts
private generateInitialRelations(
  domain: Domain,
  concepts: Concept[],
): Relation[] {
  const relations: Relation[] = [];

  // Domain contains all concepts
  concepts.forEach((concept) => {
    relations.push({
      id: uuidv4(),
      sourceId: domain.id,
      targetId: concept.id,
      type: 'contains',
      createdAt: new Date().toISOString(),
    });
  });

  // Generate task dependencies if tasks exist
  const taskConcepts = concepts.filter(c => c.type === 'task');
  for (let i = 0; i < taskConcepts.length - 1; i++) {
    relations.push({
      id: uuidv4(),
      sourceId: taskConcepts[i]!.id,
      targetId: taskConcepts[i + 1]!.id,
      type: 'dependency',
      createdAt: new Date().toISOString(),
    });
  }

  return relations;
}
```

对应源码位置：[packages/core/src/lib/features/ontology/ontology-builder.ts 第 616—646 行](../../../../packages/core/src/lib/features/ontology/ontology-builder.ts#L616-L646)。

## 4. 关系类型分析

### 4.1 contains 关系

```ts
concepts.forEach((concept) => {
  relations.push({
    id: uuidv4(),
    sourceId: domain.id,
    targetId: concept.id,
    type: 'contains',
    createdAt: new Date().toISOString(),
  });
});
```

逻辑：Domain 包含每个 Concept。

对于小王的四个任务：
- Domain → "采购原料"（contains）
- Domain → "制作咖啡"（contains）
- Domain → "服务顾客"（contains）
- Domain → "管理库存"（contains）

### 4.2 dependency 关系

```ts
const taskConcepts = concepts.filter(c => c.type === 'task');
for (let i = 0; i < taskConcepts.length - 1; i++) {
  relations.push({
    id: uuidv4(),
    sourceId: taskConcepts[i]!.id,
    targetId: taskConcepts[i + 1]!.id,
    type: 'dependency',
    createdAt: new Date().toISOString(),
  });
}
```

逻辑：相邻的 task Concept 之间有 dependency 关系。

对于小王的四个任务：
- "采购原料" → "制作咖啡"（dependency）
- "制作咖啡" → "服务顾客"（dependency）
- "服务顾客" → "管理库存"（dependency）

注意：
- 只有 `type === 'task'` 的 Concept 才会生成 dependency 关系。
- tool 和 goal 类型的 Concept 不会生成 dependency。
- dependency 是单向的（source → target），不是双向的。

## 5. 图解：关系生成

```
Domain "餐饮零售，社区咖啡馆"
  │ contains
  ├─ Concept "采购原料" (task)
  │    │ dependency
  │    ▼
  ├─ Concept "制作咖啡" (task)
  │    │ dependency
  │    ▼
  ├─ Concept "服务顾客" (task)
  │    │ dependency
  │    ▼
  ├─ Concept "管理库存" (task)
  │
  ├─ Concept "咖啡机" (tool)        ← 没有 dependency
  │
  └─ Concept "提供优质咖啡服务" (goal) ← 没有 dependency
```

## 6. 失败路径与边界

### 6.1 没有 task Concept

```ts
const taskConcepts = concepts.filter(c => c.type === 'task');
for (let i = 0; i < taskConcepts.length - 1; i++) {
```

如果 `taskConcepts` 为空，`taskConcepts.length - 1` 为 `-1`，循环不会执行。不会报错，但也不会生成 dependency 关系。

### 6.2 只有一个 task Concept

```ts
for (let i = 0; i < taskConcepts.length - 1; i++) {
```

如果只有一个 task Concept，`taskConcepts.length - 1` 为 `0`，循环不会执行。不会生成 dependency 关系。

### 6.3 task 顺序决定 dependency

```ts
sourceId: taskConcepts[i]!.id,
targetId: taskConcepts[i + 1]!.id,
```

dependency 的方向由 Concept 在数组中的顺序决定。如果数组顺序改变，dependency 关系也会改变。

这意味着：**用户输入任务的顺序决定了 dependency 的方向**。

### 6.4 循环 dependency 风险

如果用户输入的任务顺序是循环的（如 A → B → C → A），系统会生成线性的 dependency 关系（A → B → C），不会检测循环。

## 7. 测试证据与缺口

### 已覆盖

- `generateInitialRelations` 没有直接单元测试。

### 缺口

- 没有 task Concept 时的处理没有测试。
- 只有一个 task Concept 时的处理没有测试。
- tool 和 goal Concept 是否生成 contains 关系没有测试。
- dependency 方向是否正确的测试没有。

## 8. 小实验：验证关系生成

### 步骤一：基本生成

```ts
import { ontologyService } from '@originos/core/lib/features/ontology';

const domain = { id: 'dom-1', name: '测试' };
const concepts = [
  { id: 'c1', type: 'task', name: '任务A' },
  { id: 'c2', type: 'task', name: '任务B' },
  { id: 'c3', type: 'tool', name: '工具' },
];

const relations = ontologyService['generateInitialRelations'](domain, concepts);
console.log(relations.length);  // 4 (3 contains + 1 dependency)
console.log(relations[0].type); // "contains"
console.log(relations[0].sourceId); // "dom-1"
console.log(relations[3].type); // "dependency"
console.log(relations[3].sourceId); // "c1"
console.log(relations[3].targetId); // "c2"
```

### 步骤二：没有 task

```ts
const conceptsNoTask = [
  { id: 'c1', type: 'tool', name: '工具' },
];

const relations2 = ontologyService['generateInitialRelations'](domain, conceptsNoTask);
console.log(relations2.length);  // 1 (只有 contains，没有 dependency)
```

### 步骤三：只有一个 task

```ts
const conceptsOneTask = [
  { id: 'c1', type: 'task', name: '任务A' },
];

const relations3 = ontologyService['generateInitialRelations'](domain, conceptsOneTask);
console.log(relations3.length);  // 1 (只有 contains，没有 dependency)
```

### 实验结论

关系生成逻辑简单，但边界情况需要测试覆盖。

## 9. 口头验收

读完本课后，应能不看书稿回答：

1. `generateInitialRelations` 生成了哪两种关系？
2. `contains` 关系的 source 和 target 分别是什么？
3. `dependency` 关系是怎么生成的？哪些 Concept 会生成 dependency？
4. 如果没有 task Concept，会发生什么？
5. dependency 的方向由什么决定？

## 10. 章节收束

本课的核心认知是：**`generateInitialRelations` 自动生成了两种关系：Domain contains 每个 Concept，相邻 task Concept 之间有 dependency。但只有 task 类型的 Concept 会生成 dependency，且方向由数组顺序决定**。

我们看到的几个关键设计：

- **contains 关系**：Domain 包含所有 Concept（包括 task、tool、goal）。
- **dependency 关系**：只有相邻的 task Concept 之间有 dependency。
- **单向关系**：dependency 是单向的（source → target）。
- **顺序敏感**：dependency 的方向由 Concept 在数组中的顺序决定。
- **无循环检测**：不会检测循环 dependency。
- **无测试覆盖**：没有自动化测试。

下一课（G24）我们会深入 `applyEdits`，看看本体编辑的 CRUD 操作。
