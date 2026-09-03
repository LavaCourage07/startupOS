# G62：SkillService 执行流程——从加载到完成

> 本课核心问题：`SkillService` 是怎么从加载技能到完成执行的？

## 1. 开篇场景：小王执行一个技能

小王在 OriginOS 中输入："帮我查询所有进行中任务"。

系统需要：
1. 识别意图（信息查询）。
2. 路由到 info-query 技能。
3. 加载技能处理器。
4. 创建执行会话。
5. 执行技能。
6. 返回结果。

## 2. 两种执行策略

### 2.1 同步执行

```ts
const result = skill.execute(input);
console.log(result);
```

缺点：阻塞主线程，无法处理长时间运行的技能。

### 2.2 异步执行

```ts
const session = await skillService.startSkillExecution(request);
const result = await skillService.completeSkillExecution(session.sessionId);
```

OriginOS 选择了**异步执行**。

## 3. 源码精读：`service.ts` 执行流程

打开 [packages/core/src/lib/features/skills/service.ts](../../../../packages/core/src/lib/features/skills/service.ts)。

### 3.1 完成技能执行

```ts
async completeSkillExecution(sessionId: string): Promise<SkillExecutionResult> {
  // 1. 获取会话
  const session = await this.sessionStore.get(sessionId);
  if (!session) {
    return {
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: `找不到会话: ${sessionId}`,
      },
    };
  }

  // 2. 获取技能
  const skill = await this.skillRegistry.get(session.skillName);
  if (!skill) {
    return {
      success: false,
      error: {
        code: 'SKILL_NOT_FOUND',
        message: `找不到技能: ${session.skillName}`,
      },
    };
  }

  // 3. 加载处理器
  const handler = await this.loadSkillHandler(skill);

  // 4. 执行技能
  const result = await this.skillExecutor.execute({
    skill,
    handler,
    session,
    input: session.input,
  });

  // 5. 更新会话状态
  await this.sessionStore.update(sessionId, {
    status: 'completed',
    result,
    completedAt: new Date().toISOString(),
  });

  return {
    success: true,
    sessionId,
    result,
  };
}
```

对应源码位置：[packages/core/src/lib/features/skills/service.ts 第 251—400 行](../../../../packages/core/src/lib/features/skills/service.ts#L251-L400)。

### 3.2 获取执行时间线

```ts
async getSkillExecutionTimeline(sessionId: string): Promise<SkillExecutionTimeline> {
  const session = await this.sessionStore.get(sessionId);
  if (!session) {
    return {
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: `找不到会话: ${sessionId}`,
      },
    };
  }

  return {
    success: true,
    timeline: session.timeline || [],
    status: session.status,
    startedAt: session.createdAt,
    completedAt: session.completedAt,
  };
}
```

对应源码位置：[packages/core/src/lib/features/skills/service.ts 第 401—500 行](../../../../packages/core/src/lib/features/skills/service.ts#L401-L500)。

## 4. 图解：执行流程

```
用户输入
  │
  ▼
┌──────────────────┐
│  detectIntent()  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  route to skill  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ loadSkillHandler │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ create session   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ execute skill    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ update session   │
└────────┬─────────┘
         │
         ▼
      结果
```

## 5. 设计亮点

### 5.1 会话状态管理

```ts
interface SkillSession {
  id: string;
  skillName: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: unknown;
  result?: unknown;
  timeline: SkillExecutionEvent[];
  createdAt: string;
  completedAt?: string;
}
```

### 5.2 时间线追踪

```ts
interface SkillExecutionEvent {
  type: 'start' | 'step' | 'tool_call' | 'complete' | 'error';
  timestamp: string;
  data: Record<string, unknown>;
}
```

## 6. 测试证据与缺口

### 已覆盖

- `completeSkillExecution` 没有直接测试。

### 缺口

- 会话状态流转没有测试。
- 时间线追踪没有测试。
- 错误恢复没有测试。

## 7. 小实验：执行流程

```ts
import { SkillService } from '@originos/core/lib/features/skills';

const service = new SkillService(deps);

// 开始执行
const startResult = await service.startSkillExecution({
  skillName: 'task-manager',
  userId: 'user-123',
  input: { message: '创建任务：完成文档' },
});

// 完成执行
const completeResult = await service.completeSkillExecution(startResult.sessionId!);
console.log(completeResult.result);

// 获取时间线
const timeline = await service.getSkillExecutionTimeline(startResult.sessionId!);
console.log(timeline.timeline);
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `completeSkillExecution` 的流程是什么？
2. 会话有哪些状态？
3. 时间线事件有哪些类型？
4. 如果会话找不到，返回什么错误？

## 9. 章节收束

本课的核心认知是 **`SkillService` 通过异步执行模型，支持技能的分阶段执行和状态追踪**。

我们看到的几个关键设计：

- **异步执行**：支持长时间运行的技能。
- **会话状态**：pending → running → completed/failed。
- **时间线追踪**：记录执行过程中的关键事件。
- **无测试**：没有直接测试覆盖。

下一课（G63）我们会看 `SkillService` 的流式执行，了解 SSE 是怎么工作的。
