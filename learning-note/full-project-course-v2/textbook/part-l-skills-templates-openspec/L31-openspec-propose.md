# L31：`openspec-propose`——提出变更

> 本课问题：`openspec-propose` 是如何帮助用户提出变更的？

## 小林的场景

小林想为 OriginOS 添加一个新功能。她打开 `openspec-propose`，发现它帮助她创建变更提案。

她想知道：

- 变更提案包含什么？
- 怎么创建变更？
- 变更提案的格式是什么？

## 概念阶梯：变更提案不是“需求文档”，而是“实施计划”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “变更提案就是需求文档” | 变更提案是**包含设计、规格、任务的实施计划** | 不是简单的需求，而是可执行的 |
| “变更提案是一次性的” | 变更提案是**可迭代的** | 可以多次修改 |
| “变更提案没有标准” | 变更提案有**标准格式** | 不是任意的，有规范 |

## 第一段源码：`openspec-propose` 的 Frontmatter

```typescript
// [.codex/skills/openspec-propose/SKILL.md 第 1—10 行](../../../../.codex/skills/openspec-propose/SKILL.md#L1)
---
name: openspec-propose
description: Propose a new change with all artifacts generated in one step. Use when the user wants to quickly describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---
```

## 第二段源码：变更提案的内容

```typescript
// [.codex/skills/openspec-propose/SKILL.md 第 12—20 行](../../../../.codex/skills/openspec-propose/SKILL.md#L12)
Propose a new change - create the change and generate all artifacts in one step.

I'll create a change with artifacts:
- proposal.md (what & why)
- design.md (how)
- tasks.md (implementation steps)

When ready to implement, run /opsx:apply
```

**变更提案包含**：

| 文件 | 内容 | 说明 |
| --- | --- | --- |
| `proposal.md` | What & Why | 变更的目的和范围 |
| `design.md` | How | 设计方案 |
| `tasks.md` | Implementation steps | 实施步骤 |

## 第三段源码：创建流程

```typescript
// [.codex/skills/openspec-propose/SKILL.md 第 26—40 行](../../../../.codex/skills/openspec-propose/SKILL.md#L26)
**Steps**

1. **If no clear input provided, ask what they want to build**

   Use the **AskUserQuestion tool** to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add user authentication" → `add-user-auth`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

2. **Create the change directory**
   ```bash
   openspec new change "<name>"
   ```
   This creates a scaffolded change in the planning home.
```

**创建流程**：

| 步骤 | 目标 |
| --- | --- |
| 1 | 询问用户要构建什么 |
| 2 | 推导 kebab-case 名称 |
| 3 | 创建变更目录 |
| 4 | 生成 artifacts |

## 调用链：变更提案流程

```text
用户说 "I want to add user authentication"
  → openspec-propose 激活
    → 询问用户意图
      → 推导名称（add-user-auth）
        → 创建变更目录
          → 生成 proposal.md
          → 生成 design.md
          → 生成 tasks.md
            → 输出变更提案
```

## 口头验收

1. **变更提案包含哪些文件？** 能说出 proposal.md、design.md、tasks.md 吗？
2. **proposal.md 包含什么？** 能说出 what & why 吗？
3. **design.md 包含什么？** 能说出 how 吗？
4. **tasks.md 包含什么？** 能说出 implementation steps 吗？
5. **创建变更的命令是什么？** 能说出 `openspec new change "<name>"` 吗？

## 本课结论

本课建立了 `openspec-propose` 的完整认知：

- **变更提案是实施计划**：不是简单的需求文档
- **包含三个文件**：proposal.md、design.md、tasks.md
- **创建流程**：询问 → 推导名称 → 创建目录 → 生成 artifacts
- **标准格式**：有规范的变更提案格式
- **可迭代**：可以多次修改

下一课（L32）将深入 `openspec-apply-change`，了解如何应用变更。
