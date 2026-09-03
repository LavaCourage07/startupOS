# Unit 2 导学：BMAD Skill 家族

> 本单元问题：OriginOS 的 BMAD 框架包含 14 个 Skill，它们各自承担什么职责？如何协同工作？

## 本单元核心问题

BMAD（Builder, Maker, Analyzer, Discoverer）是 OriginOS 的自我构建框架。它包含 14 个 Skill，覆盖了从 Agent 构建、工作流设计、模块开发到创意发散、信息蒸馏、质量审查的完整生命周期。

本单元将回答：

1. **Agent Builder**（`bmad-agent-builder`）：如何构建一个 Agent？
2. **Workflow Builder**（`bmad-workflow-builder`）：如何构建一个工作流？
3. **Module Builder**（`bmad-module-builder`）：如何构建一个模块？
4. **Brainstorming**（`bmad-brainstorming`）：如何进行创意发散？
5. **Distillator**（`bmad-distillator`）：如何蒸馏信息？
6. **BMB Setup**（`bmad-bmb-setup`）：如何配置构建环境？
7. **Editorial Review**（`bmad-editorial-review-*`）：如何审查质量？
8. **其他辅助 Skill**：`bmad-help`、`bmad-index-docs`、`bmad-party-mode`、`bmad-shard-doc`、`bmad-review-*`

## 学习路线

```
L11: bmad-agent-builder — Agent 构建框架
L12: bmad-workflow-builder — 工作流构建
L13: bmad-module-builder — 模块构建
L14: bmad-brainstorming — 创意发散
L15: bmad-distillator — 信息蒸馏
L16: bmad-bmb-setup — 环境初始化
L17: bmad-editorial-review-* — 质量审查（散文/结构/对抗/边界）
L18: bmad-help / bmad-index-docs / bmad-party-mode / bmad-shard-doc — 辅助 Skill
L19: BMAD Skill 的协同工作模式
L20: 单元小结
```

## 源代码覆盖范围

| 目录 | 文件数 | 说明 |
| --- | --- | --- |
| `templates/skills/bmad-agent-builder/` | ~52 | Agent 构建框架，最复杂的 BMAD Skill |
| `templates/skills/bmad-workflow-builder/` | ~31 | 工作流构建 |
| `templates/skills/bmad-module-builder/` | ~20 | 模块构建 |
| `templates/skills/bmad-brainstorming/` | ~13 | 创意发散 |
| `templates/skills/bmad-distillator/` | ~8 | 信息蒸馏 |
| `templates/skills/bmad-bmb-setup/` | ~6 | 环境初始化 |
| `templates/skills/bmad-editorial-review-*` | ~3 | 质量审查（3 个） |
| `templates/skills/bmad-review-*` | ~3 | 审查（2 个） |
| `templates/skills/bmad-help/` | ~1 | 帮助 |
| `templates/skills/bmad-index-docs/` | ~1 | 文档索引 |
| `templates/skills/bmad-party-mode/` | ~1 | 多 Agent 对话 |
| `templates/skills/bmad-shard-doc/` | ~1 | 文档分片 |
| **总计** | **~142** | BMAD Skill 家族 |

## 与前后单元的关联

- **前置知识**：Unit 1（Skill 的定义、加载、分类）
- **后续单元**：Unit 3（Meta-skills & Ecosystem）、Unit 4（Project Interview Templates）、Unit 5（OpenSpec Change Workflow）
- **关联文档**：`docs/bmad/` 下的 BMAD 框架文档

## 核心概念预览

### BMAD 框架的四大角色

| 角色 | Skill | 职责 |
| --- | --- | --- |
| **Builder** | `bmad-agent-builder` | 构建 Agent |
| **Maker** | `bmad-workflow-builder` | 构建工作流 |
| **Analyzer** | `bmad-distillator` | 分析、蒸馏信息 |
| **Discoverer** | `bmad-brainstorming` | 发现、发散创意 |

### BMAD 框架的工作流

```
创意发散（Brainstorming）
  ↓
信息蒸馏（Distillator）
  ↓
Agent/工作流/模块构建（Builder）
  ↓
质量审查（Review）
  ↓
部署运行
```

## 预期收获

完成本单元后，你将能够：

1. **理解 BMAD 框架的整体架构**：14 个 Skill 的分工和协作
2. **掌握 Agent 构建流程**：从创意到成品的完整路径
3. **理解工作流和模块的构建方式**：与 Agent 构建的异同
4. **了解质量审查机制**：如何确保构建产物的质量
5. **能够独立分析和改进 BMAD Skill**：理解其内部工作原理
