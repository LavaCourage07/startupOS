# Epic ONT: 业务本体、方案契约与多 Agent 运行时重构

**Epic 编号:** ONT  
**Epic 名称:** 业务本体、方案契约与多 Agent 运行时重构  
**优先级:** Critical  
**状态:** Planning  
**Owner:** Product / Architecture  
**创建日期:** 2026-07-27

---

## Epic 目标

建立一套贯穿 OriginOS 项目三阶段的统一、可执行本体架构：

1. **业务建模阶段**：表达业务对象、聚合、事实、规则、行动、事件和生命周期，而不是把业务对象直接等同于数据库表。
2. **解决方案设计阶段**：将本体能力转化为可验证的 Skill / Agent 契约，并要求实现可执行的 OSDK 调用代码。
3. **多 Agent 运行阶段**：所有 Skill 执行前先解析事实数据和契约，执行中只能通过受约束的本体操作，执行后验证产物、规则与事实变更。
4. **项目本体编辑阶段**：业务建模产物、本体存储和项目本体编辑器使用同一份规范数据结构，不再依赖多套模型和散落转换逻辑。

最终目标不是增加一套新的本体 JSON，而是收敛现有实现，形成：

```text
统一元模型
  -> 统一项目本体文档
  -> 统一 OSDK
  -> 方案契约与静态门控
  -> Skill / Agent 运行时门控
  -> 可追溯的事实、行动和结果
```

---

## 背景与问题

### 1. 规则表达弱，行动没有成为一等公民

当前统一本体实现主要覆盖 `Entity / Attribute / Relation / Rule`。规则虽然支持
`precondition`、`postcondition`、`constraint` 等类型，但业务建模阶段主要生成自然语言
`condition/action`，运行时也没有稳定的规则到行动绑定机制。

由此造成：

- 规则通常只用于展示或提示词上下文，不能稳定阻止非法执行。
- 状态转换、业务操作、副作用和异常补偿没有统一定义。
- Agent 知道“应该遵守什么”，但系统不知道“允许执行什么”和“如何验证执行结果”。

### 2. 业务建模与数据建模一对一

当前业务模型中的 `entities` 会直接转换为编辑器中的 `concepts`，概念实例又直接映射到
独立数据目录。这个模型隐含了“一个业务实体对应一种持久化结构”的假设。

这会导致：

- 为业务语义拆分出的每个对象都可能演变成单独的数据集合或表。
- 无法表达聚合根、值对象、聚合内部实体和一致性边界。
- 跨对象更新缺少事务和不变量边界。
- 业务模型为了迁就存储结构而膨胀，增加方案和运行时复杂度。

本 Epic 明确：

> 业务对象不是数据表。持久化结构是业务本体的投影，由聚合边界、查询需求和一致性要求决定。

### 3. 运行时本体约束不足

现有多 Agent 能力匹配已经定义 `OntologyOperationSpec` 和
`SkillOntologyContract`，但主要用于路由评分，没有形成执行闭环。

当前缺口包括：

- Skill 执行前不保证读取所需事实实例。
- 输入契约可能只是元数据，没有对应的 OSDK 查询代码。
- 工具仍可绕过本体契约直接读写文件。
- 前置条件、行动授权、输出契约和后置条件没有形成强制门控。
- 多 Agent 之间缺少基于事实版本、来源和聚合边界的并发控制。

### 4. 业务建模元数据与项目本体编辑器结构不一致

当前至少存在三种用途重叠的数据结构：

| 数据结构 | 当前用途 | 主要问题 |
|----------|----------|----------|
| `output/business-model.json` | 业务建模产物 | `entities / relationships / businessRules / constraints`，属性主要是自然语言字符串 |
| `OntologyModel` | 访谈预览和旧编辑器 | `nodes` 树结构，将实体、属性、关系、规则混为节点 |
| `OntologyData` | 项目本体编辑器和实例存储 | `domains / concepts / relations`，缺少完整规则、行动、聚合和业务语义 |

转换逻辑目前散落在：

- Web 组件中的 `businessModelToOntology`
- Web API Route 中的 `business-model.json -> ontology.json`
- Electron desktop service 中的同步逻辑
- ontology data API 中的自动补同步逻辑

多套转换会导致字段丢失、ID 不稳定、关系不同步、编辑结果无法回写业务模型，以及
Web/Windows/macOS 行为不一致。

