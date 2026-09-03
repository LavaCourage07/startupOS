# K26 · CollaborationService：动态 Facade 与会话创建

> **课号** K26 · **轨道** T13 · **文件** `packages/desktop/src/main/services/collaboration-service.ts` · **预计阅读** 30 分钟

---

## 本课要回答的问题

`CollaborationService` 怎样处理多 Agent 协作？为什么使用动态导入？`getFacade()` 怎样工作？

## 概念阶梯

### 第一层：动态导入

`collaboration-runtime` 是一个重量级模块，启动时加载会占用大量内存。`getFacade()` 使用动态导入，延迟加载模块。

```typescript
let facade: typeof import('../../../../core/src/modules/collaboration-runtime/facade') | null = null;

async function getFacade() {
  if (!facade) {
    facade = await import('../../../../core/src/modules/collaboration-runtime/facade');
  }
  return facade;
}
```

### 第二层：会话创建

```textn用户发起协作任务
  → renderer 发送 COLLAB_SESSION_CREATE
  → 主进程调用 getFacade()
  → 创建会话
  → 返回会话信息
```

### 第三层：事件转发

```textn协作运行时产生事件
  → addElectronForwarder()
  → 遍历所有窗口
  → 发送 COLLAB_EVENT
```

## 源码窗口

### 窗口 1：动态导入（第 1–16 行）

```typescript
let facade: typeof import('../../../../core/src/modules/collaboration-runtime/facade') | null = null;

async function getFacade() {
  if (!facade) {
    facade = await import('../../../../core/src/modules/collaboration-runtime/facade');
  }
  return facade;
}
```

### 窗口 2：会话创建（第 101–133 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.COLLAB_SESSION_CREATE,
  async (_event, request: Record<string, unknown>): Promise<IpcResponse<unknown>> => {
    try {
      const llmConfig = request['llmConfig'] && typeof request['llmConfig'] === 'object'
        ? request['llmConfig'] as RuntimeLLMConfig
        : undefined;
      logRuntime('ipc.session.create.received', {
        projectId: typeof request['projectId'] === 'string' ? request['projectId'] : 'unknown',
        mode: typeof request['mode'] === 'string' ? request['mode'] : 'unknown',
        hasGlobalGoal: typeof request['globalGoal'] === 'string' && request['globalGoal'].length > 0,
        llmConfig: summarizeRuntimeLLMConfig(llmConfig),
      });
      const f = await getFacade();
      const session = await f.createSession(request as unknown as Parameters<typeof f.createSession>[0]);
      logRuntime('ipc.session.create.result', {
        sessionId: session.id,
        projectId: session.projectId,
        status: session.status,
        llmConfig: summarizeRuntimeLLMConfig(session.config.llmConfig),
      });
      return {
        success: true,
        data: session,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.toErrorResponse(error, '[CollaborationService] Create session failed');
    }
  }
);
```

### 窗口 3：事件转发（第 340–349 行）

```typescript
private setupEventForwarding(): void {
  this.cleanupFn = addElectronForwarder((event) => {
    const data = JSON.stringify(event);
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.COLLAB_EVENT, data);
      }
    }
  });
}
```

## 失败路径

### 失败 1：Facade 加载失败

如果 `collaboration-runtime` 模块加载失败，`getFacade()` 抛出异常。

### 失败 2：会话创建失败

如果参数无效或 LLM 配置错误，`createSession()` 抛出异常。

### 失败 3：事件转发失败

如果窗口已销毁，`window.webContents.send()` 失败。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么使用动态导入？
2. `addElectronForwarder` 的作用是什么？

<details>
<summary>参考答案</summary>

1. `collaboration-runtime` 是重量级模块，动态导入延迟加载，减少启动时间。

2. `addElectronForwarder` 注册事件转发器，把协作运行时的事件转发到所有窗口。

</details>

## 口头验收

完成本课后，你应该能用 30 秒口头描述：

> "`CollaborationService` 使用动态导入延迟加载 `collaboration-runtime` 模块。`getFacade()` 缓存 Facade 实例，避免重复加载。`setupEventForwarding()` 注册事件转发器，把协作运行时的事件转发到所有窗口。"

## 下一课预告

K26 讲了动态 Facade。K27 会看拓扑获取和会话执行。
