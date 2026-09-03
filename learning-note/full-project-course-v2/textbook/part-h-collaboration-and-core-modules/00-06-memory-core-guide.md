# 单元导读六：Memory Core 记忆系统

## 单元总问题

Memory Core 如何为 Agent 提供短期 block 记忆、长期 recall 记忆和归档 archival 记忆？不同记忆层如何选择？

## 为什么现在学这个单元

前五单元已经讲解了多 Agent 协作运行时的执行、协议、冲突和隔离。但 Agent 要在长期服务用户的过程中积累经验，就需要记忆系统。OriginOS 的 Memory Core 提供三层记忆：

1. **Block 记忆**：短期、结构化、直接注入 prompt 的工作记忆。
2. **Recall 记忆**：按 turn 组织的历史记录，支持快速召回最近对话。
3. **Archival 记忆**：长期、向量化的归档记忆，支持语义搜索。

本单元讲解 Memory Core 的内部实现。注意：Part F 已经讲过 Memory Core 中被认知系统直接调用的桥接文件（`adapter.ts`、`memory-provider.ts`、`enhanced-pattern-provider.ts`、相关 tools）。本单元只从内部实现层回答：Block 如何被创建和持久化？Recall 如何存储历史？Archival 如何使用 embedding 和 HNSW 索引？

## 主线案例在本单元的推进

小林的旅行 Agent 在长期工作中需要记忆：

1. **Block 记忆**：Agent 把“小林偏好民宿、预算 6000、同行 2 人”写入 `Memory.md` 的各个 block。
2. **Recall 记忆**：每次对话 turn 被记录到 `HistoryStore`，Agent 可以快速召回最近几轮讨论。
3. **Archival 记忆**：Agent 把“杭州西湖区酒店选择策略”提取成知识，经过 embedding 存入 `HNSWIndex`，后续语义搜索时召回。
4. **Memory.md + blocks.json**：Block 记忆同时以 markdown 和 JSON 快照持久化，支持版本追溯。
5. **工具接口**：Agent 通过 `CoreMemoryTools` 和 `ArchivalMemoryTools` 读写记忆。

到本单元结束时，你应该能：根据实时性、容量、持久性、计算成本选择 block/recall/archival，并追踪每种记忆的持久化路径。

## 范围边界

### 本单元讲什么

- `packages/core/src/modules/memory-core/index.ts`：模块公共导出。
- `packages/core/src/modules/memory-core/core/block.ts`：Block 类型与默认 blocks。
- `packages/core/src/modules/memory-core/core/memory.ts`：Memory 类，Block CRUD、compile/render、持久化。
- `packages/core/src/modules/memory-core/core/memory-core.ts`：MemoryCore 类。
- `packages/core/src/modules/memory-core/core/consolidator.ts`：记忆合并器。
- `packages/core/src/modules/memory-core/core/dream-compat.ts`：Dream 兼容层。
- `packages/core/src/modules/memory-core/recall/recall-memory.ts`：RecallMemory。
- `packages/core/src/modules/memory-core/recall/history-store.ts`：HistoryStore。
- `packages/core/src/modules/memory-core/archival/archival-memory.ts`：ArchivalMemory。
- `packages/core/src/modules/memory-core/archival/embedding.ts`：向量嵌入。
- `packages/core/src/modules/memory-core/archival/hnsw-index.ts`：HNSW 索引。
- `packages/core/src/modules/memory-core/archival/wordpiece-tokenizer.ts`：WordPiece 分词器。
- `packages/core/src/modules/memory-core/archival/pattern-ingest.ts`：模式摄入。
- `packages/core/src/modules/memory-core/tools/core-memory-tools.ts`：核心记忆工具。
- `packages/core/src/modules/memory-core/tools/archival-memory-tools.ts`：归档记忆工具。
- `packages/core/src/modules/memory-core/adapter.ts`：Adapter（本单元只讲内部结构，调用侧在 Part F）。
- `packages/core/src/modules/memory-core/session/memory-provider.ts`：MemoryProvider（本单元只讲内部结构，调用侧在 Part F）。
- `packages/core/src/modules/memory-core/session/enhanced-pattern-provider.ts`：EnhancedPatternProvider（本单元只讲内部结构，调用侧在 Part F）。

### 本单元不讲什么

- RoleAgent/Project Agent 如何把这些记忆注入 system prompt（Part F）。
- CognitiveManager 的生命周期钩子（Part F）。
- 协作运行时如何使用 Memory Core（已在 Unit 5 提边界）。

## 单元课程表

