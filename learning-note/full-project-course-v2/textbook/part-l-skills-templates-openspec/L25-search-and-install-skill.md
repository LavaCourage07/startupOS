# L25：`search-and-install-skill`——搜索安装 Skill

> 本课问题：OriginOS 如何搜索和安装 Skill？安装后的 Skill 是怎么被管理的？

## 小林的场景

小林创建了几个 Skill，她想看看系统里有哪些可用的 Skill，还想安装一个别人分享的 Skill。

她想知道：

- 怎么搜索 Skill？
- 怎么安装 Skill？
- 安装后的 Skill 是怎么被管理的？

## 概念阶梯：安装不是“复制文件”，而是“注册到系统”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “安装就是复制文件” | 安装是**注册到 Registry 并配置环境** | 不是简单的文件复制 |
| “搜索就是文件名匹配” | 搜索是**基于标签、描述、元数据的全文检索** | 不是简单的文件名匹配 |
| “安装后就能用” | 安装后还需要**配置和激活** | 不是立即可用 |

## 第一段源码：`search-and-install-skill` 的 Frontmatter

```typescript
// [templates/skills/search-and-install-skill/SKILL.md 第 1—15 行](../../../../templates/skills/search-and-install-skill/SKILL.md#L1)
---
name: search-and-install-skill
description: Search for and install skills. Use when the user wants to find or install a skill.
originos-system: true
version: 1.0.0
type: SIMPLE
tags:
  - search
  - install
  - skill
reads:
  - skill
writes:
  - skill
---
```

**关键字段**：

| 字段 | 值 | 含义 |
| --- | --- | --- |
| `type` | `SIMPLE` | 单一用途 |
| `reads` | `skill` | 读取 Skill 信息 |
| `writes` | `skill` | 写入 Skill 定义 |

## 第二段源码：搜索机制

```typescript
// [templates/skills/search-and-install-skill/SKILL.md 第 20—35 行](../../../../templates/skills/search-and-install-skill/SKILL.md#L20)
## Search

Search skills by:
- **Name**: Exact or partial match on skill name
- **Tags**: Filter by tags (e.g., "agent", "workflow", "review")
- **Description**: Full-text search in skill descriptions
- **Author**: Filter by author
- **Type**: SIMPLE or COMPOSITE

Results are ranked by relevance.
```

**搜索维度**：

| 维度 | 说明 | 示例 |
| --- | --- | --- |
| **Name** | 名称匹配 | "agent" 匹配 "bmad-agent-builder" |
| **Tags** | 标签过滤 | "agent" 标签 |
| **Description** | 全文检索 | "build agent" |
| **Author** | 作者过滤 | "OriginOS" |
| **Type** | 类型过滤 | `SIMPLE` 或 `COMPOSITE` |

## 第三段源码：安装机制

```typescript
// [templates/skills/search-and-install-skill/SKILL.md 第 40—55 行](../../../../templates/skills/search-and-install-skill/SKILL.md#L40)
## Install

Installation process:

1. **Download**: Fetch skill files from source
2. **Validate**: Check skill integrity and dependencies
3. **Register**: Add to skill registry
4. **Configure**: Set up environment and dependencies
5. **Activate**: Make available for use

Installed skills are stored in `data/skills/`.
```

**安装流程**：

| 步骤 | 名称 | 说明 |
| --- | --- | --- |
| 1 | Download | 从源下载 Skill 文件 |
| 2 | Validate | 检查完整性和依赖 |
| 3 | Register | 注册到 Registry |
| 4 | Configure | 配置环境和依赖 |
| 5 | Activate | 激活，使其可用 |

## 第四段源码：安装后的管理

```typescript
// [templates/skills/search-and-install-skill/SKILL.md 第 60—75 行](../../../../templates/skills/search-and-install-skill/SKILL.md#L60)
## Management

After installation:

- **List**: Show all installed skills
- **Update**: Update to latest version
- **Uninstall**: Remove from system
- **Enable/Disable**: Toggle availability
- **Configure**: Adjust settings

Installed skills are tracked in the skill registry.
```

**管理功能**：

| 功能 | 说明 |
| --- | --- |
| **List** | 列出所有已安装 Skill |
| **Update** | 更新到最新版本 |
| **Uninstall** | 从系统移除 |
| **Enable/Disable** | 启用/禁用 |
| **Configure** | 调整设置 |

## 调用链：搜索安装流程

```text
用户说 "Search for agent skills"
  → search-and-install-skill 激活
    → 搜索 Skill（按名称、标签、描述）
      → 显示结果
        → 用户选择要安装的 Skill
          → 下载 Skill 文件
            → 验证完整性
              → 注册到 Registry
                → 配置环境
                  → 激活
                    → 安装完成
```

## 失败路径：搜索安装可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 搜索无结果 | 找不到想要的 Skill | 关键词不匹配 |
| 下载失败 | 无法获取 Skill 文件 | 网络问题或源不可用 |
| 验证失败 | 安装失败 | 文件损坏或依赖缺失 |
| 注册失败 | 系统不认识新 Skill | Registry 错误 |
| 配置失败 | 无法激活 | 环境不满足 |
| 版本冲突 | 安装后行为异常 | 和已有 Skill 版本冲突 |

## 测试证据

```bash
# 检查 search-and-install-skill 的文件结构
ls -la templates/skills/search-and-install-skill/

# 搜索 Skill
grep -r "agent" templates/skills/*/SKILL.md | head -5

# 检查已安装的 Skill
ls data/skills/ 2>/dev/null || echo "No user skills yet"
```

## 小实验

**实验 1：分析搜索维度**

| 维度 | 优点 | 缺点 |
| --- | --- | --- |
| Name | 精确 | 需要知道名称 |
| Tags | 分类清晰 | 标签可能不全 |
| Description | 灵活 | 可能返回过多 |
| Author | 可信度高 | 限制选择 |
| Type | 快速过滤 | 粒度粗 |

**实验 2：设计安装流程**

假设用户要安装一个第三方 Skill，请回答：

1. 安装前需要检查什么？
2. 安装后需要验证什么？
3. 如果安装失败，怎么排查？

## 口头验收

1. **搜索 Skill 有哪些维度？** 能说出 Name、Tags、Description、Author、Type 吗？
2. **安装流程是什么？** 能说出 Download → Validate → Register → Configure → Activate 吗？
3. **安装后的 Skill 怎么管理？** 能说出 List、Update、Uninstall、Enable/Disable、Configure 吗？
4. **安装失败的可能原因有哪些？** 能说出下载失败、验证失败、注册失败、配置失败吗？
5. **安装的 Skill 存储在哪里？** 能说出 `data/skills/` 吗？

## 本课结论

本课建立了 `search-and-install-skill` 的完整认知：

- **搜索是多维度的**：Name、Tags、Description、Author、Type
- **安装是注册过程**：不是简单的文件复制
- **安装后需要管理**：List、Update、Uninstall、Enable/Disable
- **安装有风险**：下载失败、验证失败、注册失败、配置失败
- **存储在 `data/skills/`**：用户安装的 Skill 和系统内置分开

## Unit 3 小结

本单元建立了 Meta-skills 的完整认知：

- **Meta-skills 是"创建 Skill 的 Skill"**：让系统自我进化
- **`skill-creator-app`**：最复杂的 Meta-skill，创建、迭代、优化 Skill
- **`role-agent-creator`**：基于角色模板创建 Agent
- **`agent-creator`**：通用 Agent 创建
- **`project-skill-creator`**：项目专属 Skill 创建
- **`search-and-install-skill`**：搜索和安装 Skill

下一单元（Unit 4）将深入 Project Interview Templates。
