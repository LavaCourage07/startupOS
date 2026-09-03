# L12：`bmad-workflow-builder`——工作流构建

> 本课问题：`bmad-workflow-builder` 是如何帮助用户构建工作流的？它与 `bmad-agent-builder` 有什么区别？

## 小林的场景

小林已经用 `bmad-agent-builder` 创建了一个“代码审查助手”Agent。现在她想创建一个自动化的代码审查工作流——当用户提交代码时，自动进行静态分析、风格检查、安全扫描，最后生成审查报告。

她想知道：

- 工作流和 Agent 有什么区别？
- 工作流是怎么被构建的？
- 构建完成后，工作流的文件结构是什么样的？

## 概念阶梯：工作流不是“Agent 的替代品”，而是“Agent 的编排器”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “工作流就是 Agent” | 工作流是**多步骤编排**，Agent 是**单角色执行** | 工作流可以包含多个 Agent，Agent 是工作流的组成部分 |
| “工作流构建和 Agent 构建一样” | 工作流构建更关注**步骤编排和依赖关系** | Agent 构建关注角色定义，工作流构建关注流程设计 |
| “工作流只能线性地执行” | 工作流支持**并行、条件分支、循环** | 不是简单的线性流程 |

## 第一段源码：`bmad-workflow-builder` 的 Frontmatter

```typescript
// [templates/skills/bmad-workflow-builder/SKILL.md 第 1—21 行](../../../../templates/skills/bmad-workflow-builder/SKILL.md#L1)
---
name: bmad-workflow-builder
description: 工作流构建助手，通过对话引导用户构建、转换和分析工作流与技能
originos-system: true
version: 1.0.0
type: COMPOSITE
author: OriginOS
outputDir: data/
tags:
  - workflow
  - builder
  - skill
reads:
  - workflow
  - skill
writes:
  - workflow
  - skill
prerequisites: []
dependencies: []
---
```

**与 `bmad-agent-builder` 的对比**：

| 维度 | `bmad-agent-builder` | `bmad-workflow-builder` |
| --- | --- | --- |
| `type` | 未明确（默认 SIMPLE） | `COMPOSITE` |
| `description` | 构建、编辑、分析 Agent | 构建、转换、分析工作流 |
| `reads` | 未声明 | `workflow`、`skill` |
| `writes` | 未声明 | `workflow`、`skill` |
| `outputDir` | 未声明 | `data/` |

**关键判断**：`bmad-workflow-builder` 是 `COMPOSITE` 类型，因为它需要**多阶段编排**（构建、转换、分析）。

## 第二段源码：工作流构建的核心原则

```typescript
// [templates/skills/bmad-workflow-builder/SKILL.md 第 27—30 行](../../../../templates/skills/bmad-workflow-builder/SKILL.md#L27)
This skill helps you build AI workflows and skills that are **outcome-driven** — describing what to achieve, not micromanaging how to get there. LLMs are powerful reasoners. Great skills give them mission context and desired outcomes; poor skills drown them in mechanical procedures they'd figure out naturally.
```

**核心原则**：

1. **Outcome-driven**：描述要达到的目标，而不是具体的执行步骤
2. **Trust the LLM**：相信 LLM 的推理能力，不要过度指定
3. **Leanest possible**：最精简的技能，每个指令都有其价值

**关键判断**：这和 `bmad-agent-builder` 的原则一致——**结果驱动，信任模型**。

## 第三段源码：工作流的 Intent 路由

```typescript
// [templates/skills/bmad-workflow-builder/SKILL.md 第 72—79 行](../../../../templates/skills/bmad-workflow-builder/SKILL.md#L72)
| Intent                      | Trigger Phrases                                       | Route                                           |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| **Build new**               | "build/create/design a workflow/skill/tool"           | Load `references/build-process.md`               |
| **Convert**                 | `--convert path-or-url`                               | Load `references/convert-process.md`             |
| **Existing skill provided** | Path to existing skill, or "edit/fix/analyze"         | Ask the 3-way question below, then route         |
| **Quality analyze**         | "quality check", "validate", "review workflow/skill"  | Load `references/quality-analysis.md`            |
| **Unclear**                 | —                                                     | Present options and ask                          |
```

**与 `bmad-agent-builder` 的对比**：

| 维度 | `bmad-agent-builder` | `bmad-workflow-builder` |
| --- | --- | --- |
| **Build new** | 构建新 Agent | 构建新工作流 |
| **Convert** | 不支持 | 支持（`--convert`） |
| **Existing** | Analyze/Edit/Rebuild | Analyze/Edit/Rebuild |
| **Quality analyze** | 支持 | 支持 |

**关键判断**：`bmad-workflow-builder` 比 `bmad-agent-builder` 多一个 **Convert** 功能，可以将现有工作流转换为 BMAD 格式。

