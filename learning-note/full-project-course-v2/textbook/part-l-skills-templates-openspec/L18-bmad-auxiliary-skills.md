# L18：辅助 BMAD Skill——help、index-docs、party-mode、shard-doc

> 本课问题：BMAD 框架除了核心 Builder 和审查 Skill，还有哪些辅助 Skill？它们各自承担什么职责？

## 小林的场景

小林已经了解了 `bmad-agent-builder`、`bmad-workflow-builder` 等核心 Skill。她发现还有一些简单的 Skill，比如 `bmad-help`、`bmad-index-docs` 等。

她想知道：

- 这些辅助 Skill 是做什么的？
- 它们和核心 Skill 的关系是什么？
- 什么时候应该使用它们？

## 概念阶梯：辅助 Skill 不是“多余的”，而是“基础设施”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “辅助 Skill 不重要” | 辅助 Skill 是**基础设施**，支撑核心功能 | 不是可有可无，而是必不可少的 |
| “辅助 Skill 很简单” | 辅助 Skill 虽然简单，但**职责明确** | 不是简单的，而是专注的 |
| “辅助 Skill 可以没有” | 辅助 Skill 是**系统完整性的保障** | 没有它们，系统无法正常运行 |

## 第一段源码：辅助 Skill 的全景

```typescript
// OriginOS 的辅助 BMAD Skill：

templates/skills/bmad-help/              // 帮助系统
templates/skills/bmad-index-docs/        // 文档索引
templates/skills/bmad-party-mode/        // 多 Agent 对话
templates/skills/bmad-shard-doc/        // 文档分片
```

**辅助 Skill 的分类**：

| Skill | 职责 | 触发条件 | 复杂度 |
| --- | --- | --- | --- |
| `bmad-help` | 提供帮助信息 | 用户说"help" | 低 |
| `bmad-index-docs` | 索引文档 | 需要文档检索 | 低 |
| `bmad-party-mode` | 多 Agent 对话 | 用户说"party mode" | 中 |
| `bmad-shard-doc` | 文档分片 | 文档过大 | 低 |

## 第二段源码：`bmad-help` 的实现

```typescript
// [templates/skills/bmad-help/SKILL.md 第 1—20 行](../../../../templates/skills/bmad-help/SKILL.md#L1)
---
name: bmad-help
description: Provide help and guidance for BMAD skills. Use when the user asks for help, documentation, or guidance.
originos-system: true
version: 1.0.0
type: SIMPLE
tags:
  - help
  - documentation
  - guidance
---

# BMAD Help

## Available Commands

- `help` — Show this help message
- `help <skill-name>` — Show help for a specific skill
- `list` — List all available skills
- `status` — Show system status

## Getting Started

1. Use `bmad-agent-builder` to create an agent
2. Use `bmad-workflow-builder` to create a workflow
3. Use `bmad-module-builder` to organize into modules
```

**`bmad-help` 的特征**：

1. **触发条件**：用户说"help"
2. **功能**：提供帮助信息、列出可用 Skill、显示系统状态
3. **复杂度**：低（只有 1 个文件）

## 第三段源码：`bmad-index-docs` 的实现

```typescript
// [templates/skills/bmad-index-docs/SKILL.md 第 1—20 行](../../../../templates/skills/bmad-index-docs/SKILL.md#L1)
---
name: bmad-index-docs
description: Index and search documentation. Use when the user needs to find information in documentation.
originos-system: true
version: 1.0.0
type: SIMPLE
tags:
  - index
  - search
  - documentation
---

# Documentation Indexer

## Overview

This skill indexes documentation for fast retrieval. It creates a searchable index of all documentation files in the project.

## Process

1. **Scan**: Find all documentation files
2. **Parse**: Extract content and metadata
3. **Index**: Build search index
4. **Query**: Search the index

## Output

- Searchable index
- Document metadata
- Relevance scores
```

**`bmad-index-docs` 的特征**：

1. **触发条件**：用户需要查找文档信息
2. **功能**：扫描、解析、索引、查询文档
3. **输出**：可搜索的索引、文档元数据、相关性评分

## 第四段源码：`bmad-party-mode` 的实现

