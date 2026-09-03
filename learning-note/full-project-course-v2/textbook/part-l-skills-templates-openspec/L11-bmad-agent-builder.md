# L11：`bmad-agent-builder`——Agent 构建框架

> 本课问题：`bmad-agent-builder` 是如何帮助用户构建 Agent 的？它的六阶段构建流程是什么？

## 小林的场景

小林想创建一个“代码审查助手”Agent。她不知道该如何定义这个 Agent 的能力、性格和交互方式。

她打开 `bmad-agent-builder`，发现它通过对话引导她完成整个构建过程。她想知道：

- 构建一个 Agent 需要经过哪些阶段？
- 每个阶段产出什么？
- 构建完成后，Agent 的文件结构是什么样的？

## 概念阶梯：Agent 构建不是“写代码”，而是“对话设计”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “Agent 就是一段代码” | Agent 是**角色定义 + 能力集合 + 可选记忆** | 不是简单的代码，而是结构化的能力描述 |
| “构建 Agent 就是写 Prompt” | 构建 Agent 是**对话式发现**过程 | 不是一次性写 Prompt，而是多轮对话逐步明确 |
| “所有 Agent 都一样” | Agent 分为 **Stateless / Memory / Autonomous** 三种类型 | 不同类型有不同的文件结构和运行方式 |

## 第一段源码：`bmad-agent-builder` 的 Frontmatter

```typescript
// [templates/skills/bmad-agent-builder/SKILL.md 第 1—5 行](../../../../templates/skills/bmad-agent-builder/SKILL.md#L1)
---
name: bmad-agent-builder
description: Builds, edits or analyzes Agent Skills through conversational discovery. Use when the user requests to "Create an Agent", "Analyze an Agent" or "Edit an Agent".
originos-system: true
---
```

**关键字段**：

| 字段 | 值 | 含义 |
| --- | --- | --- |
| `name` | `bmad-agent-builder` | Skill 的唯一标识 |
| `description` | 构建、编辑或分析 Agent | 触发条件：用户说"Create an Agent"等 |
| `originos-system` | `true` | 系统内置 Skill，不可删除 |

**关键判断**：`bmad-agent-builder` 是**系统内置 Skill**，优先级最高，用户无法覆盖。

## 第二段源码：Agent 类型定义

```typescript
// [templates/skills/bmad-agent-builder/SKILL.md 第 38—40 行](../../../../templates/skills/bmad-agent-builder/SKILL.md#L38)
- **Stateless agent** — everything in SKILL.md, no memory, no First Breath. For focused experts handling isolated sessions.
- **Memory agent** — lean bootloader SKILL.md + sanctum (6 standard files + First Breath). For agents that build understanding over time.
- **Autonomous agent** — memory agent + PULSE. For agents that operate on their own between sessions.
```

**三种 Agent 类型**：

| 类型 | 特征 | 文件结构 | 适用场景 |
| --- | --- | --- | --- |
| **Stateless** | 无记忆，无 First Breath | 只有 `SKILL.md` | 单次会话的专家 |
| **Memory** | 有记忆，有 First Breath | `SKILL.md` + sanctum (6 文件) | 长期对话的助手 |
| **Autonomous** | 有记忆 + PULSE | Memory agent + `PULSE.md` | 自主运行的 Agent |

**关键判断**：Agent 类型不是预设的，而是在**第一阶段（Discover Intent）**通过对话确定的。

## 第三段源码：六阶段构建流程

```typescript
// [templates/skills/bmad-agent-builder/references/build-process.md 第 8—60 行](../../../../templates/skills/bmad-agent-builder/references/build-process.md#L8)
## Phase 1: Discover Intent

Understand their vision before diving into specifics. Ask what they want to build and encourage detail.

### Discovery questions

- **Who IS this agent?** What personality should come through?
- **How should they make the user feel?** What's the interaction model?
- **What's the core outcome?** What does this agent help the user accomplish?
- **What capabilities serve that core outcome?**
- **What's the one thing this agent must get right?**
- **If persistent memory:** What's worth remembering across sessions?

## Phase 2: Capabilities Strategy

// ...

## Phase 3: Requirements Gathering

// ...

## Phase 4: Drafting

// ...

## Phase 5: Building

// ...

## Phase 6: Summary

// ...
```

**六阶段流程**：

| 阶段 | 名称 | 目标 | 产出 |
| --- | --- | --- | --- |
| 1 | Discover Intent | 理解用户愿景 | Agent 类型、性格、核心目标 |
| 2 | Capabilities Strategy | 设计能力策略 | 能力清单、优先级 |
| 3 | Requirements Gathering | 收集详细需求 | 具体功能、约束条件 |
| 4 | Drafting | 起草 Agent 定义 | 初稿 `SKILL.md` |
| 5 | Building | 构建完整 Agent | 完整文件结构 |
| 6 | Summary | 总结和交付 | 交付物、使用说明 |

