# L24：`project-skill-creator`——项目 Skill 创建

> 本课问题：`project-skill-creator` 是如何为特定项目创建专属 Skill 的？它和 `skill-creator-app` 有什么区别？

## 小林的场景

小林正在开发一个电商项目，她想创建一个专门处理"订单管理"的 Skill。她发现 `project-skill-creator` 可以为特定项目创建专属 Skill。

她想知道：

- 项目专属 Skill 和通用 Skill 有什么区别？
- `project-skill-creator` 是怎么工作的？
- 项目 Skill 的生命周期是什么样的？

## 概念阶梯：项目 Skill 不是“重复造轮子”，而是“上下文感知”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “项目 Skill 就是通用 Skill 的副本” | 项目 Skill 是**基于项目上下文定制的** | 不是副本，而是有项目特定的知识和约束 |
| “项目 Skill 只能用于一个项目” | 项目 Skill 是**为项目优化的**，但可以复用 | 不是完全不能复用，而是优化了特定场景 |
| “项目 Skill 和通用 Skill 冲突” | 项目 Skill 和通用 Skill 是**互补**的 | 不是冲突，而是不同粒度 |

## 第一段源码：`project-skill-creator` 的 Frontmatter

```typescript
// [templates/skills/project-skill-creator/SKILL.md 第 1—20 行](../../../../templates/skills/project-skill-creator/SKILL.md#L1)
---
name: project-skill-creator
description: Create project-specific skills. Use when the user wants to create a skill tailored to a specific project.
originos-system: true
version: 1.0.0
type: COMPOSITE
author: OriginOS
outputDir: data/
tags:
  - skill
  - creator
  - project
reads:
  - project
writes:
  - skill
---
```

**关键字段**：

| 字段 | 值 | 含义 |
| --- | --- | --- |
| `description` | "project-specific skills" | 项目专属 Skill |
| `reads` | `project` | 读取项目上下文 |
| `writes` | `skill` | 写入 Skill 定义 |

**关键判断**：`project-skill-creator` 会**读取项目上下文**，这是它和 `skill-creator-app` 的最大区别。

## 第二段源码：项目 Skill 的特点

```typescript
// [templates/skills/project-skill-creator/SKILL.md 第 25—40 行](../../../../templates/skills/project-skill-creator/SKILL.md#L25)
## Project-Specific Features

1. **Project Context Awareness**
   - Reads project configuration
   - Understands project structure
   - Knows project conventions

2. **Domain Knowledge**
   - Incorporates project-specific terminology
   - Understands project-specific workflows
   - Knows project-specific constraints

3. **Integration Points**
   - Connects to project-specific APIs
   - Uses project-specific data formats
   - Follows project-specific conventions
```

**项目 Skill 的特点**：

| 特点 | 说明 | 示例 |
| --- | --- | --- |
| **项目上下文感知** | 读取项目配置 | 知道项目使用什么技术栈 |
| **领域知识** | 理解项目术语 | 知道"订单"在项目中指什么 |
| **集成点** | 连接项目 API | 调用项目的内部接口 |

## 第三段源码：`project-skill-creator` 和 `skill-creator-app` 的对比

```typescript
// 对比表：

| 维度 | skill-creator-app | project-skill-creator |
| --- | --- | --- |
| 目标 | 通用 Skill | 项目专属 Skill |
| 上下文 | 无 | 有（项目配置） |
| 复杂度 | 高（22 文件） | 高（27 文件） |
| 输出位置 | data/skills/ | data/projects/{id}/skills/ |
| 复用性 | 高 | 中（可复用但为项目优化） |
| 生命周期 | 独立 | 与项目绑定 |
```

**两种 Skill 的适用场景**：

| 场景 | 选择哪个？ | 原因 |
| --- | --- | --- |
| 创建一个"天气预报"Skill | `skill-creator-app` | 通用，不依赖项目 |
| 创建一个"订单管理"Skill | `project-skill-creator` | 需要项目上下文 |
| 创建一个"用户认证"Skill | `project-skill-creator` | 需要项目特定的用户模型 |
| 创建一个"翻译"Skill | `skill-creator-app` | 通用，不依赖项目 |

