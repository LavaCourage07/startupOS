# Unit 3 导学：Meta-skills & Ecosystem

> 本单元问题：OriginOS 的 Meta-skills 是什么？它们如何让系统自我进化？

## 本单元核心问题

Meta-skills 是"创建 Skill 的 Skill"——它们让 OriginOS 能够自我扩展、自我优化。本单元将回答：

1. **`skill-creator-app`**：如何创建新的 Skill？
2. **`role-agent-creator`**：如何创建角色化的 Agent？
3. **`agent-creator`**：如何创建通用 Agent？
4. **`project-skill-creator`**：如何创建项目专属的 Skill？
5. **`search-and-install-skill`**：如何搜索和安装 Skill？

## 学习路线

```
L21: skill-creator-app — Skill 创建器
L22: role-agent-creator — 角色 Agent 创建
L23: agent-creator — 通用 Agent 创建
L24: project-skill-creator — 项目 Skill 创建
L25: search-and-install-skill — 搜索安装 Skill
L26-L30: （预留扩展）
```

## 源代码覆盖范围

| 目录 | 文件数 | 说明 |
| --- | --- | --- |
| `templates/skills/skill-creator-app/` | ~22 | Skill 创建器，最复杂的 Meta-skill |
| `templates/skills/role-agent-creator/` | ~10 | 角色 Agent 创建 |
| `templates/skills/agent-creator/` | ~7 | 通用 Agent 创建 |
| `templates/skills/project-skill-creator/` | ~27 | 项目 Skill 创建 |
| `templates/skills/search-and-install-skill/` | ~3 | 搜索安装 Skill |
| **总计** | **~69** | Meta-skills |

## 与前后单元的关联

- **前置知识**：Unit 1（Skill 定义）、Unit 2（BMAD 框架）
- **后续单元**：Unit 4（Project Interview Templates）、Unit 5（OpenSpec Change Workflow）
- **核心概念**：Meta-skill 是"创建 Skill 的 Skill"，让系统自我进化

## 核心概念预览

### Meta-skill 的定义

```
Meta-skill = 创建 Skill 的 Skill
         = 让系统自我扩展的能力
         =  OriginOS 的"自我进化"机制
```

### Meta-skill 的分类

| 类别 | Skill | 职责 |
| --- | --- | --- |
| **Skill 创建** | `skill-creator-app` | 创建、迭代、优化 Skill |
| **角色创建** | `role-agent-creator` | 基于角色模板创建 Agent |
| **通用创建** | `agent-creator` | 创建通用 Agent |
| **项目创建** | `project-skill-creator` | 创建项目专属 Skill |
| **搜索安装** | `search-and-install-skill` | 搜索和安装 Skill |

### Meta-skill 的工作流

```
用户说 "I want to create a skill"
  → skill-creator-app 激活
    → 对话确定 Skill 目标
    → 起草 SKILL.md
    → 创建测试用例
    → 运行评测
    → 迭代优化
    → 输出到 data/skills/
```

## 预期收获

完成本单元后，你将能够：

1. **理解 Meta-skill 的概念**：什么是 Meta-skill，为什么重要
2. **掌握 Skill 创建流程**：从想法到成品的完整路径
3. **理解角色化 Agent 的创建**：基于模板 vs 完全自定义
4. **了解项目专属 Skill 的创建**：为特定项目定制 Skill
5. **掌握 Skill 的搜索和安装**：扩展 OriginOS 的能力
