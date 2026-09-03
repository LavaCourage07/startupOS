# I13：In-process 模式的 SSE：如何订阅 AgentEvent

上一节课看到 `POST /api/agent/sessions/{sessionId}/messages` 在请求头包含 `Accept: text/event-stream` 时会返回 SSE 流。这节课深入 In-process 模式的 SSE 实现：`createInProcessEventStream` 如何订阅 AgentEvent、处理各种事件类型、并将它们推送到浏览器。

## 1. 函数签名与上下文

打开 `app/api/agent/sessions/[sessionId]/messages/route.ts` 的 `createInProcessEventStream` 函数（第 525–687 行）：

```ts
function createInProcessEventStream(
  agent: ReturnType<typeof agentManager.getOrCreateAgent> extends Promise<infer T> ? T : never,
  userContent: string,
  userMessage: AgentMessage,
  sessionId: string,
  projectId: string | undefined
): ReadableStream<Uint8Array> {
```

参数说明：

- `agent`：In-process 模式的 Agent 运行时实例
- `userContent`：用户输入的文本
- `userMessage`：已保存到 session 的用户消息对象
- `sessionId`：会话 ID
- `projectId`：项目 ID（可选）

返回 `ReadableStream<Uint8Array>`，这是浏览器 `Response` 构造函数接受的流类型。

## 2. ReadableStream 的结构

```ts
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (msg: StreamMessage) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
```

核心机制：

1. **`start` 回调**：在流开始时被调用一次，用于设置事件订阅。
2. **`send` 函数**：将 JSON 对象编码为 SSE 格式（`data: {...}\n\n`）并推入流。
3. **`controller.enqueue`**：将数据块推入流的内部队列。

SSE 格式要求每条消息以 `data: ` 开头，以两个换行符结束。这是标准 SSE 协议，不是 OriginOS 自定义的。

## 3. 事件订阅与分发

### 3.1 订阅 AgentEvent

```ts
      const unsubscribe = agent.subscribe((event: AgentEvent | { type: string; [key: string]: unknown }) => {
        try {
          if (event.type === 'tool_execution_start') {
            console.log('[ROUTE DEBUG] tool_execution_start:', JSON.stringify(event, null, 2));
          }
          switch (event.type) {
```

`agent.subscribe` 是 In-process 模式的核心：它订阅 Agent 运行时发出的所有事件。每当 Agent 有新的输出、工具调用、错误等，都会触发这个回调。

### 3.2 事件类型映射表

| AgentEvent 类型 | SSE 事件类型 | 说明 |
| --- | --- | --- |
| `thinking_delta` | — | 静默累积，不推送 |
| `thinking_end` | — | 静默累积，不推送 |
| `text_delta` | `text_delta` | 增量文本，推送给客户端 |
| `message_update` | `text_delta` | 嵌套 assistantMessageEvent，提取 delta 推送 |
| `tool_execution_start` | `tool_start` | 工具调用开始 |
| `tool_execution_end` | `tool_end` | 工具调用结束 |
| `message_end` | `assistant_message` | 最终完整消息 |
| `agent_end` | `assistant_message` | 非流式模型的最终消息 |
| `agent_error` | `error` | 错误事件 |

### 3.3 text_delta 的处理

```ts
            case 'text_delta': {
              const delta = sanitizeAgentDisplayContent((event as any)['delta'] as string | undefined);
              if (typeof delta === 'string') {
                if (delta === lastSentDelta) break;
                const merged = getVisibleStreamDelta(assistantContent, delta);
                assistantContent = merged.content;
                lastSentDelta = delta;
                if (merged.delta) {
                  send({ type: 'text_delta', data: { delta: merged.delta } });
                }
              }
              break;
            }
```

关键点：

1. **去重**：`if (delta === lastSentDelta) break`。如果当前 delta 和上一个完全相同，跳过推送。这是为了防止重复事件。
2. **去重累积**：`getVisibleStreamDelta(assistantContent, delta)` 比较当前累积内容和新的 delta，只推送真正的增量。
3. **过滤空内容**：`if (merged.delta)` 确保只有非空内容才推送。

### 3.4 message_update 的处理

```ts
            case 'message_update': {
              const asm = event['assistantMessageEvent'] as { type?: string; delta?: string } | undefined;
              if (asm?.type === 'text_delta' && typeof asm.delta === 'string') {
                const delta = sanitizeAgentDisplayContent(asm.delta);
                if (delta === lastSentDelta) break;
                const merged = getVisibleStreamDelta(assistantContent, delta);
                assistantContent = merged.content;
                lastSentDelta = delta;
                if (merged.delta) {
                  send({ type: 'text_delta', data: { delta: merged.delta } });
                }
              }
              break;
            }
```

`message_update` 是 In-process 模式下的事件类型，包含嵌套的 `assistantMessageEvent`。这里提取其中的 `text_delta` 并推送。

注意注释说明："In-process mode: library emits message_update with nested assistantMessageEvent text_delta events are emitted by the library alongside message_update, causing duplicate frames if both are forwarded to the client."

