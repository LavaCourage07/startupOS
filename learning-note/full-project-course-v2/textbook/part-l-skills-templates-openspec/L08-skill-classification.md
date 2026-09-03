# L08：Skill 分类——按用途、按复杂度、按生命周期

> 本课问题：OriginOS 有 30 个 Skill，它们如何分类？不同类别的 Skill 有什么共同特征？

## 小林的场景

小林看了 `templates/skills/` 下的 30 个 Skill，发现它们差异很大：

- 有的 Skill 只有 1 个文件（如 `bmad-shard-doc`）
- 有的 Skill 有 50+ 个文件（如 `bmad-agent-builder`）
- 有的 Skill 是中文的（如 `project-initialization`）
- 有的 Skill 是英文的（如 `bmad-agent-builder`）
- 有的 Skill 有 `type: SIMPLE`，有的有 `type: COMPOSITE`

她想知道：这些 Skill 是怎么分类的？分类标准是什么？

## 概念阶梯：分类不是“标签”，而是“能力模型”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “分类就是给 Skill 打标签” | 分类是**能力模型的映射** | 不是简单的标签，而是反映 Skill 的职责和边界 |
| “Skill 数量多就是复杂” | 复杂度由**能力范围**决定，不是文件数量 | 文件数量多可能是因为资产多，而不是能力复杂 |
| “SIMPLE 就是简单，COMPOSITE 就是复杂” | `SIMPLE` 是**单一用途**，`COMPOSITE` 是**多阶段编排** | 不是简单/复杂的二元对立 |

## 第一段源码：30 个 Skill 的全景

```typescript
// 通过 git ls-files 获取的 30 个 Skill：

// BMAD 框架技能（11 个）
bmad-agent-builder      // Agent 构建框架
bmad-workflow-builder   // 工作流构建
bmad-module-builder     // 模块构建
bmad-brainstorming      // 创意发散
bmad-distillator        // 信息蒸馏
bmad-shard-doc          // 文档分片
bmad-editorial-review-prose     // 散文审查
bmad-editorial-review-structure // 结构审查
bmad-review-adversarial-general // 对抗审查
bmad-review-edge-case-hunter    // 边界发现
bmad-bmb-setup          // 环境初始化
bmad-help               // 帮助
bmad-index-docs         // 文档索引
bmad-party-mode         // 多 Agent 对话

// 业务技能（8 个）
project-initialization    // 项目访谈
domain-discovery           // 领域发现
business-refinement        // 业务精炼
info-query                 // 信息查询
task-manager               // 任务管理
model-review               // 模型审阅
solution-design            // 解决方案设计
mahjong-scorer             // 麻将计分
seal-stamper               // 印章盖章
wrong-answer-review         // 错题回顾

// 元技能（5 个）
agent-creator              // Agent 创建
role-agent-creator         // 角色 Agent 创建
skill-creator-app           // Skill 创建
project-skill-creator      // 项目 Skill 创建
search-and-install-skill   // 搜索安装 Skill
```

**分类结果**：

| 类别 | 数量 | 特征 | 代表 Skill |
| --- | --- | --- | --- |
| **BMAD 框架技能** | 14 | 以 `bmad-` 前缀，构建 Agent/Skill 的框架工具 | `bmad-agent-builder` |
| **业务技能** | 10 | 面向具体业务场景，解决实际问题 | `project-initialization` |
| **元技能** | 5 | 创建其他 Skill 或 Agent 的技能 | `skill-creator-app` |
| **系统技能** | 1 | 系统内置，不直接面向用户 | `model-review` |

## 第二段源码：按 `type` 分类

```typescript
// [packages/core/src/types/skill.ts 第 11—14 行](../../../../packages/core/src/types/skill.ts#L11)
export enum SkillType {
  SIMPLE = 'simple',       // Single-purpose skill
  COMPOSITE = 'composite', // Skill that orchestrates other skills
}
```

**`SIMPLE` 类型的 Skill**：

| Skill | 用途 | 特征 |
| --- | --- | --- |
| `info-query` | 信息查询 | 单一查询意图，直接返回结果 |
| `mahjong-scorer` | 麻将计分 | 单一计算逻辑，无多阶段 |
| `seal-stamper` | 印章盖章 | 单一图像处理任务 |
| `wrong-answer-review` | 错题回顾 | 单一分析任务 |
| `search-and-install-skill` | 搜索安装 Skill | 单一搜索任务 |

**`COMPOSITE` 类型的 Skill**：

| Skill | 用途 | 特征 |
| --- | --- | --- |
| `project-initialization` | 项目访谈 | 多阶段（Phase 1、Phase 2） |
| `bmad-agent-builder` | Agent 构建 | 多步骤（发现、构建、分析） |
| `bmad-workflow-builder` | 工作流构建 | 多步骤（设计、验证、优化） |
| `skill-creator-app` | Skill 创建 | 多阶段（创建、评测、优化） |
| `task-manager` | 任务管理 | 多操作（创建、更新、删除） |

**关键判断**：`SIMPLE` 和 `COMPOSITE` 的区别不是“简单/复杂”，而是“单一用途/多阶段编排”。

## 第三段源码：按文件数量分类