| 课号 | 课题 | 核心源码 | 学习目标 |
| --- | --- | --- | --- |
| H35 | Memory Core 全景：Block 与 Memory 对象 | `memory-core/index.ts`、`core/block.ts` | 理解 Block、Memory、MemoryCore 的关系 |
| H36 | Block CRUD、compile/render 与持久化 | `core/memory.ts` | 理解 markdown/xml 编译、Memory.md/blocks.json 持久化、版本快照 |
| H37 | RecallMemory 与 HistoryStore | `recall/recall-memory.ts`、`recall/history-store.ts` | 理解按 turn 的记录与召回 |
| H38 | ArchivalMemory、embedding 与 HNSWIndex | `archival/archival-memory.ts`、`archival/embedding.ts`、`archival/hnsw-index.ts`、`archival/wordpiece-tokenizer.ts` | 理解归档存储、向量嵌入、近似最近邻索引 |
| H39 | CoreMemoryTools 与 ArchivalMemoryTools | `tools/core-memory-tools.ts`、`tools/archival-memory-tools.ts` | 理解 Agent 可调用的记忆工具接口 |
| H40 | Adapter 与 Provider：MemoryAdapter、MemoryProvider、EnhancedPatternProvider | `adapter.ts`、`session/memory-provider.ts`、`session/enhanced-pattern-provider.ts` | 理解 Memory Core 如何被外部消费（调用侧见 Part F） |
| H41 | 单元小结课：记忆系统的层次选择 | 复习 H35-H40 | 能根据“实时性/容量/持久性/计算成本”选择 block/recall/archival |

## 源码覆盖台账

