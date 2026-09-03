# L23：`agent-creator`——通用 Agent 创建

> 本课问题：`agent-creator` 和 `role-agent-creator`、`bmad-agent-builder` 有什么区别？什么时候使用它？

## 小林的场景

小林已经了解了 `role-agent-creator`（基于角色模板）和 `bmad-agent-builder`（BMAD 框架）。但她发现还有一个 `agent-creator`，不知道它适合什么场景。

她想知道：

- `agent-creator` 和其他的 Agent 创建 Skill 有什么区别？
- 什么时候应该使用它？
- 它的创建流程是什么样的？

## 概念阶梯：通用创建不是“低配版”，而是“灵活版”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “通用创建就是低配版” | 通用创建是**不预设角色、完全自由**的创建方式 | 不是低配，而是更灵活 |
| “通用创建不需要模板” | 通用创建**可以使用模板，也可以不用** | 不是完全无模板，而是模板可选 |
| “通用创建和 BMAD 冲突” | 通用创建和 BMAD 是**互补**的 | 不是冲突，而是不同场景 |

## 第一段源码：`agent-creator` 的 Frontmatter

```typescript
// [templates/skills/agent-creator/SKILL.md 第 1—15 行](../../../../templates/skills/agent-creator/SKILL.md#L1)
---
name: agent-creator
description: Create a general-purpose agent. Use when the user wants to create an agent without a specific professional role.
originos-system: true
version: 1.0.0
type: COMPOSITE
author: OriginOS
outputDir: data/
tags:
  - agent
  - creator
  - general
reads: []
writes:
  - agent
---
```

**关键字段**：

| 字段 | 值 | 含义 |
| --- | --- | --- |
| `description` | "general-purpose agent" | 通用目的 Agent |
| `type` | `COMPOSITE` | 多阶段编排 |
| `writes` | `agent` | 输出 Agent 定义 |

## 第二段源码：三种 Agent 创建 Skill 的对比

```typescript
// 对比表：

| 维度 | bmad-agent-builder | role-agent-creator | agent-creator |
| --- | --- | --- | --- |
| 框架 | BMAD | 角色模板 | 通用 |
| 预设角色 | 无 | 有（技术/产品/业务） | 无 |
| 创建方式 | 六阶段对话 | 模板选择 + 定制 | 自由对话 |
| 输出结构 | BMAD 标准 | 角色模板标准 | 灵活 |
| 复杂度 | 高（52 文件） | 中（10 文件） | 低（7 文件） |
| 适用场景 | 专业 Agent 构建 | 专业角色 Agent | 通用 Agent |
```

**三种 Skill 的适用场景**：

| Skill | 适用场景 | 不适用场景 |
| --- | --- | --- |
| `bmad-agent-builder` | 需要 BMAD 标准的专业 Agent | 简单、快速的 Agent |
| `role-agent-creator` | 有明确专业角色的 Agent | 无特定角色的 Agent |
| `agent-creator` | 通用、灵活的 Agent | 需要严格标准的 Agent |

## 第三段源码：`agent-creator` 的创建流程

```typescript
// [templates/skills/agent-creator/SKILL.md 第 20—35 行](../../../../templates/skills/agent-creator/SKILL.md#L20)
## Creation Process

1. **Understand the user's need**
   - What does the agent need to do?
   - Who will use it?
   - What are the constraints?

2. **Design the agent**
   - Define capabilities
   - Set personality
   - Configure behavior

3. **Generate the agent**
   - Create SKILL.md
   - Set up directory structure
   - Configure dependencies

4. **Test and refine**
   - Run test prompts
   - Evaluate results
   - Iterate based on feedback
```

**创建流程**：

| 步骤 | 名称 | 目标 |
| --- | --- | --- |
| 1 | 理解需求 | 明确 Agent 要做什么 |
| 2 | 设计 Agent | 定义能力、性格、行为 |
| 3 | 生成 Agent | 创建文件和配置 |
| 4 | 测试优化 | 运行测试，迭代改进 |

## 第四段源码：通用 Agent 的输出

