# K28 · 消息发送到 Supervisor

> **课号** K28 · **轨道** T13 · **文件** `packages/desktop/src/main/services/collaboration-service.ts` · **预计阅读** 25 分钟

---

## 本课要回答的问题

`CollaborationService` 怎样发送消息到 Supervisor？`sendMessageToSupervisor` 怎样工作？

## 概念阶梯

### 第一层：消息发送流程

```textn用户发送消息
  → renderer 发送 COLLAB_SESSION_MESSAGE_POST
  → 主进程调用 sendMessageToSupervisor()
  → Supervisor 处理消息
  → 返回结果
```

### 第二层：LLM 配置

```textn请求中的 llmConfig
  → summarizeRuntimeLLMConfig()
  → 记录日志
  → persistRuntimeLLMConfig()
```

### 第三层：消息结果

```textn发送消息
  → 成功：返回 { success: true, to: 'supervisor' }
  → 失败：返回错误信息
```

## 源码窗口

### 窗口 1：消息发送（第 221–267 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.COLLAB_SESSION_MESSAGE_POST,
  async (_event, request: { sessionId: string; message: string; workerId?: string; llmConfig?: unknown }): Promise<IpcResponse<unknown>> => {
    try {
      if (!request.sessionId || !request.message) {
        return {
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'sessionId and message are required' },
          timestamp: new Date().toISOString(),
        };
      }
      const llmConfig = request.llmConfig && typeof request.llmConfig === 'object'
        ? request.llmConfig as RuntimeLLMConfig
        : undefined;
      logRuntime('ipc.message.received', {
        sessionId: request.sessionId,
        workerId: request.workerId ?? null,
        messageChars: request.message.length,
        llmConfig: summarizeRuntimeLLMConfig(llmConfig),
      });
      persistRuntimeLLMConfig(llmConfig);
      const f = await getFacade();
      const result = await f.sendMessageToSupervisor(request.sessionId, request.message, request.workerId, llmConfig);
      logRuntime('ipc.message.result', {
        sessionId: request.sessionId,
        success: result.success,
        error: result.error ?? null,
      });
      if (!result.success) {
        return {
          success: false,
          error: { code: 'MESSAGE_FAILED', message: result.error ?? 'Failed to send message' },
          timestamp: new Date().toISOString(),
        };
      }
      return {
        success: true,
        data: { success: true, to: 'supervisor' },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.toErrorResponse(error, '[CollaborationService] Send message failed');
    }
  }
);
```

## 失败路径

### 失败 1：参数缺失

如果 `sessionId` 或 `message` 缺失，返回 `INVALID_REQUEST` 错误。

### 失败 2：消息发送失败

如果 `sendMessageToSupervisor()` 失败，返回 `MESSAGE_FAILED` 错误。

### 失败 3：Supervisor 未响应

如果 Supervisor 未响应，返回超时错误。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么需要 `sendMessageToSupervisor`？
2. `persistRuntimeLLMConfig` 的作用是什么？

<details>
<summary>参考答案</summary>

1. `sendMessageToSupervisor` 把用户消息发送到 Supervisor，由 Supervisor 分配给 Agent 处理。

2. `persistRuntimeLLMConfig` 持久化 LLM 配置，供后续使用。

</details>

## 口头验收

完成本课后，你应该能用 30 秒口头描述：

> "`COLLAB_SESSION_MESSAGE_POST` 发送消息到 Supervisor。先校验参数，记录日志，持久化 LLM 配置，然后调用 `sendMessageToSupervisor()`。成功返回 `{ success: true, to: 'supervisor' }`，失败返回错误信息。"

## 下一课预告

K28 讲了消息发送。K29 会看 `WorkspaceService` 的文件上传和路径安全。
