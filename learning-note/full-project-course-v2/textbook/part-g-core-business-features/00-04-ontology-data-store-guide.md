# 单元导读四：小王的本体数据怎么被"增删改查"和版本管理

> 本单元总问题：本体生成之后，具体的数据实例（Instance）是怎么被创建、查询、更新和删除的？Schema 是怎么验证的？版本管理和导出功能是怎么实现的？

## 0. 本页先读什么

如果只记住一句话，记住这一句：

> **OntologyDataStore 是 OriginOS 的"文件数据库"——用 JSON 文件存储实例，用内存缓存加速索引，用 Schema 验证保证数据质量，用版本管理追溯历史。**

## 1. 本单元在讲什么

上一单元（G19–G26）讲的是"本体构建"——系统如何从访谈答案生成 Domain、Concept、Relation 三层结构。但本体只是"骨架"，真正的业务数据（Instance）还需要一个可靠的存储层来管理。

这就是 `OntologyDataStore` 的职责：

- **实例 CRUD**：创建、读取、更新、删除 Instance 数据。
- **Schema 验证**：根据 Concept 定义验证字段类型、必填项、枚举值。
- **查询引擎**：支持过滤、排序、分页查询。
- **索引管理**：内存缓存 + 磁盘持久化的 NeDB 风格索引。
- **版本管理**：保存实例快照，支持回滚到历史版本。
- **实例关系**：建立和管理实例之间的关联。
- **导出功能**：支持 JSON 和 CSV 格式导出。
- **本体操作**：Domain、Concept、Relation 的结构化操作。

## 2. 本单元的 12 节课

| 课号 | 课题 | 核心问题 |
| --- | --- | --- |
| G27 | 数据存储类型系统 | `types.ts` 定义了哪些类型？InstanceData、ConceptSchema、QueryParams 是怎么设计的？ |
| G28 | 配置与路径管理 | `config.ts` 怎么解析 ontologyId、生成存储路径、防止路径遍历？ |
| G29 | 实例 CRUD（上） | `createInstance` 和 `getInstance` 是怎么工作的？ |
| G30 | 实例 CRUD（下） | `updateInstance` 和 `deleteInstance` 是怎么工作的？ |
| G31 | Schema 验证 | `validateInstance` 和 `loadConceptSchema` 是怎么验证数据的？ |
| G32 | 查询引擎 | `queryInstances` 是怎么支持过滤、排序、分页的？ |
| G33 | 索引管理器 | `loadIndex` 和 `saveIndex` 是怎么用内存缓存加速的？ |
| G34 | 版本管理 | `saveVersion` 和 `revertToVersion` 是怎么管理历史版本的？ |
| G35 | 实例关系 | `createInstanceRelation` 和 `deleteInstanceRelation` 是怎么管理实例关联的？ |
| G36 | 本体操作层 | `ontology-ops.ts` 怎么管理 Domain、Concept、Relation 的结构？ |
| G37 | 导出功能 | `exportInstances` 是怎么支持 JSON 和 CSV 导出的？ |
| G38 | 单元小结课 | 画出"实例创建 → Schema 验证 → 索引更新 → 查询 → 版本管理"的完整调用链 |

## 3. 本单元涉及的源码文件

```
packages/core/src/lib/features/ontology-data-store/
├── index.ts                    # 公共 API 导出
├── types.ts                    # InstanceData, ConceptSchema, QueryParams 等类型
├── config.ts                   # 路径解析、ID 验证
├── store.ts                    # 实例 CRUD（create/get/update/delete）
├── schema-validator.ts         # Schema 验证（类型、必填、枚举）
├── query-engine.ts             # 查询引擎（过滤、排序、分页）
├── index-manager.ts            # 索引管理（内存缓存 + 磁盘持久化）
├── version.ts                  # 版本管理（快照、回滚）
├── instance-relations.ts       # 实例关系管理
├── ontology-ops.ts             # 本体结构操作（Domain/Concept/Relation CRUD）
├── export.ts                   # 导出功能（JSON/CSV）
└── __tests__/
    └── ontology-data-store.test.ts  # 单元测试
```

