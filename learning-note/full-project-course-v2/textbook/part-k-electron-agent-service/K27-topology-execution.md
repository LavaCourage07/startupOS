# K27 · 拓扑获取与会话执行

> **课号** K27 · **轨道** T13 · **文件** `packages/desktop/src/main/services/collaboration-service.ts` · **预计阅读** 25 分钟

---

## 本课要回答的问题

`CollaborationService` 怎样获取拓扑和执行会话？拓扑数据包含什么？

## 概念阶梯

### 第一层：拓扑获取

拓扑定义了 Agent 之间的关系和依赖：

```textn项目 ID
  → loadProjectTopology()
  → 返回拓扑数据
```

### 第二层：会话执行

```textn会话 ID
  → executeSession()
  → 执行协作任务
  → 返回结果
```

### 第三层：黑板状态

黑板是 Agent 共享数据的中心：

```textn会话 ID
  → getBlackboardState()
  → 返回黑板数据
```

## 源码窗口

### 窗口 1：拓扑获取（第 49–80 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.COLLAB_TOPOLOGY_GET,
  async (_event, request: { projectId: string }): Promise<IpcResponse<unknown>> => {
    try {
      if (!request.projectId) {
        return {
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'projectId is required' },
          timestamp: new Date().toISOString(),
        };
      }
      const f = await getFacade();
      const topology = await f.loadProjectTopology(request.projectId);
      if (!topology) {
        return {
          success: false,
          error: { code: 'NOT_FOUND', message: 'No topology found for project' },
          timestamp: new Date().toISOString(),
        };
      }
      return {
        success: true,
        data: topology,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.toErrorResponse(error, '[CollaborationService] Get topology failed');
    }
  }
);
```

### 窗口 2：会话执行（第 195–219 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.COLLAB_SESSION_EXECUTE,
  async (_event, request: { sessionId: string }): Promise<IpcResponse<unknown>> => {
    try {
      if (!request.sessionId) {
        return {
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
          timestamp: new Date().toISOString(),
        };
      }
      const f = await getFacade();
      const result = await f.executeSession(request.sessionId);
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.toErrorResponse(error, '[CollaborationService] Execute session failed');
    }
  }
);
```

### 窗口 3：黑板状态（第 269–300 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.COLLAB_BLACKBOARD_GET,
  async (_event, request: { sessionId: string }): Promise<IpcResponse<unknown>> => {
    try {
      if (!request.sessionId) {
        return {
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
          timestamp: new Date().toISOString(),
        };
      }
      const f = await getFacade();
      const state = await f.getBlackboardState(request.sessionId);
      if (!state) {
        return {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Session not found' },
          timestamp: new Date().toISOString(),
        };
      }
      return {
        success: true,
        data: state,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.toErrorResponse(error, '[CollaborationService] Get blackboard failed');
    }
  }
);
```

## 失败路径

### 失败 1：拓扑不存在

如果项目没有拓扑数据，返回 `NOT_FOUND` 错误。

### 失败 2：会话不存在

如果 `sessionId` 不存在，返回 `NOT_FOUND` 错误。

### 失败 3：执行失败

如果会话执行失败，返回 `INTERNAL_ERROR` 错误。

## 练习

### 练习 1（概念）

回答以下问题：

1. 拓扑数据包含什么？
2. 黑板的作用是什么？

<details>
<summary>参考答案</summary>

1. 拓扑数据包含 Agent 之间的关系和依赖。

2. 黑板是 Agent 共享数据的中心。

</details>

## 口头验收

完成本课后，你应该能用 30 秒口头描述：

> "`CollaborationService` 通过 `loadProjectTopology()` 获取拓扑，`executeSession()` 执行会话，`getBlackboardState()` 获取黑板状态。拓扑定义 Agent 关系，黑板共享数据。"

## 下一课预告

K27 讲了拓扑和会话执行。K28 会看消息发送到 Supervisor。
