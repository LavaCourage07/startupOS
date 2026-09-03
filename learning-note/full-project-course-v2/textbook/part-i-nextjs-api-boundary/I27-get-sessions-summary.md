# I27：GET /api/agent/sessions/{sessionId}/summary：会话摘要查询

上一节课看了统计查询。这节课看会话摘要：`GET /api/agent/sessions/{sessionId}/summary`。

## 1. 接口用途

会话摘要接口用于获取单个会话的摘要信息，如：

- 会话创建时间
- 最后更新时间
- 消息数量
- 会话状态

这些信息用于快速了解会话概况，不是业务逻辑的核心。

## 2. Route Handler 的实现

打开 `app/api/agent/sessions/[sessionId]/summary/route.ts`（第 12–57 行）：

```ts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;

    const summary = await agentSessionService.getSessionSummary(sessionId);

    if (!summary) {
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

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      },
    );
  } catch (error) {
    // ... 500 处理
  }
}
```

## 3. 核心逻辑

### 3.1 查询摘要

```ts
const summary = await agentSessionService.getSessionSummary(sessionId);
```

`getSessionSummary` 的实现属于 Part E/F，可能的逻辑：

1. 通过 `sessionId` 获取会话。
2. 提取关键字段（创建时间、更新时间、消息数量等）。
3. 返回摘要对象。

### 3.2 404 处理

如果会话不存在，返回 404。这与统计查询不同：统计查询先获取会话再提取 projectId，摘要查询直接查询摘要。

## 4. 与统计查询的对比

| 维度 | 统计查询 | 会话摘要 |
| --- | --- | --- |
| 路径 | `/sessions/{id}/statistics` | `/sessions/{id}/summary` |
| 参数 | 无 | 无 |
| 返回 | 项目统计信息 | 会话摘要 |
| 需要 projectId | 是（从 session 中提取） | 否 |
| 用途 | 项目级别监控 | 会话级别概览 |

## 5. 失败路径

### 5.1 会话不存在

返回 404。这是最常见的错误。

### 5.2 Core Service 返回空

如果 `getSessionSummary` 返回空，接口返回 404。这与统计查询不同：统计查询返回空数据，摘要查询返回 404。

## 6. 测试证据

| 验证方式 | 能证明 | 不能证明 |
| --- | --- | --- |
| `curl` 调用 summary | 能返回摘要数据 | Core Service 所有分支都正确 |
| `curl` 会话不存在 | 返回 404 | 所有错误分支都处理 |
| 代码阅读 | 逻辑清晰 | 数据一定正确 |

## 7. 小实验

不运行项目，回答：

1. 为什么摘要查询直接返回 404，而统计查询返回空数据？
2. 如果 `getSessionSummary` 返回空对象 `{}`，接口会返回什么？
3. 摘要查询和统计查询有什么本质区别？

参考答案：

1. 摘要查询的对象是会话本身，会话不存在就是 404。统计查询的对象是项目，会话只是查询的入口。
2. 返回 `{ success: true, data: {} }`，因为空对象不是 falsy 值。
3. 摘要查询返回单个会话的概览，统计查询返回项目的聚合数据。

## 8. 章节收束

本节课看了 `GET /api/agent/sessions/{sessionId}/summary` 的实现：查询摘要、404 处理。会话摘要是快速了解会话概况的窗口，不是业务逻辑的核心。

下一节课会看统计数据的来源和计算方式。
