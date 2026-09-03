# I08：POST /api/agent/sessions：一次 HTTP 请求如何变成会话文件

上一节课我们看到 runtime 子进程的引用放在 `globalThis` 上。这节课回到会话创建的第一站：`POST /api/agent/sessions`。当 `InterviewWindow` 或 `SkillDialog` 弹出来时，它通常会先调用这个接口，拿到一个会话对象，然后才能开始发送消息。

## 1. 一个会话创建请求包含什么

典型的请求体：

```json
{
  "projectId": "project-interview-1700000000000",
  "projectName": "新项目 2024/1/1 12:00",
  "systemPrompt": "你是项目访谈助手...",
  "agentType": "project",
  "projectContext": {
    "projectId": "project-interview-1700000000000",
    "projectName": "新项目 2024/1/1 12:00"
  },
  "sessionId": "project-initialization-1700000000000",
  "llmConfig": {
    "provider": "openai",
    "model": "gpt-4"
  },
  "agentBaseDir": "/data/web/agents/project-initialization-1700000000000"
}
```

这个请求体里有四类信息：

1. **项目身份**：`projectId`、`projectName`。
2. **Agent 配置**：`systemPrompt`、`agentType`、`llmConfig`。
3. **工作目录**：`projectContext`、`agentBaseDir`、`outputDir`。
4. **可选复用**：`sessionId`。

## 2. Route Handler 的校验与适配

打开 `api/agent/sessions/route.ts` 的 POST 处理函数：

```ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.projectId || !body.projectName) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'projectId and projectName are required',
          },
        },
        { status: 400 }
      );
    }

    persistRuntimeLLMConfig(body.llmConfig);

    const userConfig = readUserConfig();
    const llmConfigWithMapping = {
      ...body.llmConfig,
      ...(userConfig.llm?.mapping && !body.llmConfig?.mapping ? { mapping: userConfig.llm.mapping } : {}),
    };
    // ...
  }
}
```

两个关键动作：

1. **必填字段校验**：缺少 `projectId` 或 `projectName` 直接返回 400。这是 Route Handler 最基本的责任。
2. **LLM 配置持久化 + 合并**：`persistRuntimeLLMConfig` 把配置写到运行时；`readUserConfig` 读取用户配置，并把用户级别的 `mapping` 合并进来（如果请求体没有显式提供）。

## 3. 会话复用逻辑

如果请求体带了 `sessionId`，Route Handler 会先尝试复用：

```ts
if (body.sessionId) {
  const existing = await agentSessionService.getSession(body.sessionId, body.projectId);
  if (existing) {
    existing.projectContext = {
      ...existing.projectContext,
      ...body.projectContext,
      ...(body.agentBaseDir ? { currentPath: body.agentBaseDir } : {}),
      ...(body.outputDir ? { outputDir: body.outputDir } : {}),
    };
    if (body.agentType) existing.agentType = body.agentType;
    if (body.llmConfig) existing.llmConfig = llmConfigWithMapping;
    await agentSessionService.saveSession(existing);
    return NextResponse.json<ApiResponse>(
      { success: true, data: existing },
      { status: 200 }
    );
  }
}
```

这段逻辑说明：

- 复用不是简单的“返回旧会话”。它会用新请求体中的字段覆盖旧会话的 `projectContext`、`agentType`、`llmConfig`。
- 状态码是 200，不是 201，表示这是更新而非创建。
- 如果 `sessionId` 对应的会话不存在，才走创建流程。

这是一个重要的边界：客户端不能假设传入 `sessionId` 就一定复用成功。

## 4. 目录创建与会话创建

