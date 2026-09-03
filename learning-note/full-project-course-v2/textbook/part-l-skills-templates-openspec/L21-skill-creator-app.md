# L21：`skill-creator-app`——Skill 创建器

> 本课问题：`skill-creator-app` 是如何帮助用户创建新 Skill 的？它的创建流程是什么？

## 小林的场景

小林想创建一个"天气预报"Skill，但她不知道从何开始。她打开 `skill-creator-app`，发现它通过对话引导她完成整个创建过程。

她想知道：

- 创建 Skill 的流程是什么？
- 评测是怎么进行的？
- 创建完成后，Skill 是怎么被安装的？

## 概念阶梯：创建 Skill 不是“写文件”，而是“迭代优化”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “创建 Skill 就是写 SKILL.md” | 创建 Skill 是**迭代优化的过程** | 不是一次性写完，而是多轮改进 |
| “评测是可选的” | 评测是**强制的** | 不评测就无法知道 Skill 的质量 |
| “创建完成后就结束了” | 创建完成后还需要**安装和注册** | 不是写完就完，还要让系统认识它 |

## 第一段源码：`skill-creator-app` 的 Frontmatter

```typescript
// [templates/skills/skill-creator-app/SKILL.md 第 1—23 行](../../../../templates/skills/skill-creator-app/SKILL.md#L1)
---
name: skill-creator-app
code: skill-creator-app
description: 创建、迭代和优化 OriginOS 技能。当用户想要从零创建技能、改进现有技能、运行评测验证技能效果、或优化技能描述以提升触发准确率时触发。
originos-system: true
version: 1.0.0
type: COMPOSITE
author: OriginOS
outputDir: data/
tags:
  - skill
  - creator
  - builder
  - evaluation
reads:
  - skill
  - eval
writes:
  - skill
  - eval
---
```

**关键字段**：

| 字段 | 值 | 含义 |
| --- | --- | --- |
| `type` | `COMPOSITE` | 多阶段编排 |
| `reads` | `skill`、`eval` | 读取 Skill 和评测数据 |
| `writes` | `skill`、`eval` | 写入 Skill 和评测数据 |
| `outputDir` | `data/` | 输出目录 |

**关键判断**：`skill-creator-app` 是**最复杂的 Meta-skill**，有 22 个文件，包含完整的创建、评测、优化流程。

## 第二段源码：创建流程

```typescript
// [templates/skills/skill-creator-app/SKILL.md 第 29—40 行](../../../../templates/skills/skill-creator-app/SKILL.md#L29)
At a high level, the process of creating a skill goes like this:

- Decide what you want the skill to do and roughly how it should do it
- Write a draft of the skill
- Create a few test prompts and run claude-with-access-to-the-skill on them
- Help the user evaluate the results both qualitatively and quantitatively
- Rewrite the skill based on feedback from the user's evaluation
- Repeat until you're satisfied
- Expand the test set and try again at larger scale
```

**创建流程**：

| 步骤 | 名称 | 目标 | 输出 |
| --- | --- | --- | --- |
| 1 | 确定目标 | 明确 Skill 要做什么 | Skill 概念 |
| 2 | 起草 draft | 编写初版 SKILL.md | draft SKILL.md |
| 3 | 创建测试用例 | 设计测试 Prompt | 测试集 |
| 4 | 运行评测 | 执行测试 | 评测结果 |
| 5 | 评估结果 | 定性 + 定量分析 | 反馈 |
| 6 | 迭代优化 | 根据反馈修改 | 改进版 SKILL.md |
| 7 | 扩大测试 | 更大规模测试 | 最终版 |

## 第三段源码：评测机制

```typescript
// [templates/skills/skill-creator-app/SKILL.md 第 35—37 行](../../../../templates/skills/skill-creator-app/SKILL.md#L35)
- Use the `eval-viewer/generate_review.py` script to show the user the results
- Rewrite the skill based on feedback from the user's evaluation of the results
- Repeat until you're satisfied
```

**评测机制**：

1. **定性评估**：人工评审输出质量
2. **定量评估**：自动化指标（触发准确率、响应时间等）
3. **脚本工具**：`eval-viewer/generate_review.py`
4. **迭代循环**：评测 → 反馈 → 优化 → 再评测