这意味着 `text_delta` 和 `message_update` 可能同时携带相同内容，需要去重。

### 3.5 工具调用事件

```ts
            case 'tool_execution_start': {
              const fullEvent = JSON.stringify(event);
              send({
                type: 'tool_start',
                data: { toolCallId: event['toolCallId'], toolName: event['toolName'], args: event['args'], _debugRawEvent: JSON.parse(fullEvent) },
              });
              break;
            }
            case 'tool_execution_end':
              send({
                type: 'tool_end',
                data: { toolCallId: event['toolCallId'], toolName: event['toolName'], result: event['result'], isError: event['isError'] },
              });
              break;
```

工具调用事件的处理相对简单：直接映射字段并推送。`tool_start` 包含工具名和参数，`tool_end` 包含结果和错误状态。

### 3.6 最终消息的处理

```ts
            case 'message_end':
              if ((event as any)['message']?.role === 'assistant') {
                const content = reconcileFinalStreamContent(
                  assistantContent,
                  extractTextContent((event as any)['message'].content)
                );
                if (content) {
                  send({
                    type: 'assistant_message',
                    data: { content, isStreaming: false },
                  });
                  assistantMessageSent = true;
                }
              }
              break;
```

`message_end` 事件携带最终完整消息。这里使用 `reconcileFinalStreamContent` 将累积的流式内容和最终消息合并，确保内容一致性。

`agent_end` 事件的处理类似，但增加了去重逻辑（`if (assistantMessageSent) break`），防止重复发送最终消息。

## 4. 消息发送与清理

```ts
      try {
        await agent.prompt(userContent);

        // Save assistant message to session
        if (assistantContent) {
          const messageData: Omit<AgentMessage, 'id' | 'timestamp'> = {
            role: 'assistant',
            content: sanitizeAgentDisplayContent(assistantContent),
          };
          await agentSessionService.addMessage(sessionId, messageData, projectId);
        }

        send({ type: 'done', data: null });
      } catch (error) {
        send({ type: 'error', data: { message: error instanceof Error ? error.message : 'Unknown error' } });
      } finally {
        unsubscribe();
        controller.close();
      }
```

流程：

1. **`agent.prompt(userContent)`**：发送用户消息给 LLM，触发 Agent 思考。
2. **事件订阅处理**：在 `agent.prompt` 执行期间，事件订阅回调会不断收到 `text_delta` 等事件，并通过 SSE 推送。
3. **保存 assistant 消息**：`agent.prompt` 完成后，将累积的完整内容保存到 `session.json`。
4. **发送 `done` 事件**：通知客户端流已结束。
5. **清理**：取消订阅、关闭流。

## 5. 失败路径

### 5.1 重复 text_delta

如果 Agent 运行时重复发送相同的 `text_delta`，`lastSentDelta` 检查会跳过。但如果 delta 内容相同而事件不同（如来自 `text_delta` 和 `message_update`），`getVisibleStreamDelta` 会检测到重复并过滤。

### 5.2 最终消息不一致

`message_end` 和 `agent_end` 都可能携带最终消息。如果两者内容不一致（如 `message_end` 的内容和累积的 `assistantContent` 不同），`reconcileFinalStreamContent` 会尝试合并。

### 5.3 流中途断开

如果客户端在 SSE 流中途断开，`controller.close()` 会在 `finally` 中执行，但 `agent.prompt()` 可能仍在运行。这可能导致资源泄漏。

## 6. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| 浏览器 DevTools 观察 SSE | 能收到 text_delta 事件 | 所有事件类型都正确 |
| 代码阅读 | 事件订阅和推送逻辑清晰 | 实际运行时不重复 |
| 运行观察 | 流能正常结束 | 断开连接时资源一定释放 |

## 7. 小实验

不运行项目，回答：

1. 为什么 `text_delta` 和 `message_update` 都需要处理？它们有什么区别？
2. `lastSentDelta` 去重有什么局限？什么情况下会失效？
3. 如果 `agent.prompt()` 抛异常，已推送的 SSE 事件会怎样？

参考答案：

1. `text_delta` 是直接的事件类型，`message_update` 是嵌套事件（包含 `assistantMessageEvent`）。两者可能同时存在，都需要处理以覆盖不同 Agent 库的实现。
2. `lastSentDelta` 只比较字符串相等性。如果两个不同的 delta 内容相同（如都是"Hello"），会错误跳过第二个。
3. 已推送的事件已经在客户端了。异常会触发 `catch` 块，发送 `error` 事件，然后 `finally` 关闭流。

## 8. 章节收束

本节课深入 In-process 模式的 SSE 实现：`createInProcessEventStream` 通过订阅 AgentEvent，将 `text_delta`、`tool_start`、`tool_end`、`assistant_message`、`done`、`error` 等事件推送给客户端。核心机制是事件订阅 + 去重累积 + SSE 推送。

下一节课会看 Runtime 模式的 SSE 实现：`createRuntimeEventStream` 如何拦截子进程 stdout 的事件。