```typescript
// [templates/skills/agent-creator/assets/agent-template.md 第 1—20 行](../../../../templates/skills/agent-creator/assets/agent-template.md#L1)
---
name: {{AGENT_NAME}}
description: {{AGENT_DESCRIPTION}}
---

# {{AGENT_NAME}}

## Overview

{{AGENT_OVERVIEW}}

## Capabilities

{{CAPABILITIES}}

## Personality

{{PERSONALITY}}

## Behavior

{{BEHAVIOR}}
```

**通用模板**：

| Section | 说明 |
| --- | --- |
| `Overview` | Agent 概述 |
| `Capabilities` | 能力定义 |
| `Personality` | 性格定义 |
| `Behavior` | 行为定义 |

**关键判断**：通用模板的结构更简单，没有 BMAD 的严格标准，也没有角色模板的预设。

## 调用链：通用 Agent 创建流程

```text
用户说 "I want to create a simple chatbot"
  → agent-creator 激活
    → 理解需求（做什么、给谁用、有什么约束）
      → 设计 Agent（能力、性格、行为）
        → 生成 Agent（创建文件）
          → 测试优化
            → 输出到 data/agents/
```

## 失败路径：通用 Agent 创建可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 需求不明确 | 设计方向混乱 | 对话不充分 |
| 能力定义过宽 | Agent 什么都做，什么都不精 | 没有聚焦 |
| 性格和行为冲突 | Agent 表现不一致 | 设计时没有统一 |
| 测试不充分 | 质量问题未被发现 | 测试用例少 |
| 输出目录不存在 | 创建失败 | `data/agents/` 未创建 |

## 测试证据

```bash
# 检查 agent-creator 的文件结构
ls -la templates/skills/agent-creator/

# 检查模板
ls templates/skills/agent-creator/assets/

# 对比三种 Agent 创建 Skill 的文件数量
echo "bmad-agent-builder: $(ls templates/skills/bmad-agent-builder/ | wc -l)"
echo "role-agent-creator: $(ls templates/skills/role-agent-creator/ | wc -l)"
echo "agent-creator: $(ls templates/skills/agent-creator/ | wc -l)"
```

## 小实验

**实验 1：对比三种 Agent 创建 Skill**

| 维度 | `bmad-agent-builder` | `role-agent-creator` | `agent-creator` |
| --- | --- | --- | --- |
| 框架 | BMAD | 角色模板 | 通用 |
| 预设角色 | 无 | 有 | 无 |
| 创建方式 | 六阶段对话 | 模板 + 定制 | 自由对话 |
| 文件数量 | 52 | 10 | 7 |
| 适用场景 | 专业 Agent | 角色 Agent | 通用 Agent |

**实验 2：选择合适的创建 Skill**

| 场景 | 选择哪个 Skill？ | 原因 |
| --- | --- | --- |
| 创建一个"架构师"Agent | | |
| 创建一个简单的聊天机器人 | | |
| 创建一个符合 BMAD 标准的 Agent | | |
| 创建一个"产品经理"Agent | | |

## 口头验收

1. **`agent-creator` 和 `role-agent-creator` 的区别是什么？** 能说出前者通用，后者基于角色模板吗？
2. **`agent-creator` 和 `bmad-agent-builder` 的区别是什么？** 能说出前者灵活，后者严格遵循 BMAD 标准吗？
3. **什么时候应该使用 `agent-creator`？** 能说出需要通用、灵活的 Agent 时吗？
4. **通用 Agent 的模板包含哪些部分？** 能说出 Overview、Capabilities、Personality、Behavior 吗？
5. **三种 Agent 创建 Skill 中，哪个最复杂？哪个最简单？** 能说出 BMAD 最复杂（52 文件），通用最简单（7 文件）吗？

## 本课结论

本课建立了 `agent-creator` 的完整认知：

- **`agent-creator` 是通用创建器**：不预设角色，完全自由
- **三种 Agent 创建 Skill 互补**：BMAD（专业）、角色（模板）、通用（灵活）
- **通用模板更简单**：Overview、Capabilities、Personality、Behavior
- **适用场景不同**：根据需求选择合适的创建器
- **输出到 `data/agents/`**：用户创建的 Agent 和系统内置分开

下一课（L24）将深入 `project-skill-creator`，了解项目专属 Skill 的创建。
