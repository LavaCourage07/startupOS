# L04：SKILL.md 的 body——角色定义、能力清单、工具调用与输出格式

> 本课问题：SKILL.md 的 body 不是普通文档，它有结构化的约定。这些约定是什么？Agent 怎么根据 body 里的指令执行任务？

## 小林的场景

小林看了 `project-initialization` 的 body，发现它很长，有 `# OriginOS 项目访谈 Skill`、`## Overview`、`## Role Definition`、`### 核心能力`、`## Phase 1: 领域发现` 等很多 section。

她想知道：
- 这些 section 是随便写的，还是有约定？
- Agent 是怎么“看懂”这些 section 的？
- 如果我把 `## Overview` 写成 `## 概述`，会有影响吗？
- body 里的内容是怎么被注入到 Agent 的 Prompt 里的？

## 概念阶梯：Body 不是“文档”，而是“指令集”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “Body 是给人类看的说明文档” | Body 是给**模型**看的**指令集** | 不是普通文档，而是结构化的 Prompt 素材 |
| “Section 标题随便写” | Section 标题有**约定俗成的语义** | 不是强制的，但遵循约定有助于模型理解 |
| “Agent 会逐字执行 body 里的指令” | Agent 根据 body 生成**系统提示词**，然后由模型执行 | body 本身不是代码，而是被解析后注入 Prompt 的文本 |

## 第一段源码：`project-initialization` 的 body 结构

```typescript
// [templates/skills/project-initialization/SKILL.md 第 7—35 行](../../../../templates/skills/project-initialization/SKILL.md#L7)
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
- 📊 实时记录和整理业务概念
- ⚖️ 主动发现和提醒潜在矛盾
- ✨ 基于行业最佳实践提供建议

### 对话风格

- 专业、友好、引导性强
- 不预设答案，通过提问激发思考
- 适时提供选项帮助用户理清思路
- 主动总结和反馈，确保理解一致
```

**Body 的结构化约定**：

虽然 body 是 Markdown，但 OriginOS 对 body 有约定俗成的结构：

| Section | 作用 | 是否必须 |
| --- | --- | --- |
| `# 标题` | Skill 的显示名称 | 是 |
| `## Overview` | 概述 Skill 的目标和使用场景 | 推荐 |
| `## Role Definition` | 定义 Skill 扮演的角色、能力、风格 | 推荐 |
| `### 核心能力` | 列出 Skill 的核心能力 | 推荐 |
| `### 对话风格` | 定义 Skill 的对话风格 | 推荐 |
| `## 功能` / `## Capabilities` | 列出 Skill 能做什么 | 推荐 |
| `## 使用方式` / `## Usage` | 给出使用示例 | 推荐 |
| `## 执行指导` / `## Execution` | 详细的执行步骤和规则 | 复杂 Skill 必须 |
| `## 响应示例` / `## Examples` | 给出输入输出示例 | 推荐 |
| `## Phase N` | 多阶段 Skill 的阶段定义 | 多阶段 Skill 必须 |
| `### 步骤 N` | 阶段内的具体步骤 | 推荐 |
| `#### 选项处理` | 用户选择不同选项时的处理逻辑 | 推荐 |

## 第二段源码：`info-query` 的 body 结构

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

**对比分析**：

| 维度 | `project-initialization` | `info-query` |
| --- | --- | --- |
| Section 数量 | 多（~10 个） | 少（~4 个） |
| 是否有 `Role Definition` | 是 | 否 |
| 是否有 `Phase` | 是（Phase 1、Phase 2） | 否 |
| 是否有 `步骤` | 是（步骤 1–5） | 是（步骤 1–4） |
| 是否有 `选项处理` | 是 | 否 |
| 是否有 `响应示例` | 否 | 是 |

**关键判断**：`project-initialization` 的 body 更复杂，因为它需要定义角色、多阶段流程、选项处理；`info-query` 的 body 更简单，因为它只需要定义功能和执行步骤。

## 第三段源码：`bmad-agent-builder` 的 body 结构

