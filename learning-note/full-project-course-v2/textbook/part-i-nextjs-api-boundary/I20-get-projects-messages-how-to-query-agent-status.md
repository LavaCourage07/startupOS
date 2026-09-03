# I20：GET /api/agent/projects/{projectId}/messages：如何查询 Agent 状态

上一节课看了项目级 Agent 的消息发送。这节课看状态查询：`GET /api/agent/projects/{projectId}/messages`。这个接口不发送消息，只返回当前项目级 Agent 的运行状态。

## 1. 为什么用 GET /messages 查询状态

从 RESTful 设计的角度，状态查询应该用 `GET /api/agent/projects/{projectId}/status`。但 OriginOS 使用了 `GET /messages`，原因可能是：

1. **历史原因**：早期设计时把状态查询和消息列表放在同一个路由。
2. **简化接口**：减少路由数量，前端统一用 `/messages` 获取 Agent 相关信息。
3. **未来扩展**：可能计划返回消息列表，但目前只返回状态。

## 2. Route Handler 的实现

打开 `app/api/agent/projects/[projectId]/messages/route.ts` 的 GET 处理函数（第 680–729 行）：

```ts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const agent = persistentAgentManager.getAgent(projectId);
    const runtimeEntry = getRuntimeAgent(projectId);

    if (!agent && !runtimeEntry) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'AGENT_NOT_RUNNING',
            message: 'Agent is not running',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    const status = agent?.getStatus() ?? runtimeEntry?.process?.getStatus();

    return NextResponse.json<ApiResponse<{ status: any }>>(
      {
        success: true,
        data: { status },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    // ... 500 处理
  }
}
```

核心逻辑：

1. **双模式查询**：同时查询 In-process 和 Runtime 两种模式。
2. **优先 In-process**：`agent?.getStatus() ?? runtimeEntry?.process?.getStatus()`。
3. **404 处理**：如果两种模式都未找到 Agent，返回 404。

## 3. 双模式查询的顺序

```ts
const agent = persistentAgentManager.getAgent(projectId);
const runtimeEntry = getRuntimeAgent(projectId);

if (!agent && !runtimeEntry) {
  // 返回 404
}

const status = agent?.getStatus() ?? runtimeEntry?.process?.getStatus();
```

关键点：

1. **同时查询两种模式**：不管当前是 Runtime 还是 In-process，都查询两种管理器。
2. **In-process 优先**：如果 In-process 的 Agent 存在，优先返回其状态。
3. **Runtime 兜底**：如果 In-process 不存在，返回 Runtime 的状态。

这种设计的原因是：环境变量可能在运行中切换（虽然不建议），或者同一个项目在不同模式下启动过。

## 4. 状态值的可能取值

状态值取决于运行时类型：

| 运行时类型 | 可能的状态值 |
| --- | --- |
| In-process | `idle`、`running`、`error` 等 |
| Runtime | `idle`、`running`、`stopped`、`error` 等 |

具体状态值的定义属于 Part E/F。

## 5. 与会话级状态查询的对比

会话级 Agent 没有专门的状态查询接口。状态通常通过以下方式获取：

1. **会话数据**：`GET /api/agent/sessions/{sessionId}` 返回会话对象，包含消息列表。
2. **运行时推断**：如果会话存在且消息列表非空，推断 Agent 正在运行。

项目级 Agent 有专门的状态查询接口，因为：

1. **生命周期更长**：项目级 Agent 可能运行很长时间，需要定期检查状态。
2. **自动重启**：如果 Agent 意外停止，前端可以通过状态查询发现并重连。
3. **多客户端**：多个客户端可能同时连接同一个项目级 Agent，需要统一的状态源。

## 6. 失败路径

### 6.1 环境变量切换导致状态不一致

如果 `USE_COLLABORATION_RUNTIME` 在运行中切换，In-process 和 Runtime 可能同时存在或同时不存在。这会导致状态查询返回意外结果。

### 6.2 状态值不一致

In-process 和 Runtime 的状态值定义可能不同。例如，In-process 用 `idle`，Runtime 用 `stopped`。前端需要根据状态值做不同处理。

### 6.3 内存泄漏

如果 Agent 实例被销毁但 `persistentAgentManager` 或 `getRuntimeAgent` 中仍有引用，状态查询会返回"运行中"，但实际上 Agent 已经停止。

## 7. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| `curl` 查询状态 | 能返回状态值 | 状态值一定正确 |
| `curl` 未启动时查询 | 返回 404 | 所有错误分支都处理 |
| 代码阅读 | 双模式查询逻辑清晰 | 状态值定义一致 |

## 8. 小实验

不运行项目，回答：

1. 为什么 `GET /messages` 既返回状态，又可能返回消息列表？
2. 如果 In-process 和 Runtime 同时存在，返回哪个状态？
3. 如果 `USE_COLLABORATION_RUNTIME=true` 但 Runtime 未启动，In-process 也未启动，返回什么？

参考答案：

1. 这是历史设计，可能未来扩展为返回消息列表。目前只返回状态。
2. 返回 In-process 的状态，因为 `agent?.getStatus()` 优先。
3. 返回 404，因为两种模式都未找到 Agent。

## 9. 章节收束

本节课看了 `GET /api/agent/projects/{projectId}/messages` 的实现：双模式查询、In-process 优先、404 处理。项目级 Agent 有专门的状态查询接口，因为生命周期更长、需要自动重启、多客户端连接。

下一节课会看项目级 Agent 的停止：`POST /api/agent/projects/{projectId}/stop`。