```typescript
// [templates/skills/bmad-party-mode/SKILL.md 第 1—20 行](../../../../templates/skills/bmad-party-mode/SKILL.md#L1)
---
name: bmad-party-mode
description: Facilitate multi-agent conversations. Use when the user wants multiple agents to collaborate or discuss.
originos-system: true
version: 1.0.0
type: COMPOSITE
tags:
  - multi-agent
  - collaboration
  - discussion
---

# Party Mode

## Overview

Party mode enables multiple agents to collaborate in a single conversation. Each agent has a role and contributes to the discussion.

## Process

1. **Select agents**: Choose which agents to invite
2. **Set topic**: Define the discussion topic
3. **Facilitate**: Guide the conversation
4. **Synthesize**: Combine insights from all agents

## Example

User: "Let's have a discussion about the architecture"

Agent A (Architect): "I suggest a microservices approach..."
Agent B (Security): "We need to consider security implications..."
Agent C (DevOps): "Deployment complexity will increase..."

Synthesis: "The team agrees on microservices with security-first design..."
```

**`bmad-party-mode` 的特征**：

1. **触发条件**：用户说"party mode"或"let's discuss"
2. **功能**：多 Agent 协作、讨论、综合
3. **类型**：`COMPOSITE`（多阶段编排）
4. **复杂度**：中（需要协调多个 Agent）

## 调用链：辅助 Skill 的使用场景

```text
用户说 "help"
  → bmad-help 激活
    → 显示帮助信息

用户说 "find docs about authentication"
  → bmad-index-docs 激活
    → 扫描文档
    → 搜索索引
    → 返回结果

用户说 "let's have a party mode discussion"
  → bmad-party-mode 激活
    → 选择 Agent
    → 设置话题
    → 引导讨论
    → 综合洞察

用户上传大文档
  → bmad-shard-doc 激活
    → 分片处理
    → 逐片分析
    → 综合结果
```

## 失败路径：辅助 Skill 可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| `bmad-help` 信息过时 | 帮助信息不准确 | Skill 更新后未同步 |
| `bmad-index-docs` 索引失败 | 无法搜索文档 | 文档格式不支持 |
| `bmad-party-mode` Agent 冲突 | 讨论混乱 | Agent 角色定义不清 |
| `bmad-shard-doc` 分片丢失 | 分析不完整 | 分片逻辑错误 |

## 测试证据

```bash
# 检查辅助 Skill 的文件结构
for skill in bmad-help bmad-index-docs bmad-party-mode bmad-shard-doc; do
  echo "=== $skill ==="
  ls templates/skills/$skill/
done

# 检查文件数量
for skill in bmad-help bmad-index-docs bmad-party-mode bmad-shard-doc; do
  count=$(ls templates/skills/$skill/ | wc -l)
  echo "$skill: $count files"
done
```

## 小实验

**实验 1：对比辅助 Skill 和核心 Skill**

| 维度 | 核心 Skill（如 agent-builder） | 辅助 Skill（如 help） |
| --- | --- | --- |
| 文件数量 | 多（52 个） | 少（1-3 个） |
| 复杂度 | 高 | 低 |
| 触发条件 | 特定意图 | 通用请求 |
| 输出产物 | 复杂文件结构 | 简单信息 |

**实验 2：设计使用场景**

| 场景 | 使用的辅助 Skill | 原因 |
| --- | --- | --- |
| 用户不知道如何使用 BMAD | | |
| 用户需要查找某个功能的文档 | | |
| 用户想让多个 Agent 讨论问题 | | |
| 用户上传了一个大文档 | | |

## 口头验收

1. **OriginOS 有哪些辅助 BMAD Skill？** 能说出 help、index-docs、party-mode、shard-doc 吗？
2. **`bmad-help` 是做什么的？** 能说出提供帮助信息、列出可用 Skill 吗？
3. **`bmad-party-mode` 是做什么的？** 能说出多 Agent 协作讨论吗？
4. **辅助 Skill 和核心 Skill 的区别是什么？** 能说出辅助 Skill 更简单、更通用吗？
5. **辅助 Skill 可以没有吗？** 能说出它们是基础设施，不能没有吗？

## 本课结论

本课建立了辅助 BMAD Skill 的完整认知：

- **辅助 Skill 是基础设施**：不是可有可无的
- **`bmad-help`**：提供帮助信息
- **`bmad-index-docs`**：索引和搜索文档
- **`bmad-party-mode`**：多 Agent 协作讨论
- **`bmad-shard-doc`**：文档分片处理
- **辅助 Skill 更简单、更通用**：但同样重要

下一课（L19）将深入 BMAD Skill 的协同工作模式。
