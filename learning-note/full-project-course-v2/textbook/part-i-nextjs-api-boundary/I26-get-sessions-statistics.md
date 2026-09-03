# I26：GET /api/agent/sessions/{sessionId}/statistics：项目统计查询

前四个单元追踪了页面路由、会话管理、消息流式响应、项目级 Agent 生命周期。这个单元转向两个辅助接口：统计查询和会话摘要。这节课先看统计查询。

## 1. 接口用途

统计查询接口用于获取项目的统计信息，如：

- 会话数量
- 消息数量
- 工具调用次数
- 平均响应时间

这些信息用于监控和调试，不是业务逻辑的核心。

## 2. Route Handler 的实现

打开 `app/api/agent/sessions/[sessionId]/statistics/route.ts`（第 12–59 行）：

```ts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const session = await agentSessionService.getSession(sessionId);

    if (!session) {
      return NextResponse.json<ApiResponse<unknown>>(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    const projectId = session.projectContext.projectId;
    const statistics = await agentSessionService.getProjectStatistics(projectId);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: statistics,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    // ... 500 处理
  }
}
```

## 3. 核心逻辑

### 3.1 获取会话

```ts
const session = await agentSessionService.getSession(sessionId);
```

通过 `sessionId` 获取会话。如果会话不存在，返回 404。

### 3.2 提取 projectId

```ts
const projectId = session.projectContext.projectId;
```

从会话的 `projectContext` 中提取 `projectId`。这是关键一步：统计查询是按项目维度查询的，但接口路径是按会话维度设计的。

### 3.3 查询统计

```ts
const statistics = await agentSessionService.getProjectStatistics(projectId);
```

`getProjectStatistics` 的实现属于 Part E/F，可能的逻辑：

1. 查询该项目下的所有会话。
2. 统计消息数量、工具调用次数等。
3. 计算平均响应时间等。

## 4. 与会话查询的对比

| 维度 | 统计查询 | 会话查询 |
| --- | --- | --- |
| 路径 | `/sessions/{id}/statistics` | `/sessions/{id}` |
| 返回 | 项目统计信息 | 会话对象 |
| 需要 projectId | 从 session 中提取 | 从 query 参数中获取 |
| 用途 | 监控、调试 | 恢复、查看 |

## 5. 失败路径

### 5.1 会话不存在

返回 404。这是最常见的错误。

### 5.2 projectId 为空

如果 `session.projectContext.projectId` 为空，`getProjectStatistics` 可能返回空或报错。

### 5.3 Core Service 返回空

如果 `getProjectStatistics` 返回空，接口返回 `{ success: true, data: {} }`。客户端需要处理空数据。

## 6. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| `curl` 调用 statistics | 能返回统计数据 | Core Service 所有分支都正确 |
| `curl` 会话不存在 | 返回 404 | 所有错误分支都处理 |
| 代码阅读 | 逻辑清晰 | 数据一定正确 |

## 7. 小实验

不运行项目，回答：

1. 为什么统计查询的路径是 `/sessions/{id}/statistics`，而不是 `/projects/{id}/statistics`？
2. 如果 `session.projectContext.projectId` 为空，会发生什么？
3. 统计查询和会话查询有什么本质区别？

参考答案：

1. 按会话维度设计，方便前端在查看会话时同时查看统计。按项目维度设计更合理，但当前实现按会话维度。
2. `getProjectStatistics` 可能返回空或报错，取决于 Core Service 的实现。
3. 统计查询返回聚合数据，会话查询返回原始数据。

## 8. 章节收束

本节课看了 `GET /api/agent/sessions/{sessionId}/statistics` 的实现：获取会话、提取 projectId、查询统计。统计查询是调试和监控的窗口，不是业务逻辑的核心。

下一节课会看会话摘要：`GET /api/agent/sessions/{sessionId}/summary`。
