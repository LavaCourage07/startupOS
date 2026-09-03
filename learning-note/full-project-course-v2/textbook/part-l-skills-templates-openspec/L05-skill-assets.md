# L05：Skill 的“资产”——references、scripts、assets 目录做什么？

> 本课问题：一个 Skill 目录下除了 `SKILL.md`，还有 references、scripts、assets 等子目录。它们各自承担什么职责？Agent 是怎么使用它们的？

## 小林的场景

小林打开 `templates/skills/bmad-agent-builder/`，发现里面有很多文件和子目录：

```
bmad-agent-builder/
  SKILL.md
  references/
    build-process.md
    quality-analysis.md
    ...
  assets/
    BOND-template.md
    CAPABILITIES-template.md
    ...
  scripts/
    generate-html-report.py
    prepass-execution-deps.py
    ...
```

她想知道：
- `references/` 里的文件是给谁看的？
- `assets/` 里的模板是怎么被使用的？
- `scripts/` 里的 Python 脚本是做什么的？
- Agent 会主动读取这些文件吗？

## 概念阶梯：Skill 不是单文件，而是“目录包”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “Skill 就是一个 SKILL.md 文件” | Skill 是一个**目录包**，`SKILL.md` 只是入口 | 目录下的其他文件也是 Skill 的一部分 |
| “references 是给人类看的文档” | references 是给**模型**看的**参考材料** | 不是普通文档，而是被注入 Prompt 的素材 |
| “assets 是静态资源” | assets 是**模板和配置**，用于生成产物 | 不是图片或 CSS，而是 Markdown 模板和 TOML 配置 |
| “scripts 是自动化工具” | scripts 是**构建和评测工具**，不是 Skill 本身 | 是 Skill 的辅助工具，不是运行时必需 |

## 第一段源码：`bmad-agent-builder` 的目录结构

```typescript
// [templates/skills/bmad-agent-builder/ 目录结构](../../../../templates/skills/bmad-agent-builder/)
// 通过 git ls-files 获取的完整结构：

bmad-agent-builder/
  SKILL.md                          // Skill 入口定义
  references/                       // 参考文档（给模型看的参考材料）
    agent-type-guidance.md
    build-process.md
    edit-guidance.md
    first-breath-adaptation-guidance.md
    mission-writing-guidance.md
    quality-analysis.md
    quality-dimensions.md
    quality-scan-agent-cohesion.md
    quality-scan-customization-surface.md
    quality-scan-enhancement-opportunities.md
    quality-scan-execution-efficiency.md
    quality-scan-prompt-craft.md
    quality-scan-sanctum-architecture.md
    quality-scan-script-opportunities.md
    quality-scan-structure.md
    report-quality-scan-creator.md
    sample-capability-authoring.md
    sample-capability-prompt.md
    sample-first-breath.md
    sample-init-sanctum.py
    sample-memory-guidance.md
    script-opportunities-reference.md
    script-standards.md
    skill-best-practices.md
    standard-fields.md
    standing-order-guidance.md
    template-substitution-rules.md
  assets/                           // 模板和配置（用于生成产物）
    BOND-template.md
    CAPABILITIES-template.md
    CREED-template.md
    INDEX-template.md
    MEMORY-template.md
    PERSONA-template.md
    PULSE-template.md
    SKILL-template-bootloader.md
    SKILL-template.md
    capability-authoring-template.md
    customize-template.toml
    first-breath-config-template.md
    first-breath-template.md
    init-sanctum-template.py
    memory-guidance-template.md
    sample-customize-analyst.toml
  scripts/                          // 构建和评测工具（辅助脚本）
    generate-html-report.py
    prepass-execution-deps.py
    prepass-prompt-metrics.py
    prepass-sanctum-architecture.py
    prepass-structure-capabilities.py
    process-template.py
    scan-path-standards.py
    scan-scripts.py
```

**三个子目录的职责**：

| 目录 | 内容 | 给谁用 | 何时被读取 |
| --- | --- | --- | --- |
| `references/` | 参考文档（Markdown、Python） | 模型 | Skill 执行时，被注入 Prompt |
| `assets/` | 模板和配置（Markdown、TOML、Python） | 模型 + 用户 | 生成产物时，被填充和输出 |
| `scripts/` | 构建和评测工具（Python） | 开发者 | 开发时，用于验证和评测 |

## 第二段源码：`references/` 里的文件是怎么被使用的

在 `bmad-agent-builder/SKILL.md` 中，有多处引用 `references/` 下的文件：

```typescript
// [templates/skills/bmad-agent-builder/SKILL.md 第 44—50 行](../../../../templates/skills/bmad-agent-builder/SKILL.md#L44)
## Build Process

... Load `./references/build-process.md` to begin.

## Quality Analysis

... Load `./references/quality-analysis.md` to begin.
```

**引用机制**：

1. **相对路径引用**：`./references/build-process.md`
2. **加载时机**：Skill 执行时，Agent 会读取这些文件并注入 Prompt
3. **内容作用**：提供详细的构建流程、质量分析标准等参考材料

**关键判断**：`references/` 里的文件不是被“显示”给用户的，而是被“注入”到模型的 Prompt 中，作为模型的上下文知识。

## 第三段源码：`assets/` 里的模板是怎么被使用的

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
2. **填充时机**：Skill 执行时，Agent 根据用户输入填充占位符
3. **输出产物**：填充后的文件被保存到指定目录

