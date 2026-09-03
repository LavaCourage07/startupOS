# F63：`RuleEngine` —— 混合模式规则引擎

## 开篇场景

Agent 在处理用户请求时，需要遵守一些规则："预算不能超过 10 万"、"敏感数据不能外传"、"先确认再执行"。有些规则可以用代码验证（如预算 < 10 万），有些规则只能用自然语言描述（如"敏感数据"的定义）。`RuleEngine` 支持两种模式：结构化规则（json-logic）和自然语言规则。

## 核心问题

**`RuleEngine` 如何验证规则？结构化规则和自然语言规则有什么区别？Agent 如何使用规则？**

## 概念阶梯

### 1. 规则类型

```typescript
type RuleType = 'invariant' | 'precondition' | 'postcondition' | 'constraint' | 'derivation';
type RuleSeverity = 'error' | 'warning' | 'info';

interface Rule {
  id: string;
  name: string;
  type: RuleType;
  description: string;
  expression?: RuleExpression;  // 结构化规则
  severity: RuleSeverity;
  enabled: boolean;
}
```

### 2. 规则分类

| 类型 | 说明 | 验证时机 |
|---|---|---|
| **invariant** | 不变量，始终为真 | 任何修改后 |
| **precondition** | 前置条件，执行前必须满足 | 执行前 |
| **postcondition** | 后置条件，执行后必须满足 | 执行后 |
| **constraint** | 约束，限制某些行为 | 任何修改后 |
| **derivation** | 推导规则，从已知推导未知 | 查询时 |

### 3. 混合模式验证

```
RuleEngine.validate()
  ├── 结构化规则（json-logic）
  │     └── 机器求值 → 返回 violations
  └── 自然语言规则（无 expression）
        └── 生成 Agent prompt → 供 Agent 判断
```

## 源码精读

### 1. validate 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/rule-engine.ts 第 30-51 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/rule-engine.ts#L30)

```typescript
validate(): RuleEngineResult {
  const violations: RuleViolation[] = [];
  const agentPrompts: AgentRulePrompt[] = [];

  for (const rule of this.ontology.rules) {
    if (!rule.enabled) continue;

    if (rule.expression?.format === 'json-logic') {
      // 结构化规则：机器求值
      const v = this.evaluateStructuredRule(rule);
      if (v) violations.push(v);
    } else {
      // 自然语言规则：生成 Agent prompt
      agentPrompts.push(this.buildAgentPrompt(rule));
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    agentPrompts,
  };
}
```

**关键点**：
- `enabled: false` 的规则跳过
- 有 `expression` 且 `format === 'json-logic'` 的是结构化规则
- 无 `expression` 的是自然语言规则

### 2. 结构化规则求值

[packages/core/src/lib/integrations/pi-agent/cognitive/rule-engine.ts 第 76-90 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/rule-engine.ts#L76)

```typescript
private evaluateStructuredRule(rule: Rule): RuleViolation | null {
  const expr = rule.expression!;
  if (expr.format !== 'json-logic') return null;

  const result = evaluateJsonLogic(expr.body, this.ontology);
  if (result === false) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: rule.description,
    };
  }
  return null;
}
```

### 3. Agent Prompt 生成

[packages/core/src/lib/integrations/pi-agent/cognitive/rule-engine.ts 第 92-100 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/rule-engine.ts#L92)

```typescript
private buildAgentPrompt(rule: Rule): AgentRulePrompt {
  const severityLabel = rule.severity === 'error' ? '必须遵守'
    : rule.severity === 'warning' ? '建议遵守'
    : '参考';
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    description: rule.description,
    prompt: `【${severityLabel}】规则「${rule.name}」（${rule.type}）：${rule.description}\n请检查当前本体状态是否违反此规则。`,
  };
}
```

**生成的 Prompt 示例**：
```
【必须遵守】规则「budget_constraint」（constraint）：预算不能超过 10 万
请检查当前本体状态是否违反此规则。
```

### 4. JSON-Logic 示例

```json
{
  "name": "budget_constraint",
  "type": "constraint",
  "description": "预算不能超过 10 万",
  "expression": {
    "format": "json-logic",
    "body": {
      "<": [
        { "var": "budget" },
        100000
      ]
    }
  },
  "severity": "error",
  "enabled": true
}
```

## 真实调用链

```
Agent 处理用户请求
  → RuleEngine.validate()
       ├─ 结构化规则 → 机器求值
       │     ├─ 通过 → 继续
       │     └─ 失败 → 返回 violation
       └─ 自然语言规则 → 生成 Agent prompt
             → Agent 判断是否违反
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| json-logic 语法错误 | 返回 true（默认通过） | `evaluateJsonLogic` 的 default 分支 |
| 规则 disabled | 跳过 | `!rule.enabled` |
| 自然语言规则无 expression | 生成 Agent prompt | `else` 分支 |
| 求值器不支持某运算符 | 返回 true | `default: return true` |

## 练习与验收

1. **设计规则**：为 "用户年龄必须大于 18 岁" 设计一个 JSON-Logic 规则。
2. **分析混合模式**：什么场景适合用结构化规则？什么场景适合用自然语言规则？
3. **扩展求值器**：如果要支持 `"in"` 运算符（检查数组包含），如何修改 `evaluateJsonLogic`？

**验收标准**：能设计结构化规则，理解混合模式的优势。

## 章节收束

`RuleEngine` 讲完了。下一节课（F64）看 `SleepComputeScheduler` 睡眠计算调度器。
