# L15：`bmad-distillator`——信息蒸馏

> 本课问题：`bmad-distillator` 是如何从大量信息中提取精华的？它和摘要有什么不同？

## 小林的场景

小林用 `bmad-brainstorming` 生成了 24 个创意，但她发现这些创意质量参差不齐。她想知道：

- 如何从大量信息中提取精华？
- 蒸馏和摘要有什么区别？
- 蒸馏后的结果怎么被使用？

## 概念阶梯：蒸馏不是“摘要”，而是“提炼”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “蒸馏就是摘要” | 蒸馏是**提取核心洞察**，摘要是**压缩内容** | 摘要保留结构，蒸馏提取本质 |
| “蒸馏是自动的” | 蒸馏需要**交互式精炼** | 不是一次性完成，而是多轮迭代 |
| “蒸馏没有输出格式” | 蒸馏有**结构化的输出模板** | 不是自由文本，而是结构化产物 |

## 第一段源码：`bmad-distillator` 的 SKILL.md

```typescript
// [templates/skills/bmad-distillator/SKILL.md 第 1—20 行](../../../../templates/skills/bmad-distillator/SKILL.md#L1)
---
name: bmad-distillator
description: Distill information into structured, actionable insights. Use when the user needs to extract essence from large amounts of text, data, or ideas.
originos-system: true
version: 1.0.0
type: SIMPLE
tags:
  - distillation
  - analysis
  - synthesis
---

# Distillator

## Overview

The distillator extracts the essence from complex information. Unlike summarization which compresses content, distillation identifies the core insights, patterns, and actionable takeaways.

## Process

1. **Ingest**: Load and understand the source material
2. **Analyze**: Identify patterns, themes, and insights
3. **Synthesize**: Combine related insights into coherent takeaways
4. **Structure**: Format according to the output template
5. **Validate**: Ensure accuracy and completeness
```

**关键特征**：

1. **触发条件**：用户需要从大量信息中提取精华
2. **类型**：`SIMPLE`（单一用途）
3. **核心区别**：蒸馏 vs 摘要

## 第二段源码：蒸馏 vs 摘要

```typescript
// [templates/skills/bmad-distillator/SKILL.md 第 25—35 行](../../../../templates/skills/bmad-distillator/SKILL.md#L25)
## Distillation vs Summarization

| Aspect | Summarization | Distillation |
| --- | --- | --- |
| **Goal** | Compress content | Extract essence |
| **Output** | Shorter version of input | Structured insights |
| **Structure** | Preserves original structure | Creates new structure |
| **Depth** | Surface-level | Deep-level |
| **Actionability** | Low | High |
```

**核心区别**：

| 维度 | 摘要 | 蒸馏 |
| --- | --- | --- |
| **目标** | 压缩内容 | 提取精华 |
| **输出** | 更短的版本 | 结构化的洞察 |
| **结构** | 保留原文结构 | 创建新结构 |
| **深度** | 表面 | 深层 |
| **可操作性** | 低 | 高 |

**关键判断**：摘要是“压缩”，蒸馏是“提炼”。摘要让你知道“说了什么”，蒸馏让你知道“意味着什么”。

## 第三段源码：蒸馏的输出模板

```typescript
// [templates/skills/bmad-distillator/SKILL.md 第 40—55 行](../../../../templates/skills/bmad-distillator/SKILL.md#L40)
## Output Template

```
# Distillation Report

## Core Insights
- [Insight 1]
- [Insight 2]

## Patterns
- [Pattern 1]
- [Pattern 2]

## Actionable Takeaways
- [Takeaway 1]
- [Takeaway 2]

## Questions for Further Exploration
- [Question 1]
- [Question 2]
```
```

**输出结构**：

| Section | 内容 | 作用 |
| --- | --- | --- |
| **Core Insights** | 核心洞察 | 最重要的发现 |
| **Patterns** | 模式 | 重复出现的规律 |
| **Actionable Takeaways** | 可执行的要点 | 下一步行动 |
| **Questions for Further Exploration** | 待探索问题 | 深入研究的方向 |