**关键判断**：`assets/` 里的模板是“半成品”，需要被填充后才能使用。它们不是直接给模型看的，而是给模型“使用”的。

## 第四段源码：`scripts/` 里的工具是怎么被使用的

```typescript
// [templates/skills/bmad-agent-builder/scripts/prepass-prompt-metrics.py 第 1—30 行](../../../../templates/skills/bmad-agent-builder/scripts/prepass-prompt-metrics.py#L1)
#!/usr/bin/env python3
"""
Pre-pass: Analyze prompt metrics for a skill.

This script analyzes the prompt metrics of a skill to ensure
quality and consistency before final evaluation.
"""

import sys
import json
from pathlib import Path

def analyze_prompt_metrics(skill_path: str) -> dict:
    """Analyze prompt metrics for a skill."""
    # Read the SKILL.md file
    skill_file = Path(skill_path) / "SKILL.md"
    if not skill_file.exists():
        return {"error": f"SKILL.md not found in {skill_path}"}

    # Parse frontmatter and body
    content = skill_file.read_text()
    # ...

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python prepass-prompt-metrics.py <skill_path>")
        sys.exit(1)

    skill_path = sys.argv[1]
    result = analyze_prompt_metrics(skill_path)
    print(json.dumps(result, indent=2))
```

**脚本机制**：

1. **用途**：分析 Skill 的 Prompt 质量、结构完整性等
2. **执行时机**：开发时，由开发者手动运行
3. **输入**：Skill 目录路径
4. **输出**：JSON 格式的分析报告

**关键判断**：`scripts/` 里的工具是“开发时工具”，不是“运行时工具”。它们不会被 Agent 自动调用，而是由开发者手动运行。

## 调用链：资产从文件到使用

```text
Skill 目录
  → SKILL.md（入口）
    → 引用 references/ 下的文件
      → 被注入 Prompt
        → 模型获取上下文知识
    → 使用 assets/ 下的模板
      → 填充占位符
        → 生成产物
    → 调用 scripts/ 下的工具（开发时）
      → 分析、验证、评测
```

## 失败路径：资产可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| `references/` 文件不存在 | Skill 执行时找不到参考材料 | 引用路径错误或文件被删除 |
| `assets/` 模板占位符未填充 | 产物中包含 `{{AGENT_NAME}}` | 填充逻辑缺失或占位符名称错误 |
| `scripts/` 工具依赖缺失 | 脚本运行失败 | 缺少 Python 依赖或环境配置 |
| `references/` 文件过大 | Prompt 超出 token 限制 | 参考材料过多或过长 |
| `assets/` 模板格式错误 | 产物格式不正确 | 模板语法错误或占位符不匹配 |

## 测试证据

```bash
# 检查每个 Skill 的目录结构
for dir in templates/skills/*/; do
  echo "=== $(basename $dir) ==="
  echo "references: $(ls "$dir"references/ 2>/dev/null | wc -l)"
  echo "assets: $(ls "$dir"assets/ 2>/dev/null | wc -l)"
  echo "scripts: $(ls "$dir"scripts/ 2>/dev/null | wc -l)"
done

# 检查 SKILL.md 中引用的 references 文件是否存在
for f in templates/skills/*/SKILL.md; do
  dir=$(dirname "$f")
  grep -oP 'references/[^ ]+' "$f" | while read ref; do
    if [ ! -f "$dir/$ref" ]; then
      echo "MISSING: $dir/$ref"
    fi
  done
done
```

**测试缺口**：
- 没有自动化测试验证 references 文件的引用完整性
- 没有测试验证 assets 模板的占位符完整性
- 没有测试验证 scripts 工具的依赖完整性

## 小实验

**实验 1：统计各 Skill 的资产数量**

| Skill | references | assets | scripts |
| --- | --- | --- | --- |
| bmad-agent-builder | | | |
| project-initialization | | | |
| info-query | | | |
| role-agent-creator | | | |

**思考**：为什么有的 Skill 有很多 assets，有的几乎没有？

**实验 2：检查引用完整性**

打开 `bmad-agent-builder/SKILL.md`，找到所有 `references/` 的引用，检查对应的文件是否存在。

**思考**：如果引用的文件不存在，会发生什么？

## 口头验收

1. **`references/`、`assets/`、`scripts/` 各自承担什么职责？** 能说出 references 是参考材料、assets 是模板、scripts 是工具吗？
2. **`references/` 里的文件是给谁看的？** 能说出是给模型看的参考材料吗？
3. **`assets/` 里的模板是怎么被使用的？** 能说出占位符被填充后生成产物吗？
4. **`scripts/` 里的工具是运行时使用的吗？** 能说出它们是开发时工具吗？
5. **如果 `references/` 文件不存在，会发生什么？** 能说出 Skill 执行时找不到参考材料吗？

## 本课结论

本课建立了 Skill 资产的完整认知：

- **Skill 不是单文件，而是“目录包”**
- **`references/`**：参考文档，给模型看的上下文知识
- **`assets/`**：模板和配置，用于生成产物
- **`scripts/`**：构建和评测工具，开发时使用
- **不同 Skill 的资产数量差异很大**：复杂 Skill（如 `bmad-agent-builder`）有大量资产，简单 Skill（如 `info-query`）几乎没有

下一课（L06）将深入 Skill 的“评测”——evals、evolution.json 和运行报告。
