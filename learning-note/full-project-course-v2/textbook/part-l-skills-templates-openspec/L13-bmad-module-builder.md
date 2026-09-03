# L13：`bmad-module-builder`——模块构建

> 本课问题：`bmad-module-builder` 是如何帮助用户构建模块的？模块与 Agent、工作流有什么关系？

## 小林的场景

小林已经用 `bmad-agent-builder` 创建了 Agent，用 `bmad-workflow-builder` 创建了工作流。现在她想把这些组织成一个**模块**——一个包含多个相关 Agent 和工作流的集合。

她想知道：

- 模块是什么？和 Agent、工作流有什么关系？
- 模块是怎么被构建的？
- 模块的文件结构是什么样的？

## 概念阶梯：模块不是“大杂烩”，而是“有组织的集合”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “模块就是一堆文件的集合” | 模块是**有组织的、可复用的功能单元** | 不是随意堆砌，而是有明确的结构和边界 |
| “模块和 Agent 是同一层级” | 模块**包含** Agent 和工作流 | 模块是容器，Agent 和工作流是内容 |
| “模块构建和 Agent 构建一样” | 模块构建更关注**组织结构和依赖关系** | Agent 构建关注角色定义，模块构建关注架构设计 |

## 第一段源码：`bmad-module-builder` 的 Frontmatter

```typescript
// [templates/skills/bmad-module-builder/SKILL.md 第 1—20 行](../../../../templates/skills/bmad-module-builder/SKILL.md#L1)
---
name: bmad-module-builder
description: Module builder for OriginOS. Creates structured modules containing agents, workflows, and skills.
originos-system: true
version: 1.0.0
type: COMPOSITE
author: OriginOS
tags:
  - module
  - builder
  - architecture
reads:
  - module
  - agent
  - workflow
writes:
  - module
  - agent
  - workflow
dependencies:
  - bmad-agent-builder
  - bmad-workflow-builder
---
```

**关键字段**：

| 字段 | 值 | 含义 |
| --- | --- | --- |
| `type` | `COMPOSITE` | 多阶段编排 |
| `dependencies` | `bmad-agent-builder`、`bmad-workflow-builder` | 依赖其他 Builder Skill |
| `reads` | `module`、`agent`、`workflow` | 读取模块、Agent、工作流 |
| `writes` | `module`、`agent`、`workflow` | 写入模块、Agent、工作流 |

**关键判断**：`bmad-module-builder` **依赖** `bmad-agent-builder` 和 `bmad-workflow-builder`，说明模块构建会调用它们。

## 第二段源码：模块的定义

```typescript
// [templates/skills/bmad-module-builder/SKILL.md 第 25—40 行](../../../../templates/skills/bmad-module-builder/SKILL.md#L25)
## Overview

A module is a self-contained, reusable unit of functionality within OriginOS. It contains:

- **Agents**: AI agents that perform specific tasks
- **Workflows**: Multi-step processes that orchestrate agents
- **Skills**: Reusable capabilities that agents and workflows can use
- **Configuration**: Module-level settings and dependencies

Modules follow the same outcome-driven principles as agents and workflows — they describe what functionality they provide, not how to implement it.
```

**模块的组成**：

| 组成部分 | 说明 | 示例 |
| --- | --- | --- |
| **Agents** | 执行特定任务的 AI Agent | 代码审查助手、文档生成器 |
| **Workflows** | 编排多个 Agent 的多步骤流程 | CI/CD 流程、审批流程 |
| **Skills** | 可复用的能力 | 查询、分析、生成 |
| **Configuration** | 模块级设置和依赖 | 数据库连接、API 密钥 |

## 第三段源码：模块的文件结构

```typescript
// [templates/skills/bmad-module-builder/assets/module-template.md 第 1—30 行](../../../../templates/skills/bmad-module-builder/assets/module-template.md#L1)
# {{MODULE_NAME}}

## Overview

{{MODULE_OVERVIEW}}

## Architecture

{{MODULE_ARCHITECTURE}}

## Agents

{{AGENTS}}

## Workflows

{{WORKFLOWS}}

## Skills

{{SKILLS}}

## Configuration

{{CONFIGURATION}}
```

**模块模板**：

1. **Overview**：模块概述
2. **Architecture**：架构设计
3. **Agents**：包含的 Agent
4. **Workflows**：包含的工作流
5. **Skills**：包含的 Skill
6. **Configuration**：配置

