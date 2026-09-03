# L34：`openspec-explore`——探索变更

> 本课问题：`openspec-explore` 是如何帮助用户探索想法和问题的？

## 第一段源码：`openspec-explore` 的 Frontmatter

```typescript
// [.codex/skills/openspec-explore/SKILL.md 第 1—10 行](../../../../.codex/skills/openspec-explore/SKILL.md#L1)
---
name: openspec-explore
description: Enter explore mode - a thinking partner for exploring ideas, investigating problems, and clarifying requirements. Use when the user wants to think through something before or during a change.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---
```

## 第二段源码：探索模式

```typescript
// [.codex/skills/openspec-explore/SKILL.md 第 12—28 行](../../../../.codex/skills/openspec-explore/SKILL.md#L12)
**IMPORTANT: Explore mode is for thinking, not implementing.**

You may read files, search code, and investigate the codebase, but you must NEVER write code or implement features. If the user asks you to implement something, remind them to exit explore mode first and create a change proposal.

## The Stance

- **Curious, not prescriptive** - Ask questions that emerge naturally
- **Open threads, not interrogations** - Surface multiple interesting directions
- **Visual** - Use ASCII diagrams liberally
- **Adaptive** - Follow interesting threads, pivot when new information emerges
- **Patient** - Don't rush to conclusions
- **Grounded** - Explore the actual codebase when relevant
```

**探索模式特征**：

| 特征 | 说明 |
| --- | --- |
| **Curious** | 好奇，不预设 |
| **Open threads** | 开放讨论，不限制 |
| **Visual** | 使用 ASCII 图表 |
| **Adaptive** | 适应变化 |
| **Patient** | 耐心，不急于结论 |
| **Grounded** | 基于实际代码 |

## 口头验收

1. **探索模式的目标是什么？** 能说出思考，不是实现吗？
2. **探索模式可以做什么？** 能说出读取文件、搜索代码、调查代码库吗？
3. **探索模式不能做什么？** 能说出不能写代码或实现功能吗？
4. **探索模式的特征是什么？** 能说出好奇、开放、可视化、适应、耐心、基于实际吗？
5. **如果用户要求实现功能，怎么办？** 能说出提醒用户退出探索模式并创建变更提案吗？

## 本课结论

本课建立了 `openspec-explore` 的完整认知：

- **探索模式是思考工具**：不是实现工具
- **可以读取和搜索**：但不能写代码
- **特征**：好奇、开放、可视化、适应、耐心、基于实际
- **用途**：探索想法、调查问题、澄清需求

下一课（L35）将深入 `openspec-sync-specs`，了解规范同步。