---

## 设计原则

### 单一规范源

`data/projects/{projectId}/ontology/ontology.json` 是项目本体元数据的唯一规范源。

- 业务建模 Skill 通过 OSDK 或 core 公共服务更新规范源。
- 项目本体编辑器直接读取和修改规范源。
- 解决方案设计从规范源生成契约。
- 运行时从规范源和事实存储创建执行上下文。
- `output/business-model.json` 在迁移期保留为只读兼容投影，不再与规范源双向竞争。

### 模型与数据分离

```text
Ontology Model
  - Domain
  - Business Object
  - Aggregate
  - Relation
  - Rule / Policy
  - Action
  - Event
  - Projection

Ontology Facts
  - Aggregate instances
  - Fact records
  - Relation instances
  - Action executions
  - Provenance and versions
```

本体元数据描述“业务世界允许什么”；事实数据描述“当前真实发生了什么”。

### 聚合优先

规范模型必须支持：

- `aggregateRoot`：聚合唯一外部写入口。
- `aggregateMember`：聚合内部有身份对象。
- `valueObject`：无独立生命周期、随聚合持久化的值。
- `reference`：跨聚合只保存稳定引用，不隐式联动写入。
- `projection`：为查询、编辑器或外部系统生成的数据视图。

是否独立持久化由 `storageProjection` 决定，不能由“它是一个业务实体”自动推导。

### 行动驱动

行动是改变事实或触发外部副作用的唯一业务入口。每个 Action 至少声明：

- 目标聚合与操作权限
- 输入、输出和事实查询
- 前置条件与适用规则
- 状态转换和领域事件
- 幂等键、失败语义和补偿策略
- 执行后置条件

规则不只是一段文本，必须明确约束的 Action、Aggregate 或 Fact 范围。

### 契约必须可执行

Skill 契约不能只声明 `reads/writes`。进入可发布状态前必须存在可静态检查的 OSDK 调用：

```typescript
const order = await osdk.facts.order.getRequired(input.orderId);
await osdk.actions.confirmOrder.execute({
  aggregateId: order.aggregateId,
  expectedVersion: order.version,
});
```

实际 API 以 ONT.4 的设计为准，但必须满足：

- 输入事实查询与 `inputContract` 对齐。
- Action 调用与允许操作、规则和聚合边界对齐。
- 输出事实或事件与 `outputContract` 对齐。
- 禁止用直接文件写入伪装成本体写入。

### 默认拒绝

遇到以下情况时，方案确认或运行时执行必须失败并返回结构化原因：

- 契约引用不存在的对象、字段、规则或 Action。
- 必需事实缺失、来源不可信或版本冲突。
- Skill 没有实现契约要求的 OSDK 调用。
- Action 前置条件不满足。
- 输出未满足后置条件或破坏聚合不变量。
- Agent 没有目标本体对象或 Action 的操作权限。

---

## 目标元模型

Epic 需要形成一个由 `packages/core/src/lib/features/ontology/` 公共 API 导出的规范模型。
以下是概念边界，不是最终 TypeScript 字段定稿：

| 概念 | 职责 |
|------|------|
| `Domain` | 业务边界和命名空间 |
| `BusinessObject` | 业务语义对象，不隐含物理表 |
| `Aggregate` | 一致性边界，声明 root、members、invariants |
| `Property` | 业务属性、值类型、必填和敏感级别 |
| `Relation` | 对象之间的语义关系及跨聚合约束 |
| `FactType` | 可被运行时查询和引用的事实类型 |
| `Rule` | 不变量、前置条件、后置条件、派生或策略 |
| `Action` | 读取事实、改变聚合、发出事件的业务能力 |
| `DomainEvent` | 已发生业务事实及来源 |
| `Projection` | 从聚合/事实映射到编辑、查询或持久化结构 |
| `SkillContract` | Skill 所需事实、允许 Action、输出和验证条件 |
| `AgentContract` | Agent 权限、可用 Skill 和协作边界 |

规范文档必须带有稳定 ID、schema version、迁移版本和来源信息。显示名称不能作为关系主键。

---

## 三阶段目标流程

### 阶段一：业务本体建模

