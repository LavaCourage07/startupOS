# K22 · Agent 会话创建与初始化

> **课号** K22 · **轨道** T13 · **文件** `packages/desktop/src/main/services/agent-session-service.ts` · **预计阅读** 30 分钟

---

## 本课要回答的问题

Agent 会话怎样被创建和初始化？`AGENT_SESSION_CREATE` 怎样工作？`agentBaseDir` 怎样被创建？

## 概念阶梯

### 第一层：会话创建流程

```textn用户点击技能卡片
  → renderer 发送 AGENT_SESSION_CREATE
  → 主进程创建会话
  → 返回会话信息
```

### 第二层：参数校验

```textn检查 projectId 和 projectName
  → 检查 sessionId 是否已有会话
  → 创建 agentBaseDir
  → 创建会话
```

### 第三层：会话初始化

```textn创建会话
  → 初始化 Agent 运行时
  → 返回会话信息
```

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

## 失败路径

### 失败 1：参数缺失

如果 `projectId` 或 `projectName` 缺失，返回 `INVALID_REQUEST` 错误。

### 失败 2：会话已存在

如果 `sessionId` 已存在，更新而不是创建。

### 失败 3：目录创建失败

如果 `agentBaseDir` 创建失败，返回错误。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么 `AGENT_SESSION_CREATE` 要检查 `sessionId` 是否已有会话？
2. `agentBaseDir` 的作用是什么？

<details>
<summary>参考答案</summary>

1. 防止重复创建。如果用户刷新页面后重新创建会话，`sessionId` 可能还在，此时应该更新而不是创建。

2. `agentBaseDir` 是 Agent 的工作目录，用于存储 Agent 的产物。

</details>

## 口头验收

完成本课后，你应该能用 30 秒口头描述：

> "`AGENT_SESSION_CREATE` 创建 Agent 会话。先校验参数，持久化 LLM 配置，检查已有会话，创建 `agentBaseDir`，最后创建会话。"

## 下一课预告

K22 讲了会话创建。K23 会看 Agent 消息怎样发送和接收。
