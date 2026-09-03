# L22：`role-agent-creator`——角色 Agent 创建

> 本课问题：`role-agent-creator` 是如何帮助用户创建具有专业角色的 Agent 的？角色模板是怎么工作的？

## 小林的场景

小林想创建一个“架构师”Agent，帮助她设计系统架构。她发现 `role-agent-creator` 提供了现成的角色模板，可以快速创建。

她想知道：

- 角色模板有哪些？
- 基于模板创建和完全自定义有什么区别？
- 角色 Agent 和普通 Agent 有什么不同？

## 概念阶梯：角色 Agent 不是“换皮”，而是“专业定位”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “角色就是换个名字” | 角色是**专业背景、工作方式、判断风格**的定义 | 不是简单的名称，而是完整的专业定位 |
| “模板是限制创意的” | 模板是**起点**，不是终点 | 可以基于模板修改，也可以完全自定义 |
| “角色 Agent 和普通 Agent 一样” | 角色 Agent 有**预设的专业能力** | 不是一样的，角色 Agent 更专注 |

## 第一段源码：`role-agent-creator` 的 Frontmatter

```typescript
// [templates/skills/role-agent-creator/SKILL.md 第 1—18 行](../../../../templates/skills/role-agent-creator/SKILL.md#L1)
---
name: role-agent-creator
description: 角色 Agent 创建助手，帮助用户基于专业角色模板或自定义角色创建 Agent，生成完整的 Agent 工程文件
originos-system: true
version: 1.0.0
type: COMPOSITE
author: OriginOS
outputDir: data/
tags:
  - agent
  - role
  - creator
reads: []
writes:
  - agent
---
```

**关键字段**：

| 字段 | 值 | 含义 |
| --- | --- | --- |
| `type` | `COMPOSITE` | 多阶段编排 |
| `writes` | `agent` | 输出 Agent 定义 |
| `outputDir` | `data/` | 输出目录 |

## 第二段源码：角色模板库

```typescript
// [templates/skills/role-agent-creator/SKILL.md 第 24—40 行](../../../../templates/skills/role-agent-creator/SKILL.md#L24)
## 角色模板库

### 技术类
- **架构师** — 系统设计、技术选型、架构评审
- **代码审查专家** — 代码质量、安全漏洞、最佳实践
- **测试工程师** — 测试策略、用例设计、质量保障
- **DevOps 工程师** — CI/CD、部署、监控运维

### 产品类
- **产品经理** — 需求分析、优先级排序、用户故事
- **UX 设计师** — 用户体验、交互设计、可用性评估
- **数据分析师** — 数据洞察、指标分析、决策支持

### 业务类
- **项目经理** — 进度管理、风险识别、团队协调
- **业务分析师** — 流程梳理、需求挖掘、方案设计
- **客户成功** — 客户关系、问题解决、价值传递
```

**角色模板分类**：

| 类别 | 角色 | 核心能力 |
| --- | --- | --- |
| **技术类** | 架构师、代码审查专家、测试工程师、DevOps 工程师 | 技术设计、代码质量、测试、运维 |
| **产品类** | 产品经理、UX 设计师、数据分析师 | 需求分析、用户体验、数据分析 |
| **业务类** | 项目经理、业务分析师、客户成功 | 进度管理、流程梳理、客户关系 |

## 第三段源码：启动流程

```typescript
// [templates/skills/role-agent-creator/SKILL.md 第 42—60 行](../../../../templates/skills/role-agent-creator/SKILL.md#L42)
## 启动流程

收到用户第一条消息时，先发送问候语：

> 你好！我是 Persona，角色设计师。
>
> 我帮你创建的不只是一个 Agent，而是一个有专业背景和工作方式的智能伙伴。
>
> 你可以从现有角色模板开始，也可以完全自定义一个角色。

然后**在同一条消息末尾**，输出以下 yaml block：

```yaml
question: "你想怎么创建这个角色 Agent？"
options:
  - label: "从模板开始"
    description: "选择一个专业角色模板，快速创建并定制"
  - label: "完全自定义"
    description: "从零开始，完全按照你的想法设计角色"
