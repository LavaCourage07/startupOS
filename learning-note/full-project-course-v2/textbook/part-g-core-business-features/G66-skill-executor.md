# G66：SkillExecutor——技能是怎么被执行的

> 本课核心问题：`SkillExecutor` 是怎么执行技能并注入工具的？

## 1. 开篇场景：小王执行本体编辑技能

小王输入："创建一个新项目，名为 OriginOS"。

系统需要：
1. 加载本体编辑技能处理器。
2. 创建工具上下文（createEntity、updateEntity 等）。
3. 执行技能处理器。
4. 返回结果。

## 2. 两种执行策略

### 2.1 直接执行

```ts
const result = await handler(input);
```

缺点：无法注入工具，无法追踪执行。

### 2.2 上下文注入执行

```ts
const context = createToolContext();
const result = await handler({ input, tools: context.tools });
```

OriginOS 选择了**上下文注入执行**。

## 3. 源码精读：`executor.ts`

打开 [packages/core/src/lib/features/skills/executor.ts](../../../../packages/core/src/lib/features/skills/executor.ts)。

### 3.1 SkillExecutor 类定义

```ts
class SkillExecutor {
  async execute(request: SkillExecutionRequest): Promise<SkillResult> {
    const { skill, handler, session, input } = request;

    // 1. 创建工具上下文
    const tools = this.createToolContext(session);

    // 2. 构建技能上下文
    const context: SkillContext = {
      input,
      session,
      tools,
    };

    // 3. 执行技能
    try {
      const result = await handler(context);
      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : '执行错误',
        },
      };
    }
  }
}
```

对应源码位置：[packages/core/src/lib/features/skills/executor.ts 第 1—128 行](../../../../packages/core/src/lib/features/skills/executor.ts#L1-L128)。

### 3.2 创建工具上下文

```ts
private createToolContext(session: SkillSession): SkillTools {
  return {
    createEntity: async (type: string, properties: Record<string, unknown>) => {
      // 调用本体服务创建实体
      return await ontologyService.createEntity(type, properties);
    },
    updateEntity: async (id: string, properties: Record<string, unknown>) => {
      return await ontologyService.updateEntity(id, properties);
    },
    queryEntities: async (type: string, where: Record<string, unknown>) => {
      return await ontologyService.queryEntities(type, where);
    },
    getRelated: async (id: string, relation: string) => {
      return await ontologyService.getRelated(id, relation);
    },
    callSkill: async (name: string, input: unknown) => {
      // 递归调用其他技能
      return await skillService.executeSkill(name, input);
    },
  };
}
```

## 4. 图解：执行流程

```
SkillService.execute()
  │
  ▼
┌──────────────────┐
│ SkillExecutor    │
│ .execute()       │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌──────────┐
│create │ │ handler  │
│tools  │ │ (context)│
└───┬───┘ └────┬─────┘
    │          │
    └────┬─────┘
         ▼
    SkillResult
```

## 5. 设计亮点

### 5.1 工具注入

```ts
const tools = this.createToolContext(session);
const context: SkillContext = { input, session, tools };
const result = await handler(context);
```

- 技能处理器通过 `tools` 参数访问系统能力。
- 解耦技能与底层实现。

### 5.2 错误处理

```ts
try {
  const result = await handler(context);
  return result;
} catch (error) {
  return {
    success: false,
    error: {
      code: 'EXECUTION_ERROR',
      message: error instanceof Error ? error.message : '执行错误',
    },
  };
}
```

## 6. 测试证据与缺口

### 已覆盖

- `SkillExecutor` 没有直接测试。

### 缺口

- 工具注入没有测试。
- 错误处理没有测试。
- 递归调用没有测试。

## 7. 小实验：执行技能

```ts
import { SkillExecutor } from '@originos/core/lib/features/skills';

const executor = new SkillExecutor();

const result = await executor.execute({
  skill: {
    metadata: { name: 'test', description: '测试', scope: 'bundled', tags: [], version: '1.0.0' },
    handler: async (context) => {
      const entity = await context.tools.createEntity!('Task', {
        title: '测试任务',
      });
      return { success: true, data: { entity } };
    },
  },
  handler: async (context) => {
    const entity = await context.tools.createEntity!('Task', {
      title: '测试任务',
    });
    return { success: true, data: { entity } };
  },
  session: { id: 'session-1', skillName: 'test', userId: 'user-1', status: 'running', input: {}, timeline: [], createdAt: '' },
  input: { message: '创建任务' },
});

console.log(result);
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `SkillExecutor` 注入哪些工具？
2. `createToolContext` 返回什么？
3. 技能处理器怎么使用工具？
4. 如果执行出错，返回什么？

## 9. 章节收束

本课的核心认知是 **`SkillExecutor` 通过创建工具上下文并注入到技能处理器，实现技能与系统能力的解耦**。

我们看到的几个关键设计：

- **工具注入**：通过 `tools` 参数注入系统能力。
- **解耦**：技能不直接依赖底层实现。
- **错误处理**：捕获异常并返回结构化错误。
- **无测试**：没有直接测试覆盖。

下一课（G67）我们会进入 `AgentDecisionMaker`，了解意图是怎么被检测的。