## 4. 主线案例：小王的咖啡馆实例数据

本单元沿用"小王开社区咖啡馆"案例：

1. 小王的本体已经生成：Domain "餐饮零售"，Concept "商品"、"供应商"、"订单"。
2. 小王创建一个"商品"实例：
   - 名称："埃塞俄比亚耶加雪菲咖啡豆"
   - 类别："咖啡豆"
   - 单价：128
   - 库存：50
3. 系统验证 Schema（名称是字符串、单价是数字、必填项是否完整）。
4. 系统写入 JSON 文件，更新索引。
5. 小王查询所有"商品"实例，按单价排序。
6. 小王修改库存（50 → 45），系统自动保存版本快照。
7. 小王导出所有商品数据为 CSV。

## 5. 关键概念速览

### 5.1 三层数据结构

```
Ontology（本体）
  └── Domain（领域）
        └── Concept（概念）
              └── Instance（实例） ← OntologyDataStore 管理这一层
```

### 5.2 InstanceData 结构

```ts
interface InstanceData {
  id: string;              // 实例 ID（如 "inst-1717603200000-abc123"）
  conceptId: string;       // 所属 Concept
  domainId: string;        // 所属 Domain
  ontologyId: string;    // 所属 Ontology
  fields: Record<string, unknown>;  // 实际数据字段
  meta: InstanceMeta;      // 元数据（创建时间、更新时间、版本等）
}
```

### 5.3 存储路径

```
data/projects/{projectId}/ontology/
├── ontology.json              # 本体结构定义
└── data/
    └── {conceptId}/
        ├── _index.json        # 索引文件（NeDB 风格）
        ├── {instanceId}.json  # 实例数据文件
        └── versions/          # 版本快照目录
```

### 5.4 核心设计模式

| 模式 | 说明 | 示例 |
| --- | --- | --- |
| **文件存储** | 每个实例一个 JSON 文件 | `{instanceId}.json` |
| **索引缓存** | 内存缓存 + 磁盘持久化 | `index-manager.ts` |
| **Schema 验证** | 严格模式，拒绝未知字段 | `schema-validator.ts` |
| **版本快照** | 每次更新自动保存快照 | `version.ts` |
| **路径安全** | `isValidId` 防止路径遍历 | `config.ts` |

## 6. 与前后单元的衔接

**上游（单元三 G19–G26）：**
- 本体构建生成了 Domain、Concept、Relation 结构。
- `OntologyDataStore` 在此基础上管理具体的 Instance 数据。

**下游（单元五 G39–G46）：**
- 实例数据被 Document、API Clients 等模块使用。
- 导出功能为数据迁移提供支持。

**平行（Part F）：**
- Agent 可以通过工具调用创建、查询、更新实例数据。
- `OntologyDataStore` 为 Agent 提供了结构化的数据操作接口。

## 7. 阅读建议

按以下顺序阅读本单元：

1. 先读 G27，理解类型系统（InstanceData、ConceptSchema、QueryParams）。
2. 读 G28，理解配置和路径管理（如何防止路径遍历）。
3. 读 G29-G30，理解实例 CRUD（创建、读取、更新、删除）。
4. 读 G31，理解 Schema 验证（类型检查、必填项、枚举值）。
5. 读 G32，理解查询引擎（过滤、排序、分页）。
6. 读 G33，理解索引管理器（内存缓存机制）。
7. 读 G34，理解版本管理（快照和回滚）。
8. 读 G35，理解实例关系管理。
9. 读 G36，理解本体操作层（Domain/Concept/Relation CRUD）。
10. 读 G37，理解导出功能。
11. 最后做 G38 工作坊，画出完整调用链。

---

**准备好后，从 G27 开始。**
