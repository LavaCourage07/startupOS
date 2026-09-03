# K16 · CollaborationService：多 Agent 协作与会话管理

> **课号** K16 · **轨道** T13 · **文件** `packages/desktop/src/main/services/collaboration-service.ts` · **预计阅读** 30 分钟

---

## 本课要回答的问题

桌面版怎样创建多 Agent 协作会话？`collaboration:session:create` 怎样工作？协作会话怎样管理拓扑、黑板和人工审核？

## 概念阶梯

### 第一层：协作会话创建

```textnrenderer → IPC collaboration:session:create → CollaborationService.createSession()
  → 创建会话 ID
  → 初始化拓扑
  → 创建黑板
  → 返回会话信息
```

### 第二层：拓扑管理

拓扑定义了 Agent 之间的关系和依赖：

```textn拓扑 (Topology)
  ├── 节点 (Node)：Agent
  ├── 边 (Edge)：依赖关系
  └── 模式 (Pattern)：Workflow / System
```

### 第三层：黑板协作

黑板是 Agent 共享数据的中心：

```textnAgent A 写入数据
  → 黑板更新
  → 通知所有订阅者
  → Agent B 读取数据
```

### 第四层：人工审核

关键操作需要人工审核：

```textnAgent 请求执行关键操作
  → 发送到人工审核队列
  → 用户审核
  → 批准/拒绝
```

## 源码窗口

### 窗口 1：会话创建（第 1–120 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.COLLABORATION_SESSION_CREATE,
  async (_event, request): Promise<IpcResponse<CollaborationSession>> => {
    try {
      const session = await collaborationService.createSession({
        projectId: request.projectId,
        topology: request.topology,
        agents: request.agents,
      });
      return { success: true, data: session };
    } catch (error) {
      return { success: false, error: { code: 'SESSION_CREATE_FAILED', message: String(error) } };
    }
  }
);
```

### 窗口 2：拓扑获取（第 121–200 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.COLLABORATION_TOPOLOGY_GET,
  async (_event, request): Promise<IpcResponse<Topology>> => {
    try {
      const topology = await collaborationService.getTopology(request.sessionId);
      return { success: true, data: topology };
    } catch (error) {
      return { success: false, error: { code: 'TOPOLOGY_GET_FAILED', message: String(error) } };
    }
  }
);
```

### 窗口 3：黑板操作（第 201–300 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.COLLABORATION_BLACKBOARD_GET,
  async (_event, request): Promise<IpcResponse<Blackboard>> => {
    try {
      const blackboard = await collaborationService.getBlackboard(request.sessionId);
      return { success: true, data: blackboard };
    } catch (error) {
      return { success: false, error: { code: 'BLACKBOARD_GET_FAILED', message: String(error) } };
    }
  }
);

ipcMain.handle(
  IPC_CHANNELS.COLLABORATION_BLACKBOARD_UPDATE,
  async (_event, request): Promise<IpcResponse<void>> => {
    try {
      await collaborationService.updateBlackboard(request.sessionId, request.data);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: { code: 'BLACKBOARD_UPDATE_FAILED', message: String(error) } };
    }
  }
);
```

## 失败路径

### 失败 1：会话不存在

如果 `sessionId` 不存在，返回 `SESSION_NOT_FOUND` 错误。

### 失败 2：拓扑无效

如果拓扑数据格式错误，返回 `INVALID_TOPOLOGY` 错误。

### 失败 3：黑板更新冲突

如果多个 Agent 同时更新黑板，可能产生冲突。使用版本号或时间戳解决冲突。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么需要黑板机制？
2. 人工审核在什么场景下使用？

<details>
<summary>参考答案</summary>

1. 黑板机制让多个 Agent 共享数据，实现协作。

2. 关键操作（如删除数据、修改配置）需要人工审核，防止误操作。

</details>

## 口头验收

完成本课后，你应该能用 45 秒口头描述：

> "`CollaborationService` 管理多 Agent 协作会话。`collaboration:session:create` 创建会话，`collaboration:topology:get` 获取拓扑，`collaboration:blackboard:get/update` 操作黑板。黑板是 Agent 共享数据的中心，人工审核用于关键操作。"

## 下一课预告

K16 讲了协作服务。K17 会看 `preload.ts` 怎样建立 renderer 和主进程之间的安全桥梁。