## 第四段源码：Agent 文件结构模板

```typescript
// [templates/skills/bmad-agent-builder/assets/SKILL-template.md 第 1—20 行](../../../../templates/skills/bmad-agent-builder/assets/SKILL-template.md#L1)
---
name: {{AGENT_NAME}}
description: {{AGENT_DESCRIPTION}}
---

# {{AGENT_NAME}}

## Overview

{{AGENT_OVERVIEW}}

## Role Definition

{{ROLE_DEFINITION}}

## Capabilities

{{CAPABILITIES}}

## Execution

{{EXECUTION}}
```

**模板机制**：

1. **占位符**：`{{AGENT_NAME}}`、`{{AGENT_DESCRIPTION}}` 等
2. **填充时机**：构建过程中，根据用户输入填充
3. **输出产物**：填充后的 `SKILL.md` 文件

**关键判断**：模板是“半成品”，需要被填充后才能使用。这保证了 Agent 定义的一致性和可维护性。

## 调用链：Agent 构建流程

```text
用户请求 "Create an Agent"
  → bmad-agent-builder 激活
    → Phase 1: Discover Intent（对话确定类型、性格、目标）
      → Phase 2: Capabilities Strategy（设计能力）
        → Phase 3: Requirements Gathering（收集需求）
          → Phase 4: Drafting（起草 SKILL.md）
            → Phase 5: Building（构建完整文件结构）
              → Phase 6: Summary（总结交付）
                → 输出到 {bmad_builder_output_folder}
```

## 失败路径：Agent 构建可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 用户意图不明确 | 构建出的 Agent 不符合预期 | Phase 1 对话不充分 |
| 能力过度设计 | Agent 过于复杂，难以维护 | Phase 2 没有遵循"outcome-driven"原则 |
| 模板占位符未填充 | 产物中有 `{{AGENT_NAME}}` | 构建过程出错 |
| 输出目录不存在 | 构建失败 | `bmad_builder_output_folder` 未配置 |
| Agent 类型选择错误 | Memory agent 被做成 Stateless | Phase 1 类型检测错误 |

## 测试证据

```bash
# 检查 bmad-agent-builder 的文件结构
ls -la templates/skills/bmad-agent-builder/

# 检查 assets 模板
cat templates/skills/bmad-agent-builder/assets/SKILL-template.md

# 检查 references 文档
ls templates/skills/bmad-agent-builder/references/

# 检查 scripts 工具
ls templates/skills/bmad-agent-builder/scripts/
```

**测试缺口**：
- 没有自动化测试验证六阶段构建流程的完整性
- 没有测试验证模板填充的正确性
- 没有测试验证 Agent 类型检测的准确性

## 小实验

**实验 1：分析 `bmad-agent-builder` 的文件结构**

| 目录/文件 | 数量 | 用途 |
| --- | --- | --- |
| `SKILL.md` | 1 | 入口定义 |
| `references/` | | 参考文档 |
| `assets/` | | 模板和配置 |
| `scripts/` | | 构建和评测工具 |

**思考**：为什么 `bmad-agent-builder` 有 52 个文件，而 `info-query` 只有 3 个？

**实验 2：对比三种 Agent 类型**

| 维度 | Stateless | Memory | Autonomous |
| --- | --- | --- | --- |
| 有记忆 | 否 | 是 | 是 |
| 有 First Breath | 否 | 是 | 是 |
| 有 PULSE | 否 | 否 | 是 |
| 文件数量 | 最少 | 中等 | 最多 |

**思考**：什么场景下应该选择 Autonomous agent？

## 口头验收

1. **`bmad-agent-builder` 的触发条件是什么？** 能说出用户说"Create an Agent"等时触发吗？
2. **Agent 有哪三种类型？** 能说出 Stateless、Memory、Autonomous 吗？
3. **六阶段构建流程是什么？** 能说出 Discover Intent → Capabilities Strategy → Requirements Gathering → Drafting → Building → Summary 吗？
4. **模板中的占位符是怎么被填充的？** 能说出根据用户输入在构建过程中填充吗？
5. **如果用户意图不明确，会发生什么？** 能说出构建出的 Agent 可能不符合预期吗？

## 本课结论

本课建立了 `bmad-agent-builder` 的完整认知：

- **Agent 构建是“对话设计”**：不是一次性写 Prompt，而是六阶段对话过程
- **三种 Agent 类型**：Stateless（无记忆）、Memory（有记忆）、Autonomous（自主运行）
- **六阶段流程**：Discover Intent → Capabilities Strategy → Requirements Gathering → Drafting → Building → Summary
- **模板机制**：占位符在构建过程中被填充
- **系统内置 Skill**：`originos-system: true`，不可删除

下一课（L12）将深入 `bmad-workflow-builder`，了解工作流构建的奥秘。
