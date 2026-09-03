# L35：`openspec-sync-specs`——同步规范

> 本课问题：`openspec-sync-specs` 是如何同步规范的？

## 第一段源码：`openspec-sync-specs` 的 Frontmatter

```typescript
// [.codex/skills/openspec-sync-specs/SKILL.md 第 1—10 行](../../../../.codex/skills/openspec-sync-specs/SKILL.md#L1)
---
name: openspec-sync-specs
description: Sync specifications across changes. Use when the user wants to update or synchronize specifications between changes.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---
```

## 第二段源码：同步流程

```typescript
// [.codex/skills/openspec-sync-specs/SKILL.md 第 12—25 行](../../../../.codex/skills/openspec-sync-specs/SKILL.md#L12)
**Steps**

1. **Identify changes to sync**
   - List active changes
   - Identify dependencies

2. **Compare specifications**
   - Find differences
   - Identify conflicts

3. **Resolve conflicts**
   - Manual or automatic resolution
   - Update affected changes

4. **Sync completed**
   - Verify consistency
   - Update status
```

**同步流程**：

| 步骤 | 目标 |
| --- | --- |
| 1 | 识别要同步的变更 |
| 2 | 比较规范 |
| 3 | 解决冲突 |
| 4 | 完成同步 |

## 口头验收

1. **同步规范的第一步是什么？** 能说出识别要同步的变更吗？
2. **怎么比较规范？** 能说出找出差异和冲突吗？
3. **冲突怎么解决？** 能说出手动或自动解决吗？
4. **同步后需要验证什么？** 能说出一致性吗？
5. **同步规范的触发条件是什么？** 能说出用户想更新或同步规范吗？

## 本课结论

本课建立了 `openspec-sync-specs` 的完整认知：

- **同步规范是维护一致性的操作**：不是简单的复制
- **四步法**：识别 → 比较 → 解决冲突 → 完成
- **需要解决冲突**：手动或自动
- **验证一致性**：确保同步后的一致性
- **触发条件**：用户想更新或同步规范

## Unit 5 小结

本单元建立了 OpenSpec Change Workflow 的完整认知：

- **OpenSpec 是变更管理工作流**：从提出到归档
- **5 个系统 Skill**：propose、apply、archive、explore、sync
- **变更生命周期**：propose → explore → apply → sync → archive
- **系统 Skill 在 `.codex/skills/`**：优先级高于业务 Skill
- **标准格式**：proposal.md、design.md、tasks.md

## Part L 总结

Part L 涵盖了 OriginOS 的 Skill、Templates 和 OpenSpec：

- **Unit 1**：Skill 定义与加载（L01-L10）
- **Unit 2**：BMAD Skill 家族（L11-L20）
- **Unit 3**：Meta-skills & Ecosystem（L21-L25）
- **Unit 4**：Project Interview Templates（L26-L30）
- **Unit 5**：OpenSpec Change Workflow（L31-L35）

## 下一步

完成 Part L 后，建议：

1. **实践**：尝试创建自己的 Skill
2. **探索**：查看 `.codex/skills/` 和 `templates/skills/` 下的所有 Skill
3. **应用**：使用 OpenSpec 工作流管理变更
