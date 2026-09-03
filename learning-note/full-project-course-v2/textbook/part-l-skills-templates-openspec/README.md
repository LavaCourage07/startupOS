# Part L：Skills, Templates & OpenSpec

> OriginOS 的技能系统、模板生态和 OpenSpec 变更工作流

## 目录

### Unit 1：Skill 定义与加载（L01-L10）

| 课程 | 标题 | 核心问题 |
| --- | --- | --- |
| 00-01 | [单元导学](00-01-skill-definition-and-loading-guide.md) | Skill 是什么？从哪里来？到哪里去？ |
| L01 | [Skill 从哪来](L01-skill-from-where.md) | Skill 的定义和来源 |
| L02 | [.codex 与 templates 的 Skill](L02-codex-vs-templates-skills.md) | 系统级 vs 业务级 Skill |
| L03 | [SKILL.md 的 Frontmatter](L03-skill-md-frontmatter.md) | 机器可读的元数据 |
| L04 | [SKILL.md 的 Body](L04-skill-md-body.md) | 人类可读的能力描述 |
| L05 | [Skill 资产](L05-skill-assets.md) | references、scripts、assets |
| L06 | [Skill 评测](L06-skill-evaluation.md) | evals、evolution.json、报告 |
| L07 | [Skill 加载链路](L07-skill-loading.md) | 从磁盘到内存 |
| L08 | [Skill 分类](L08-skill-classification.md) | 按用途、复杂度、生命周期 |
| L09 | [运行时副本](L09-skill-runtime-copy.md) | 模板与运行时副本 |
| L10 | [单元小结](L10-unit-1-summary.md) | Unit 1 总结 |

### Unit 2：BMAD Skill 家族（L11-L20）

| 课程 | 标题 | 核心问题 |
| --- | --- | --- |
| 00-02 | [单元导学](00-02-bmad-skill-family-guide.md) | BMAD 框架的 14 个 Skill |
| L11 | [bmad-agent-builder](L11-bmad-agent-builder.md) | Agent 构建框架 |
| L12 | [bmad-workflow-builder](L12-bmad-workflow-builder.md) | 工作流构建 |
| L13 | [bmad-module-builder](L13-bmad-module-builder.md) | 模块构建 |
| L14 | [bmad-brainstorming](L14-bmad-brainstorming.md) | 创意发散 |
| L15 | [bmad-distillator](L15-bmad-distillator.md) | 信息蒸馏 |
| L16 | [bmad-bmb-setup](L16-bmad-bmb-setup.md) | 环境初始化 |
| L17 | [bmad-editorial-review](L17-bmad-editorial-review.md) | 质量审查 |
| L18 | [辅助 BMAD Skill](L18-bmad-auxiliary-skills.md) | help、index-docs、party-mode、shard-doc |
| L19 | [BMAD 协同工作](L19-bmad-collaboration.md) | Skill 之间的协作模式 |
| L20 | [单元小结](L20-unit-2-summary.md) | Unit 2 总结 |

### Unit 3：Meta-skills & Ecosystem（L21-L25）

| 课程 | 标题 | 核心问题 |
| --- | --- | --- |
| 00-03 | [单元导学](00-03-meta-skills-ecosystem-guide.md) | Meta-skills 让系统自我进化 |
| L21 | [skill-creator-app](L21-skill-creator-app.md) | Skill 创建器 |
| L22 | [role-agent-creator](L22-role-agent-creator.md) | 角色 Agent 创建 |
| L23 | [agent-creator](L23-agent-creator.md) | 通用 Agent 创建 |
| L24 | [project-skill-creator](L24-project-skill-creator.md) | 项目 Skill 创建 |
| L25 | [search-and-install-skill](L25-search-and-install-skill.md) | 搜索安装 Skill |

### Unit 4：Project Interview Templates（L26-L30）

| 课程 | 标题 | 核心问题 |
| --- | --- | --- |
| 00-04 | [单元导学](00-04-project-interview-guide.md) | 项目访谈模板 |
| L26 | [project-initialization](L26-project-initialization.md) | 两阶段访谈模式 |
| L27 | [domain-discovery](L27-domain-discovery.md) | 领域发现 |
| L28 | [business-refinement](L28-business-refinement.md) | 业务精炼 |
| L29 | [访谈进度管理](L29-interview-progress.md) | 进度追踪 |
| L30 | [单元小结](L30-unit-4-summary.md) | Unit 4 总结 |

### Unit 5：OpenSpec Change Workflow（L31-L35）

| 课程 | 标题 | 核心问题 |
| --- | --- | --- |
| 00-05 | [单元导学](00-05-openspec-change-workflow-guide.md) | OpenSpec 变更工作流 |
| L31 | [openspec-propose](L31-openspec-propose.md) | 提出变更 |
| L32 | [openspec-apply-change](L32-openspec-apply-change.md) | 应用变更 |
| L33 | [openspec-archive-change](L33-openspec-archive-change.md) | 归档变更 |
| L34 | [openspec-explore](L34-openspec-explore.md) | 探索变更 |
| L35 | [openspec-sync-specs](L35-openspec-sync-specs.md) | 同步规范 |

## 核心概念

### Skill 的本质

```
Skill = 定义（SKILL.md）+ 运行时（handler）
```

### BMAD 框架

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

## 源代码覆盖范围

| 目录 | 文件数 | 说明 |
| --- | --- | --- |
| `.codex/skills/` | 5 | 系统级 Skill（OpenSpec） |
| `templates/skills/` | ~278 | 业务级 Skill |
| `packages/core/src/lib/features/skills/bundled/` | 4 | 运行时副本 |
| **总计** | **~287** | 所有 Skill 相关文件 |

## 学习建议

1. **按单元顺序学习**：每个单元建立在前一个单元的基础上
2. **动手实践**：尝试创建自己的 Skill
3. **查看源码**：对照源码验证理解
4. **完成实验**：每个课程末尾的小实验
5. **口头验收**：确保理解核心概念

## 相关文档

- [03-sample-unit-writing-sop.md](../03-sample-unit-writing-sop.md) — 写作标准
- [Part A](../part-a-system-foundation/) — 系统基础
- [Part B](../part-b-user-operation-chain/) — 用户操作链
