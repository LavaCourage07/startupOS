# L16：`bmad-bmb-setup`——环境初始化

> 本课问题：`bmad-bmb-setup` 是如何配置 BMAD 构建环境的？为什么需要单独的配置 Skill？

## 小林的场景

小林第一次使用 BMAD 框架，发现 `bmad-agent-builder` 需要读取 `_bmad/config.yaml` 来获取配置。但她不知道这个文件应该放在哪里、应该包含什么内容。

她想知道：

- BMAD 的配置是怎么管理的？
- `bmad-bmb-setup` 做了什么？
- 配置文件的优先级是什么？

## 概念阶梯：配置不是“硬编码”，而是“分层管理”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “配置就是写死的路径” | 配置是**分层、可覆盖的设置** | 不是单一的，而是有多层优先级 |
| “配置一次就够了” | 配置是**动态的**，可以更新 | 不是静态的，可以运行时调整 |
| “配置只有系统级” | 配置分为**系统级、项目级、用户级** | 不是单一的，而是多层级 |

## 第一段源码：`bmad-bmb-setup` 的 Frontmatter

```typescript
// [templates/skills/bmad-bmb-setup/SKILL.md 第 1—15 行](../../../../templates/skills/bmad-bmb-setup/SKILL.md#L1)
---
name: bmad-bmb-setup
description: Initialize and configure the BMAD build environment. Use when setting up a new project or updating BMAD configuration.
originos-system: true
version: 1.0.0
type: SIMPLE
tags:
  - setup
  - configuration
  - bmad
---
```

**关键特征**：

1. **触发条件**：设置新项目或更新 BMAD 配置
2. **类型**：`SIMPLE`（单一用途）
3. **关注点**：环境初始化

## 第二段源码：配置文件的层级

```typescript
// [templates/skills/bmad-bmb-setup/SKILL.md 第 20—35 行](../../../../templates/skills/bmad-bmb-setup/SKILL.md#L20)
## Configuration Hierarchy

BMAD uses a layered configuration system:

1. **System defaults** (lowest priority)
   - Built into the skill
   - Can be overridden by project or user config

2. **Project config** (`{project-root}/_bmad/config.yaml`)
   - Project-wide settings
   - Shared by all team members

3. **User config** (`{project-root}/_bmad/config.user.yaml`)
   - Personal preferences
   - Not committed to version control

4. **Legacy config** (`{project-root}/_bmad/bmb/config.yaml`)
   - Backward compatibility
   - Will be deprecated in future versions
```

**配置层级**：

| 层级 | 文件 | 优先级 | 说明 |
| --- | --- | --- | --- |
| 1 | 系统默认值 | 最低 | 内置于 Skill |
| 2 | `config.yaml` | 中 | 项目级配置 |
| 3 | `config.user.yaml` | 高 | 用户级配置 |
| 4 | `bmb/config.yaml` | 兼容 | 旧版配置 |

**关键判断**：配置是**分层覆盖**的，用户配置可以覆盖项目配置，项目配置可以覆盖系统默认值。

## 第三段源码：配置项的定义

```typescript
// [templates/skills/bmad-bmb-setup/assets/config-template.yaml 第 1—25 行](../../../../templates/skills/bmad-bmb-setup/assets/config-template.yaml#L1)
# BMAD Configuration Template

# User identity
user_name: "{{USER_NAME}}"

# Language settings
communication_language: "{{COMMUNICATION_LANGUAGE}}"
document_output_language: "{{DOCUMENT_OUTPUT_LANGUAGE}}"

# Output directories
bmad_builder_output_folder: "{{PROJECT_ROOT}}/skills"
bmad_builder_reports: "{{PROJECT_ROOT}}/skills/reports"

# Builder settings
builder:
  default_agent_type: "memory"
  max_capabilities: 10
  require_first_breath: true

# Quality settings
quality:
  run_lint: true
  run_scan: true
  generate_report: true
```

**配置项分类**：

