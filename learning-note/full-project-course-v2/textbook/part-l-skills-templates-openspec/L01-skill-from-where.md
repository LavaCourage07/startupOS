# L01：小林想做一个“旅行规划助手”——Skill 从哪来？

> 本课问题：OriginOS 里的 Skill 到底长什么样？它是代码、配置、还是文档？一个“旅行规划助手”的 Skill 需要包含哪些东西？

## 小林的场景

小林想在 OriginOS 里做一个“旅行规划助手”。她打开项目，看到系统里已经有不少 Skill，但她不知道：

- 这些 Skill 放在哪里？是代码文件还是配置？
- 一个 Skill 最少需要包含什么？
- Skill 的“能力”是怎么被 Agent 知道的？
- 她自己能不能写一个？

本课先不讨论 Skill 怎么被加载到运行时（那是 L07–L08 的事），而是聚焦于**Skill 的定义本身**：拿到一个 Skill 文件，你能看懂它是什么、能做什么、有哪些边界。

## 概念阶梯：四样东西，容易混为一谈

| 名称 | 通俗解释 | 小林的例子 | 不能把它误认为 |
| --- | --- | --- | --- |
| **Skill** | 一个“能力包”，告诉 Agent 它能做什么、怎么做 | “旅行规划助手”能推荐路线、订酒店、算预算 | 不是一段可执行的代码，也不是一个独立运行的程序 |
| **SKILL.md** | Skill 的定义文件，用 Markdown 写成，包含元数据和指令 | `travel-planner/SKILL.md` 这个文件 | 不是运行时直接读取的配置，而是被解析后注入 Prompt 的素材 |
| **Frontmatter** | 文件头部的 YAML 元数据，描述 Skill 的名字、描述、版本等 | `name: travel-planner`、`version: 1.0.0` | 不是 Skill 的全部，只是“名片信息”；真正的能力在 body 里 |
| **Body** | Frontmatter 之后的 Markdown 正文，描述 Skill 的角色、流程、输出格式 | “你是旅行规划助手，擅长……” | 不是普通文档，它有结构化约定（## Overview、## Role Definition 等） |

## 第一段源码：最简单的 Skill 长什么样

我们先看一个最简化的 Skill 定义——`templates/skills/info-query/SKILL.md`：

```typescript
// [templates/skills/info-query/SKILL.md 第 1—19 行](../../../../templates/skills/info-query/SKILL.md#L1)
---
name: info-query
description: 信息查询技能，帮助用户通过对话式界面查询项目相关信息
originos-system: true
version: 1.0.0
type: SIMPLE
author: OriginOS
tags:
  - query
  - search
  - information
reads:
  - ontology
  - project
  - task
writes: []
prerequisites: []
dependencies: []
---
```

**这是 Frontmatter。** 它用 YAML 语法写在文件最开头，被 `---` 包裹。字段含义：

| 字段 | 含义 | 小林的例子 |
| --- | --- | --- |
| `name` | Skill 的唯一标识符 | `travel-planner` |
| `description` | 一句话描述 Skill 能做什么 | “帮助用户规划旅行路线和预算” |
| `originos-system` | 是否为系统内置 Skill | `true` 表示是系统自带的 |
| `version` | 语义化版本号 | `1.0.0` |
| `type` | Skill 类型 | `SIMPLE` 表示简单查询型；还有更复杂的类型 |
| `author` | 作者 | `OriginOS` 或用户自己 |
| `tags` | 标签列表，用于分类和搜索 | `travel`、`planning` |
| `reads` | 这个 Skill 会读取哪些数据 | `ontology`、`project` |
| `writes` | 这个 Skill 会写入哪些数据 | `[]` 表示只读不写 |
| `prerequisites` | 前置条件 | `[]` 表示无前置 |
| `dependencies` | 依赖的其他 Skill | `[]` 表示无依赖 |

**关键判断**：Frontmatter 是 Skill 的“名片”，但名片不等于人。Agent 不会只看 frontmatter 就执行 Skill，它还需要 body 里的具体指令。

## 第二段源码：Skill 的 Body 里有什么

继续看 `info-query` 的 body（节选）：

```typescript
// [templates/skills/info-query/SKILL.md 第 21—72 行](../../../../templates/skills/info-query/SKILL.md#L21)
# 信息查询

本技能帮助你通过对话式界面查询项目相关信息。

## 功能

- 查询项目详情
- 查询任务信息
- 查询团队成员信息
- 查询目标进度
- 关系查询（如查询某个人员的所有任务）
- 统计信息（如任务数量、状态分布等）

## 使用方式

你可以用自然语言提出问题，例如：

- "这个项目有多少个任务？"
- "显示张三负责的所有任务"
- "项目的目标是什么？"

## 执行指导

处理用户查询时：

1. **理解查询意图**：分析用户的自然语言输入，确定查询类型

2. **识别查询类型**：
   - 数量统计：包含"多少"、"数量"、"几个"、"how many"等关键词
   - 状态查询：包含"进行中"、"完成"、"待处理"等关键词
   - 人员相关：包含"张三"、"人员"、"成员"等关键词
   - ...

3. **提取参数**：
   - 实体类型：匹配"项目"、"任务"、"人员"等
   - 人员姓名：匹配中文姓名模式或英文名
   - 状态关键词：...

4. **提供流式响应**：
   - 首先确认查询意图
   - 逐步显示查询进度
   - 提供查询结果摘要
   - 展示详细信息
```

