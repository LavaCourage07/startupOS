# K19 · LocalAgentBridge：启动 Agent Worker 子进程

> **课号** K19 · **轨道** T13 · **文件** `packages/desktop/src/main/local-agent-bridge.ts` · **预计阅读** 30 分钟

---

## 本课要回答的问题

Agent 怎样在桌面版中运行？`LocalAgentBridge` 怎样启动 Agent Worker 子进程？子进程怎样通过 stdio 和主进程通信？

## 概念阶梯

### 第一层：为什么需要子进程

Agent 运行需要大量计算资源，如果在主进程中运行，会阻塞主线程，导致 UI 卡顿。子进程可以隔离计算，保证主进程的响应性。

```textn主进程
  ├── renderer 进程（UI）
  ├── Agent Worker 子进程（计算）
  └── 其他子进程
```

### 第二层：LocalAgentBridge 的职责

`LocalAgentBridge` 是主进程和 Agent Worker 子进程之间的桥梁：

1. **启动子进程**：`startAgent()` 启动 Agent Worker。
2. **发送命令**：`sendCommand()` 向子进程发送命令。
3. **接收消息**：`handleWorkerOutput()` 处理子进程的输出。
4. **管理生命周期**：`stopAgent()`、`abortAgent()` 管理 Agent 的生命周期。

### 第三层：子进程通信协议

Agent Worker 通过 stdio 和主进程通信：

```textn主进程 → stdin → Agent Worker
Agent Worker → stdout → 主进程
Agent Worker → stderr → 主进程（错误日志）
```

通信协议是 JSON 行协议（JSON Lines），每行一个 JSON 对象。

## 源码窗口

### 窗口 1：LocalAgentBridge 类（第 1–50 行）

```typescript
export class LocalAgentBridge extends EventEmitter {
  private readonly agents = new Map<string, AgentProcessState>();

  constructor() {
    super();
    this.registerIpcHandlers();
  }

  private registerIpcHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.AGENT_START, async (_event, config: LocalAgentConfig) => {
      return this.startAgent(config);
    });

    ipcMain.handle(IPC_CHANNELS.AGENT_STOP, async (_event, agentId: string) => {
      await this.stopAgent(agentId);
      return true;
    });

    ipcMain.handle(IPC_CHANNELS.AGENT_MESSAGE, async (_event, payload: { agentId: string; message: string }) => {
      await this.sendMessage(payload.agentId, payload.message);
      return true;
    });

    ipcMain.handle(IPC_CHANNELS.AGENT_ABORT, async (_event, agentId: string) => {
      await this.abortAgent(agentId);
      return true;
    });
  }
```

### 窗口 2：启动 Agent Worker（第 51–130 行）

```typescript
async startAgent(config: LocalAgentConfig): Promise<string> {
  const existing = this.agents.get(config.agentId);
  if (existing) {
    return config.agentId;
  }

  const workerPath = path.join(getMonorepoRoot(), 'src/modules/collaboration-runtime/sandbox/agent-worker.mts');
  const child = spawn(process.execPath, ['--import', 'tsx', workerPath], {
    cwd: getMonorepoRoot(),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_OPTIONS: process.env['NODE_OPTIONS'],
    },
  });

  const state: AgentProcessState = {
    config,
    process: child,
    buffer: '',
  };

  child.stdout.on('data', (chunk: Buffer) => {
    this.handleWorkerOutput(config.agentId, chunk.toString('utf-8'));
  });

  child.stderr.on('data', (chunk: Buffer) => {
    console.error(`[LocalAgentBridge:${config.agentId}]`, chunk.toString('utf-8'));
  });

  child.on('exit', (code) => {
    this.agents.delete(config.agentId);
    this.notifyRenderer(IPC_CHANNELS.AGENT_EXIT, {
      agentId: config.agentId,
      sessionId: config.sessionId,
      code,
    });
  });

  this.agents.set(config.agentId, state);

  this.sendCommand(config.agentId, {
    type: 'initialize',
    config: {
      projectId: config.projectId,
      agentId: config.agentId,
      workingDirectory: config.workingDirectory,
      agentType: config.agentType ?? 'originos',
      systemPrompt: config.systemPrompt,
    },
  });

  return config.agentId;
}
```

**关键步骤：**

1. **检查已有 Agent**：如果 `agentId` 已存在，直接返回。
2. **启动子进程**：`spawn()` 启动 Node.js 子进程，加载 `agent-worker.mts`。
3. **监听 stdout**：子进程的输出通过 `stdout` 事件接收。
4. **监听 stderr**：子进程的错误通过 `stderr` 事件接收。
5. **监听 exit**：子进程退出时清理资源。
6. **发送初始化命令**：向子进程发送 `initialize` 命令。

### 窗口 3：发送命令（第 131–162 行）

```typescript
private sendCommand(agentId: string, command: WorkerCommand): void {
  const state = this.agents.get(agentId);
  if (!state) {
    throw new Error(`Agent not found: ${agentId}`);
  }
  state.process.stdin.write(`${JSON.stringify(command)}\n`);
}
```

### 窗口 4：处理输出（第 163–205 行）

```typescript
private handleWorkerOutput(agentId: string, chunk: string): void {
  const state = this.agents.get(agentId);
  if (!state) {
    return;
  }

  state.buffer += chunk;
  const lines = state.buffer.split('\n');
  state.buffer = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    try {
      const message = JSON.parse(line) as WorkerMessage;
      if (message.type === 'event') {
        const envelope: LocalAgentEventEnvelope = {
          agentId,
          sessionId: state.config.sessionId,
          event: message.event,
        };
        this.emit('agent:event', envelope);
        this.notifyRenderer(IPC_CHANNELS.AGENT_EVENT, envelope);
      } else if (message.type === 'error') {
        this.notifyRenderer(IPC_CHANNELS.AGENT_EVENT, {
          agentId,
          sessionId: state.config.sessionId,
          event: {
            type: 'agent_error',
            error: {
              message: message.message ?? 'Unknown agent worker error',
            },
          },
        });
      }
    } catch (error) {
      console.error('[LocalAgentBridge] Failed to parse worker output:', error);
    }
  }
}
```

## 失败路径

### 失败 1：子进程启动失败

如果 `spawn()` 失败（如文件不存在），子进程无法启动，返回错误。

### 失败 2：JSON 解析失败

如果子进程输出非 JSON 格式，`JSON.parse()` 抛出异常。

### 失败 3：Agent 重复启动

如果 `agentId` 已存在，`startAgent()` 直接返回，不会重复启动。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么 Agent 要在子进程中运行？
2. `LocalAgentBridge` 怎样防止重复启动同一个 Agent？

<details>
<summary>参考答案</summary>

1. 子进程可以隔离计算，防止阻塞主线程，保证 UI 响应性。

2. `startAgent()` 检查 `this.agents.has(config.agentId)`，如果已存在直接返回。

</details>

## 口头验收

完成本课后，你应该能用 45 秒口头描述：

> "`LocalAgentBridge` 管理 Agent Worker 子进程的生命周期。`startAgent()` 启动子进程，通过 stdio 通信。`sendCommand()` 向子进程发送 JSON 命令，`handleWorkerOutput()` 处理子进程的 JSON 输出。子进程退出时清理资源。"

## 下一课预告

K19 讲了 Agent Worker 启动。K20 会看 Agent Worker 怎样通过 stdio 和主进程通信。
