# I12：POST /api/agent/sessions/{sessionId}/messages：消息如何进入 Agent

上一单元追踪了会话的创建与管理。这节课回到消息发送的起点：`POST /api/agent/sessions/{sessionId}/messages`。当小林在 SkillDialog 里输入消息并点击发送时，浏览器会调用这个接口。这节课解决的问题是：一条消息从 HTTP POST 到 Agent 回复，经历了哪些阶段？

## 1. 请求体包含什么

典型的请求体：

```json
{
  "projectId": "project-interview-1700000000000",
  "content": "帮我规划一下这个项目",
  "role": "user",
  "entryType": "skill",
  "entryId": "trip-planner",
  "toolResults": [],
  "metadata": {}
}
```

这个请求体里有五类信息：

1. **项目身份**：`projectId`，用于定位会话。
2. **消息内容**：`content`，用户输入的文本。
3. **角色**：`role`，默认 `user`。
4. **入口信息**：`entryType`、`entryId`，用于归属权校验。
5. **工具结果**：`toolResults`，上一轮工具调用的结果。

## 2. Route Handler 的校验与恢复

打开 `app/api/agent/sessions/[sessionId]/messages/route.ts` 的 POST 处理函数（第 51–306 行）：

```ts
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await _request.json();
    const projectId = body.projectId;

    // 校验 content 字段
    if (!body.content) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'content is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // 获取或创建会话
    let session = await agentSessionService.getSession(sessionId, projectId);
    if (!session) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found. Please create a session first.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }
```

两个关键校验：

1. **content 必填**：没有内容直接返回 400。
2. **会话必须存在**：如果会话不存在，返回 404。这意味着客户端必须先创建会话，才能发送消息。

### 2.1 归属权校验

```ts
    try {
      assertSessionMessageOwnership(session, {
        sessionId,
        projectId,
        entryType: body.entryType as RestoreAgentEntryType | undefined,
        entryId: body.entryId,
      });
    } catch (error) {
      const ownershipError = toRestoreAgentSessionError(error);
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: ownershipError.code,
            message: ownershipError.message,
          },
          timestamp: new Date().toISOString(),
        },
        { status: ownershipError.code === 'OWNERSHIP_MISMATCH' ? 403 : 422 }
      );
    }
```

`assertSessionMessageOwnership` 验证当前请求是否有权向这个会话发送消息。如果 `entryType` 或 `entryId` 与会话创建时不匹配，返回 403。

### 2.2 运行时恢复

```ts
    // Runtime 必须先恢复持久化历史，再提交当前新消息，避免新消息被重复注入。
    const agent = await agentManager.getOrRestoreAgentRuntime(session);
```

这是关键一步：`getOrRestoreAgentRuntime` 确保 Agent 运行时已经恢复。如果这是会话的第一条消息，它会创建新的运行时；如果是后续消息，它会恢复已有的运行时上下文。

## 3. 消息保存与 SSE 分支

### 3.1 保存用户消息

```ts
    // Add user message to session
    session = await agentSessionService.addMessage(sessionId, {
      role: body.role || 'user',
      content: body.content,
      toolResults: body.toolResults,
      metadata: body.metadata,
    }, projectId);
```

用户消息先保存到 `session.json`，然后才发送给 Agent。这保证了即使 Agent 处理失败，用户消息也不会丢失。

### 3.2 判断流式响应

```ts
    // Check if streaming is requested
    const acceptHeader = _request.headers.get('accept') || '';
    const wantsStreaming = acceptHeader.includes('text/event-stream');

    if (wantsStreaming) {
      // Return SSE stream
      const stream = createEventStream(agent, body.content, userMessage, sessionId, projectId);

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
```

关键点：

1. **Accept 头决定模式**：`text/event-stream` 表示请求 SSE 流式响应。
2. **SSE 返回 `Response` 对象**：不是 `NextResponse.json()`，而是原生 `Response`，因为需要流式传输。
3. **非流式走 JSON 返回**：收集完整回复后返回 JSON。

## 4. 非流式响应的收集逻辑

如果客户端没有请求 SSE，Route Handler 会订阅 Agent 事件并收集完整回复：

