# L27：`domain-discovery`——领域发现

> 本课问题：`domain-discovery` 是如何识别和定义业务领域的？

## 小林的场景

小林在访谈中描述了她的"在线书店"想法。`domain-discovery` 需要帮她识别出这是一个什么领域，有哪些核心概念。

她想知道：

- 领域是怎么被识别的？
- 核心概念是怎么被提取的？
- 领域发现的结果是什么？

## 概念阶梯：领域发现不是“分类”，而是“建模”

| 通俗理解 | 准确术语 | 边界 |
| --- | --- | --- |
| “领域就是行业分类” | 领域是**业务边界和核心概念的集合** | 不是简单的分类，而是业务模型 |
| “领域发现是一次性的” | 领域发现是**迭代的** | 不是一次性的，可以不断完善 |
| “领域发现没有标准” | 领域发现有**行业最佳实践** | 不是任意的，有参考模型 |

## 第一段源码：`domain-discovery` 的 Frontmatter

```typescript
// [templates/skills/domain-discovery/SKILL.md 第 1—10 行](../../../../templates/skills/domain-discovery/SKILL.md#L1)
---
name: domain-discovery
description: Discover and define business domains. Use when the user needs to identify and model their business domain.
originos-system: true
version: 1.0.0
type: SIMPLE
tags:
  - domain
  - discovery
  - modeling
---
```

**关键字段**：

| 字段 | 值 | 含义 |
| --- | --- | --- |
| `type` | `SIMPLE` | 单一用途 |
| `tags` | `domain`、`discovery`、`modeling` | 领域、发现、建模 |

## 第二段源码：领域发现的方法

```typescript
// [templates/skills/domain-discovery/SKILL.md 第 15—30 行](../../../../templates/skills/domain-discovery/SKILL.md#L15)
## Discovery Process

1. **Identify the domain**
   - What industry does the business belong to?
   - What are the core business activities?
   - Who are the stakeholders?

2. **Define the boundaries**
   - What is in scope?
   - What is out of scope?
   - What are the constraints?

3. **Extract core concepts**
   - What are the key entities?
   - What are the relationships?
   - What are the business rules?

4. **Validate the model**
   - Does it cover all requirements?
   - Are there any contradictions?
   - Is it aligned with industry best practices?
```

**发现方法**：

| 步骤 | 名称 | 目标 |
| --- | --- | --- |
| 1 | 识别领域 | 确定行业、核心活动、干系人 |
| 2 | 定义边界 | 确定范围、约束 |
| 3 | 提取概念 | 识别实体、关系、规则 |
| 4 | 验证模型 | 检查完整性、一致性 |

## 第三段源码：领域发现的输出

```typescript
// [templates/skills/domain-discovery/SKILL.md 第 35—50 行](../../../../templates/skills/domain-discovery/SKILL.md#L35)
## Output

The domain discovery produces:

- **Domain name**: The identified business domain
- **Domain description**: A brief description of the domain
- **Core concepts**: Key entities and their relationships
- **Business rules**: Rules that govern the domain
- **Stakeholders**: People or systems involved
- **Boundaries**: Scope and constraints
```

**输出产物**：

| 产物 | 说明 | 示例 |
| --- | --- | --- |
| **Domain name** | 领域名称 | "电子商务" |
| **Domain description** | 领域描述 | "在线图书销售" |
| **Core concepts** | 核心概念 | 用户、图书、订单、支付 |
| **Business rules** | 业务规则 | 库存不能为负 |
| **Stakeholders** | 干系人 | 买家、卖家、管理员 |
| **Boundaries** | 边界 | 仅图书，不含电子书 |

## 第四段源码：行业最佳实践

```typescript
// [templates/skills/domain-discovery/SKILL.md 第 55—65 行](../../../../templates/skills/domain-discovery/SKILL.md#L55)
## Industry Best Practices

Common domain patterns:

- **E-commerce**: Product, Order, Payment, Shipping
- **SaaS**: Tenant, User, Subscription, Feature
- **Social**: User, Post, Comment, Like
- **Finance**: Account, Transaction, Ledger, Balance
```

**常见领域模式**：

| 领域 | 核心概念 |
| --- | --- |
| **E-commerce** | Product, Order, Payment, Shipping |
| **SaaS** | Tenant, User, Subscription, Feature |
| **Social** | User, Post, Comment, Like |
| **Finance** | Account, Transaction, Ledger, Balance |

## 调用链：领域发现流程

```text
用户描述业务场景
  → domain-discovery 激活
    → 识别领域（行业、活动、干系人）
      → 定义边界（范围、约束）
        → 提取概念（实体、关系、规则）
          → 验证模型（完整性、一致性）
            → 输出领域定义
```

## 失败路径：领域发现可能出什么问题

| 问题 | 现象 | 原因 |
| --- | --- | --- |
| 领域识别错误 | 业务模型偏差 | 用户描述不清 |
| 边界模糊 | 范围失控 | 没有明确约束 |
| 概念遗漏 | 模型不完整 | 提取不充分 |
| 规则矛盾 | 业务逻辑错误 | 没有验证一致性 |
| 行业知识不足 | 建议不准确 | 缺乏行业经验 |

## 测试证据

```bash
# 检查 domain-discovery 的文件
cat templates/skills/domain-discovery/SKILL.md

# 检查输出目录
ls data/ontology/ 2>/dev/null || echo "No ontology yet"
```

## 小实验

**实验 1：识别领域**

| 业务场景 | 领域 | 核心概念 |
| --- | --- | --- |
| 在线书店 | 电子商务 | 用户、图书、订单、支付 |
| 社交网络 | 社交 | 用户、帖子、评论、点赞 |
| 银行系统 | 金融 | 账户、交易、账本、余额 |

**实验 2：定义边界**

假设用户说："我想做一个在线书店"

- 在范围内：图书浏览、搜索、购买、支付
- 不在范围内：电子书、 audiobook、实体配送
- 约束：仅中文图书、仅中国大陆

## 口头验收

1. **领域发现的四个步骤是什么？** 能说出识别领域 → 定义边界 → 提取概念 → 验证模型吗？
2. **领域发现的输出是什么？** 能说出领域名称、描述、核心概念、业务规则、干系人、边界吗？
3. **常见领域模式有哪些？** 能说出 E-commerce、SaaS、Social、Finance 吗？
4. **如果领域识别错误，会发生什么？** 能说出业务模型偏差吗？
5. **边界模糊会导致什么问题？** 能说出范围失控吗？

## 本课结论

本课建立了 `domain-discovery` 的完整认知：

- **领域发现是建模过程**：不是分类，而是构建业务模型
- **四步法**：识别领域 → 定义边界 → 提取概念 → 验证模型
- **输出产物**：领域名称、描述、核心概念、业务规则、干系人、边界
- **行业最佳实践**：E-commerce、SaaS、Social、Finance 等模式
- **迭代过程**：可以不断完善

下一课（L28）将深入 `business-refinement`，了解业务精炼的方法。
