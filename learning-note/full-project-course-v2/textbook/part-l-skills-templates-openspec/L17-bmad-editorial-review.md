# L17：`bmad-editorial-review-*`——质量审查

> 本课问题：OriginOS 如何通过多个审查 Skill 确保产物质量？它们各自审查什么？

## 小林的场景

小林用 `bmad-agent-builder` 创建了一个 Agent，但她不确定这个 Agent 的质量如何。她发现 BMAD 框架有多个审查 Skill，每个审查不同的方面。

她想知道：

- 有哪些审查 Skill？
- 它们各自审查什么？
- 审查结果怎么被使用？

## 概念阶梯：审查不是“找茬”，而是“质量保障”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “审查就是找错误” | 审查是**多维度的质量评估** | 不只是找错误，还包括结构、风格、安全等 |
| “审查是主观的” | 审查有**明确的标准和检查清单** | 不是主观的，而是可量化的 |
| “审查是一次性的” | 审查是**迭代的** | 不是一次性的，而是持续的 |

## 第一段源码：审查 Skill 的全景

```typescript
// OriginOS 的审查 Skill 家族：

// 内容审查
templates/skills/bmad-editorial-review-prose/      // 散文审查
templates/skills/bmad-editorial-review-structure/  // 结构审查

// 安全审查
templates/skills/bmad-review-adversarial-general/    // 对抗审查
templates/skills/bmad-review-edge-case-hunter/      // 边界发现
```

**审查 Skill 的分类**：

| 分类 | Skill | 审查内容 | 目标 |
| --- | --- | --- | --- |
| **内容审查** | `bmad-editorial-review-prose` | 散文、文风、表达 | 可读性、专业性 |
| **结构审查** | `bmad-editorial-review-structure` | 结构、逻辑、组织 | 清晰性、一致性 |
| **对抗审查** | `bmad-review-adversarial-general` | 安全、偏见、滥用 | 安全性、合规性 |
| **边界发现** | `bmad-review-edge-case-hunter` | 边界条件、异常场景 | 健壮性、鲁棒性 |

## 第二段源码：`bmad-editorial-review-prose` 的审查标准

```typescript
// [templates/skills/bmad-editorial-review-prose/SKILL.md 第 1—20 行](../../../../templates/skills/bmad-editorial-review-prose/SKILL.md#L1)
---
name: bmad-editorial-review-prose
description: Review prose for clarity, tone, and style. Use when the user needs editorial feedback on written content.
originos-system: true
version: 1.0.0
type: SIMPLE
tags:
  - review
  - prose
  - editorial
---

# Editorial Review: Prose

## Review Criteria

1. **Clarity**: Is the meaning clear? Are there ambiguous statements?
2. **Tone**: Is the tone appropriate for the audience?
3. **Style**: Is the writing style consistent?
4. **Grammar**: Are there grammatical errors?
5. **Conciseness**: Is the writing concise without being terse?
```

**散文审查标准**：

| 标准 | 审查内容 | 示例 |
| --- | --- | --- |
| **Clarity** | 意义是否清晰 | 是否有歧义 |
| **Tone** | 语气是否合适 | 是否适合目标受众 |
| **Style** | 风格是否一致 | 前后风格是否统一 |
| **Grammar** | 语法是否正确 | 是否有语法错误 |
| **Conciseness** | 是否简洁 | 是否冗长 |

## 第三段源码：`bmad-review-adversarial-general` 的审查标准

```typescript
// [templates/skills/bmad-review-adversarial-general/SKILL.md 第 1—20 行](../../../../templates/skills/bmad-review-adversarial-general/SKILL.md#L1)
---
name: bmad-review-adversarial-general
description: Review for adversarial vulnerabilities, biases, and potential misuse. Use when the user needs a security-focused review.
originos-system: true
version: 1.0.0
type: SIMPLE
tags:
  - review
  - adversarial
  - security
---

# Adversarial Review

## Review Criteria

1. **Prompt Injection**: Can the agent be manipulated by malicious prompts?
2. **Bias**: Does the agent exhibit unfair biases?
3. **Misuse**: Can the agent be used for harmful purposes?
4. **Privacy**: Does the agent leak sensitive information?
5. **Robustness**: Does the agent handle edge cases gracefully?
```

