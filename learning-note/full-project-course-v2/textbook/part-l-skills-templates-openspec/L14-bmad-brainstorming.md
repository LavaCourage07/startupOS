# L14：`bmad-brainstorming`——创意发散

> 本课问题：`bmad-brainstorming` 是如何帮助用户进行创意发散的？它和普通的聊天有什么不同？

## 小林的场景

小林想设计一个新的 Agent，但她不知道这个 Agent 应该具备哪些能力。她打开 `bmad-brainstorming`，希望通过系统化的方法激发创意。

她想知道：

- 创意发散是怎么被系统化的？
- 有哪些创意技巧？
- 发散后的结果怎么被整理？

## 概念阶梯：创意发散不是“随便聊”，而是“结构化探索”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “创意发散就是聊天” | 创意发散是**结构化的探索过程** | 不是随意的对话，而是有方法论的 |
| “创意越多越好” | 创意需要**筛选和精炼** | 不是数量越多越好，而是要有质量 |
| “创意发散没有输出” | 创意发散有**结构化的输出** | 不是空对空的讨论，而是有产物 |

## 第一段源码：`bmad-brainstorming` 的 SKILL.md

```typescript
// [templates/skills/bmad-brainstorming/SKILL.md 第 1—8 行](../../../../templates/skills/bmad-brainstorming/SKILL.md#L1)
---
name: bmad-brainstorming
description: 'Facilitate interactive brainstorming sessions using diverse creative techniques and ideation methods. Use when the user says help me brainstorm or help me ideate.'
originos-system: true
---

Follow the instructions in ./workflow.md.
```

**关键特征**：

1. **触发条件**：用户说"help me brainstorm"或"help me ideate"
2. **执行方式**：加载 `./workflow.md`
3. **简洁定义**：只有 frontmatter 和一句话的 body

**关键判断**：`bmad-brainstorming` 是**委托式**的——它把具体逻辑委托给 `workflow.md`。

## 第二段源码：`workflow.md` 的结构

```typescript
// [templates/skills/bmad-brainstorming/workflow.md 第 1—30 行](../../../../templates/skills/bmad-brainstorming/workflow.md#L1)
# Brainstorming Workflow

## Phase 1: Problem Framing

1. Understand the user's goal
2. Define the scope and constraints
3. Identify stakeholders

## Phase 2: Divergent Thinking

1. Apply creative techniques (see brain-methods.csv)
2. Generate as many ideas as possible
3. Defer judgment

## Phase 3: Convergent Thinking

1. Cluster similar ideas
2. Evaluate against criteria
3. Select top ideas

## Phase 4: Action Planning

1. Define next steps
2. Assign responsibilities
3. Set timelines
```

**四阶段流程**：

| 阶段 | 名称 | 目标 | 方法 |
| --- | --- | --- | --- |
| 1 | Problem Framing | 明确问题 | 理解目标、定义范围、识别干系人 |
| 2 | Divergent Thinking | 发散创意 | 应用创意技巧、生成想法、延迟判断 |
| 3 | Convergent Thinking | 收敛创意 | 聚类、评估、筛选 |
| 4 | Action Planning | 行动计划 | 定义步骤、分配责任、设定时间 |

## 第三段源码：创意技巧库

```typescript
// [templates/skills/bmad-brainstorming/brain-methods.csv 第 1—10 行](../../../../templates/skills/bmad-brainstorming/brain-methods.csv#L1)
technique,description,when_to_use
"SCAMPER","Substitute, Combine, Adapt, Modify, Put to another use, Eliminate, Reverse","When improving an existing product or service"
"Six Thinking Hats","White (facts), Red (emotions), Black (risks), Yellow (benefits), Green (creativity), Blue (process)","When exploring multiple perspectives"
"Mind Mapping","Visual representation of ideas and connections","When exploring relationships between ideas"
"Random Word","Use a random word to trigger new associations","When stuck or need fresh perspectives"
"Reverse Brainstorming","Identify ways to cause the problem","When traditional brainstorming isn't working"
```

**创意技巧**：

| 技巧 | 描述 | 适用场景 |
| --- | --- | --- |
| **SCAMPER** | 替代、组合、适应、修改、他用、消除、反转 | 改进现有产品 |
| **Six Thinking Hats** | 白（事实）、红（情感）、黑（风险）、黄（收益）、绿（创意）、蓝（流程） | 多视角探索 |
| **Mind Mapping** | 可视化想法和连接 | 探索关系 |
| **Random Word** | 随机词触发联想 | 需要新视角 |
| **Reverse Brainstorming** | 找出导致问题的方法 | 传统方法无效 |

