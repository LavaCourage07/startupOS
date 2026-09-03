# K20 · Agent Worker 通信协议：JSON Lines 与事件流

> **课号** K20 · **轨道** T13 · **文件** `packages/desktop/src/main/local-agent-bridge.ts` · **预计阅读** 25 分钟

---

## 本课要回答的问题

Agent Worker 怎样通过 stdio 和主进程通信？JSON Lines 协议怎样工作？事件流怎样被解析和分发？

## 概念阶梯

### 第一层：JSON Lines 协议

JSON Lines（JSONL）是一种每行一个 JSON 对象的格式：

```json
{"type": "initialize", "config": {...}}
{"type": "prompt", "message": "Hello"}
{"type": "event", "event": {...}}
```

### 第二层：缓冲区管理

由于 `data` 事件可能接收不完整的行，需要缓冲区管理：

```textn接收 chunk → 追加到 buffer → 按换行符分割 → 处理完整行 → 保留未完整行
```

### 第三层：事件分发

解析后的消息通过 EventEmitter 分发：

```textn解析消息 → 判断类型 → emit 事件 → notifyRenderer
```

## 源码窗口

### 窗口 1：缓冲区管理（第 170–173 行）

```typescript
state.buffer += chunk;
const lines = state.buffer.split('\n');
state.buffer = lines.pop() ?? '';
```

**关键逻辑：**

1. **追加 chunk**：把接收到的数据追加到缓冲区。
2. **按换行符分割**：`split('\n')` 分割成多行。
3. **保留未完整行**：`pop()` 移除最后一行（可能不完整），保留到下一次处理。

### 窗口 2：消息解析（第 174–204 行）

```typescript
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
```

### 窗口 3：通知 Renderer（第 207–211 行）

```typescript
private notifyRenderer(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}
```

## 失败路径

### 失败 1：JSON 解析失败

如果子进程输出非 JSON 格式，`JSON.parse()` 抛出异常。

### 失败 2：缓冲区溢出

如果子进程长时间不输出换行符，缓冲区可能无限增长。

### 失败 3：Renderer 已销毁

如果窗口已关闭，`window.webContents.send()` 会失败。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么需要缓冲区管理？
2. `notifyRenderer` 怎样通知所有窗口？

<details>
<summary>参考答案</summary>

1. `data` 事件可能接收不完整的行，需要缓冲区管理。

2. 遍历 `BrowserWindow.getAllWindows()`，向每个窗口发送消息。

</details>

## 口头验收

完成本课后，你应该能用 30 秒口头描述：

> "Agent Worker 通过 JSON Lines 协议和主进程通信。`handleWorkerOutput()` 管理缓冲区，按换行符分割，解析 JSON 后分发事件。`notifyRenderer()` 遍历所有窗口发送消息。"

## 下一课预告

K20 讲了通信协议。K21 会看 `agent-worker-runtime-deps.ts` 怎样确保运行时依赖被正确打包。
