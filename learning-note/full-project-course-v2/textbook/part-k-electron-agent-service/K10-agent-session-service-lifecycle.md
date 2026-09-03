# K10 · AgentSessionService 怎样管理会话生命周期

> **课号** K10 · **轨道** T13 · **文件** `packages/desktop/src/main/services/agent-session-service.ts` · **预计阅读** 30 分钟

---

## 本课要回答的问题

Agent 会话在桌面版中怎样被创建、获取、更新、删除和恢复？`AgentSessionService` 怎样处理非流式和流式两种消息模式？会话销毁时怎样清理运行时资源？

## 概念阶梯

### 第一层：会话生命周期

```textn创建 (AGENT_SESSION_CREATE)
  → 获取 (AGENT_SESSION_GET)
  → 更新 (AGENT_SESSION_UPDATE)
  → 消息 (AGENT_SESSION_MESSAGE / AGENT_SESSION_MESSAGE_STREAM)
  → 中止 (AGENT_SESSION_ABORT)
  → 销毁 (AGENT_SESSION_DESTROY)
  → 删除 (AGENT_SESSION_DELETE)
```

### 第二层：两种消息模式

| 模式 | IPC 通道 | 特点 | 适用场景 |
| --- | --- | --- | --- |
| 非流式 | `AGENT_SESSION_MESSAGE` | 等待完整回复后返回 | 简单对话 |
| 流式 | `AGENT_SESSION_MESSAGE_STREAM` | 实时推送 text_delta | 长回复、需要实时显示 |

### 第三层：会话恢复

当用户关闭窗口后重新打开时，会话需要从持久化存储中恢复。`AGENT_SESSION_GET` 调用 `restoreSessionAtBoundary()` 恢复会话状态，并重新初始化 Agent 运行时。

## 源码窗口

### 窗口 1：会话创建（第 91–178 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.AGENT_SESSION_CREATE,
  async (_event, request: {
    projectId: string;
    projectName: string;
    systemPrompt?: string;
    agentType?: string;
    projectContext?: Record<string, unknown>;
    sessionId?: string;
    llmConfig?: RuntimeLLMConfig;
    agentBaseDir?: string;
    outputDir?: string;
  }): Promise<IpcResponse<unknown>> => {
    // 1. 参数校验
    if (!request.projectId || !request.projectName) {
      return {
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'projectId and projectName are required' },
        timestamp: new Date().toISOString(),
      };
    }

    // 2. 持久化 LLM 配置
    persistRuntimeLLMConfig(request.llmConfig);

    // 3. 如果提供了 sessionId，检查已有会话
    if (request.sessionId) {
      const existing = await agentSessionService.getSession(request.sessionId, request.projectId);
      if (existing) {
        // 更新现有会话
        const session = await agentSessionService.updateSession(
          request.sessionId,
          { /* ... */ },
          request.projectId,
        ) ?? existing;
        return { success: true, data: session, timestamp: new Date().toISOString() };
      }
    }

    // 4. 确保 agentBaseDir 存在
    if (request.agentBaseDir) {
      const fs = await import('fs');
      fs.mkdirSync(request.agentBaseDir, { recursive: true });
    }

    // 5. 创建会话
    const session = await agentSessionService.createSession(createRequest);
    return { success: true, data: session, timestamp: new Date().toISOString() };
  }
);
```

**关键步骤：**

1. **参数校验**：`projectId` 和 `projectName` 必填。
2. **持久化 LLM 配置**：`persistRuntimeLLMConfig()` 把 LLM 配置保存到磁盘。
3. **检查已有会话**：如果 `sessionId` 存在且会话存在，更新而不是创建。
4. **创建目录**：`agentBaseDir` 不存在时自动创建。
5. **创建会话**：调用 Core 的 `agentSessionService.createSession()`。

### 窗口 2：会话恢复（第 180–212 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.AGENT_SESSION_GET,
  async (_event, request: RestoreAgentSessionRequest): Promise<IpcResponse<unknown>> => {
    // 参数校验
    if (!request.sessionId || !request.projectId || !request.entryType || !request.entryId) {
      return { success: false, error: { code: 'RESTORE_FAILED', message: '...' } };
    }

    // 恢复会话
    const session = await restoreSessionAtBoundary(request, {
      getSession: (sessionId, projectId) =>
        agentSessionService.getSession(sessionId, projectId),
      hydrateRuntime: async (storedSession) => {
        await agentManager.restoreAgentRuntime(storedSession);
      },
    });

    return { success: true, data: session, timestamp: new Date().toISOString() };
  }
);
```