| 分类 | 配置项 | 说明 |
| --- | --- | --- |
| **用户身份** | `user_name` | 用户名称 |
| **语言设置** | `communication_language`、`document_output_language` | 沟通语言和文档语言 |
| **输出目录** | `bmad_builder_output_folder`、`bmad_builder_reports` | 构建输出和报告目录 |
| **构建器设置** | `default_agent_type`、`max_capabilities` | Agent 类型、最大能力数 |
| **质量设置** | `run_lint`、`run_scan`、`generate_report` | 是否运行检查、扫描、生成报告 |

## 第四段源码：配置的加载顺序

```typescript
// [templates/skills/bmad-bmb-setup/SKILL.md 第 40—55 行](../../../../templates/skills/bmad-bmb-setup/SKILL.md#L40)
## Configuration Loading

The configuration is loaded in the following order:

1. Load system defaults
2. Load project config (`config.yaml`)
3. Load user config (`config.user.yaml`)
4. Load legacy config (`bmb/config.yaml`) — if others don't exist
5. Merge with priority: user > project > system

If no config exists, the setup skill will guide the user through creating one.
```

**加载顺序**：

1. 加载系统默认值
2. 加载项目配置
3. 加载用户配置
4. 加载旧版配置（兼容）
5. 合并（优先级：用户 > 项目 > 系统）

## 调用链：环境初始化流程

```text
用户首次使用 BMAD
  → bmad-bmb-setup 激活
    → 检查现有配置
      → 如果存在，加载并显示
      → 如果不存在，引导用户创建
        → 询问用户名称
        → 询问语言偏好
        → 询问输出目录
        → 生成 config.yaml
          → 写入项目目录
            → 配置生效
```

## 失败路径：配置可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 配置文件格式错误 | 无法加载 | YAML 语法错误 |
| 配置项缺失 | 使用默认值 | 用户未填写 |
| 路径不存在 | 构建失败 | 输出目录未创建 |
| 权限不足 | 无法写入 | 文件系统权限 |
| 配置冲突 | 行为异常 | 项目配置和用户配置冲突 |

## 测试证据

```bash
# 检查 bmad-bmb-setup 的文件结构
ls -la templates/skills/bmad-bmb-setup/

# 检查配置模板
cat templates/skills/bmad-bmb-setup/assets/config-template.yaml

# 检查脚本工具
ls templates/skills/bmad-bmb-setup/scripts/
```

## 小实验

**实验 1：分析配置层级**

| 层级 | 文件 | 优先级 | 覆盖范围 |
| --- | --- | --- | --- |
| 系统默认 | 内置 | 最低 | 所有项目 |
| 项目配置 | `config.yaml` | 中 | 当前项目 |
| 用户配置 | `config.user.yaml` | 高 | 当前用户 |
| 旧版配置 | `bmb/config.yaml` | 兼容 | 旧项目 |

**实验 2：设计一个配置覆盖场景**

假设：
- 系统默认：`user_name = "User"`
- 项目配置：`user_name = "ProjectTeam"`
- 用户配置：`user_name = "Alice"`

**问题**：最终 `user_name` 是什么？

**答案**：`"Alice"`（用户配置优先级最高）

## 口头验收

1. **BMAD 的配置有几层？** 能说出系统默认、项目配置、用户配置、旧版配置吗？
2. **配置的优先级是什么？** 能说出用户 > 项目 > 系统吗？
3. **`bmad-bmb-setup` 做了什么？** 能说出初始化配置、引导用户创建、生成 config.yaml 吗？
4. **如果配置文件格式错误，会发生什么？** 能说出无法加载，可能使用默认值吗？
5. **为什么需要单独的配置 Skill？** 能说出配置管理复杂，需要专门处理吗？

## 本课结论

本课建立了 `bmad-bmb-setup` 的完整认知：

- **配置是分层管理的**：系统默认、项目配置、用户配置、旧版配置
- **优先级**：用户 > 项目 > 系统
- **`bmad-bmb-setup` 引导用户创建配置**：不是自动生成的
- **配置项分类**：用户身份、语言、输出目录、构建器设置、质量设置
- **配置管理复杂**：需要专门的 Skill 来处理

下一课（L17）将深入 `bmad-editorial-review-*`，了解质量审查的机制。