```ts
if (body.agentBaseDir) {
  mkdirSync(body.agentBaseDir, { recursive: true });
}

const createRequest = {
  projectId: body.projectId,
  projectName: body.projectName,
  systemPrompt: body.systemPrompt,
  agentType: body.agentType,
  projectContext: {
    ...body.projectContext,
    ...(body.agentBaseDir ? { currentPath: body.agentBaseDir } : {}),
    ...(body.outputDir ? { outputDir: body.outputDir } : {}),
  },
  sessionId: body.sessionId,
  llmConfig: llmConfigWithMapping,
};

const session = await agentSessionService.createSession(createRequest);

return NextResponse.json<ApiResponse>(
  { success: true, data: session },
  { status: 201 }
);
```

这里 `mkdirSync` 是一个副作用：它会在文件系统上创建 `agentBaseDir`。然后 `agentSessionService.createSession` 才会把会话数据写入这个目录下的 `session.json`。

注意一个细节：`mkdirSync` 是同步的，而 `createSession` 是异步的。同步创建目录可以避免后续异步写入时目录不存在，但同步 I/O 在服务端可能阻塞事件循环。对于创建单个目录来说影响很小，但大量并发时可能成为瓶颈。

## 5. 调用链：从浏览器到文件系统

```text
浏览器 POST /api/agent/sessions
  → Next.js 解析 JSON body
  → 校验 projectId/projectName
  → persistRuntimeLLMConfig(body.llmConfig)
  → readUserConfig() 并合并 mapping
  → 如果 sessionId 存在，尝试 getSession + 更新 + 返回 200
  → mkdirSync(agentBaseDir)
  → agentSessionService.createSession(createRequest)
    → 生成 sessionId（如果没有传入）
    → 写入 data/web/agents/{sessionId}/session.json
  → 返回 201 + 会话对象
```

这条链的边界：

- Route Handler 不做模型选择、不做提示词生成，只把请求体整理成 `CreateSessionRequest`。
- 会话 ID 可能由客户端传入，也可能由 Core 生成。
- 目录创建和文件写入是副作用，失败会抛异常并返回 500。

## 6. 失败路径

### 6.1 缺少必填字段

返回 400。这是客户端最容易修复的错误。

### 6.2 用户配置合并错误

如果 `readUserConfig()` 读取失败或返回非预期结构，`llmConfigWithMapping` 可能生成错误对象。当前实现没有单独处理这个异常。

### 6.3 目录创建失败

如果 `agentBaseDir` 指向一个无权限的路径，`mkdirSync` 会抛异常，返回 500。注意这里不是 `agentSessionService` 的错，而是文件系统边界问题。

### 6.4 复用时字段被意外覆盖

复用逻辑会覆盖 `projectContext`、`agentType`、`llmConfig`。如果客户端传入的 `projectContext` 不完整，可能把已有上下文中的某些字段清空。

## 7. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| `curl` 发送正确请求 | 能创建会话并返回 201 | 用户配置合并在所有场景正确 |
| `curl` 缺少 projectId | 返回 400 | 其他字段缺失也返回 400 |
| `curl` 传入已有 sessionId | 返回 200 并更新字段 | 运行时历史一定被保留 |

## 8. 小实验

不运行项目，回答：

1. 为什么复用成功时返回 200，创建成功时返回 201？
2. `mkdirSync` 放在 `createSession` 之前有什么风险？如果反过来会怎样？
3. 如果客户端传了 `sessionId` 但对应会话不存在，系统会做什么？

参考答案：

1. 200 表示资源已存在并更新，201 表示新资源创建。这是 HTTP 语义。
2. 先创建目录可以确保 `createSession` 写入文件时目录存在。反过来可能导致写入失败。
3. 会进入创建流程，用传入的 `sessionId` 创建新会话（如果 Core 接受外部 sessionId）。

## 9. 章节收束

本节课追踪了 `POST /api/agent/sessions` 的完整变形：从 HTTP 请求体到字段校验、配置合并、会话复用、目录创建，最终到 `agentSessionService.createSession`。Route Handler 的核心责任是边界适配，而不是业务语义生成。

下一节课会看列表查询和单条恢复：`GET /api/agent/sessions` 和 `GET /api/agent/sessions/{sessionId}`。