## 第四段源码：蒸馏的交互式精炼

```typescript
// [templates/skills/bmad-distillator/SKILL.md 第 60—75 行](../../../../templates/skills/bmad-distillator/SKILL.md#L60)
## Interactive Refinement

The distillation process is iterative:

1. **Initial distillation**: Produce first draft
2. **User feedback**: User reviews and provides feedback
3. **Refinement**: Adjust based on feedback
4. **Finalization**: Produce final version

Users can request:
- "Deeper" — more detailed analysis
- "Broader" — wider context
- "Focus on X" — narrow to specific theme
- "Simplify" — reduce complexity
```

**迭代过程**：

1. **Initial distillation**：初稿
2. **User feedback**：用户评审
3. **Refinement**：根据反馈调整
4. **Finalization**：定稿

**用户指令**：

| 指令 | 效果 |
| --- | --- |
| "Deeper" | 更详细的分析 |
| "Broader" | 更广泛的上下文 |
| "Focus on X" | 聚焦特定主题 |
| "Simplify" | 降低复杂度 |

## 调用链：蒸馏流程

```text
用户提供大量信息
  → bmad-distillator 激活
    → Ingest（加载和理解）
      → Analyze（识别模式和洞察）
        → Synthesize（组合成要点）
          → Structure（按模板格式化）
            → Validate（验证准确性）
              → 输出 Distillation Report
                → 用户反馈
                  → Refinement（迭代精炼）
```

## 失败路径：蒸馏可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 信息过载 | 无法提取精华 | 输入太多，超出处理能力 |
| 洞察肤浅 | 输出表面化 | 分析深度不够 |
| 结构混乱 | 输出难以理解 | 格式化不当 |
| 用户反馈不明确 | 无法精炼 | 用户不知道如何表达需求 |
| 验证失败 | 输出不准确 | 没有充分验证 |

## 测试证据

```bash
# 检查 bmad-distillator 的文件结构
ls -la templates/skills/bmad-distillator/

# 检查 agents 目录
ls templates/skills/bmad-distillator/agents/

# 检查 resources 目录
ls templates/skills/bmad-distillator/resources/
```

## 小实验

**实验 1：对比摘要和蒸馏**

| 维度 | 摘要 | 蒸馏 |
| --- | --- | --- |
| 输入 | 长文本 | 大量信息 |
| 输出 | 短文本 | 结构化洞察 |
| 深度 | 表面 | 深层 |
| 可操作性 | 低 | 高 |

**实验 2：分析蒸馏的输出模板**

```
# Distillation Report

## Core Insights
- Insight 1: ...
- Insight 2: ...

## Patterns
- Pattern 1: ...
- Pattern 2: ...

## Actionable Takeaways
- Takeaway 1: ...
- Takeaway 2: ...

## Questions for Further Exploration
- Question 1: ...
- Question 2: ...
```

**思考**：为什么蒸馏的输出比摘要更有价值？

## 口头验收

1. **蒸馏和摘要的区别是什么？** 能说出蒸馏提取精华，摘要压缩内容吗？
2. **蒸馏的输出结构包含哪些部分？** 能说出 Core Insights、Patterns、Actionable Takeaways、Questions 吗？
3. **蒸馏是自动完成的吗？** 能说出是交互式迭代的过程吗？
4. **用户如何指导蒸馏的方向？** 能说出 "Deeper"、"Broader"、"Focus on X"、"Simplify" 吗？
5. **如果信息过载，会发生什么？** 能说出无法提取精华吗？

## 本课结论

本课建立了 `bmad-distillator` 的完整认知：

- **蒸馏不是摘要**：摘要压缩内容，蒸馏提取精华
- **输出是结构化的**：Core Insights、Patterns、Actionable Takeaways、Questions
- **交互式迭代**：Initial → Feedback → Refinement → Finalization
- **用户可指导方向**：Deeper、Broader、Focus on X、Simplify
- **可操作性高**：输出可直接用于决策和行动

下一课（L16）将深入 `bmad-bmb-setup`，了解 BMAD 环境的初始化。
