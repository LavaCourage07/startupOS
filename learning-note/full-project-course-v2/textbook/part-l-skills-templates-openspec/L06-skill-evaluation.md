# L06：Skill 的“评测”——evals、evolution.json 和运行报告

> 本课问题：Skill 的质量是怎么被评估的？`evolution.json` 记录了什么？运行报告是怎么生成的？

## 小林的场景

小林发现 `role-agent-creator` 目录下有个 `evolution.json` 文件，里面记录了每次运行的 timestamp、sessionId、success、turnCount、duration 等信息。

她想知道：
- 这些数据是怎么被记录的？
- 它们能反映 Skill 的质量吗？
- 运行报告是怎么生成的？
- 开发者怎么利用这些数据改进 Skill？

## 概念阶梯：评测不是“打分”，而是“追踪”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “评测就是给 Skill 打分” | 评测是**运行数据的追踪和分析** | 不是简单的分数，而是多维度的运行指标 |
| “evolution.json 是版本历史” | evolution.json 是**运行记录**，不是版本历史 | 记录每次运行的数据，不记录代码变更 |
| “运行报告是给用户看的” | 运行报告是给**开发者**看的**质量分析** | 不是用户可见的产物，而是开发者的调试工具 |

## 第一段源码：`evolution.json` 的结构

```typescript
// [templates/skills/role-agent-creator/evolution.json 第 1—152 行](../../../../templates/skills/role-agent-creator/evolution.json#L1)
{
  "runs": [
    {
      "timestamp": "2026-06-12T02:30:14.308Z",
      "sessionId": "3fa2b5d1-0961-4bef-9450-a15d15b1767c",
      "success": true,
      "turnCount": 3,
      "duration": 2247
    },
    {
      "timestamp": "2026-06-12T14:04:54.014Z",
      "sessionId": "52367885-e8b8-4e55-a187-9b57fb47718d",
      "success": true,
      "turnCount": 3,
      "duration": 3741
    },
    ...
  ],
  "version": 1
}
```

**字段含义**：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `timestamp` | ISO 8601 字符串 | 运行开始时间 |
| `sessionId` | UUID | 会话唯一标识 |
| `success` | 布尔值 | 是否成功完成 |
| `turnCount` | 整数 | 对话轮数 |
| `duration` | 整数（毫秒） | 运行持续时间 |
| `version` | 整数 | 数据格式版本 |

**关键判断**：`evolution.json` 记录的是**运行时的会话数据**，不是**代码版本历史**。它回答的问题是“这个 Skill 运行得怎么样”，而不是“这个 Skill 的代码变了什么”。

## 第二段源码：`skill-creator-app` 的评测脚本

`skill-creator-app` 有专门的评测脚本：

```typescript
// [templates/skills/skill-creator-app/scripts/run_eval.py 第 1—30 行](../../../../templates/skills/skill-creator-app/scripts/run_eval.py#L1)
#!/usr/bin/env python3
"""
Run evaluation for a skill.

This script runs a skill through a set of test cases and evaluates
its performance against expected outcomes.
"""

import sys
import json
import subprocess
from pathlib import Path

def run_skill_eval(skill_path: str, test_cases: list) -> dict:
    """Run evaluation for a skill."""
    results = []
    for case in test_cases:
        # Run the skill with the test case input
        result = subprocess.run(
            ["python", "-m", "skill_runner", skill_path, "--input", json.dumps(case["input"])],
            capture_output=True,
            text=True
        )
        # Evaluate the output against expected output
        success = evaluate_output(result.stdout, case["expected"])
        results.append({
            "case": case["name"],
            "success": success,
            "output": result.stdout
        })
    return {"results": results, "summary": summarize_results(results)}

def evaluate_output(actual: str, expected: str) -> bool:
    """Evaluate if actual output matches expected output."""
    # Simple string matching for now
    return expected in actual

def summarize_results(results: list) -> dict:
    """Summarize evaluation results."""
    total = len(results)
    passed = sum(1 for r in results if r["success"])
    return {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "pass_rate": passed / total if total > 0 else 0
    }
```

**评测流程**：

1. **定义测试用例**：输入 + 预期输出
2. **运行 Skill**：用测试用例的输入调用 Skill
3. **评估输出**：对比实际输出和预期输出
4. **生成报告**：统计通过率、失败原因等

**关键判断**：评测是**自动化的**，但评估逻辑是**简单的**（字符串匹配）。这意味着评测只能验证“输出是否包含预期内容”，不能验证“输出是否正确”。

## 第三段源码：`skill-creator-app` 的报告生成

```typescript
// [templates/skills/skill-creator-app/scripts/generate_report.py 第 1—30 行](../../../../templates/skills/skill-creator-app/scripts/generate_report.py#L1)
#!/usr/bin/env python3
"""
Generate evaluation report for a skill.

This script generates an HTML report from evaluation results.
"""

import json
from pathlib import Path
from jinja2 import Template

def generate_report(eval_results: dict, output_path: str) -> str:
    """Generate HTML report from evaluation results."""
    template = Template("""
    <html>
    <head><title>Skill Evaluation Report</title></head>
    <body>
        <h1>Skill Evaluation Report</h1>
        <h2>Summary</h2>
        <p>Total: {{ summary.total }}</p>
        <p>Passed: {{ summary.passed }}</p>
        <p>Failed: {{ summary.failed }}</p>
        <p>Pass Rate: {{ summary.pass_rate * 100 }}%</p>
        <h2>Details</h2>
        <ul>
        {% for result in results %}
            <li>{{ result.case }}: {{ "PASS" if result.success else "FAIL" }}</li>
        {% endfor %}
        </ul>
    </body>
    </html>
    """)
    html = template.render(**eval_results)
    Path(output_path).write_text(html)
    return output_path
```

