# G65：DefaultSkillRouter——技能是怎么路由的

> 本课核心问题：`DefaultSkillRouter` 是怎么根据请求路由到合适技能的？

## 1. 开篇场景：小王输入不同指令

小王输入不同指令，系统需要路由到不同技能：
- "创建任务" → task-manager
- "查询项目" → info-query
- "编辑本体" → ontology-editor

## 2. 两种路由策略

### 2.1 精确匹配

```ts
if (input === '创建任务') return 'task-manager';
if (input === '查询项目') return 'info-query';
```

缺点：无法处理模糊输入。

### 2.2 优先级规则匹配

```ts
const rules = [
  { pattern: /任务|task/i, skill: 'task-manager', priority: 100 },
  { pattern: /查询|query/i, skill: 'info-query', priority: 90 },
];
```

OriginOS 选择了**优先级规则匹配**。

## 3. 源码精读：`registry.ts` 路由部分

打开 [packages/core/src/lib/features/skills/registry.ts](../../../../packages/core/src/lib/features/skills/registry.ts)。

### 3.1 DefaultSkillRouter 类定义

```ts
class DefaultSkillRouter implements SkillRouter {
  private rules: SkillRoutingRule[] = [];

  addRule(rule: SkillRoutingRule): void {
    this.rules.push(rule);
    // Sort by priority (highest first)
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  async route(request: SkillRoutingRequest): Promise<LoadedSkill | null> {
    // Sort rules by priority
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);

    // Find first matching rule
    for (const rule of sortedRules) {
      if (await this.matchesRule(rule, request)) {
        return rule.skill;
      }
    }

    return null;
  }

  private async matchesRule(rule: SkillRoutingRule, request: SkillRoutingRequest): Promise<boolean> {
    // Check if the rule matches the request
    return rule.pattern.test(request.input);
  }
}
```

对应源码位置：[packages/core/src/lib/features/skills/registry.ts 第 1—136 行](../../../../packages/core/src/lib/features/skills/registry.ts#L1-L136)。

### 3.2 路由规则

```ts
interface SkillRoutingRule {
  pattern: RegExp;
  skill: LoadedSkill;
  priority: number;
}

interface SkillRoutingRequest {
  input: string;
  context?: Record<string, unknown>;
}
```

## 4. 图解：路由流程

```
用户输入: "创建任务"
  │
  ▼
┌──────────────────┐
│ 遍历路由规则      │
│ 按优先级排序      │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌──────────
│ 规则1 │ │ 规则2    │
│ 任务  │ │ 查询     │
│ ✓ 匹配│ │ ✗ 不匹配 │
└───┬───┘ └──────────┘
    │
    ▼
┌─────────────┐
│ task-manager│
└─────────────┘
```

## 5. 设计亮点

### 5.1 优先级排序

```ts
this.rules.sort((a, b) => b.priority - a.priority);
```

- 高优先级规则优先匹配。
- 支持动态调整优先级。

### 5.2 正则匹配

```ts
private async matchesRule(rule: SkillRoutingRule, request: SkillRoutingRequest): Promise<boolean> {
  return rule.pattern.test(request.input);
}
```

- 支持复杂匹配模式。
- 支持中英文混合。

## 6. 测试证据与缺口

### 已覆盖

- `DefaultSkillRouter` 没有直接测试。

### 缺口

- 路由规则没有测试。
- 优先级排序没有测试。
- 正则匹配没有测试。

## 7. 小实验：路由技能

```ts
import { DefaultSkillRouter, DefaultSkillRegistry } from '@originos/core/lib/features/skills';

const registry = new DefaultSkillRegistry();
const router = new DefaultSkillRouter();

// 注册技能
const taskManagerSkill = {
  metadata: { name: 'task-manager', description: '任务管理', scope: 'bundled', tags: [], version: '1.0.0' },
  handler: async () => ({ success: true, data: {} }),
};
registry.register(taskManagerSkill);

// 添加路由规则
router.addRule({
  pattern: /任务|task/i,
  skill: taskManagerSkill,
  priority: 100,
});

// 路由
const result = await router.route({ input: '创建任务' });
console.log(result?.metadata.name); // 'task-manager'
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `DefaultSkillRouter` 怎么排序规则？
2. `matchesRule` 是怎么匹配的？
3. 如果没有规则匹配，返回什么？
4. 路由规则的优先级是怎么工作的？

## 9. 章节收束

本课的核心认知是 **`DefaultSkillRouter` 通过优先级规则匹配，将用户输入路由到合适的技能**。

我们看到的几个关键设计：

- **优先级排序**：高优先级规则优先匹配。
- **正则匹配**：支持复杂匹配模式。
- **动态规则**：支持运行时添加规则。
- **无测试**：没有直接测试覆盖。

下一课（G66）我们会进入 `SkillExecutor`，了解技能是怎么被执行的。
