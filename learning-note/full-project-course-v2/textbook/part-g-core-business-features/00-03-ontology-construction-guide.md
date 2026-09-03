# 单元导读三：访谈结果如何变成"商品、供应商、订单"等本体概念

> 本单元总问题：小王回答完访谈问题后，系统如何把答案转换成结构化的本体？本体包含哪些层次？`OntologyService` 是怎么生成和编辑本体的？

## 0. 本页先读什么

如果只记住一句话，记住这一句：

> **本体是 OriginOS 理解用户业务的"知识骨架"——Domain 定义领域边界，Concept 定义概念类型，Instance 存储具体数据，Relation 连接它们之间的关系。**

## 1. 本单元在讲什么

上一单元（G11–G18）讲的是"访谈流程"——系统如何通过结构化问题收集用户基本信息。但收集到的信息只是原始文本，OriginOS 需要把它们转换成结构化的知识表示，才能被 Agent 理解和使用。

这就是本体（Ontology）模块的职责：

- 从访谈答案中提取结构化信息（领域、任务、工具、目标）。
- 生成三层本体结构：Domain → Concept → Instance。
- 建立概念之间的关系（contains、dependency 等）。
- 支持对本体的增删改查（CRUD）。
- 提供本体客户端，封装底层 API 调用。

## 2. 本单元的 8 节课

| 课号 | 课题 | 核心问题 |
| --- | --- | --- |
| G19 | 本体类型系统 | `types/ontology.ts` 定义了哪些类型？三层结构是怎么设计的？ |
| G20 | 本体构建服务 | `OntologyService.generateFromInterview` 如何从访谈生成本体？ |
| G21 | 领域生成 | `generateDomain` 怎么从答案中提取领域信息？ |
| G22 | 概念生成 | `generateConcepts` 怎么从任务、工具、目标中提取概念？ |
| G23 | 关系生成 | `generateInitialRelations` 怎么建立概念之间的关联？ |
| G24 | 本体编辑 | `applyEdits` 如何支持本体的增删改查？ |
| G25 | 本体客户端 | `OntologyClient` 如何封装底层 API 调用？ |
| G26 | 单元小结课 | 画出"访谈答案 → 本体生成 → 关系建立 → 编辑"的完整调用链 |

## 3. 本单元涉及的源码文件

```
packages/core/src/lib/features/ontology/
├── index.ts                    # 公共 API 导出（types, interview, ontology-builder, client）
├── types.ts                    # InterviewQuestion, InterviewSession 等类型
├── interview.ts                # InterviewService：访谈会话 CRUD
├── ontology-builder.ts         # OntologyService：本体生成与编辑
└── client.ts                   # OntologyClient：本体 API 客户端

packages/core/src/types/ontology.ts
├── Domain, Concept, Instance, Relation, Ontology      # 三层本体结构
├── OntologyEntity, OntologyRelation                   # 技能集成类型
├── OntologyEditOperation, OntologyEditResponse        # 编辑操作类型
└── PersonProperties, ProjectProperties, ...           # 实体属性类型
```

## 4. 主线案例：小王的咖啡馆本体

本单元沿用"小王开社区咖啡馆"案例：

1. 小王回答完访谈问题（工作领域、工作模式、主要任务）。
2. 系统从答案中提取：
   - 领域："餐饮零售，社区咖啡馆"
   - 任务："采购原料、制作咖啡、服务顾客、管理库存"
3. 系统生成 Domain："餐饮零售，社区咖啡馆"。
4. 系统从任务中提取 Concept：
   - "采购原料"（task 类型）
   - "制作咖啡"（task 类型）
   - "服务顾客"（task 类型）
   - "管理库存"（task 类型）
5. 系统建立关系：
   - Domain "contains" 每个 Concept
   - 任务之间有 "dependency" 关系
6. 小王可以编辑本体，添加新的 Concept（如"供应商"、"客户"）和 Instance（如具体的咖啡豆供应商）。

## 5. 关键概念速览

### 5.1 三层本体结构

```
Domain（领域层）
  └── Concept（概念对象层）
        └── Instance（实例数据层）
```

| 层级 | 对应源码 | 说明 |
| --- | --- | --- |
| **Domain** | `Domain` interface | 领域定义，如"餐饮零售" |
| **Concept** | `Concept` interface | 概念类型，如"采购原料" |
| **Instance** | `Instance` interface | 具体实例，如"XX咖啡豆供应商" |

### 5.2 关系类型

```ts
type RelationType = 'dependency' | 'contains' | 'association' | 'inheritance';
```

| 类型 | 说明 | 示例 |
| --- | --- | --- |
| `contains` | 包含关系 | Domain contains Concept |
| `dependency` | 依赖关系 | Task A depends on Task B |
| `association` | 关联关系 | Concept A associated with Concept B |
| `inheritance` | 继承关系 | Concept A inherits from Concept B |

### 5.3 本体编辑操作

```ts
interface OntologyEditOperation {
  type: 'add' | 'update' | 'delete';
  entityType: 'domain' | 'concept' | 'instance' | 'relation';
  entityId?: string;
  data: any;
}
```

## 6. 与前后单元的衔接

**上游（单元二 G11–G18）：**
- 访谈流程提供了原始答案（`InterviewSession.answers`）。
- `OntologyService.generateFromInterview` 接收访谈会话作为输入。

**下游（单元四 G27–G38）：**
- 本体生成后，需要存储到数据层。
- `OntologyDataStore` 负责实例数据的持久化。

**平行（Part F）：**
- Agent 可以读取和编辑本体。
- `OntologyClient` 为 Agent 提供了操作接口。

## 7. 阅读建议

按以下顺序阅读本单元：

1. 先读 G19，理解本体类型系统（Domain、Concept、Instance、Relation）。
2. 读 G20，理解 `OntologyService.generateFromInterview` 的整体流程。
3. 读 G21–G23，分别理解领域生成、概念生成、关系生成的细节。
4. 读 G24，理解本体编辑的 CRUD 操作。
5. 读 G25，理解 `OntologyClient` 的 API 封装。
6. 最后做 G26 工作坊，画出完整调用链。

---

**准备好后，从 G19 开始。**
