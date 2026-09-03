# G26：单元小结课——画出"访谈答案 → 本体生成 → 关系建立 → 编辑"的完整调用链

> 本课核心问题：从 G19 到 G25，我们已经把本体构建拆成了七节课。现在请你脱离源码，把"访谈答案 → 本体生成 → 关系建立 → 编辑"的完整旅程画出来，并标出每个关键节点的责任方、数据格式、失败路径和测试缺口。

## 1. 开篇场景：七节课之后，小王的本体终于能用了

让我们回到小王的视角：

1. 小王回答完访谈问题（工作领域、工作模式、主要任务）。
2. 系统从答案中提取：
   - 领域："餐饮零售，社区咖啡馆"
   - 任务："采购原料、制作咖啡、服务顾客、管理库存"
   - 工具："咖啡机、POS系统"
   - 目标："提供优质咖啡服务"
3. 系统生成 Domain："餐饮零售，社区咖啡馆"。
4. 系统从任务中提取 Concept（4 个 task、2 个 tool、1 个 goal）。
5. 系统建立关系（contains + dependency）。
6. 小王可以编辑本体，添加新的 Concept 和 Instance。

这个看似简单的流程，背后涉及多个文件、多个服务、多种数据格式。

本单元小结课的任务，就是**把这条线从头到尾画清楚**。

## 2. 概念阶梯回顾

### 2.1 从直觉到术语

| 直觉说法 | 专业术语 | 对应源码 |
| --- | --- | --- |
| "系统从我的答案中提取了领域" | `generateDomain` | `ontology-builder.ts` |
| "系统把我的任务变成了概念" | `generateConcepts` | `ontology-builder.ts` |
| "概念之间有关系" | `generateInitialRelations` | `ontology-builder.ts` |
| "我可以修改本体" | `applyEdits` | `ontology-builder.ts` |
| "系统通过 API 存取数据" | `OntologyClient` | `client.ts` |

### 2.2 关键边界

本单元反复强调的边界：

- **`OntologyService` 负责本体生成和编辑。**
- **`OntologyClient` 负责 API 封装和内存回退。**
- **三层结构：Domain → Concept → Instance。**
- **基于规则的生成，不依赖 LLM。**
- **没有事务回滚机制。**

## 3. 完整调用链图解

```mermaid
flowchart TD
    subgraph Input["访谈答案"]
        A1[work_domain: "餐饮零售，社区咖啡馆"]
        A2[work_mode: "独立经营"]
        A3[main_tasks: "采购原料、制作咖啡、服务顾客、管理库存"]
        A4[tools_used: "咖啡机、POS系统"]
        A5[goals: "提供优质咖啡服务"]
    end

    subgraph Generate["OntologyService.generateFromInterview"]
        G1[generateDomain]
        G2[generateConcepts]
        G3[generateInitialRelations]
        G4[saveOntology]
    end

    subgraph Output["生成的本体"]
        D1[Domain: "餐饮零售，社区咖啡馆"]
        C1[Concept: "采购原料" type=task]
        C2[Concept: "制作咖啡" type=task]
        C3[Concept: "服务顾客" type=task]
        C4[Concept: "管理库存" type=task]
        C5[Concept: "咖啡机" type=tool]
        C6[Concept: "POS系统" type=tool]
        C7[Concept: "提供优质咖啡服务" type=goal]
        R1[Relation: Domain contains 每个 Concept]
        R2[Relation: 任务1 dependency 任务2]
        R3[Relation: 任务2 dependency 任务3]
        R4[Relation: 任务3 dependency 任务4]
    end

    subgraph Edit["applyEdits"]
        E1[add concept]
        E2[update concept]
        E3[delete concept]
    end

    subgraph Client["OntologyClient"]
        CL1[createEntity]
        CL2[getEntity]
        CL3[updateEntity]
        CL4[deleteEntity]
    end

    A1 --> G1
    A2 --> G1
    A3 --> G2
    A4 --> G2
    A5 --> G2
    G1 --> D1
    G2 --> C1
    G2 --> C2
    G2 --> C3
    G2 --> C4
    G2 --> C5
    G2 --> C6
    G2 --> C7
    D1 --> G3
    C1 --> G3
    C2 --> G3
    C3 --> G3
    C4 --> G3
    G3 --> R1
    G3 --> R2
    G3 --> R3
    G3 --> R4
    G3 --> G4
    C1 --> E1
    C2 --> E2
    C3 --> E3
    E1 --> CL1
    E2 --> CL3
    E3 --> CL4
```

## 4. 节点责任表

| 步骤 | 负责人 | 输入 | 输出 | 关键设计决策 |
| --- | --- | --- | --- | --- |
| 生成 Domain | `generateDomain` | `workDomain`, `workMode` | `Domain` | 模板合成，硬编码 icon/color |
| 生成 Concepts | `generateConcepts` | `mainTasks`, `toolsUsed`, `goals` | `Concept[]` | 多源提取，最多 5 个任务 |
| 生成 Relations | `generateInitialRelations` | `Domain`, `Concept[]` | `Relation[]` | contains + dependency |
| 保存本体 | `saveOntology` | `Ontology` | 持久化 | 无事务 |
| 编辑本体 | `applyEdits` | `OntologyEditOperation[]` | `OntologyEditResponse` | 批量操作，级联删除 |
| API 调用 | `OntologyClient` | 各种参数 | `OntologyEntity` | 内存回退 |

## 5. 数据格式转换链