```text
业务访谈
  -> 识别业务能力与事实
  -> 划分业务对象和值对象
  -> 定义聚合与一致性边界
  -> 定义生命周期、规则和行动
  -> 校验引用、规则覆盖和行动闭环
  -> 保存统一项目本体
  -> 编辑器直接展示同一模型
```

阶段一门控：

- 每个关键生命周期转换必须由 Action 触发。
- 每条强约束规则必须绑定作用域和检查时机。
- 每个跨聚合关系必须声明引用和一致性策略。
- 业务对象不得自动一对一生成持久化集合。
- 业务建模视图和项目本体编辑器往返编辑不得丢失字段。

### 阶段二：解决方案与契约设计

```text
读取统一项目本体
  -> 选择 Agent / Skill
  -> 声明事实输入与 Action 权限
  -> 生成 OSDK 调用实现
  -> 静态契约检查
  -> 场景推演
  -> 门控通过
  -> 生成可执行 manifest
```

阶段二门控：

- 所有输入事实都有可解析来源。
- 所有输出都由 Action、Event 或 Projection 产生。
- Skill 契约引用的类型和字段存在。
- OSDK 代码覆盖契约声明，不存在越权调用。
- SOP 上游输出满足下游输入。
- 失败、补偿、幂等和并发策略完整。
- 门控失败时不得将方案标记为可执行或发布 Skill。

### 阶段三：多 Agent 运行时执行

```text
任务进入
  -> 解析 Agent / Skill 契约
  -> 通过 OSDK 加载事实快照
  -> 验证权限与前置条件
  -> 基于本体契约路由 Agent
  -> 执行 Action
  -> 验证输出与后置条件
  -> 原子提交事实 / 事件
  -> 写入来源、版本和审计记录
```

阶段三门控：

- 未完成事实加载时不启动 Skill 主循环。
- 事实快照和契约摘要必须进入 Agent 上下文。
- 运行时工具集按契约裁剪。
- 写操作只能通过 OSDK Action API。
- 聚合使用乐观版本或等价机制检测并发冲突。
- Worker 结果必须包含事实引用、Action 记录和契约验证结果。
- Supervisor 只能聚合已通过输出契约的结果。

---

## Stories

| Story | 标题 | 状态 | 优先级 | 核心交付 |
|-------|------|------|--------|----------|
| ONT.1 | 统一项目本体规范与单一数据源 | Planning | Critical | Canonical schema、schema version、稳定 ID、唯一存储源、core 公共 API |
| ONT.2 | 业务建模元模型重构 | Planning | Critical | 业务对象、值对象、聚合根、规则、行动、事件、生命周期与建模门控 |
| ONT.3 | 项目本体编辑器统一与无损往返 | Planning | Critical | 编辑器改用 canonical schema、移除散落转换、业务建模与编辑器双向一致 |
| ONT.4 | OSDK 查询与行动执行层 | Planning | Critical | 类型化事实查询、Action API、权限、版本、审计、错误契约和代码生成 |
| ONT.5 | 解决方案 Skill/Agent 契约重构 | Planning | High | 事实输入、Action 权限、输出事实/事件、SOP 数据流和 manifest v2 |
| ONT.6 | OSDK 实现门控与方案推演 | Planning | Critical | 静态检查、契约覆盖率、越权检测、场景推演和发布阻断 |
| ONT.7 | 多 Agent 本体运行时执行闭环 | Planning | Critical | 事实预载、上下文注入、工具裁剪、Action 执行、后置校验和 Supervisor 聚合 |
| ONT.8 | 旧模型迁移、兼容投影与端到端验证 | Planning | High | 数据迁移、`business-model.json` 兼容投影、回滚、跨平台 E2E |

### Story 实施顺序

```text
ONT.1
  ├─> ONT.2 ─> ONT.3
  └─> ONT.4 ─> ONT.5 ─> ONT.6 ─> ONT.7
                                  └────────> ONT.8
```

ONT.1、ONT.4 和 ONT.6 是架构门。后续 Story 不得在它们的契约未稳定前复制临时类型。

---

## 与现有规格的关系

