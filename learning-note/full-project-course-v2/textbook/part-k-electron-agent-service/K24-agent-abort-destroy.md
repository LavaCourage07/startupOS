# K24 · Agent 中止与销毁

> **课号** K24 · **轨道** T13 · **文件** `packages/desktop/src/main/services/agent-session-service.ts`、`packages/desktop/src/main/local-agent-bridge.ts` · **预计阅读** 25 分钟

---

## 本课要回答的问题

Agent 怎样被中止和销毁？`AGENT_SESSION_ABORT` 怎样工作？`AGENT_SESSION_DESTROY` 的三级回退策略是什么？

## 概念阶梯

### 第一层：中止 Agent

```textn用户点击中止按钮
  → renderer 发送 AGENT_SESSION_ABORT
  → 主进程调用 agentManager.removeAgent()
  → Agent 停止运行
```

### 第二层：销毁 Agent

```textn用户关闭会话
  → renderer 发送 AGENT_SESSION_DESTROY
  → 主进程尝试三级回退销毁
  → 清理资源
```

### 第三层：三级回退策略

```textn第一级：通过 sessionId 直接移除
  → 失败
第二级：通过 sessionId 查找 projectId，再遍历移除
  → 失败
第三级：直接通过 projectId 遍历移除
```

## 源码窗口

### 窗口 1：中止 Agent（第 862–885 行）

```typescript
ipcMain.handle(
  IPC_CHANNELS.AGENT_SESSION_ABORT,
  async (_event, request: { sessionId: string }): Promise<IpcResponse<unknown>> => {
    try {
      if (!request.sessionId) {
        return {
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'sessionId is required' },
          timestamp: new Date().toISOString(),
        };
      }
      agentManager.removeAgent(request.sessionId);
      return {
        success: true,
        data: { aborted: true },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.toErrorResponse(error, '[AgentSessionService] Abort failed');
    }
  }
);
```

### 窗口 2：销毁 Agent（第 278–329 行）

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

### 窗口 3：LocalAgentBridge 的停止和销毁（第 132–147 行）

```typescript
async stopAgent(agentId: string): Promise<void> {
  if (!this.agents.has(agentId)) {
    return;
  }
  this.sendCommand(agentId, { type: 'shutdown' });
  setTimeout(() => {
    this.agents.get(agentId)?.process.kill('SIGKILL');
  }, 3000);
}

async abortAgent(agentId: string): Promise<void> {
  if (!this.agents.has(agentId)) {
    return;
  }
  this.sendCommand(agentId, { type: 'abort' });
}
```

## 失败路径

### 失败 1：Agent 不存在

如果 `sessionId` 不存在，`removeAgent()` 不执行任何操作。

### 失败 2：销毁超时

如果 `finalizeAndRemoveAgent()` 超时，`stopAgent()` 发送 `SIGKILL` 强制终止。

### 失败 3：资源未清理

如果 `unsubscribe()` 没被调用，事件监听器会一直存在，导致内存泄漏。

## 练习

### 练习 1（概念）

回答以下问题：

1. 中止和销毁的区别是什么？
2. 为什么需要三级回退策略？

<details>
<summary>参考答案</summary>

1. 中止是停止当前操作，Agent 还在。销毁是彻底删除 Agent，清理所有资源。

2. 三级回退确保在各种情况下都能清理资源，即使 sessionId 或 projectId 信息不完整。

</details>

## 口头验收

完成本课后，你应该能用 45 秒口头描述：

> "`AGENT_SESSION_ABORT` 中止 Agent，`AGENT_SESSION_DESTROY` 销毁 Agent。销毁采用三级回退：直接移除、间接移除、遍历移除。`LocalAgentBridge` 的 `stopAgent()` 发送 `shutdown` 命令，3 秒后发送 `SIGKILL` 强制终止。"

## 下一课预告

K24 讲了中止和销毁。K25 是单元小结课，把 K19–K24 的知识重新组织成系统能力。