```typescript
// 通过 git ls-files 统计的各 Skill 文件数量：

// 大型 Skill（>20 文件）
bmad-agent-builder      // 52 文件
bmad-workflow-builder   // 31 文件
project-skill-creator   // 27 文件
skill-creator-app       // 22 文件
bmad-module-builder     // 20 文件

// 中型 Skill（5–15 文件）
bmad-brainstorming      // 13 文件
role-agent-creator      // 10 文件
bmad-distillator        // 8 文件
agent-creator           // 7 文件
bmad-bmb-setup          // 6 文件
project-initialization  // 4 文件

// 小型 Skill（<5 文件）
wrong-answer-review     // 3 文件
search-and-install-skill// 3 文件
seal-stamper            // 3 文件
info-query              // 3 文件
task-manager            // 2 文件
solution-design         // 2 文件
mahjong-scorer          // 2 文件
model-review            // 1 文件
domain-discovery        // 1 文件
business-refinement     // 1 文件
bmad-shard-doc          // 1 文件
bmad-advanced-elicitation // 1 文件
bmad-editorial-review-prose // 1 文件
bmad-editorial-review-structure // 1 文件
bmad-review-adversarial-general // 1 文件
bmad-review-edge-case-hunter    // 1 文件
bmad-help               // 1 文件
bmad-index-docs         // 1 文件
bmad-party-mode         // 1 文件
```

**文件数量与复杂度的关系**：

| 文件数量 | 特征 | 代表 Skill |
| --- | --- | --- |
| >20 | 有完整的框架、模板、脚本、评测 | `bmad-agent-builder` |
| 5–15 | 有参考文档和模板 | `bmad-brainstorming` |
| <5 | 只有基本定义 | `info-query` |

**关键判断**：文件数量多**不一定**代表能力复杂，可能是因为**资产多**（如模板、脚本、评测）。

## 第四段源码：按生命周期分类

| 生命周期阶段 | 特征 | 代表 Skill |
| --- | --- | --- |
| **创建期** | 帮助用户创建项目、Agent、Skill | `project-initialization`、`agent-creator`、`skill-creator-app` |
| **运行期** | 帮助用户执行任务、查询信息 | `info-query`、`task-manager`、`mahjong-scorer` |
| **优化期** | 帮助用户审查、优化、改进 | `bmad-agent-builder`、`model-review`、`wrong-answer-review` |
| **协作期** | 支持多 Agent 协作 | `bmad-party-mode`、`bmad-workflow-builder` |

## 调用链：不同类别 Skill 的使用路径

```textn用户请求
  → Router 匹配 Skill
    → SIMPLE Skill
      → 直接执行 handler
        → 返回结果
    → COMPOSITE Skill
      → 分阶段执行
        → Phase 1: 发现/准备
        → Phase 2: 精炼/执行
        → 返回结果
```

## 失败路径：分类可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| Skill 分类错误 | 路由到错误的 Skill | 分类标准不清晰 |
| `type` 声明与实际不符 | 执行行为异常 | `SIMPLE` Skill 却有多阶段逻辑 |
| 文件数量与能力不匹配 | 维护困难 | 资产过多或过少 |
| 生命周期阶段不明确 | 用户使用困惑 | 不知道何时使用哪个 Skill |

## 测试证据

```bash
# 统计各类 Skill 的数量
echo "BMAD 框架技能:" && ls templates/skills/ | grep "^bmad-" | wc -l
echo "业务技能:" && ls templates/skills/ | grep -v "^bmad-" | grep -v "creator\|app" | wc -l
echo "元技能:" && ls templates/skills/ | grep -E "creator|app" | wc -l

# 统计 SIMPLE 和 COMPOSITE 类型的 Skill
grep -l "type: SIMPLE" templates/skills/*/SKILL.md | wc -l
grep -l "type: COMPOSITE" templates/skills/*/SKILL.md | wc -l
```

**测试缺口**：
- 没有自动化测试验证 Skill 分类的准确性
- 没有测试验证 `type` 声明与实际行为的一致性
- 没有测试验证文件数量与能力的匹配度

## 小实验

**实验 1：给 Skill 分类**

| Skill | 类别（BMAD/业务/元） | 类型（SIMPLE/COMPOSITE） | 生命周期阶段 |
| --- | --- | --- | --- |
| `info-query` | | | |
| `project-initialization` | | | |
| `bmad-agent-builder` | | | |
| `skill-creator-app` | | | |
| `mahjong-scorer` | | | |

**实验 2：分析文件数量与能力的关系**

选择 3 个 Skill，对比它们的文件数量和实际能力：

| Skill | 文件数量 | 实际能力 | 匹配度 |
| --- | --- | --- | --- |
| | | | |

**思考**：文件数量多就代表能力复杂吗？

## 口头验收

1. **30 个 Skill 如何分类？** 能说出 BMAD 框架技能、业务技能、元技能、系统技能吗？
2. **`SIMPLE` 和 `COMPOSITE` 类型的区别是什么？** 能说出前者单一用途、后者多阶段编排吗？
3. **文件数量多就代表能力复杂吗？** 能说出文件数量多可能是因为资产多吗？
4. **Skill 的生命周期阶段有哪些？** 能说出创建期、运行期、优化期、协作期吗？
5. **如果 `type` 声明与实际不符，会发生什么？** 能说出执行行为异常吗？

## 本课结论

本课建立了 Skill 分类的完整认知：

- **30 个 Skill 分为 4 类**：BMAD 框架技能（14）、业务技能（10）、元技能（5）、系统技能（1）
- **`SIMPLE` 是单一用途，`COMPOSITE` 是多阶段编排**
- **文件数量多不一定代表能力复杂**，可能是因为资产多
- **Skill 有生命周期阶段**：创建期、运行期、优化期、协作期

下一课（L09）将深入 Skill 的“运行时拷贝”，回答“模板和运行时副本的关系”这个问题。