```typescript
// [templates/skills/bmad-agent-builder/SKILL.md 第 7—72 行](../../../../templates/skills/bmad-agent-builder/SKILL.md#L7)
# Agent Builder

## Overview

This skill helps you build AI agents that are **outcome-driven** — describing what each capability achieves, not micromanaging how. Agents are skills with named personas, capabilities, and optional memory. Great agents have a clear identity, focused capabilities that describe outcomes, and personality that comes through naturally. Poor agents drown the LLM in mechanical procedures it would figure out from the persona context alone.

Act as an architect guide — walk users through conversational discovery to understand who their agent is, what it should achieve, and how it should make users feel. Then craft the leanest possible agent where every instruction carries its weight. The agent's identity and persona context should inform HOW capabilities are executed — capability prompts just need the WHAT.

**Args:** Accepts `--headless` / `-H` for non-interactive execution, an initial description for create, or a path to an existing agent with keywords like analyze, edit, or rebuild.

**Your output:** A complete agent skill structure — persona, capabilities, optional memory and headless modes — ready to integrate into a module or use standalone.

## On Activation

1. Detect user's intent. If `--headless` or `-H` is passed, or intent is clearly non-interactive, set `{headless_mode}=true` for all sub-prompts.

2. Load available config from `{project-root}/_bmad/config.yaml` and `{project-root}/_bmad/config.user.yaml` (root and bmb section). If neither exists, fall back to `{project-root}/_bmad/bmb/config.yaml` (legacy per-module format). If still missing, and the `bmad-builder-setup` skill is available, let the user know they can run it at any time to configure. Resolve and apply throughout the session (defaults in parens):
   - `{user_name}` (default: null) — address the user by name
   - `{communication_language}` (default: user or system intent) — use for all communications
   - `{document_output_language}` (default: user or system intent) — use for generated document content
   - `{bmad_builder_output_folder}` (default: `{project-root}/skills`) — save built agents here
   - `{bmad_builder_reports}` (default: `{project-root}/skills/reports`) — save reports (quality, eval, planning) here

3. Route by intent — see Quick Reference below.

## Build Process

The core creative path — where agent ideas become reality. Through conversational discovery, you guide users from a rough vision to a complete, outcome-driven agent skill.

The builder produces three agent types along a spectrum:

- **Stateless agent** — everything in SKILL.md, no memory, no First Breath. For focused experts handling isolated sessions.
- **Memory agent** — lean bootloader SKILL.md + sanctum (6 standard files + First Breath). For agents that build understanding over time.
- **Autonomous agent** — memory agent + PULSE. For agents that operate on their own between sessions.

Agent type is determined during Phase 1 discovery, not upfront. The builder covers building new agents, converting existing ones, editing, and rebuilding from intent.

Load `./references/build-process.md` to begin.

## Quality Analysis

Comprehensive quality analysis toward outcome-driven design. Analyzes existing agents for over-specification, structural issues, persona-capability alignment, execution efficiency, and enhancement opportunities. Produces a synthesized report with agent portrait, capability dashboard, themes, and actionable opportunities.

Load `./references/quality-analysis.md` to begin.
```

**`bmad-agent-builder` 的独特结构**：

| Section | 作用 | 独特性 |
| --- | --- | --- |
| `## On Activation` | 激活时的初始化逻辑 | 加载配置、设置参数 |
| `## Build Process` | 构建流程 | 定义三种 Agent 类型 |
| `## Quality Analysis` | 质量分析 | 引用外部文件 `references/quality-analysis.md` |
| `## Quick Reference` | 快速参考表格 | 用表格定义路由规则 |

**关键判断**：`bmad-agent-builder` 的 body 展示了更高级的 Skill 设计模式：
1. **引用外部文件**：`Load './references/build-process.md'`
2. **参数化配置**：`{user_name}`、`{communication_language}` 等占位符
3. **路由表格**：用表格定义不同意图的触发条件和路由目标

## 第四段源码：Body 如何被注入 Prompt

Body 的内容最终会被解析成字符串，注入到 Agent 的 System Prompt 中。这个过程在 `packages/core/src/lib/features/skills/service.ts` 中：

```typescript
// [packages/core/src/lib/features/skills/service.ts 第 1—30 行](../../../../packages/core/src/lib/features/skills/service.ts#L1)
// 注：这是示意性代码，实际实现可能不同
// Skill Loader 的大致流程：
// 1. 读取 SKILL.md 文件
// 2. 按 `---` 分割 frontmatter 和 body
// 3. 解析 frontmatter 为 SkillMetadata
// 4. 将 body 作为字符串保存
// 5. 注册到 Registry
// 6. Agent 使用时，将 body 注入 System Prompt
```

**注入过程**：