## 第四段源码：`evolution.json`——追踪创意发散的效果

```typescript
// [templates/skills/bmad-brainstorming/evolution.json 第 1—30 行](../../../../templates/skills/bmad-brainstorming/evolution.json#L1)
{
  "runs": [
    {
      "timestamp": "2026-06-15T10:30:00.000Z",
      "sessionId": "brainstorm-001",
      "success": true,
      "turnCount": 12,
      "duration": 3456,
      "ideasGenerated": 24,
      "ideasSelected": 3
    }
  ],
  "version": 1
}
```

**追踪指标**：

| 指标 | 含义 | 作用 |
| --- | --- | --- |
| `ideasGenerated` | 生成的想法数量 | 衡量发散程度 |
| `ideasSelected` | 选中的想法数量 | 衡量收敛效果 |
| `turnCount` | 对话轮数 | 衡量会话深度 |
| `duration` | 持续时间 | 衡量效率 |

## 调用链：创意发散流程

```text
用户说 "help me brainstorm"
  → bmad-brainstorming 激活
    → 加载 workflow.md
      → Phase 1: Problem Framing（明确问题）
        → Phase 2: Divergent Thinking（应用技巧，生成想法）
          → Phase 3: Convergent Thinking（聚类、评估、筛选）
            → Phase 4: Action Planning（制定行动计划）
              → 记录到 evolution.json
```

## 失败路径：创意发散可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 问题定义不清 | 发散方向混乱 | Phase 1 不充分 |
| 过早判断 | 创意被扼杀 | Phase 2 中用户或 Agent 过早评价 |
| 收敛困难 | 想法太多，无法选择 | Phase 3 缺乏评估标准 |
| 行动计划模糊 | 无法执行 | Phase 4 步骤不清晰 |
| 技巧选择不当 | 效果不佳 | brain-methods.csv 中的技巧不匹配 |

## 测试证据

```bash
# 检查 brain-methods.csv
cat templates/skills/bmad-brainstorming/brain-methods.csv

# 检查 workflow.md
cat templates/skills/bmad-brainstorming/workflow.md

# 检查 evolution.json
cat templates/skills/bmad-brainstorming/evolution.json
```

## 小实验

**实验 1：分析创意发散的四阶段**

| 阶段 | 输入 | 输出 | 关键原则 |
| --- | --- | --- | --- |
| Problem Framing | 用户目标 | 明确的问题定义 | 理解、范围、约束 |
| Divergent Thinking | 问题定义 | 大量想法 | 延迟判断、数量优先 |
| Convergent Thinking | 大量想法 | 精选想法 | 聚类、评估、筛选 |
| Action Planning | 精选想法 | 行动计划 | 具体、可执行、有时限 |

**实验 2：对比 `bmad-brainstorming` 和普通聊天**

| 维度 | `bmad-brainstorming` | 普通聊天 |
| --- | --- | --- |
| 结构 | 四阶段流程 | 无固定结构 |
| 方法 | 创意技巧库 | 无系统方法 |
| 输出 | 结构化的行动计划 | 随意的对话记录 |
| 追踪 | evolution.json | 无 |

## 口头验收

1. **创意发散的四阶段是什么？** 能说出 Problem Framing → Divergent Thinking → Convergent Thinking → Action Planning 吗？
2. **`bmad-brainstorming` 和普通聊天有什么区别？** 能说出结构化的四阶段流程吗？
3. **有哪些创意技巧？** 能说出 SCAMPER、Six Thinking Hats、Mind Mapping 吗？
4. **创意发散的输出是什么？** 能说出结构化的行动计划吗？
5. **如果问题定义不清，会发生什么？** 能说出发散方向混乱吗？

## 本课结论

本课建立了 `bmad-brainstorming` 的完整认知：

- **创意发散是结构化的**：不是随意聊天，而是四阶段流程
- **创意技巧库提供方法**：SCAMPER、Six Thinking Hats、Mind Mapping 等
- **延迟判断是关键**：Phase 2 不要过早评价
- **输出是行动计划**：不是空对空的讨论
- **效果可追踪**：`evolution.json` 记录生成和选中的想法数量

下一课（L15）将深入 `bmad-distillator`，了解信息蒸馏的机制。