**Body 的结构化约定**：

虽然 body 是 Markdown，但它不是普通文档。OriginOS 对 body 有约定俗成的结构：

| Section | 作用 | 是否必须 |
| --- | --- | --- |
| `# 标题` | Skill 的显示名称 | 是 |
| `## Overview` | 概述 Skill 的目标和使用场景 | 推荐 |
| `## Role Definition` | 定义 Skill 扮演的角色、能力、风格 | 推荐 |
| `## 功能` / `## Capabilities` | 列出 Skill 能做什么 | 推荐 |
| `## 使用方式` / `## Usage` | 给出使用示例 | 推荐 |
| `## 执行指导` / `## Execution` | 详细的执行步骤和规则 | 复杂 Skill 必须 |
| `## 响应示例` / `## Examples` | 给出输入输出示例 | 推荐 |

**关键判断**：Body 里的内容最终会被解析成字符串，注入到 Agent 的 System Prompt 中。所以 body 不是“给人类看的文档”，而是“给模型看的指令”。

## 第三段源码：一个更复杂的 Skill——project-initialization

`info-query` 是简单型 Skill。我们再看一个复杂型的——`project-initialization`：

```typescript
// [templates/skills/project-initialization/SKILL.md 第 1—5 行](../../../../templates/skills/project-initialization/SKILL.md#L1)
---
name: project-initialization
description: OriginOS 项目访谈 Skill - 通过对话式引导完成项目业务建模。采用"领域发现"和"业务精炼"两阶段模式，从模糊想法到严谨的业务模型。
originos-system: true
---
```

它的 frontmatter 更简洁，但 body 非常长（700+ 行）。核心结构：

```typescript
// [templates/skills/project-initialization/SKILL.md 第 7—16 行](../../../../templates/skills/project-initialization/SKILL.md#L7)
# OriginOS 项目访谈 Skill

## Overview

这是一个用于 OriginOS 项目启动的访谈 Skill，采用**两阶段对话式引导**来完成业务建模：

1. **Phase 1: 领域发现 (Discovery)** - 引导用户描述具体业务场景，识别行业领域
2. **Phase 2: 业务精炼 (Refinement)** - 结构化追问填补缺口，检测矛盾，完善业务规则

## Role Definition

你是 OriginOS 项目访谈助手（称为"Oracle"），协助用户从模糊的想法出发，逐步构建完整的业务领域模型。

### 核心能力

- 🎯 通过开放式问题引导用户思考
- 🏭 识别行业并提供行业背景知识
- 💬 使用 AskUserQuestion 工具进行互动式对话
- ...
```

**对比**：`info-query` 和 `project-initialization` 的区别

| 维度 | info-query | project-initialization |
| --- | --- | --- |
| Frontmatter 复杂度 | 字段多（type、tags、reads/writes） | 字段少（只有 name、description、originos-system） |
| Body 长度 | 短（~125 行） | 长（~700 行） |
| 结构化程度 | 中等（有功能列表、使用示例） | 高（有阶段定义、步骤流程、YAML 配置示例） |
| 工具调用 | 无显式声明 | 显式声明使用 `AskUserQuestion` 工具 |
| 输出格式 | 自然语言回复 | 结构化 JSON + Markdown |

**关键判断**：Skill 的复杂度不由 frontmatter 决定，而由 body 里的指令深度决定。Frontmatter 只是“名片”，body 才是“能力说明书”。

## 第四段源码：系统级 Skill 长什么样

`.codex/skills/` 下的 Skill 和 `templates/skills/` 下的 Skill 格式相同，但用途不同。看 `openspec-propose`：

```typescript
// [.codex/skills/openspec-propose/SKILL.md 第 1—9 行](../../../../.codex/skills/openspec-propose/SKILL.md#L1)
---
name: openspec-propose
description: Propose a new change with all artifacts generated in one step. Use when the user wants to quickly describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---
```

**系统级 Skill 的特点**：

1. 放在 `.codex/skills/` 下，是“系统内置”的
2. 通常有 `license` 和 `compatibility` 字段
3. `metadata` 更详细（author、version、generatedBy）
4. Body 更短，通常只描述输入、输出和步骤，不展开角色定义

**关键判断**：系统级 Skill 和业务级 Skill 的**格式相同**，但**使用场景不同**。系统级 Skill 是“工具性”的（如 propose、apply、archive），业务级 Skill 是“服务性”的（如旅行规划、项目访谈）。

