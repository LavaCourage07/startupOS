# L33：`openspec-archive-change`——归档变更

> 本课问题：`openspec-archive-change` 是如何归档已完成变更的？

## 第一段源码：`openspec-archive-change` 的 Frontmatter

```typescript
// [.codex/skills/openspec-archive-change/SKILL.md 第 1—10 行](../../../../.codex/skills/openspec-archive-change/SKILL.md#L1)
---
name: openspec-archive-change
description: Archive a completed change. Use when the user wants to archive a change that has been completed or abandoned.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---
```

## 第二段源码：归档流程

```typescript
// [.codex/skills/openspec-archive-change/SKILL.md 第 12—25 行](../../../../.codex/skills/openspec-archive-change/SKILL.md#L12)
**Steps**

1. **Select the change to archive**
   - If a name is provided, use it
   - Otherwise, list active changes and let user select

2. **Confirm archiving**
   - Ask user to confirm
   - Explain that archived changes are read-only

3. **Archive the change**
   ```bash
   openspec archive --change "<name>"
   ```

4. **Update status**
   - Mark as archived
   - Record completion date
```

**归档流程**：

| 步骤 | 目标 |
| --- | --- |
| 1 | 选择要归档的变更 |
| 2 | 确认归档 |
| 3 | 执行归档 |
| 4 | 更新状态 |

## 口头验收

1. **归档变更的第一步是什么？** 能说出选择要归档的变更吗？
2. **归档后的变更是什么状态？** 能说出只读吗？
3. **归档命令是什么？** 能说出 `openspec archive --change "<name>"` 吗？
4. **归档前需要确认什么？** 能说出用户确认吗？
5. **归档后更新什么？** 能说出状态和完成日期吗？

## 本课结论

本课建立了 `openspec-archive-change` 的完整认知：

- **归档是完成后的操作**：变更完成后归档
- **归档后只读**：不能修改
- **四步法**：选择 → 确认 → 归档 → 更新状态
- **记录完成日期**：便于追踪

下一课（L34）将深入 `openspec-explore`，了解探索模式。
