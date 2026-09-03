# I14：Runtime 模式的 SSE：如何拦截子进程事件

上一节课看了 In-process 模式的 SSE 实现。这节课深入 Runtime 模式的 SSE：`createRuntimeEventStream` 如何拦截子进程 stdout 的事件、处理 RuntimeEvent、并将它们推送到浏览器。

## 1. 函数签名与上下文

打开 `app/api/agent/sessions/[sessionId]/messages/route.ts` 的 `createRuntimeEventStream` 函数（第 315–520 行）：

```ts
function createRuntimeEventStream(
  agent: ReturnType<typeof agentManager.getOrCreateAgent> extends Promise<infer T> ? T : never,
  userContent: string,
  userMessage: AgentMessage,
  sessionId: string,
  projectId: string | undefined
): ReadableStream<Uint8Array> {
```

参数与 In-process 模式相同，但内部实现完全不同。

## 2. 关键区别：Runtime 模式的事件来源

In-process 模式的事件来自 Agent 实例的订阅回调：`agent.subscribe(callback)`。

Runtime 模式的事件来自子进程 stdout 的解析。子进程通过 stdout 输出 JSON 格式的 RuntimeEvent，父进程解析后触发事件处理。

```ts
  // Runtime mode: direct RuntimeEvent interception
  const bridgeProcess = (agent as any).__bridgeProcess;
  if (bridgeProcess && bridgeProcess.getStatus() === 'running') {
    return createRuntimeEventStream(bridgeProcess, userContent, userMessage, sessionId);
  }
```

`__bridgeProcess` 是 Runtime 模式下 Agent 实例持有的子进程引用。通过它可以直接访问子进程的事件流。

## 3. ReadableStream 的结构

```ts
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (msg: StreamMessage) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));

      send({ type: 'user_message', data: userMessage });

      const queue: StreamMessage[] = [];
      let completed = false;
      const waiterRef = { current: null as null | (() => void) };

      const enqueueEvent = (msg: StreamMessage) => {
        queue.push(msg);
        const cb = waiterRef.current;
        waiterRef.current = null;
        if (cb) cb();
      };

      const waitForEvent = () =>
        queue.length > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => { waiterRef.current = resolve; });
```

核心机制：

1. **队列 + 等待者模式**：子进程事件是异步的，使用队列缓存事件，`waiterRef` 通知消费循环有新事件。
2. **`enqueueEvent`**：将事件推入队列，并唤醒等待者。
3. **`waitForEvent`**：如果队列为空，等待新事件到达。

## 4. RuntimeEvent 拦截器

```ts
      const eventInterceptor = (event: { type: string; payload?: Record<string, unknown> }) => {
        switch (event.type) {
          case 'TOOL_CALL':
            enqueueEvent({
              type: 'tool_start',
              data: {
                toolCallId: event.payload?.['toolCallId'],
                toolName: event.payload?.['toolName'],
                args: event.payload?.['args'],
              },
            });
            break;
          case 'TOOL_RESULT':
            enqueueEvent({
              type: 'tool_end',
              data: {
                toolCallId: event.payload?.['toolCallId'],
                toolName: event.payload?.['toolName'],
                result: event.payload?.['result'],
                isError: event.payload?.['isError'],
              },
            });
            break;
```

RuntimeEvent 类型与 AgentEvent 不同：

| RuntimeEvent | 对应 SSE | 说明 |
| --- | --- | --- |
| `TOOL_CALL` | `tool_start` | 工具调用开始 |
| `TOOL_RESULT` | `tool_end` | 工具调用结束 |
| `MESSAGE_SENT` | `text_delta` | 增量文本 |
| `ASSISTANT_MESSAGE` | `assistant_message` | 最终完整消息 |
| `AGENT_COMPLETE_TASK` | `assistant_message` | 任务完成 |
| `AGENT_FAIL_TASK` | `error` | 任务失败 |

### 4.1 MESSAGE_SENT 的处理

```ts
          case 'MESSAGE_SENT': {
            const text = event.payload?.['text'];
            const delta = event.payload?.['delta'];
            const newText = typeof delta === 'string'
              ? sanitizeAgentDisplayContent(delta)
              : typeof text === 'string'
                ? sanitizeAgentDisplayContent(text)
                : null;
            if (newText) {
              const merged = getVisibleStreamDelta(sentTextAccumulator, newText);
              sentTextAccumulator = merged.content;
              if (merged.delta) {
                enqueueEvent({ type: 'text_delta', data: { delta: merged.delta } });
              }
            }
            break;
          }
```

与 In-process 模式的区别：

1. **事件来源不同**：`MESSAGE_SENT` 来自子进程 stdout，不是 Agent 实例的事件订阅。
2. **payload 结构不同**：`event.payload.text` 或 `event.payload.delta`，而不是 `event.delta`。
3. **去重逻辑相同**：同样使用 `getVisibleStreamDelta` 和 `sentTextAccumulator` 去重。

### 4.2 ASSISTANT_MESSAGE 的处理

```ts
          case 'ASSISTANT_MESSAGE':
            if (event.payload?.['content']) {
              const content = sanitizeAgentDisplayContent(String(event.payload['content']));
              latestCompleteMessage = content;
              if (content && content !== lastAssistantMessageContent) {
                lastAssistantMessageContent = content;
                enqueueEvent({ type: 'assistant_message', data: { content, isStreaming: false } });
              }
            }
            break;
```