## 第四段源码：输出目录

```typescript
// [templates/skills/skill-creator-app/SKILL.md 第 9 行](../../../../templates/skills/skill-creator-app/SKILL.md#L9)
outputDir: data/
```

**输出位置**：

| 环境 | 输出目录 | 说明 |
| --- | --- | --- |
| Web 版本 | `data/web/skills/{skill-name}/` | 用户数据目录 |
| Desktop 版本 | `data/desktop/skills/{skill-name}/` | 本地存储 |

**关键判断**：创建的 Skill 输出到 `data/` 目录，不是 `templates/skills/`。这意味着用户创建的 Skill 和系统内置的 Skill 是分开的。

## 调用链：Skill 创建流程

```text
用户说 "I want to create a skill"
  → skill-creator-app 激活
    → 对话确定 Skill 目标
      → 起草 SKILL.md
        → 创建测试用例
          → 运行评测
            → 评估结果
              → 迭代优化
                → 扩大测试
                  → 最终输出到 data/skills/
                    → 注册到 Registry
```

## 失败路径：创建 Skill 可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 目标不明确 | 无法起草 | 对话不充分 |
| 测试用例不覆盖 | 评测通过但质量差 | 测试集不完整 |
| 评测脚本缺失 | 无法量化评估 | `eval-viewer/` 未配置 |
| 迭代次数过多 | 开发效率低 | 目标不明确或标准过高 |
| 输出目录不存在 | 创建失败 | `data/` 目录未创建 |
| 注册失败 | 系统不认识新 Skill | Registry 未更新 |

## 测试证据

```bash
# 检查 skill-creator-app 的文件结构
ls -la templates/skills/skill-creator-app/

# 检查评测脚本
ls templates/skills/skill-creator-app/scripts/

# 检查输出目录
ls data/skills/ 2>/dev/null || echo "No user skills yet"
```

## 小实验

**实验 1：分析创建流程**

| 步骤 | 输入 | 输出 | 关键决策 |
| --- | --- | --- | --- |
| 确定目标 | 用户想法 | Skill 概念 | 要做什么？ |
| 起草 draft | Skill 概念 | draft SKILL.md | 怎么做？ |
| 创建测试用例 | draft | 测试集 | 测什么？ |
| 运行评测 | 测试集 | 评测结果 | 好不好？ |
| 迭代优化 | 反馈 | 改进版 | 怎么改？ |

**实验 2：对比 `skill-creator-app` 和 `bmad-agent-builder`**

| 维度 | `skill-creator-app` | `bmad-agent-builder` |
| --- | --- | --- |
| 创建目标 | Skill | Agent |
| 评测机制 | 有 | 有 |
| 迭代优化 | 是 | 是 |
| 输出目录 | `data/skills/` | `{bmad_builder_output_folder}` |
| 复杂度 | 高（22 文件） | 高（52 文件） |

## 口头验收

1. **`skill-creator-app` 的创建流程是什么？** 能说出确定目标 → 起草 → 创建测试 → 评测 → 迭代 → 扩大测试吗？
2. **评测是怎么进行的？** 能说出定性 + 定量，使用 `eval-viewer/generate_review.py` 吗？
3. **创建完成后，Skill 输出到哪里？** 能说出 `data/skills/` 吗？
4. **为什么需要迭代优化？** 能说出一次创建无法达到最佳质量吗？
5. **`skill-creator-app` 和 `bmad-agent-builder` 的区别是什么？** 能说出前者创建 Skill，后者创建 Agent 吗？

## 本课结论

本课建立了 `skill-creator-app` 的完整认知：

- **创建 Skill 是迭代过程**：不是一次性写完，而是多轮优化
- **评测是强制的**：定性 + 定量，使用脚本工具
- **输出到 `data/skills/`**：用户创建的 Skill 和系统内置分开
- **最复杂的 Meta-skill**：22 个文件，包含完整流程
- **创建完成后需要注册**：系统才能认识新 Skill

下一课（L22）将深入 `role-agent-creator`，了解角色化 Agent 的创建。