```
访谈答案
  ↓
InterviewSession {
  answers: {
    work_domain: "餐饮零售，社区咖啡馆",
    work_mode: "独立经营",
    main_tasks: "采购原料、制作咖啡、服务顾客、管理库存",
    tools_used: "咖啡机、POS系统",
    goals: "提供优质咖啡服务"
  }
}
  ↓
Ontology {
  id: "ont-xxx",
  projectId: "proj-xxx",
  name: "餐饮零售，社区咖啡馆 Ontology",
  domains: [{ id: "dom-xxx", name: "餐饮零售，社区咖啡馆", ... }],
  concepts: [
    { id: "c1", domainId: "dom-xxx", name: "采购原料", type: "task", ... },
    { id: "c2", domainId: "dom-xxx", name: "制作咖啡", type: "task", ... },
    ...
  ],
  instances: [],
  relations: [
    { id: "r1", sourceId: "dom-xxx", targetId: "c1", type: "contains" },
    { id: "r2", sourceId: "c1", targetId: "c2", type: "dependency" },
    ...
  ]
}
```

## 6. 失败路径复盘

### 6.1 生成阶段

| 失败场景 | 处理方式 | 风险 |
| --- | --- | --- |
| `workDomain` 为空 | fallback 为 `'My Project'` | 项目名不友好 |
| `mainTasks` 为空 | 添加默认 Concept | 信息缺失 |
| 任务超过 5 个 | 截断到 5 个 | 信息丢失 |
| 没有 task Concept | 不生成 dependency | 关系缺失 |

### 6.2 编辑阶段

| 失败场景 | 处理方式 | 风险 |
| --- | --- | --- |
| Ontology 不存在 | 返回错误 | 无法编辑 |
| Domain 不存在 | 返回错误 | 无法添加 Concept |
| 部分操作失败 | 继续执行其他操作 | 数据不一致 |
| 级联删除 | 自动删除关联数据 | 意外删除 |

### 6.3 API 调用阶段

| 失败场景 | 处理方式 | 风险 |
| --- | --- | --- |
| API 不可用 | 存入内存 | 页面刷新后丢失 |
| 内存泄漏 | 无处理 | 内存溢出 |

## 7. 测试覆盖复盘

| 能力 | 测试位置 | 覆盖状态 |
| --- | --- | --- |
| `generateFromInterview` | 无 | ❌ 未覆盖 |
| `generateDomain` | 无 | ❌ 未覆盖 |
| `generateConcepts` | 无 | ❌ 未覆盖 |
| `generateInitialRelations` | 无 | ❌ 未覆盖 |
| `applyEdits` | 无 | ❌ 未覆盖 |
| `OntologyClient` | 无 | ❌ 未覆盖 |

## 8. 工作坊练习

### 练习一：画出调用链

请拿一张纸或打开一个白板工具，不看书稿，画出以下调用链：

1. 小王回答访谈问题。
2. 系统生成 Domain。
3. 系统生成 Concepts。
4. 系统生成 Relations。
5. 系统保存本体。
6. 小王编辑本体。
7. 系统通过 OntologyClient 调用 API。

要求：
- 每个箭头标注调用的函数/方法名。
- 每个节点标注输入和输出的数据格式。
- 在每个节点旁边写出一个可能的失败场景。

### 练习二：找出设计问题

请列出至少三个设计问题：

| 问题 | 影响 | 改进建议 |
| --- | --- | --- |
| `icon` 和 `color` 硬编码 | 所有 Domain 看起来一样 | 根据领域动态选择 |
| 没有事务回滚 | 部分成功时数据不一致 | 增加事务机制 |
| 内存回退只在当前会话有效 | 页面刷新后数据丢失 | 增加持久化 |
| 任务最多取 5 个 | 信息丢失 | 增加分页或全部提取 |

### 练习三：补测试计划

假设你只能补三个测试，你会优先补哪三个？请说明理由。

参考答案（不唯一）：

1. **`generateFromInterview` 完整流程测试**
   - 理由：本体生成是核心功能，没有测试意味着无法验证生成结果。

2. **`applyEdits` 部分失败场景测试**
   - 理由：没有事务回滚，部分失败时数据可能不一致，需要验证。

3. **`OntologyClient` 内存回退测试**
   - 理由：API 失败时的回退机制是核心设计，需要验证。

## 9. 口头验收

完成本单元后，应能不看书稿回答：

1. 从"访谈答案"到"本体生成"，中间经历了哪几个主要阶段？
2. `generateConcepts` 从哪些来源提取 Concept？
3. `generateInitialRelations` 生成了哪两种关系？
4. `applyEdits` 有没有事务回滚？
5. `OntologyClient` 的回退机制是怎么工作的？

## 10. 章节收束

本单元（G19—G26）围绕"访谈答案 → 本体生成 → 关系建立 → 编辑"这一流程，拆解了 OriginOS 的本体构建系统。

我们学到的核心认知：

- **本体采用三层结构**：Domain → Concept → Instance。
- **基于规则的生成**：`OntologyService.generateFromInterview` 是纯本地逻辑，不依赖 LLM。
- **多源提取**：从 tasks、tools、goals 三个来源提取 Concept。
- **自动关系生成**：Domain contains 每个 Concept，相邻 task 有 dependency。
- **批量编辑**：`applyEdits` 支持批量操作，有级联删除，但没有事务回滚。
- **API 封装**：`OntologyClient` 封装了底层 API，有内存回退机制。
- **测试覆盖薄弱**：所有模块都没有单元测试。

下一单元（G27—G38）我们将进入**本体数据存储**，看看概念下的具体实例如何被增删改查、建立关系。

---

**本单元到此结束。**