## 第四段源码：Convert 功能

```typescript
// [templates/skills/bmad-workflow-builder/SKILL.md 第 62—66 行](../../../../templates/skills/bmad-workflow-builder/SKILL.md#L62)
## Convert

One-command conversion of any existing skill into a BMad-compliant, outcome-driven equivalent. Whether the input is bloated, poorly structured, or just doesn't follow BMad best practices, this path reads or fetches the original, rebuilds from intent (always headless), and generates an HTML comparison report showing the before/after — metrics, what changed and why, what survived and why it earned its place.

`--convert` implies headless mode. Accepts a local path or URL. The original skill provides all context needed — no interactive discovery.
```

**Convert 机制**：

1. **输入**：本地路径或 URL
2. **处理**：读取原始 Skill → 重建为 BMAD 格式 → 生成对比报告
3. **输出**：BMAD 合规的 Skill + HTML 对比报告
4. **模式**：Headless（非交互式）

**关键判断**：Convert 是**自动化**的，不需要用户参与对话。这使得批量转换成为可能。

## 调用链：工作流构建流程

```text
用户请求 "build a workflow"
  → bmad-workflow-builder 激活
    → 检测 Intent（Build new / Convert / Existing / Quality analyze）
      → Build new: 对话式构建
        → Phase 1: 发现意图
        → Phase 2: 设计流程
        → Phase 3: 定义步骤
        → Phase 4: 构建输出
      → Convert: 自动转换
        → 读取原始 Skill
        → 重建为 BMAD 格式
        → 生成 HTML 对比报告
      → Existing: Analyze / Edit / Rebuild
        → 类似 bmad-agent-builder 的处理逻辑
```

## 失败路径：工作流构建可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 工作流步骤循环依赖 | 工作流无法执行 | 步骤设计时没有考虑依赖关系 |
| Convert 失败 | 原始 Skill 格式无法识别 | 原始格式不兼容 |
| HTML 报告生成失败 | 无法查看对比结果 | 依赖缺失或模板错误 |
| 工作流过于复杂 | 难以维护 | 没有遵循"outcome-driven"原则 |
| 步骤并行设计错误 | 数据竞争或结果不一致 | 没有正确处理并发 |

## 测试证据

```bash
# 检查 bmad-workflow-builder 的文件结构
ls -la templates/skills/bmad-workflow-builder/

# 检查 references 文档
ls templates/skills/bmad-workflow-builder/references/

# 检查 assets 模板
ls templates/skills/bmad-workflow-builder/assets/

# 检查 scripts 工具
ls templates/skills/bmad-workflow-builder/scripts/
```

**测试缺口**：
- 没有自动化测试验证 Convert 功能的正确性
- 没有测试验证 HTML 对比报告的生成
- 没有测试验证工作流步骤的依赖关系

## 小实验

**实验 1：对比 Agent 构建和工作流构建**

| 维度 | Agent 构建 | 工作流构建 |
| --- | --- | --- |
| 核心关注点 | 角色定义 | 步骤编排 |
| 输出产物 | SKILL.md + sanctum | workflow 定义 |
| 是否有 Convert | 否 | 是 |
| 类型 | SIMPLE | COMPOSITE |

**思考**：什么场景下应该使用工作流而不是 Agent？

**实验 2：分析 Convert 功能**

1. 打开 `templates/skills/bmad-workflow-builder/references/convert-process.md`
2. 回答：Convert 功能的输入、处理、输出分别是什么？
3. 思考：为什么 Convert 是 headless 模式？

## 口头验收

1. **工作流和 Agent 的区别是什么？** 能说出工作流是多步骤编排，Agent 是单角色执行吗？
2. **`bmad-workflow-builder` 比 `bmad-agent-builder` 多什么功能？** 能说出 Convert 功能吗？
3. **Convert 功能是怎么工作的？** 能说出读取原始 Skill → 重建为 BMAD 格式 → 生成 HTML 对比报告吗？
4. **为什么 `bmad-workflow-builder` 是 COMPOSITE 类型？** 能说出因为它需要多阶段编排吗？
5. **工作流构建的核心原则是什么？** 能说出 outcome-driven、trust the LLM、leanest possible 吗？

## 本课结论

本课建立了 `bmad-workflow-builder` 的完整认知：

- **工作流是 Agent 的编排器**：多步骤、可并行、有条件分支
- **`bmad-workflow-builder` 比 `bmad-agent-builder` 多 Convert 功能**：可以将现有 Skill 转换为 BMAD 格式
- **Convert 是自动化的**：Headless 模式，不需要用户参与
- **核心原则一致**：Outcome-driven、trust the LLM、leanest possible
- **COMPOSITE 类型**：因为工作流需要多阶段编排

下一课（L13）将深入 `bmad-module-builder`，了解模块构建的方式。