**报告机制**：

1. **输入**：评测结果（JSON）
2. **处理**：用 Jinja2 模板生成 HTML
3. **输出**：HTML 报告文件

**关键判断**：报告是**静态的**，不是实时的。它反映的是**某次评测的结果**，而不是**Skill 的当前状态**。

## 第四段源码：`skills/reports/` 下的运行报告

```typescript
// [skills/reports/architecture-guard/architecture-guard-20260729-120736.md 第 1—30 行](../../../../skills/reports/architecture-guard/architecture-guard-20260729-120736.md#L1)
# Architecture Guard Report

**Date**: 2026-07-29
**Time**: 12:07:36
**Skill**: architecture-guard

## Summary

This report documents the architecture guard evaluation results.

## Findings

### Finding 1: Dependency Direction

- **Status**: PASS
- **Description**: All dependencies follow the unidirectional dependency principle.
- **Evidence**: See `packages/core/src/lib/features/skills/registry.ts`

### Finding 2: Module Boundary

- **Status**: PASS
- **Description**: No module violates the layer boundary.
- **Evidence**: See `packages/core/src/types/skill.ts`

## Recommendations

1. Continue monitoring dependency directions.
2. Add automated checks for new modules.
```

**报告结构**：

| Section | 作用 |
| --- | --- |
| `Summary` | 总体概述 |
| `Findings` | 具体发现（状态、描述、证据） |
| `Recommendations` | 改进建议 |

**关键判断**：运行报告是**结构化的**，不是自由文本。它遵循“发现 → 证据 → 建议”的模式。

## 调用链：评测从运行到报告

```text
Skill 运行
  → 记录运行数据（timestamp、sessionId、success、turnCount、duration）
    → 保存到 evolution.json
      → 开发者运行评测脚本（run_eval.py）
        → 生成评测结果（JSON）
          → 生成报告（generate_report.py）
            → 输出 HTML 报告
```

## 失败路径：评测可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| `evolution.json` 格式损坏 | 无法读取运行记录 | JSON 语法错误 |
| 评测用例不覆盖 | 通过评测但仍有 bug | 评测用例不完整 |
| 评估逻辑太简单 | 误判输出正确性 | 字符串匹配无法验证语义 |
| 报告模板错误 | HTML 渲染失败 | Jinja2 模板语法错误 |
| 运行时数据缺失 | `evolution.json` 为空 | 记录逻辑未触发 |

## 测试证据

```bash
# 检查 evolution.json 的格式
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('templates/skills/role-agent-creator/evolution.json')); console.log('runs:', data.runs.length, 'version:', data.version);"

# 检查评测脚本是否存在
ls templates/skills/skill-creator-app/scripts/run_eval.py
ls templates/skills/skill-creator-app/scripts/generate_report.py

# 检查运行报告
ls skills/reports/
```

**测试缺口**：
- 没有自动化测试验证 `evolution.json` 的数据完整性
- 没有测试验证评测用例的覆盖率
- 没有测试验证评估逻辑的准确性

## 小实验

**实验 1：分析 `evolution.json` 的数据**

打开 `templates/skills/role-agent-creator/evolution.json`，回答：

- 有多少条运行记录？
- 成功率是多少？
- 平均 duration 是多少？
- 最长的一次运行用了多久？

**实验 2：对比不同 Skill 的评测机制**

| Skill | 有 evolution.json | 有评测脚本 | 有运行报告 |
| --- | --- | --- | --- |
| role-agent-creator | | | |
| skill-creator-app | | | |
| project-initialization | | | |
| info-query | | | |

**思考**：为什么有的 Skill 有评测机制，有的没有？

## 口头验收

1. **`evolution.json` 记录了什么？** 能说出它记录了每次运行的 timestamp、sessionId、success、turnCount、duration 吗？
2. **评测是怎么进行的？** 能说出定义测试用例 → 运行 Skill → 评估输出 → 生成报告吗？
3. **运行报告是给谁看的？** 能说出是给开发者看的质量分析吗？
4. **评测的评估逻辑有什么局限？** 能说出字符串匹配无法验证语义吗？
5. **如果 `evolution.json` 格式损坏，会发生什么？** 能说出无法读取运行记录吗？

## 本课结论

本课建立了 Skill 评测的完整认知：

- **`evolution.json` 记录运行数据**：timestamp、sessionId、success、turnCount、duration
- **评测是自动化的**：定义测试用例 → 运行 Skill → 评估输出 → 生成报告
- **评估逻辑有局限**：字符串匹配无法验证语义
- **运行报告是结构化的**：发现 → 证据 → 建议
- **评测是开发工具**：不是用户可见的产物

下一课（L07）将深入 Skill 的加载链路——从磁盘到内存的完整过程。