## 调用链：Skill 定义从哪里来、到哪里去

```text
用户创建 Skill
  → 写入 templates/skills/{skill-name}/SKILL.md
    → 被 Skill Loader 读取
      → 解析 frontmatter（YAML）→ 元数据对象
      → 解析 body（Markdown）→ 指令文本
    → 注入 Agent 的 System Prompt
      → Agent 根据指令执行任务
```

**本课的边界**：我们只看到 `SKILL.md` 文件本身。加载、解析、注入的过程在 L07–L08 展开。

## 失败路径：Skill 定义可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| Frontmatter 格式错误 | Skill 无法被识别 | YAML 语法错误，如缺少 `---` 闭合 |
| `name` 字段缺失 | 加载时报错或忽略 | Frontmatter 必填字段不完整 |
| `description` 为空 | Agent 不知道 Skill 能做什么 | 描述是 Agent 选择 Skill 的依据 |
| Body 结构混乱 | Agent 执行行为不可预测 | 缺少结构化的 Section，模型理解困难 |
| `reads`/`writes` 声明与实际不符 | 数据权限错误 | 声明只读但 body 里写了文件 |
| 版本号格式错误 | 版本管理混乱 | 未遵循语义化版本规范 |

## 测试证据

本课涉及的 Skill 定义文件没有直接的单元测试（它们是被解析的对象，不是解析器本身）。但可以通过以下方式验证：

```bash
# 检查 YAML frontmatter 是否合法
node -e "const fs=require('fs'); const yaml=require('yaml'); const content=fs.readFileSync('templates/skills/info-query/SKILL.md','utf8'); const parts=content.split('---'); yaml.parse(parts[1]); console.log('YAML OK')"

# 检查所有 SKILL.md 的 frontmatter 是否都能解析
for f in templates/skills/*/SKILL.md; do
  echo -n "$f: "
  node -e "const fs=require('fs'); const yaml=require('yaml'); try { const c=fs.readFileSync('$f','utf8'); const p=c.split('---'); yaml.parse(p[1]); console.log('OK') } catch(e) { console.log('FAIL:', e.message) }"
done
```

**测试缺口**：
- 没有自动化测试验证 body 的结构化约定（如是否包含 `## Overview`）
- 没有测试验证 `reads`/`writes` 声明与实际行为的一致性
- 没有测试验证 frontmatter 字段的完整性

## 小实验

**实验 1：创建一个最小的 Skill**

在 `templates/skills/` 下新建一个目录 `travel-planner/`，创建 `SKILL.md`：

```markdown
---
name: travel-planner
description: 帮助用户规划旅行路线和预算
originos-system: false
version: 1.0.0
type: SIMPLE
author: user
tags:
  - travel
  - planning
reads: []
writes: []
prerequisites: []
dependencies: []
---

# 旅行规划助手

## Overview

你是一个旅行规划助手，帮助用户规划旅行路线和预算。

## 功能

- 推荐旅行目的地
- 规划行程路线
- 估算旅行预算

## 使用方式

- "我想去日本玩一周，预算一万块"
- "推荐一个适合情侣的海岛"
```

**观察**：这个 Skill 能被系统识别吗？Frontmatter 是否合法？Body 是否包含必要的 Section？

**实验 2：对比 frontmatter 字段**

打开 `templates/skills/info-query/SKILL.md` 和 `templates/skills/project-initialization/SKILL.md`，对比它们的 frontmatter：

- 哪些字段是共有的？
- 哪些字段是独有的？
- 为什么 `project-initialization` 没有 `type`、`tags`、`reads`、`writes`？

**思考**：字段的多少和 Skill 的复杂度有直接关系吗？

## 口头验收

1. **Skill 的 Frontmatter 和 Body 各自承担什么职责？** 能说出 frontmatter 是“名片”、body 是“能力说明书”吗？
2. **`info-query` 和 `project-initialization` 的 Skill 定义有什么区别？** 能从字段数量、body 长度、结构化程度三个维度对比吗？
3 **系统级 Skill（`.codex/skills/`）和业务级 Skill（`templates/skills/`）的格式相同吗？** 能说出它们的使用场景差异吗？
4. **如果 Skill 的 `description` 为空，会导致什么问题？** 能说出 Agent 选择 Skill 时依赖 description 吗？
5. **Skill 的 `reads` 和 `writes` 字段是做什么的？** 能说出它们声明了 Skill 的数据访问权限吗？

## 本课结论

本课建立了 Skill 的基本认知：

- **Skill 是一个“能力包”**，由 `SKILL.md` 文件定义
- **Frontmatter 是“名片”**，用 YAML 描述元数据
- **Body 是“能力说明书”**，用 Markdown 描述角色、流程、输出
- **系统级和业务级 Skill 格式相同，用途不同**

下一课（L02）将对比 `.codex/skills/` 和 `templates/skills/` 的职责边界，回答“系统内置 Skill 和用户自定义 Skill 有什么区别”这个问题。
