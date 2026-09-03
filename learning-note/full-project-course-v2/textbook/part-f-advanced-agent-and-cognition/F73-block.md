# F72：Memory Core 架构总览

## 开篇场景

Agent 需要记住三类信息：
1. **当前状态**：用户是谁、项目进展到哪里（需要快速访问）
2. **长期知识**：过去学到的经验、知识（需要语义搜索）
3. **对话历史**：之前说了什么（需要按时间线回溯）

Memory Core 提供三层记忆架构来解决这个问题。

## 核心问题

**为什么需要三层记忆？每层分别解决什么问题？**

## 概念阶梯

### 1. 三层记忆架构

```
┌─────────────────────────────────────────────────────────┐
│                      Memory Core                         │
├─────────────────────────────────────────────────────────┤
│  Core Memory（工作记忆）                                   │
│  ├── human: 用户画像、偏好、历史习惯                        │
│  ├── persona: Agent 角色认知、工作风格                      │
│  ├── project: 当前项目状态、活跃任务、关键决策                │
│  ├── scratchpad: 临时笔记、待办、注意项                      │
│  └── temporal: 关键事件时间线（只读）                        │
├─────────────────────────────────────────────────────────┤
│  Archival Memory（长期记忆）                                │
│  ├── 非结构化文本记忆                                       │
│  ├── ONNX embedding + HNSW 向量索引                         │
│  └── 语义搜索                                               │
├─────────────────────────────────────────────────────────┤
│  Recall Memory（对话历史）                                 │
│  ├── JSONL 按 session 存储                                 │
│  ├── 语义搜索 + 关键词搜索                                  │
│  └── Dream cursor 兼容                                    │
└─────────────────────────────────────────────────────────┘
```

### 2. 设计原则

| 层级 | 设计原则 | 类比 |
|---|---|---|
| **Core** | 结构化、小容量、快速访问 | 人类的工作记忆 |
| **Archival** | 非结构化、大容量、语义搜索 | 人类的长期记忆 |
| **Recall** | 按时间线、可回溯、按 session | 人类的对话记录 |

### 3. MemoryCore 统一门面

[packages/core/src/modules/memory-core/core/memory-core.ts](../../../../packages/core/src/modules/memory-core/core/memory-core.ts)

```typescript
export class MemoryCore {
  readonly memory: Memory;           // Core Memory
  readonly archival: ArchivalMemory; // Archival Memory
  readonly recall: RecallMemory;     // Recall Memory
  readonly coreTools: CoreMemoryTools;
  readonly archivalTools: ArchivalMemoryTools;

  constructor(agentDir: string, sessionId: string = 'default', definitions?: BlockDefinition[]) {
    this.memory = new Memory(agentDir, definitions);
    this.archival = new ArchivalMemoryImpl(agentDir);
    this.recall = new RecallMemory(agentDir, sessionId);
    this.coreTools = new CoreMemoryTools(this.memory);
    this.archivalTools = new ArchivalMemoryTools(this.archival);
  }
}
```

## 真实调用链

```
Agent 启动
  → new MemoryCore(agentDir, sessionId)
       → new Memory(agentDir)           → 加载 Memory.md + blocks.json
       → new ArchivalMemory(agentDir)   → 加载 entries.jsonl + hnsw-index.bin
       → new RecallMemory(agentDir)     → 加载 history/*.jsonl

每轮对话
  → recall.recordTurn(data)            → 写入 history/{sessionId}.jsonl

Agent 编辑记忆
  → coreTools.core_memory_append(label, content)
  → coreTools.core_memory_replace(label, old, new)
  → archivalTools.archival_memory_insert(text, tags)

窗体关闭
  → consolidator.consolidate()
       → 分析最近 50 轮对话
       → 生成 block 更新指令
       → 更新 Core Memory
       → 提取知识候选
       → 保存到 Archival Memory
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| Memory.md 不存在 | 初始化默认 Block | `initializeDefaults` |
| Archival entries.jsonl 损坏 | 跳过损坏行 | `try/catch` |
| HNSW 索引损坏 | 重建索引 | `rebuildIndex` |
| history 目录不存在 | 创建目录 | `mkdirSync` |

## 练习与验收

1. **比较三层记忆**：Core、Archival、Recall 分别适合存储什么？
2. **设计使用场景**：如果要存储"用户喜欢深色模式"，应该存在哪一层？为什么？
3. **分析架构**：MemoryCore 为什么是"统一门面"模式？有什么好处？

**验收标准**：能理解三层记忆的设计和用途。

## 章节收束

Memory Core 架构讲完了。下一节课（F73）看 Block——记忆的基本单元。