## 第四段源码：模块与 Agent、工作流的关系

```
Module（模块）
  ├── Agents（Agent 集合）
  │   ├── Agent A
  │   └── Agent B
  ├── Workflows（工作流集合）
  │   ├── Workflow X
  │   └── Workflow Y
  ├── Skills（Skill 集合）
  │   ├── Skill 1
  │   └── Skill 2
  └── Configuration（配置）
```

**关系总结**：

| 维度 | 模块 | Agent | 工作流 |
| --- | --- | --- | --- |
| **层级** | 最高 | 中间 | 中间 |
| **包含关系** | 包含 Agent 和工作流 | 被模块包含 | 被模块包含 |
| **关注点** | 组织架构 | 角色定义 | 流程编排 |
| **构建工具** | `bmad-module-builder` | `bmad-agent-builder` | `bmad-workflow-builder` |

## 调用链：模块构建流程

```text
用户请求 "create a module"
  → bmad-module-builder 激活
    → Phase 1: 定义模块范围和目标
      → Phase 2: 设计模块架构
        → Phase 3: 创建 Agent（调用 bmad-agent-builder）
          → Phase 4: 创建工作流（调用 bmad-workflow-builder）
            → Phase 5: 定义配置和依赖
              → Phase 6: 生成模块文件结构
                → 输出到 {module_output_folder}
```

## 失败路径：模块构建可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 依赖的 Builder 不可用 | 模块构建失败 | `bmad-agent-builder` 或 `bmad-workflow-builder` 未注册 |
| Agent 和工作流重复 | 模块臃肿 | 没有合理拆分模块边界 |
| 配置冲突 | 运行时错误 | 模块级配置和组件级配置冲突 |
| 循环依赖 | 无法加载 | 模块 A 依赖模块 B，模块 B 依赖模块 A |
| 模块边界模糊 | 难以维护 | 模块职责不清晰 |

## 测试证据

```bash
# 检查 bmad-module-builder 的文件结构
ls -la templates/skills/bmad-module-builder/

# 检查依赖的 Builder
ls templates/skills/bmad-agent-builder/
ls templates/skills/bmad-workflow-builder/

# 检查模块模板
ls templates/skills/bmad-module-builder/assets/
```

## 小实验

**实验 1：分析模块、Agent、工作流的关系**

```
Module: "代码审查模块"
  ├── Agent: "代码审查助手"
  ├── Agent: "安全扫描助手"
  ├── Workflow: "完整审查流程"
  │   ├── Step 1: 静态分析（调用"代码审查助手"）
  │   ├── Step 2: 安全扫描（调用"安全扫描助手"）
  │   └── Step 3: 生成报告
  └── Skill: "查询代码规范"
```

**思考**：模块的边界应该怎么划分？

**实验 2：对比三种 Builder**

| 维度 | `bmad-agent-builder` | `bmad-workflow-builder` | `bmad-module-builder` |
| --- | --- | --- | --- |
| 构建目标 | Agent | 工作流 | 模块 |
| 关注点 | 角色定义 | 流程编排 | 组织架构 |
| 依赖其他 Builder | 否 | 否 | 是 |
| 输出产物 | SKILL.md + sanctum | workflow 定义 | 模块文件结构 |

## 口头验收

1. **模块和 Agent、工作流的关系是什么？** 能说出模块包含 Agent 和工作流吗？
2. **`bmad-module-builder` 依赖哪些 Builder？** 能说出 `bmad-agent-builder` 和 `bmad-workflow-builder` 吗？
3. **模块的文件结构包含哪些部分？** 能说出 Overview、Architecture、Agents、Workflows、Skills、Configuration 吗？
4. **模块构建失败的可能原因有哪些？** 能说出依赖不可用、重复、配置冲突、循环依赖吗？
5. **模块的边界应该怎么划分？** 能说出按职责、按复用性、按依赖关系划分吗？

## 本课结论

本课建立了 `bmad-module-builder` 的完整认知：

- **模块是容器**：包含 Agent、工作流、Skill 和配置
- **模块构建依赖其他 Builder**：调用 `bmad-agent-builder` 和 `bmad-workflow-builder`
- **模块关注组织架构**：不是角色定义，也不是流程编排
- **模块边界要清晰**：按职责、复用性、依赖关系划分
- **模块是最高层级**：Agent 和工作流被模块包含

下一课（L14）将深入 `bmad-brainstorming`，了解创意发散的机制。
