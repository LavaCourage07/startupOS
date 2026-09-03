# L32：`openspec-apply-change`——应用变更

> 本课问题：`openspec-apply-change` 是如何帮助用户实施变更的？

## 小林的场景

小林已经用 `openspec-propose` 创建了变更提案。现在她想开始实施变更。

她想知道：

- 怎么选择要实施的变更？
- 实施流程是什么？
- 怎么追踪实施进度？

## 第一段源码：`openspec-apply-change` 的 Frontmatter

```typescript
// [.codex/skills/openspec-apply-change/SKILL.md 第 1—10 行](../../../../.codex/skills/openspec-apply-change/SKILL.md#L1)
---
name: openspec-apply-change
description: Implement tasks from an OpenSpec change. Use when the user wants to start implementing, continue implementation, or work through tasks.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---
```

## 第二段源码：应用流程

```typescript
// [.codex/skills/openspec-apply-change/SKILL.md 第 16—40 行](../../../../.codex/skills/openspec-apply-change/SKILL.md#L16)
**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes

2. **Check status to understand the schema**
   ```bash
   openspec status --change "<name>" --json
   ```

3. **Get apply instructions**
   ```bash
   openspec instructions apply --change "<name>" --json
   ```
```

**应用流程**：

| 步骤 | 目标 |
| --- | --- |
| 1 | 选择变更 |
| 2 | 检查状态 |
| 3 | 获取实施指令 |
| 4 | 执行任务 |

## 口头验收

1. **应用变更的第一步是什么？** 能说出选择变更吗？
2. **怎么检查变更状态？** 能说出 `openspec status --change "<name>" --json` 吗？
3. **怎么获取实施指令？** 能说出 `openspec instructions apply --change "<name>" --json` 吗？
4. **如果多个变更存在，怎么选择？** 能说出使用 AskUserQuestion 工具吗？
5. **应用变更的触发条件是什么？** 能说出用户想开始实施、继续实施或处理任务吗？

## 本课结论

本课建立了 `openspec-apply-change` 的完整认知：

- **应用变更是实施过程**：不是简单的执行
- **四步法**：选择变更 → 检查状态 → 获取指令 → 执行任务
- **需要选择变更**：可以从上下文推断或手动选择
- **状态检查**：了解变更的当前状态
- **实施指令**：获取具体的实施步骤

下一课（L33）将深入 `openspec-archive-change`，了解如何归档变更。