`ASSISTANT_MESSAGE` 携带最终完整消息。这里同样使用 `lastAssistantMessageContent` 去重。

### 4.3 AGENT_COMPLETE_TASK 的处理

```ts
          case 'AGENT_COMPLETE_TASK': {
            if (!promptSent) break;
            if (assistantMessageSent) break;
            // ... 提取最终消息内容
            if (fullContent && fullContent !== lastAssistantMessageContent) {
              lastAssistantMessageContent = fullContent;
              assistantMessageSent = true;
              enqueueEvent({ type: 'assistant_message', data: { content: fullContent, isStreaming: false } });
            }
            break;
          }
```

`AGENT_COMPLETE_TASK` 表示 Agent 完成了任务。这里需要：

1. **等待 prompt 完成**：`if (!promptSent) break` 确保只在 `prompt()` 完成后处理。
2. **防止重复发送**：`if (assistantMessageSent) break` 确保只发送一次最终消息。
3. **提取完整内容**：从 `event.payload.messages` 中提取最后的 assistant 消息。

## 5. 事件推送循环

```ts
      const deliveryPromise = (async () => {
        while (!completed) {
          await waitForEvent();
          while (queue.length > 0) {
            const msg = queue.shift()!;
            send(msg);
            if (msg.type === 'error') {
              completed = true;
              break;
            }
          }
        }
        while (queue.length > 0) {
          send(queue.shift()!);
        }
        send({ type: 'done', data: null });
        controller.close();
      })();

      let promptSent = false;

      try {
        const promptPromise = process.prompt(userContent);
        promptSent = true;
        await promptPromise;

        completed = true;
        const cb = waiterRef.current;
        waiterRef.current = null;
        if (cb) cb();

        await deliveryPromise;
      } catch (error) {
        // ...
      }
```

流程：

1. **启动推送循环**：`deliveryPromise` 不断从队列中取出事件并推送。
2. **发送 prompt**：`process.prompt(userContent)` 触发子进程处理。
3. **事件到达**：子进程 stdout 输出 RuntimeEvent，`eventInterceptor` 将事件推入队列。
4. **推送循环消费**：`deliveryPromise` 从队列取出事件并通过 SSE 推送。
5. **prompt 完成**：`completed = true`，推送循环发送 `done` 并关闭流。

## 6. In-process 与 Runtime 模式的 SSE 对比

| 维度 | In-process 模式 | Runtime 模式 |
| --- | --- | --- |
| 事件来源 | `agent.subscribe(callback)` | 子进程 stdout 解析 |
| 事件类型 | `AgentEvent` | `RuntimeEvent` |
| 去重机制 | `lastSentDelta` | `sentTextAccumulator` |
| 推送循环 | `subscribe` 回调直接推送 | 队列 + 等待者模式 |
| 错误处理 | `catch` 块发送 `error` | `catch` 块发送 `error` |
| 资源清理 | `unsubscribe()` + `controller.close()` | `controller.close()` |

## 7. 失败路径

### 7.1 子进程 stdout 解析错误

如果子进程输出的 JSON 格式错误，`eventInterceptor` 可能收不到事件。这会导致推送循环一直等待，直到超时。

### 7.2 事件顺序错乱

`MESSAGE_SENT` 和 `ASSISTANT_MESSAGE` 可能乱序到达。`getVisibleStreamDelta` 和 `reconcileFinalStreamContent` 的设计就是为了处理这种情况。

### 7.3 内存泄漏

如果客户端断开连接但子进程仍在运行，事件会继续推入队列。虽然 `controller.close()` 会停止推送循环，但子进程可能仍在产生事件。

## 8. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器 DevTools 观察 SSE | 能收到 RuntimeEvent 对应的事件 | 所有事件类型都正确 |
| 代码阅读 | 事件拦截和推送逻辑清晰 | 实际运行时不乱序 |
| 运行观察 | 流能正常结束 | 断开连接时资源一定释放 |

## 9. 小实验

不运行项目，回答：

1. 为什么 Runtime 模式需要队列 + 等待者模式，而 In-process 模式不需要？
2. `AGENT_COMPLETE_TASK` 为什么需要 `if (!promptSent) break`？
3. 如果子进程在 `prompt()` 完成前输出了 `AGENT_COMPLETE_TASK`，会发生什么？

参考答案：

1. In-process 模式的事件订阅是同步回调，直接在 `subscribe` 中推送。Runtime 模式的事件来自异步的 stdout 解析，需要队列缓存。
2. `AGENT_COMPLETE_TASK` 可能在 `prompt()` 完成前到达（如子进程提前结束）。`promptSent` 确保只在 `prompt()` 发送后才处理完成事件。
3. 事件会被推入队列，但 `if (!promptSent) break` 会跳过处理。等 `prompt()` 完成后，事件可能已经被丢弃。

## 10. 章节收束

本节课深入 Runtime 模式的 SSE 实现：`createRuntimeEventStream` 通过拦截子进程 stdout 的 RuntimeEvent，使用队列 + 等待者模式将事件推送给客户端。核心机制是事件拦截 + 队列缓存 + SSE 推送。

下一节课会看流式去重和 content 合并策略：`getVisibleStreamDelta` 和 `reconcileFinalStreamContent` 的设计原理。
