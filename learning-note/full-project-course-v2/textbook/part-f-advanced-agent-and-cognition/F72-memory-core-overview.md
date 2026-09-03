# F.6 单元导学：Memory Core 桥接

## 本单元学习目标

F.6 单元深入 Memory Core 模块。Memory Core 是 OriginOS 的记忆基础设施，提供三层记忆架构（Core/Archival/Recall），让 Agent 能够长期记住关键信息。

## 核心文件

| 文件 | 职责 |
|---|---|
| `memory-core/core/memory-core.ts` | 三层记忆统一门面 |
| `memory-core/core/memory.ts` | Block 集合管理 + compile/render |
| `memory-core/core/block.ts` | Block 类型定义 + 工厂函数 |
| `memory-core/core/consolidator.ts` | 窗体关闭时的主动记忆整理 |
| `memory-core/core/dream-compat.ts` | Dream 兼容层 |
| `memory-core/recall/recall-memory.ts` | 对话历史索引 + 语义搜索 |
| `memory-core/recall/history-store.ts` | JSONL 历史存储 |
| `memory-core/archival/archival-memory.ts` | 长期语义记忆存储 |
| `memory-core/archival/embedding.ts` | ONNX embedding + TF-IDF 回退 |
| `memory-core/archival/hnsw-index.ts` | HNSW 向量索引 |
| `memory-core/tools/core-memory-tools.ts` | Core Memory 工具 API |
| `memory-core/tools/archival-memory-tools.ts` | Archival Memory 工具 API |

## 核心架构

```
MemoryCore（统一门面）
├── Memory（Core Memory）
│   ├── Block[]（human, persona, project, scratchpad, temporal）
│   ├── compile() → markdown/xml
│   └── save() → Memory.md + blocks.json
├── ArchivalMemory（长期语义记忆）
│   ├── entries[]
│   ├── HNSWIndex（向量索引）
│   ├── insert() → entries.jsonl + hnsw-index.bin
│   └── search() → 语义搜索
└── RecallMemory（对话历史）
    ├── entries[]
    ├── HistoryStore（JSONL 存储）
    ├── recordTurn() → 记录对话
    └── searchSemantic() → 语义搜索
```

## 三层记忆对比

| 层级 | 存储内容 | 查询方式 | 持久化 | 容量 |
|---|---|---|---|---|
| **Core** | 结构化 Block（用户画像、项目状态） | 按 label 直接访问 | Memory.md + blocks.json | 小（每个 Block 有 limit） |
| **Archival** | 非结构化文本记忆 | 语义搜索（HNSW） | entries.jsonl + hnsw-index.bin | 大（无上限） |
| **Recall** | 对话历史 | 语义搜索 + 关键词搜索 | history/*.jsonl | 中（按 session） |

## 本单元课程安排（9 课）

| 课程 | 主题 | 文件 |
|---|---|---|
| F72 | Memory Core 架构总览 | `memory-core/` |
| F73 | `Block`：记忆基本单元 | `core/block.ts` |
| F74 | `Memory`：Block 集合管理 | `core/memory.ts` |
| F75 | `ArchivalMemory`：长期语义记忆 | `archival/archival-memory.ts` |
| F76 | `HNSWIndex`：向量索引 | `archival/hnsw-index.ts` |
| F77 | `RecallMemory`：对话历史 | `recall/recall-memory.ts` |
| F78 | `MemoryConsolidator`：主动记忆整理 | `core/consolidator.ts` |
| F79 | Memory Core 工具 API | `tools/` |
| F80 | F.6 单元小结 Workshop | — |

## 前置知识

- F.3 单元：RoleAgent 的 MemoryTracker（理解旧版记忆系统）
- F.5 单元：认知系统（理解知识提取和存储）

## 学习路径建议

1. **先读架构**（F72）：理解三层记忆的设计
2. **再读 Block**（F73）：理解记忆的基本单元
3. **深入各层**（F74-F77）：按 Core → Archival → Recall 的顺序
4. **看整合**（F78）：Consolidator 如何整合三层记忆
5. **做实验**（F79-F80）：工具使用和总结

## 关键概念速查

| 概念 | 含义 | 对应文件 |
|---|---|---|
| **Block** | 记忆基本单元，有 label/value/limit | `core/block.ts` |
| **Core Memory** | 结构化记忆，直接访问 | `core/memory.ts` |
| **Archival Memory** | 长期语义记忆，向量搜索 | `archival/archival-memory.ts` |
| **Recall Memory** | 对话历史，语义搜索 | `recall/recall-memory.ts` |
| **HNSW** | 分层导航小世界图，向量索引 | `archival/hnsw-index.ts` |
| **Embedding** | 文本 → 向量（ONNX/TF-IDF） | `archival/embedding.ts` |
| **Consolidator** | 窗体关闭时主动整理记忆 | `core/consolidator.ts` |
| **MMR** | 最大边际相关性，去重 | `archival/archival-memory.ts` |

## 下一步

F72 开始，从 Memory Core 架构总览讲起。