```

**启动流程**：

1. **问候语**：介绍身份和能力
2. **选项卡**：提供两种创建方式
3. **用户选择**：从模板开始 或 完全自定义

## 第四段源码：基于模板创建 vs 完全自定义

```typescript
// [templates/skills/role-agent-creator/SKILL.md 第 65—80 行](../../../../templates/skills/role-agent-creator/SKILL.md#L65)
### 从模板开始

1. 用户选择角色模板（如"架构师"）
2. 加载模板的默认配置
3. 用户可以根据需要修改：
   - 角色名称
   - 专业领域
   - 工作方式
   - 判断风格
4. 生成完整的 Agent 工程文件

### 完全自定义

1. 用户描述想要的角色
2. 对话收集角色的专业背景、工作方式、判断风格
3. 生成完整的 Agent 工程文件
```

**两种方式对比**：

| 维度 | 从模板开始 | 完全自定义 |
| --- | --- | --- |
| **起点** | 预设模板 | 空白 |
| **速度** | 快 | 慢 |
| **灵活性** | 中（可修改） | 高（完全自由） |
| **适用场景** | 有现成角色 | 独特角色 |
| **输出质量** | 稳定 | 依赖用户描述 |

## 调用链：角色 Agent 创建流程

```text
用户说 "I want to create an architect agent"
  → role-agent-creator 激活
    → 发送问候语和选项卡
      → 用户选择"从模板开始"
        → 显示角色模板列表
          → 用户选择"架构师"
            → 加载架构师模板
              → 用户修改配置（可选）
                → 生成 Agent 工程文件
                  → 输出到 data/agents/
      → 或用户选择"完全自定义"
        → 对话收集角色信息
          → 生成 Agent 工程文件
            → 输出到 data/agents/
```

## 失败路径：角色 Agent 创建可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 模板不匹配 | 创建出的 Agent 不符合预期 | 选择了错误的模板 |
| 自定义描述不清 | 生成的 Agent 质量差 | 用户描述不充分 |
| 配置冲突 | Agent 行为异常 | 修改了不兼容的配置 |
| 输出目录不存在 | 创建失败 | `data/agents/` 未创建 |
| 角色定位模糊 | Agent 能力边界不清 | 没有明确的专业定位 |

## 测试证据

```bash
# 检查 role-agent-creator 的文件结构
ls -la templates/skills/role-agent-creator/

# 检查角色模板
ls templates/skills/role-agent-creator/assets/ 2>/dev/null || echo "No assets directory"

# 检查输出目录
ls data/agents/ 2>/dev/null || echo "No user agents yet"
```

## 小实验

**实验 1：分析角色模板**

| 类别 | 角色 | 核心能力 | 适用场景 |
| --- | --- | --- | --- |
| 技术类 | 架构师 | 系统设计、技术选型 | 系统架构设计 |
| 技术类 | 代码审查专家 | 代码质量、安全漏洞 | 代码审查 |
| 产品类 | 产品经理 | 需求分析、优先级排序 | 产品规划 |
| 业务类 | 项目经理 | 进度管理、风险识别 | 项目管理 |

**实验 2：设计一个自定义角色**

假设你要创建一个“技术写作专家”Agent，请回答：

1. 这个专业角色的核心能力是什么？
2. 它的工作方式是什么？
3. 它的判断风格是什么？

## 口头验收

1. **`role-agent-creator` 提供哪些角色模板？** 能说出技术类、产品类、业务类吗？
2. **基于模板创建和完全自定义的区别是什么？** 能说出前者快但灵活性低，后者慢但灵活性高吗？
3. **角色 Agent 和普通 Agent 的区别是什么？** 能说出角色 Agent 有预设的专业能力吗？
4. **创建完成后，Agent 输出到哪里？** 能说出 `data/agents/` 吗？
5. **如果模板不匹配，怎么办？** 能说出选择完全自定义或修改模板吗？

## 本课结论

本课建立了 `role-agent-creator` 的完整认知：

- **角色模板是起点**：不是限制，而是快速开始的方式
- **三种角色类别**：技术类、产品类、业务类
- **两种创建方式**：从模板开始（快）、完全自定义（灵活）
- **角色 Agent 有预设能力**：不是简单的名称，而是完整的专业定位
- **输出到 `data/agents/`**：用户创建的 Agent 和系统内置分开

下一课（L23）将深入 `agent-creator`，了解通用 Agent 的创建。
