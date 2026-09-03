# Unit 5 导学：OpenSpec Change Workflow

> 本单元问题：OriginOS 如何通过 OpenSpec 的 5 个系统 Skill 管理变更工作流？

## 本单元核心问题

OpenSpec 是 OriginOS 的变更管理工作流。它包含 5 个系统 Skill，覆盖了从提出变更到归档变更的完整生命周期。

本单元将回答：

1. **`openspec-propose`**：如何提出变更？
2. **`openspec-apply-change`**：如何应用变更？
3. **`openspec-archive-change`**：如何归档变更？
4. **`openspec-explore`**：如何探索变更？
5. **`openspec-sync-specs`**：如何同步规范？

## 学习路线

```
L31: openspec-propose — 提出变更
L32: openspec-apply-change — 应用变更
L33: openspec-archive-change — 归档变更
L34: openspec-explore — 探索变更
L35: openspec-sync-specs — 同步规范
L36-L40: （预留扩展）
```

## 源代码覆盖范围

| 目录 | 文件数 | 说明 |
| --- | --- | --- |
| `.codex/skills/openspec-propose/` | ~1 | 提出变更 |
| `.codex/skills/openspec-apply-change/` | ~1 | 应用变更 |
| `.codex/skills/openspec-archive-change/` | ~1 | 归档变更 |
| `.codex/skills/openspec-explore/` | ~1 | 探索变更 |
| `.codex/skills/openspec-sync-specs/` | ~1 | 同步规范 |
| **总计** | **~5** | OpenSpec 系统 Skill |

## 与前后单元的关联

- **前置知识**：Unit 1-4
- **核心概念**：OpenSpec 是系统级变更管理工作流

## 核心概念预览

### OpenSpec 工作流

```
提出变更（propose）
  ↓
探索变更（explore）
  ↓
应用变更（apply-change）
  ↓
同步规范（sync-specs）
  ↓
归档变更（archive-change）
```

### 5 个系统 Skill

| Skill | 职责 | 触发条件 |
| --- | --- | --- |
| `openspec-propose` | 提出变更 | 用户想创建变更 |
| `openspec-apply-change` | 应用变更 | 用户想实现变更 |
| `openspec-archive-change` | 归档变更 | 变更完成 |
| `openspec-explore` | 探索变更 | 用户想探索想法 |
| `openspec-sync-specs` | 同步规范 | 规范需要更新 |

## 预期收获

完成本单元后，你将能够：

1. **理解 OpenSpec 工作流**：从提出到归档的完整流程
2. **掌握每个系统 Skill 的职责**：propose、apply、archive、explore、sync
3. **理解系统 Skill 和业务 Skill 的区别**：`.codex/skills/` vs `templates/skills/`
