# K11 · 非流式与流式消息模式

> **课号** K11 · **轨道** T13 · **文件** `packages/desktop/src/main/services/agent-session-service.ts` · **预计阅读** 30 分钟

---

## 本课要回答的问题

Agent 会话创建后，用户发送消息。非流式消息和流式消息有什么区别？`AGENT_SESSION_MESSAGE` 怎样等待完整回复？`AGENT_SESSION_MESSAGE_STREAM` 怎样实时推送 text_delta？

## 概念阶梯

### 第一层：非流式消息

```textn用户发送消息
  → 主进程调用 agent.prompt()
  → 等待 Agent 完成
  → 返回完整回复
```

非流式消息是阻塞的：用户发送消息后，必须等待 Agent 完成才能看到回复。

### 第二层：流式消息

```textn用户发送消息
  → 主进程调用 agent.prompt()
  → Agent 实时推送 text_delta
  → 主进程通过 IPC 推送给 renderer
  → renderer 实时显示
```

流式消息是非阻塞的：用户发送消息后，立即看到 Agent 的回复逐字出现。

### 第三层：流式消息的两种实现

| 实现 | 特点 | 适用场景 |
| --- | --- | --- |
| 非流式（`AGENT_SESSION_MESSAGE`） | 等待完整回复 | 简单对话 |
| 流式（`AGENT_SESSION_MESSAGE_STREAM`） | 实时推送 text_delta | 长回复、需要实时显示 |

## 源码窗口

### 窗口 1：非流式消息（第 396–586 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.AGENT_SESSION_MESSAGE,
  async (_event, request): Promise<IpcResponse<unknown>> => {
    // 1. 参数校验
    if (!request.sessionId || !request.content) {
      return { success: false, error: { code: 'INVALID_REQUEST', message: '...' } };
    }

    // 2. 获取会话和 Agent
    const session = await agentSessionService.getSession(request.sessionId, request.projectId);
    const agent = await agentManager.getOrRestoreAgentRuntime(session);

    // 3. 添加用户消息
    await agentSessionService.addMessage(request.sessionId, {
      role: 'user',
      content: request.content,
    }, request.projectId);

    // 4. 订阅 Agent 事件
    let assistantContent = '';
    const unsubscribe = agent.subscribe((event) => {
      switch (event.type) {
        case 'message_update':
          // 更新 assistantContent
          break;
        case 'tool_execution_start':
          // 记录工具执行
          break;
        case 'message_end':
          // 处理完成
          break;
      }
    });

    // 5. 调用 Agent
    processHealthMonitor.setAgentActivity(request.sessionId, 'prompt_start');
    try {
      await agent.prompt(request.content);
    } catch (error) {
      // 处理错误
    } finally {
      processHealthMonitor.clearAgentActivity(request.sessionId);
    }

    // 6. 取消订阅
    unsubscribe();

    // 7. 添加 assistant 消息
    await agentSessionService.addMessage(request.sessionId, {
      role: 'assistant',
      content: assistantContent,
    }, request.projectId);

    return { success: true, data: { userMessage, assistantMessage } };
  }
);
```

**关键步骤：**

1. **参数校验**：`sessionId` 和 `content` 必填。
2. **获取会话**：从持久化存储中读取会话。
3. **恢复 Agent**：如果 Agent 运行时不在内存中，从持久化存储中恢复。
4. **添加用户消息**：把用户消息添加到会话历史中。
5. **订阅事件**：订阅 Agent 的事件流，收集 assistant 的回复。
6. **调用 Agent**：`agent.prompt()` 是阻塞的，等待 Agent 完成。
7. **取消订阅**：防止内存泄漏。
8. **添加 assistant 消息**：把收集到的回复添加到会话历史中。

### 窗口 2：流式消息（第 588–859 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.AGENT_SESSION_MESSAGE_STREAM,
  async (event, request): Promise<IpcResponse<unknown>> => {
    // 1. 参数校验
    if (!request.sessionId || !request.content) {
      return { success: false, error: { code: 'INVALID_REQUEST', message: '...' } };
    }

    // 2. 获取会话和 Agent
    const session = await agentSessionService.getSession(request.sessionId, request.projectId);
    const agent = await agentManager.getOrRestoreAgentRuntime(session);

    // 3. 添加用户消息
    await agentSessionService.addMessage(request.sessionId, {
      role: 'user',
      content: request.content,
    }, request.projectId);

    // 4. 创建 IPC 发送函数
    const sender = event.sender;
    const sendToRenderer = (eventType: string, data: unknown) => {
      if (eventType === 'text_delta') {
        batcher.push({ type: eventType, data });
        return;
      }
      batcher.flush();
      sender.send(IPC_CHANNELS.AGENT_EVENT, { type: eventType, sessionId: request.sessionId, data });
    };

    // 5. 创建 StreamEventBatcher
    const batcher = new StreamEventBatcher({
      onFlush: (events) => sendToRenderer('batch_events', { events }),
    });

    // 6. 订阅 Agent 事件
    const unsubscribe = agent.subscribe((event) => {
      switch (event.type) {
        case 'message_update':
          // 发送 text_delta
          sendToRenderer('text_delta', { delta: event.delta });
          break;
        case 'message_end':
          // 发送 assistant_message
          sendToRenderer('assistant_message', { content: assistantContent });
          break;
        case 'agent_end':
          // 发送 done
          sendToRenderer('done', { content: assistantContent });
          break;
      }
    });

    // 7. 调用 Agent（非阻塞）
    agent.prompt(request.content).then(() => {
      unsubscribe();
      batcher.dispose();
    }).catch((error) => {
      // 处理错误
    });

    return { success: true, data: { started: true } };
  }
);
```

**关键区别：**

1. **非阻塞**：`agent.prompt()` 不等待，立即返回 `{ started: true }`。
2. **实时推送**：通过 `sender.send()` 实时推送 text_delta 到 renderer。
3. **StreamEventBatcher**：合并连续的 text_delta，减少 IPC 次数。

## 失败路径

### 失败 1：Agent 运行时未恢复

如果 `getOrRestoreAgentRuntime()` 失败（如 LLM 配置无效），会话无法恢复，返回错误。

### 失败 2：流式消息中断

如果用户关闭窗口或网络中断，流式消息会中断。`sender.isDestroyed()` 检查 renderer 是否还在，防止向已销毁的窗口发送消息。

### 失败 3：内存泄漏

如果 `unsubscribe()` 没被调用，Agent 事件监听器会一直存在，导致内存泄漏。`finally` 块确保取消订阅。

## 练习

### 练习 1（概念）

回答以下问题：

1. 非流式消息和流式消息的主要区别是什么？
2. 为什么流式消息要用 `StreamEventBatcher`？

<details>
<summary>参考答案</summary>

1. 非流式消息是阻塞的，等待 Agent 完成后返回完整回复。流式消息是非阻塞的，实时推送 text_delta。

2. `StreamEventBatcher` 合并连续的 text_delta，减少 IPC 次数，提高性能。

</details>

## 口头验收

完成本课后，你应该能用 45 秒口头描述：

> "非流式消息通过 `agent.prompt()` 阻塞等待 Agent 完成，收集完整回复后返回。流式消息通过 `sender.send()` 实时推送 text_delta，使用 `StreamEventBatcher` 合并连续事件，减少 IPC 次数。两种模式都通过 `agent.subscribe()` 订阅 Agent 事件，非流式在 `message_end` 时收集回复，流式在 `message_update` 时实时推送。"

## 下一课预告

K11 讲了消息模式。K12 会看 `StreamEventBatcher` 在流式消息中的具体应用。