| 文件路径 | 文件类型 | 本单元状态 | 主讲章节 | 代码窗口 | 教学责任 | 配对验证 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/core/src/modules/memory-core/index.ts` | source | 精读 | H35 | 全文件 re-export | 模块公共 API | 类型检查 | 入口 |
| `packages/core/src/modules/memory-core/core/block.ts` | source | 精读 | H35 | `Block`、`BlockDefinition`、`DEFAULT_BLOCKS`、`createBlock`、`validateBlock`、`serializeBlock` | Block 类型与默认块 | `block.test.ts` | 基础类型 |
| `packages/core/src/modules/memory-core/core/memory.ts` | source | 精读 | H36 | `Memory` 类、CRUD、`compile`、`saveMemoryMd`、`saveBlocksSnapshot`、`loadFromDisk`、`parseMemoryMd` | Block 管理与持久化 | `memory.test.ts` | 核心实现 |
| `packages/core/src/modules/memory-core/core/memory-core.ts` | source | 背景引用 | H35 | `MemoryCore` 类 | 高层封装 | 可能无独立测试 | 本单元提边界 |
| `packages/core/src/modules/memory-core/core/consolidator.ts` | source | 背景引用 | H38-H39 | `MemoryConsolidator` | 记忆合并 | `consolidator.test.ts` | 可能 H38 或 H39 精读 |
| `packages/core/src/modules/memory-core/core/dream-compat.ts` | source | 背景引用 | H38 | `DreamCompat` | Dream 兼容 | `dream-compat.test.ts` | 边界说明 |
| `packages/core/src/modules/memory-core/recall/recall-memory.ts` | source | 精读 | H37 | `RecallMemory`、`RecallSearchResult` | 召回记忆 | `recall.test.ts` | 短期记忆 |
| `packages/core/src/modules/memory-core/recall/history-store.ts` | source | 精读 | H37 | `HistoryStore`、`TurnRecord`、`RecallEntry` | 历史记录存储 | `recall.test.ts` | turn 级记录 |
| `packages/core/src/modules/memory-core/archival/archival-memory.ts` | source | 精读 | H38 | `ArchivalMemory`、`ArchivalEntry`、`ArchivalSearchResult`、`SearchOptions` | 归档记忆 | `archival.test.ts` | 长期记忆 |
| `packages/core/src/modules/memory-core/archival/embedding.ts` | source | 精读 | H38 | `embeddingEngine`、`cosineSimilarity`、`quantizeInt8`、`normalizeVector` | 向量嵌入 | `archival.test.ts` | 语义基础 |
| `packages/core/src/modules/memory-core/archival/hnsw-index.ts` | source | 精读 | H38 | `HNSWIndex`、`HNSWIndexOptions` | 近似最近邻索引 | `archival.test.ts` | 向量索引 |
| `packages/core/src/modules/memory-core/archival/wordpiece-tokenizer.ts` | source | 背景引用 | H38 | WordPiece 分词 | 文本 tokenization | 可能无独立测试 | 实现细节 |
| `packages/core/src/modules/memory-core/archival/pattern-ingest.ts` | source | 背景引用 | H39 | `extractPrincipleFromToolResults`、`ingestPatternToArchival` | 模式摄入归档 | `pattern.test.ts`、Part F 已覆盖 | 边界说明 |
| `packages/core/src/modules/memory-core/tools/core-memory-tools.ts` | source | 精读 | H39 | `CoreMemoryTools` | Block 记忆工具 | `tools-provider.test.ts` | Agent 工具接口 |
| `packages/core/src/modules/memory-core/tools/archival-memory-tools.ts` | source | 精读 | H39 | `ArchivalMemoryTools` | 归档记忆工具 | `tools-provider.test.ts` | Agent 工具接口 |
| `packages/core/src/modules/memory-core/adapter.ts` | source | 精读 | H40 | `MemoryAdapter` | 外部消费适配器 | Part F 已覆盖调用侧 | 内部结构 |
| `packages/core/src/modules/memory-core/session/memory-provider.ts` | source | 精读 | H40 | `MemoryProvider` | Prompt 注入 provider | Part F 已覆盖调用侧 | 内部结构 |
| `packages/core/src/modules/memory-core/session/enhanced-pattern-provider.ts` | source | 精读 | H40 | `EnhancedPatternProvider` | 增强模式 provider | Part F 已覆盖调用侧 | 内部结构 |
| `packages/core/src/modules/memory-core/__tests__/block.test.ts` | test | 精读 | H36 | Block CRUD 测试 | Block 行为验证 | — | — |
| `packages/core/src/modules/memory-core/__tests__/memory.test.ts` | test | 精读 | H36 | Memory 持久化测试 | 持久化验证 | — | — |
| `packages/core/src/modules/memory-core/__tests__/recall.test.ts` | test | 精读 | H37 | Recall 测试 | 召回验证 | — | — |
| `packages/core/src/modules/memory-core/__tests__/archival.test.ts` | test | 精读 | H38 | Archival 测试 | 归档验证 | — | — |
| `packages/core/src/modules/memory-core/__tests__/consolidator.test.ts` | test | 背景引用 | H38 | Consolidator 测试 | 合并验证 | — | — |
| `packages/core/src/modules/memory-core/__tests__/dream-compat.test.ts` | test | 背景引用 | H38 | Dream 兼容测试 | Dream 验证 | — | — |
| `packages/core/src/modules/memory-core/__tests__/pattern.test.ts` | test | 背景引用 | H39 | Pattern 测试 | 模式验证 | — | — |
| `packages/core/src/modules/memory-core/__tests__/tools-provider.test.ts` | test | 精读 | H39 | Tools provider 测试 | 工具接口验证 | — | — |

## 关键概念预告

| 概念 | 通俗直觉 | 准确含义 | 不能误认为 |
| --- | --- | --- | --- |
| Block | 记忆卡片 | 有 label、description、limit、readOnly、tags 的结构化记忆单元 | 普通字符串 |
| Memory | 卡片盒 | 管理 Block 集合，支持 CRUD、compile、持久化 | 数据库 |
| RecallMemory | 近期备忘录 | 按 turn 组织的历史记录，快速召回 | 全文搜索 |
| ArchivalMemory | 档案室 | 长期归档，支持向量语义搜索 | 最近历史 |
| Embedding | 语义指纹 | 把文本映射为向量，支持相似度计算 | 关键词匹配 |
| HNSWIndex | 语义索引 | 近似最近邻索引，加速向量搜索 | 精确搜索 |
| MemoryAdapter | 转接头 | 让外部系统以统一方式使用 Memory Core | Memory Core 本身 |

## 单元小结课目标（H41）

读完 H41 后，读者应能不看源码回答：

1. Block、Recall、Archival 三种记忆分别适合什么场景？
2. `Memory.md` 和 `blocks.json` 各承担什么职责？
3. 为什么 ArchivalMemory 需要 embedding 和 HNSWIndex？
4. `CoreMemoryTools` 和 `ArchivalMemoryTools` 分别暴露哪些操作？
5. Memory Core 与 Part F 的认知系统之间的边界在哪里？
6. 如果 Agent 记不住久远信息，应该检查哪一层记忆？

## 相邻单元衔接

Unit 6 解决了 Agent 如何记忆。接下来，Part H 还要补齐 OriginOS 中其他相对独立的 Core Modules：Scheduler、Neural Channel、View Manager、View Reconciler、MCP in Browser。这些模块不直接属于协作运行时或记忆系统，但它们是系统能力的重要拼图。