**对抗审查标准**：

| 标准 | 审查内容 | 示例 |
| --- | --- | --- |
| **Prompt Injection** | 是否可被恶意 Prompt 操纵 | 注入攻击 |
| **Bias** | 是否有不公平偏见 | 性别、种族偏见 |
| **Misuse** | 是否可被用于有害目的 | 生成有害内容 |
| **Privacy** | 是否泄露敏感信息 | 数据泄露 |
| **Robustness** | 是否优雅处理边界情况 | 异常输入 |

## 第四段源码：审查的协同工作

```
Agent 构建完成
  → bmad-editorial-review-prose
    → 审查散文、文风
      → 通过？
        → 是 → bmad-editorial-review-structure
          → 审查结构、逻辑
            → 通过？
              → 是 → bmad-review-adversarial-general
                → 审查安全、偏见
                  → 通过？
                    → 是 → bmad-review-edge-case-hunter
                      → 审查边界条件
                        → 通过？
                          → 是 → 审查通过
                          → 否 → 修复边界问题
                    → 否 → 修复安全问题
              → 否 → 修复结构问题
        → 否 → 修复散文问题
```

**审查流程**：

1. **散文审查** → 2. **结构审查** → 3. **对抗审查** → 4. **边界发现

## 失败路径：审查可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 审查标准不一致 | 不同审查者结论不同 | 标准定义不清 |
| 审查过于严格 | 产物无法通过 | 标准过高 |
| 审查过于宽松 | 质量问题遗漏 | 标准过低 |
| 审查结果冲突 | 不同 Skill 结论矛盾 | 审查维度重叠 |
| 审查成本过高 | 开发效率降低 | 审查步骤过多 |

## 测试证据

```bash
# 检查审查 Skill 的文件结构
for skill in bmad-editorial-review-prose bmad-editorial-review-structure bmad-review-adversarial-general bmad-review-edge-case-hunter; do
  echo "=== $skill ==="
  ls templates/skills/$skill/
done

# 检查审查标准
cat templates/skills/bmad-editorial-review-prose/SKILL.md
cat templates/skills/bmad-review-adversarial-general/SKILL.md
```

## 小实验

**实验 1：对比四种审查 Skill**

| Skill | 审查内容 | 目标 | 标准数量 |
| --- | --- | --- | --- |
| `bmad-editorial-review-prose` | 散文、文风 | 可读性 | 5 |
| `bmad-editorial-review-structure` | 结构、逻辑 | 清晰性 | 5 |
| `bmad-review-adversarial-general` | 安全、偏见 | 安全性 | 5 |
| `bmad-review-edge-case-hunter` | 边界条件 | 健壮性 | 5 |

**实验 2：设计一个审查场景**

假设你构建了一个“医疗咨询 Agent”，请回答：

1. 散文审查会关注什么？
2. 结构审查会关注什么？
3. 对抗审查会关注什么？
4. 边界发现会关注什么？

## 口头验收

1. **OriginOS 有哪些审查 Skill？** 能说出散文、结构、对抗、边界四种吗？
2. **散文审查审查什么？** 能说出 Clarity、Tone、Style、Grammar、Conciseness 吗？
3. **对抗审查审查什么？** 能说出 Prompt Injection、Bias、Misuse、Privacy、Robustness 吗？
4. **审查是串行还是并行的？** 能说出通常是串行的吗？
5. **如果审查结果冲突，怎么办？** 能说出需要人工介入或调整标准吗？

## 本课结论

本课建立了 BMAD 审查 Skill 的完整认知：

- **审查是多维度的**：散文、结构、安全、边界
- **每个审查有明确标准**：5 个审查维度，每个维度 5 个标准
- **审查是串行的**：散文 → 结构 → 安全 → 边界
- **审查是迭代的**：不通过则修复后重新审查
- **审查是质量保障**：不是找茬，而是确保产物质量

下一课（L18）将介绍其他辅助 BMAD Skill。
