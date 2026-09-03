# G63：SkillService 流式执行——SSE 是怎么工作的

> 本课核心问题：`SkillService` 是怎么通过 SSE（Server-Sent Events）流式返回技能执行结果的？

## 1. 开篇场景：小王和技能对话

小王在 OriginOS 中输入："帮我分析项目进度"。

系统需要：
1. 接收用户输入。
2. 流式返回分析结果（逐字显示）。
3. 支持中断和恢复。

## 2. 两种流式策略

### 2.1 轮询

```ts
setInterval(async () => {
  const result = await fetchResult();
  updateUI(result);
}, 1000);
```

缺点：延迟高，浪费带宽。

### 2.2 SSE（Server-Sent Events）

```ts
const eventSource = new EventSource('/api/skills/stream');
eventSource.onmessage = (event) => {
  updateUI(JSON.parse(event.data));
};
```

OriginOS 选择了**SSE**。

## 3. 源码精读：`service.ts` 流式执行

打开 [packages/core/src/lib/features/skills/service.ts](../../../../packages/core/src/lib/features/skills/service.ts)。

### 3.1 发送流式消息

```ts
async sendSkillExecutionMessage(
  request: SendSkillExecutionMessageRequest
): Promise<SkillExecutionResult> {
  // 1. 获取会话
  const session = await this.sessionStore.get(request.sessionId);
  if (!session) {
    return {
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: `找不到会话: ${request.sessionId}`,
      },
    };
  }

  // 2. 添加用户消息
  await this.sessionStore.addMessage(request.sessionId, {
    role: 'user',
    content: request.message,
    timestamp: new Date().toISOString(),
  });

  // 3. 获取或创建 Agent
  const agent = await this.agentManager.getOrCreateAgent({
    sessionId: request.sessionId,
    skillName: session.skillName,
  });

  // 4. 流式执行
  const result = await this.streamSkillExecutionMessage(request, (event) => {
    // Emit SSE event
    emitSSE(event);
  });

  return result;
}
```

对应源码位置：[packages/core/src/lib/features/skills/service.ts 第 501—700 行](../../../../packages/core/src/lib/features/skills/service.ts#L501-L700)。

### 3.2 流式执行核心

```ts
async streamSkillExecutionMessage(
  request: SendSkillExecutionMessageRequest,
  emit: (event: SSEEvent) => void
): Promise<SkillExecutionResult> {
  const session = await this.sessionStore.get(request.sessionId);
  if (!session) {
    return {
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: `找不到会话: ${request.sessionId}`,
      },
    };
  }

  // 获取 Agent
  const agent = await this.agentManager.getOrCreateAgent({
    sessionId: request.sessionId,
    skillName: session.skillName,
  });

  // 流式调用 Agent
  const stream = await agent.stream({
    messages: [{ role: 'user', content: request.message }],
  });

  // 处理流式响应
  for await (const chunk of stream) {
    emit({
      type: 'chunk',
      data: chunk,
    });
  }

  // 发送完成事件
  emit({
    type: 'complete',
    data: { sessionId: request.sessionId },
  });

  return {
    success: true,
    sessionId: request.sessionId,
  };
}
```

对应源码位置：[packages/core/src/lib/features/skills/service.ts 第 701—1047 行](../../../../packages/core/src/lib/features/skills/service.ts#L701-L1047)。

## 4. 图解：SSE 流式执行

```
Client          Server
  │                │
  │── POST /api ──▶│
  │   message      │
  │                │
  │◀── SSE Event ──│
  │   {chunk 1}    │
  │                │
  │◀── SSE Event ──│
  │   {chunk 2}    │
  │                │
  │◀── SSE Event ──│
  │   {complete}   │
```

## 5. 设计亮点

### 5.1 SSE 事件格式

```ts
interface SSEEvent {
  type: 'chunk' | 'complete' | 'error';
  data: unknown;
}
```

### 5.2 流式中断

```ts
const controller = new AbortController();
const stream = await agent.stream({
  messages: [{ role: 'user', content: request.message }],
  signal: controller.signal,
});

// 用户中断
controller.abort();
```

## 6. 测试证据与缺口

### 已覆盖

- `streamSkillExecutionMessage` 没有直接测试。

### 缺口

- SSE 连接没有测试。
- 流式中断没有测试。
- 错误恢复没有测试。

## 7. 小实验：流式执行

```ts
import { SkillService } from '@originos/core/lib/features/skills';

const service = new SkillService(deps);

const eventSource = new EventSource('/api/skills/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'chunk') {
    console.log('收到:', data.data);
  } else if (data.type === 'complete') {
    console.log('完成');
    eventSource.close();
  }
};

// 发送消息
await service.sendSkillExecutionMessage({
  sessionId: 'session-123',
  message: '分析项目进度',
});
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. SSE 和轮询有什么区别？
2. `streamSkillExecutionMessage` 的参数是什么？
3. SSE 事件有哪些类型？
4. 怎么中断流式执行？

## 9. 章节收束

本课的核心认知是 **`SkillService` 通过 SSE 实现流式执行，支持逐字返回结果和流式中断**。

我们看到的几个关键设计：

- **SSE**：Server-Sent Events，单向流式通信。
- **流式中断**：通过 AbortController 实现。
- **事件类型**：chunk、complete、error。
- **无测试**：没有直接测试覆盖。

下一课（G64）我们会进入 `DefaultSkillRegistry`，了解技能是怎么注册的。
