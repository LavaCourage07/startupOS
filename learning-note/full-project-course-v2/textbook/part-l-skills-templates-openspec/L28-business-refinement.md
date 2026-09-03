# L28：`business-refinement`——业务精炼

> 本课问题：`business-refinement` 是如何通过结构化追问完善业务模型的？

## 小林的场景

小林已经完成了领域发现，识别出"在线书店"领域的核心概念。现在她需要进一步完善业务规则，填补信息缺口。

她想知道：

- 业务精炼是怎么进行的？
- 如何检测矛盾？
- 如何完善业务规则？

## 概念阶梯：业务精炼不是“补充细节”，而是“结构化完善”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “精炼就是补充细节” | 精炼是**结构化的追问和验证** | 不是随意的补充，而是有方法的 |
| “精炼是一次性的” | 精炼是**迭代的** | 可以多次精炼 |
| “精炼没有标准” | 精炼有**检查清单** | 不是任意的，有标准 |

## 第一段源码：`business-refinement` 的 Frontmatter

```typescript
// [templates/skills/business-refinement/SKILL.md 第 1—10 行](../../../../templates/skills/business-refinement/SKILL.md#L1)
---
name: business-refinement
description: Refine business models through structured questioning. Use when the user needs to fill gaps, detect contradictions, and完善 business rules.
originos-system: true
version: 1.0.0
type: SIMPLE
tags:
  - business
  - refinement
  - modeling
---
```

## 第二段源码：精炼方法

```typescript
// [templates/skills/business-refinement/SKILL.md 第 15—35 行](../../../../templates/skills/business-refinement/SKILL.md#L15)
## Refinement Process

1. **Structured questioning**
   - Ask specific questions to fill gaps
   - Use predefined question templates
   - Focus on missing information

2. **Contradiction detection**
   - Compare statements for inconsistencies
   - Identify conflicting business rules
   - Flag ambiguous requirements

3. **Rule completion**
   - Ensure all business rules are complete
   - Add missing constraints
   - Clarify ambiguous rules

4. **Validation**
   - Verify completeness
   - Check consistency
   - Confirm with user
```

**精炼方法**：

| 步骤 | 名称 | 目标 |
| --- | --- | --- |
| 1 | 结构化追问 | 填补信息缺口 |
| 2 | 矛盾检测 | 发现不一致 |
| 3 | 规则完善 | 补充约束 |
| 4 | 验证 | 确认完整性 |

## 第三段源码：检查清单

```typescript
// [templates/skills/business-refinement/SKILL.md 第 40—55 行](../../../../templates/skills/business-refinement/SKILL.md#L40)
## Checklist

For each business concept:

- [ ] Is the concept clearly defined?
- [ ] Are all attributes specified?
- [ ] Are all relationships defined?
- [ ] Are business rules complete?
- [ ] Are constraints specified?
- [ ] Are edge cases considered?
- [ ] Are exceptions handled?
- [ ] Is the concept validated with user?
```

## 调用链：业务精炼流程

```text
领域发现完成
  → business-refinement 激活
    → 结构化追问（填补缺口）
      → 矛盾检测（发现不一致）
        → 规则完善（补充约束）
          → 验证（确认完整性）
            → 输出完整业务模型
```

## 口头验收

1. **业务精炼的四个步骤是什么？** 能说出结构化追问 → 矛盾检测 → 规则完善 → 验证吗？
2. **检查清单包含哪些内容？** 能说出概念定义、属性、关系、规则、约束、边界情况、异常处理、用户验证吗？
3. **矛盾检测的目标是什么？** 能说出发现不一致、冲突的规则吗？
4. **业务精炼是一次性的吗？** 能说出是迭代的吗？
5. **验证的目标是什么？** 能说出确认完整性、一致性吗？

## 本课结论

本课建立了 `business-refinement` 的完整认知：

- **业务精炼是结构化完善**：不是随意补充，而是有方法的
- **四步法**：结构化追问 → 矛盾检测 → 规则完善 → 验证
- **检查清单**：确保每个概念都完整定义
- **迭代过程**：可以多次精炼
- **输出完整业务模型**：填补缺口、检测矛盾、完善规则

下一课（L29）将介绍访谈进度管理。