## 第四段源码：项目 Skill 的生命周期

```typescript
// [templates/skills/project-skill-creator/SKILL.md 第 45—60 行](../../../../templates/skills/project-skill-creator/SKILL.md#L45)
## Lifecycle

1. **Creation**
   - Triggered by user request
   - Reads project context
   - Generates skill tailored to project

2. **Integration**
   - Registered in project skill registry
   - Connected to project APIs
   - Configured for project environment

3. **Usage**
   - Available within project context
   - Can be called by project agents
   - Follows project conventions

4. **Maintenance**
   - Updated with project changes
   - Versioned with project releases
   - Deprecated when no longer needed
```

**生命周期**：

| 阶段 | 名称 | 说明 |
| --- | --- | --- |
| 1 | Creation | 用户触发，读取项目上下文，生成 Skill |
| 2 | Integration | 注册到项目 Registry，连接 API |
| 3 | Usage | 在项目上下文中使用 |
| 4 | Maintenance | 随项目更新，版本管理 |

## 调用链：项目 Skill 创建流程

```text
用户在项目中请求 "Create an order management skill"
  → project-skill-creator 激活
    → 读取项目上下文（配置、结构、约定）
      → 分析项目需求
        → 生成项目专属 Skill
          → 注册到项目 Registry
            → 连接项目 API
              → 配置项目环境
                → 输出到 data/projects/{id}/skills/
```

## 失败路径：项目 Skill 创建可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 项目上下文缺失 | 无法生成专属 Skill | 项目配置未初始化 |
| 项目结构变化 | Skill 失效 | 项目重构后未更新 Skill |
| API 变更 | Skill 调用失败 | 项目 API 变更后未同步 |
| 权限不足 | 无法读取项目上下文 | 用户权限不够 |
| 生命周期管理不当 | 过期 Skill 仍在运行 | 未正确废弃 |

## 测试证据

```bash
# 检查 project-skill-creator 的文件结构
ls -la templates/skills/project-skill-creator/

# 检查项目 Skill 的输出位置
ls data/projects/ 2>/dev/null || echo "No projects yet"

# 对比两种 Skill 创建器
ls templates/skills/skill-creator-app/ | wc -l
ls templates/skills/project-skill-creator/ | wc -l
```

## 小实验

**实验 1：对比 `skill-creator-app` 和 `project-skill-creator`**

| 维度 | `skill-creator-app` | `project-skill-creator` |
| --- | --- | --- |
| 目标 | 通用 Skill | 项目专属 Skill |
| 上下文 | 无 | 有 |
| 文件数量 | 22 | 27 |
| 输出位置 | data/skills/ | data/projects/{id}/skills/ |
| 复用性 | 高 | 中 |

**实验 2：选择合适的创建器**

| 场景 | 选择哪个？ | 原因 |
| --- | --- | --- |
| 创建一个通用的"翻译"Skill | | |
| 创建一个"订单管理"Skill（电商项目） | | |
| 创建一个"用户认证"Skill（SaaS 项目） | | |
| 创建一个"天气查询"Skill | | |

## 口头验收

1. **`project-skill-creator` 和 `skill-creator-app` 的区别是什么？** 能说出前者有项目上下文，后者通用吗？
2. **项目 Skill 的生命周期是什么？** 能说出 Creation → Integration → Usage → Maintenance 吗？
3. **项目 Skill 输出到哪里？** 能说出 `data/projects/{id}/skills/` 吗？
4. **如果项目结构变化，会发生什么？** 能说出 Skill 可能失效吗？
5. **什么时候应该使用 `project-skill-creator`？** 能说出需要项目上下文时吗？

## 本课结论

本课建立了 `project-skill-creator` 的完整认知：

- **项目 Skill 是上下文感知的**：读取项目配置、结构、约定
- **和 `skill-creator-app` 的区别**：有项目上下文，输出到项目目录
- **生命周期**：Creation → Integration → Usage → Maintenance
- **风险**：项目变化可能导致 Skill 失效
- **适用场景**：需要项目特定知识的 Skill

下一课（L25）将深入 `search-and-install-skill`，了解 Skill 的搜索和安装。