| 现有规格/实现 | 本 Epic 处理方式 |
|---------------|------------------|
| Epic 1 项目初始化与业务建模 | 由 ONT.2 重构本体产出方式；保留对话式访谈体验 |
| P2.6 SOP I/O 契约 | 需求并入 ONT.5，升级为事实、Action、规则和 OSDK 代码契约 |
| P2.4 沙盒推演 | 由 ONT.6 提供本体契约门控和推演内核，P2.4 消费结果 |
| 9.36 本体契约能力匹配 | 由 ONT.7 接管执行约束；现有匹配评分作为兼容输入 |
| `UnifiedOntology` | 评估迁移到 ONT.1 规范模型，禁止继续形成第四套模型 |
| `ontology-data-store` | 保留事实存储能力，但 schema 和目录必须服从聚合与 projection 设计 |
| `OntologyModel` 树结构 | 降为纯 UI ViewModel，由 canonical schema 单向派生 |
| `business-model.json` | 迁移期由 canonical schema 生成的兼容投影，禁止继续作为第二写入源 |

若现有 Story 与本 Epic 冲突，以 ONT 的 canonical schema、OSDK 和门控约束为准，并在对应
Story 实施时更新原规格的依赖与废弃说明。

---

## 架构边界

### Core

规范模型、迁移、验证、OSDK、契约检查和运行时门控属于：

```text
packages/core/src/lib/features/ontology/
packages/core/src/lib/features/ontology-data-store/
packages/core/src/modules/collaboration-runtime/
```

跨 feature 调用必须通过公共 `index.ts`，不得直接引用其他 feature 内部文件。

### Web

Web 组件只消费 core 提供的 DTO/ViewModel 和命令接口：

- `packages/web/src/app/` 只处理参数和响应映射。
- 禁止继续在 API Route 中实现 `business-model -> ontology` 转换。
- 编辑器状态可以使用 Zustand，但本体规则和迁移逻辑不得进入 store 或组件。

### Desktop

Electron 主进程负责 IPC 和文件系统环境适配：

- 不复制 core 的 schema 转换和验证逻辑。
- Windows/macOS 使用同一个 core 本体服务。
- 运行时目录解析由 desktop 注入，业务规则仍由 core 执行。

### Skills

- Skill 定义目录只读。
- Skill 通过 OSDK 操作项目事实和 Action。
- Skill 运行产物仍遵守现有 `data/skills`、`data/agents` 和项目 CWD 规则。
- 本体事实不得通过 `write_file` 直接修改底层 JSON。

以上依赖保持 AGENTS.md 要求的单向依赖，不引入数据库，也不把业务逻辑放入 App Router。

---

## Epic 级验收标准

### 统一结构

- [ ] 业务建模、项目本体编辑器、解决方案设计和运行时引用同一个 schema version。
- [ ] canonical ontology 中的规则、Action、聚合和属性经过编辑器保存后无损。
- [ ] Web API、Electron service 和 UI 组件中不再存在重复的业务模型转换实现。
- [ ] `business-model.json` 与 canonical ontology 不再形成双写和冲突源。

### 业务语义

- [ ] 业务对象可以被建模为聚合根、聚合成员或值对象。
- [ ] 一个聚合可以投影为一个或多个存储结构，多个业务对象也可以共享一个聚合存储。
- [ ] 关键规则绑定明确作用域、检查时机和相关 Action。
- [ ] 生命周期转换必须通过 Action，并可验证前置/后置条件。

### 方案门控

- [ ] 每个可执行 Skill 都声明事实输入、允许 Action、输出和失败契约。
- [ ] 每个本体契约都有对应 OSDK 调用实现。
- [ ] 缺失 OSDK 实现、引用不存在或越权操作会阻止方案确认和发布。
- [ ] SOP 契约检查覆盖连通性、字段、规则、版本、幂等和补偿。

### 运行时

- [ ] Skill 主循环启动前已加载契约要求的事实数据。
- [ ] Agent 只能获得契约允许的本体工具与 Action。
- [ ] 失败的前置条件、版本冲突或输出校验会阻止事实提交。
- [ ] 多 Agent 结果携带来源、版本、Action 和契约验证记录。
- [ ] Supervisor 不接受未通过契约验证的 Worker 结果。

### 兼容与验证

- [ ] 已有项目可迁移且支持迁移前备份和失败回滚。
- [ ] 旧版方案和 Skill 有明确的兼容、警告或阻断策略。
- [ ] Windows、macOS 和 Web 开发态通过相同的端到端用例。
- [ ] 每个 Story 实施前具有完整 `testing.md`，实施后创建自动化测试验证 goal。