```text
Agent 初始化
  → 加载 Skill
    → 解析 SKILL.md
      → frontmatter → SkillMetadata 对象
      → body → 原始 Markdown 字符串
    → 构建 System Prompt
      → 基础 Prompt（角色定义、安全约束等）
      → + Skill body（作为上下文）
      → + 用户输入
    → 发送给模型
      → 模型根据 Prompt 生成回复
```

**关键判断**：Body 不是被“执行”的，而是被“注入”的。模型根据 body 里的指令生成回复，但 body 本身不是代码。

## 调用链：Body 从文件到模型

```text
SKILL.md 文件
  → Skill Loader 读取
    → 分割 frontmatter 和 body
      → frontmatter → SkillMetadata
      → body → 字符串
    → 注册到 Registry
      → Agent 初始化时
        → 加载 Skill body
          → 注入 System Prompt
            → 模型生成回复
```

## 失败路径：Body 可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| Section 标题写错 | 模型可能无法识别结构 | 约定俗成的标题有助于模型理解 |
| 指令模糊 | 模型执行行为不可预测 | 指令需要具体、可执行 |
| 缺少 `Role Definition` | 模型不知道扮演什么角色 | 角色定义是 Agent 行为的基础 |
| 步骤顺序混乱 | 模型执行顺序错误 | 步骤需要清晰的顺序和依赖关系 |
| 引用外部文件不存在 | 运行时找不到文件 | 引用路径需要正确 |
| 占位符未替换 | 模型看到 `{user_name}` 而不是实际值 | 占位符需要在注入前替换 |

## 测试证据

```bash
# 检查 body 是否包含必要的 Section
grep -E "^## (Overview|Role Definition|功能|Capabilities|使用方式|Usage|执行指导|Execution)" templates/skills/*/SKILL.md

# 检查是否有 Skill 缺少 Role Definition
for f in templates/skills/*/SKILL.md; do
  if ! grep -q "^## Role Definition" "$f"; then
    echo "MISSING Role Definition: $f"
  fi
done
```

**测试缺口**：
- 没有自动化测试验证 body 的结构化约定
- 没有测试验证 Section 标题的规范性
- 没有测试验证指令的可执行性

## 小实验

**实验 1：对比三个 Skill 的 body 结构**

| Section | `project-initialization` | `info-query` | `bmad-agent-builder` |
| --- | --- | --- | --- |
| `# 标题` | | | |
| `## Overview` | | | |
| `## Role Definition` | | | |
| `### 核心能力` | | | |
| `### 对话风格` | | | |
| `## 功能` | | | |
| `## 使用方式` | | | |
| `## 执行指导` | | | |
| `## 响应示例` | | | |
| `## Phase N` | | | |
| `## On Activation` | | | |
| `## Build Process` | | | |
| `## Quick Reference` | | | |

**思考**：为什么不同 Skill 的 body 结构差异这么大？

**实验 2：修改 body 的 Section 标题**

将 `project-initialization` 的 `## Overview` 改为 `## 概述`，观察：
- 模型是否还能理解 Skill 的目标？
- 是否有影响？

**注意**：这只是思维实验，不要真的修改文件。

## 口头验收

1. **Body 里的 `## Overview` 是做什么的？** 能说出它是 Skill 的目标和使用场景概述吗？
2. **`## Role Definition` 和 `### 核心能力` 有什么区别？** 能说出前者定义角色、后者列出能力吗？
3. **`bmad-agent-builder` 的 `## On Activation` 是做什么的？** 能说出它是激活时的初始化逻辑吗？
4. **Body 里的内容是怎么被 Agent 使用的？** 能说出它被注入到 System Prompt 中吗？
5. **如果我把 `## Overview` 写成 `## 概述`，会有影响吗？** 能说出约定俗成的标题有助于模型理解，但不是强制的吗？

## 本课结论

本课建立了 body 的完整认知：

- **Body 不是普通文档，而是结构化的指令集**
- **Section 标题有约定俗成的语义**：`Overview`、`Role Definition`、`核心能力`、`功能`、`使用方式`、`执行指导`、`响应示例`、`Phase N`、`步骤 N`、`选项处理`
- **Body 的内容被注入到 Agent 的 System Prompt 中**
- **不同复杂度的 Skill 有不同的 body 结构**：简单 Skill 功能列表即可，复杂 Skill 需要角色定义、多阶段流程、选项处理
- **`bmad-agent-builder` 展示了高级模式**：引用外部文件、参数化配置、路由表格

下一课（L05）将深入 Skill 的“资产”——references、scripts、assets 目录的分工。