**`restoreSessionAtBoundary()`**：

1. 从持久化存储中读取会话数据。
2. 调用 `getSession()` 获取会话。
3. 调用 `hydrateRuntime()` 恢复 Agent 运行时。
4. 返回恢复后的会话。

### 窗口 3：会话销毁（第 278–329 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.AGENT_SESSION_DESTROY,
  async (_event, request: { sessionId?: string; projectId?: string }): Promise<IpcResponse<unknown>> => {
    // 1. 尝试通过 sessionId 直接移除
    let removed = request.sessionId
      ? await agentManager.finalizeAndRemoveAgent(request.sessionId)
      : false;

    // 2. 回退：通过 projectId 查找并移除
    if (!removed && request.sessionId) {
      const session = await agentSessionService.getSession(request.sessionId);
      if (session?.projectContext?.projectId) {
        const stats = agentManager.getStats();
        for (const entry of stats.sessions) {
          const agentEntry = agentManager.agents.get(entry.sessionId);
          if (agentEntry?.projectId === actualProjectId) {
            await agentManager.finalizeAndRemoveAgent(entry.sessionId);
            removed = true;
            break;
          }
        }
      }
    }

    // 3. 回退：直接通过 projectId 移除
    if (!removed && request.projectId) {
      const stats = agentManager.getStats();
      for (const entry of stats.sessions) {
        const agentEntry = agentManager.agents.get(entry.sessionId);
        if (agentEntry?.projectId === request.projectId) {
          await agentManager.finalizeAndRemoveAgent(entry.sessionId);
          removed = true;
          break;
        }
      }
    }

    return {
      success: true,
      data: { sessionId: request.sessionId ?? request.projectId ?? 'unknown', agentDestroyed: removed },
      timestamp: new Date().toISOString(),
    };
  }
);
```

**三级回退策略：**

1. **直接移除**：通过 `sessionId` 直接移除。
2. **间接移除**：通过 `sessionId` 查找 `projectId`，再遍历所有 Agent 找到匹配的移除。
3. **直接遍历**：通过 `projectId` 遍历所有 Agent 找到匹配的移除。

## 失败路径

### 失败 1：会话不存在

`AGENT_SESSION_GET` 和 `AGENT_SESSION_UPDATE` 会检查会话是否存在，不存在时返回 `NOT_FOUND` 错误。

### 失败 2：所有权校验失败

`assertSessionMessageOwnership()` 检查用户是否有权访问该会话。如果失败，返回 `OWNERSHIP_MISMATCH` 或 `CORRUPT_SESSION` 错误。

### 失败 3：Agent 运行时恢复失败

`hydrateRuntime()` 恢复 Agent 运行时可能失败（如 LLM 配置无效）。此时会话数据还在，但 Agent 无法工作。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么 `AGENT_SESSION_CREATE` 要检查 `sessionId` 是否已有会话？
2. `AGENT_SESSION_DESTROY` 的三级回退策略是什么？为什么需要三级？

<details>
<summary>参考答案</summary>

1. 防止重复创建。如果用户刷新页面后重新创建会话，`sessionId` 可能还在，此时应该更新而不是创建。

2. 第一级通过 `sessionId` 直接移除，第二级通过 `sessionId` 查找 `projectId` 再移除，第三级直接通过 `projectId` 遍历移除。三级回退确保在各种情况下都能清理资源。

</details>

## 口头验收

完成本课后，你应该能用 45 秒口头描述：

> "`AgentSessionService` 管理会话的生命周期：创建、获取、更新、删除、销毁。创建时先校验参数，持久化 LLM 配置，检查已有会话，创建目录，最后创建会话。获取时通过 `restoreSessionAtBoundary()` 恢复会话和 Agent 运行时。销毁时采用三级回退：直接移除、间接移除、遍历移除。"

## 下一课预告

K10 讲了会话生命周期。K11 会看非流式和流式消息模式的具体实现。