```ts
    // Non-streaming: collect response and return
    try {
      let assistantContent = '';
      let hasError = false;
      let errorMessage = '';
      let llmCallSuccessful = false;

      // Subscribe to events
      const unsubscribe = agent.subscribe((event: AgentEvent | { type: string; [key: string]: unknown }) => {
        switch (event.type) {
          case 'text_delta':
            if (event['delta']) {
              assistantContent = getVisibleStreamDelta(assistantContent, sanitizeAgentDisplayContent(event['delta'] as string)).content;
            }
            break;
          case 'message_end':
            // ...
            llmCallSuccessful = true;
            break;
          case 'agent_error':
            hasError = true;
            errorMessage = (event as any).error?.message || 'Unknown error';
            break;
        }
      });

      // Send prompt to LLM
      await agent.prompt(body.content);

      // Unsubscribe
      unsubscribe();
```

这段逻辑的核心：

1. **订阅所有事件**：通过 `agent.subscribe` 监听 Agent 运行时的各种事件。
2. **累加 text_delta**：每个 `text_delta` 事件携带增量文本，累加到 `assistantContent`。
3. **处理错误**：`agent_error` 事件表示 LLM 调用失败。
4. **保存 assistant 消息**：收集完成后，保存到 `session.json`。

## 5. 调用链：从浏览器到 LLM

```text
浏览器 POST /api/agent/sessions/{sessionId}/messages
  → Next.js 解析 JSON body
  → 校验 content 字段
  → agentSessionService.getSession(sessionId, projectId)
    → 读取 data/web/agents/{sessionId}/session.json
  → assertSessionMessageOwnership(session, { entryType, entryId })
  → agentManager.getOrRestoreAgentRuntime(session)
    → 恢复或创建 Agent 运行时
  → agentSessionService.addMessage(sessionId, { role: 'user', content })
    → 追加到 session.json 的 messages 数组
  → 检查 Accept 头
  → 如果 SSE：
    → createEventStream(agent, content, userMessage, sessionId, projectId)
      → 创建 ReadableStream
      → 订阅 AgentEvent / RuntimeEvent
      → 通过 SSE 推送事件
  → 如果非 SSE：
    → agent.subscribe(...) 收集事件
    → agent.prompt(content) 发送给 LLM
    → 累加 text_delta
    → agentSessionService.addMessage(sessionId, { role: 'assistant', content })
    → 返回 JSON
```

## 6. 失败路径

### 6.1 会话不存在

返回 404。这是客户端最容易修复的错误——先调用 `POST /sessions` 创建会话。

### 6.2 归属权校验失败

返回 403。这通常发生在：用户打开了一个 Skill 窗口，然后尝试从另一个窗口向同一个会话发送消息。

### 6.3 LLM 调用失败

`agent.prompt()` 可能失败，但 Route Handler 会捕获异常并返回 500。注意：非流式模式下，如果 LLM 失败，用户消息已经保存，但 assistant 消息不会保存。

### 6.4 SSE 连接断开

如果客户端在 SSE 流中途断开连接，Route Handler 的 `ReadableStream` 会被取消，但 Agent 运行时的处理可能仍在继续。这可能导致资源泄漏。

## 7. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| `curl` 发送 SSE 请求 | 能建立 SSE 连接 | 所有事件类型都正确推送 |
| `curl` 发送非 SSE 请求 | 能返回完整 assistant 消息 | LLM 回复一定正确 |
| `curl` 缺少 content | 返回 400 | 其他字段缺失也返回 400 |
| 浏览器 DevTools | 能看到 SSE 事件流 | 内容一定不重复 |

## 8. 小实验

不运行项目，回答：

1. 为什么 SSE 响应返回 `new Response(stream, ...)` 而不是 `NextResponse.json(...)`？
2. 如果客户端发送消息时未提供 `entryType` 和 `entryId`，会发生什么？
3. 非流式模式下，如果 `agent.prompt()` 抛异常，用户消息是否已保存？

参考答案：

1. `NextResponse` 不支持流式传输。`new Response(stream)` 可以直接返回 `ReadableStream`，实现 SSE 推送。
2. `entryType` 和 `entryId` 是可选的。如果未提供，`assertSessionMessageOwnership` 可能跳过校验或报错，取决于 Core Service 的实现。
3. 已保存。用户消息在 `agent.prompt()` 之前就已经通过 `agentSessionService.addMessage` 保存了。

## 9. 章节收束

本节课追踪了 `POST /api/agent/sessions/{sessionId}/messages` 的完整变形：从 HTTP 请求体到字段校验、归属权验证、运行时恢复、消息保存，最终到 SSE 流式响应或非流式 JSON 返回。Route Handler 的核心责任是边界适配和事件搬运，而不是生成回复内容。

下一节课会深入 In-process 模式的 SSE 实现：`createInProcessEventStream` 如何订阅 AgentEvent 并推送到浏览器。