---

## 非功能要求

| 项目 | 要求 |
|------|------|
| 一致性 | canonical schema 写入必须原子化，并带 schema/version 信息 |
| 性能 | 常规 Skill 的事实预载和契约检查目标 P95 小于 500ms，不含模型调用 |
| 并发 | 聚合写入必须检测版本冲突，禁止静默覆盖 |
| 安全 | 默认拒绝未声明的对象、字段、Action 和跨聚合写入 |
| 可观测性 | 每次执行记录 ontologyId、schemaVersion、factVersion、actionId、contractVersion 和验证结果 |
| 可迁移性 | 所有 schema 升级提供确定性 migration 和 downgrade/restore 路径 |
| 跨平台 | 路径与文件操作不得依赖 Windows 或 POSIX 专有语法 |

---

## 风险

| 风险 | 缓解措施 |
|------|----------|
| 一次性替换三套模型导致现有项目不可用 | 采用版本化 migration、兼容读取和只读投影，分 Story 切换 |
| 聚合设计过度工程化 | 先支持 root/member/value-object/reference 四类边界，不引入完整 DDD 框架 |
| LLM 生成 OSDK 代码不稳定 | 使用模板、类型检查、AST/静态契约检查和场景测试共同门控 |
| 事实预载增加每轮延迟和 token | 只加载契约声明的事实摘要，按需分页读取详情 |
| Agent 绕过 OSDK 修改文件 | 运行时裁剪工具并保护本体数据目录，写入仅开放 Action API |
| 旧 Skill 没有契约 | 设兼容等级：只读兼容、受限运行、阻断发布，并提供迁移报告 |

---

## 依赖

### 前置依赖

| 依赖 | 状态 | 说明 |
|------|------|------|
| Epic 1 项目初始化 Skill | 已有实现 | 提供业务建模入口和现有模型样本 |
| Epic P2 解决方案设计 | 部分实现 | 提供方案工作流和现有 I/O 契约规格 |
| Story 9.36 本体契约能力匹配 | 部分实现 | 提供运行时匹配模型和迁移基础 |
| ontology-data-store | 已有实现 | 提供项目本体和实例文件存储能力 |
| Pi Agent ToolRegistry | 已有实现 | 用于注入经过契约裁剪的 OSDK 工具 |

### 后续依赖

- AI 解决方案可执行 manifest
- 多 Agent 协作运行时
- Skill 市场发布审核
- 本体数据编辑与事实审计
- 认知系统的事实来源和知识沉淀

---

## 当前进度

| 领域 | 当前状态 | Epic 目标状态 |
|------|----------|---------------|
| 业务模型 | `business-model.json` 独立结构 | canonical schema 的业务建模视图 |
| 编辑器模型 | `domains/concepts/relations`，通过同步生成 | 直接消费 canonical schema |
| 规则 | 自然语言为主，弱运行时校验 | 结构化/自然语言混合，绑定作用域和 Action |
| Action | 分散在 lifecycle 和规则文本 | 一等元模型与唯一写入口 |
| 聚合 | 未定义 | 明确一致性和持久化投影边界 |
| Skill 契约 | 基础 I/O 类型 | 事实、Action、规则、版本和错误契约 |
| OSDK | 未形成统一 API | 类型化查询、Action、审计与代码门控 |
| 多 Agent 执行 | 主要用于匹配评分 | 事实预载、权限、执行和结果验证闭环 |

Epic 当前处于规格拆解阶段，尚未开始代码实施。

---

## 相关文档

- [Epic 1: 项目初始化 Skill](../epic-1/README.md)
- [Epic P2: AI 解决方案设计](../epic-P2/README.md)
- [Story P2.6: SOP I/O 契约](../epic-P2/story-P2.6/README.md)
- [Story 9.36: 多 Agent 本体契约能力匹配](../epic-9/story-9.36/README.md)
- [Epic C: 认知系统](../epic-C/README.md)
- [AGENTS.md](../../../AGENTS.md)

---

## 变更历史

| 日期 | 版本 | 变更 | 变更人 |
|------|------|------|--------|
| 2026-07-27 | 0.1.0 | 创建 Epic，覆盖统一 schema、业务聚合、规则与 Action、OSDK 契约门控和多 Agent 运行时 | Codex |
