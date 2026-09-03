# K12 · StreamEventBatcher：流式事件合并与首次立即刷新

> **课号** K12 · **轨道** T13 · **文件** `packages/desktop/src/main/services/stream-event-batcher.ts` · **预计阅读** 25 分钟

---

## 本课要回答的问题

流式消息产生大量 `text_delta` 事件，怎样减少 IPC 调用次数？`StreamEventBatcher` 怎样合并连续文本？为什么首次文本要立即刷新？

## 概念阶梯

### 第一层：问题背景

流式消息中，Agent 每产生一个 token 就会触发一次 `text_delta` 事件。如果每个 token 都通过 IPC 发送，会产生大量 IPC 调用，影响性能。

```textnAgent 产生 token
  → IPC 发送 text_delta
  → Agent 产生下一个 token
  → IPC 发送 text_delta
  → ...（每秒可能几十次）
```

### 第二层：合并策略

`StreamEventBatcher` 采用两种策略合并事件：

1. **时间窗口**：32ms 内的事件合并为一次 IPC。
2. **大小阈值**：16KB 的数据立即刷新。\n```textnAgent 产生 token
  → 放入 batcher 队列
  → 32ms 内继续产生 token
  → 合并后一次性 IPC 发送
```

### 第三层：首次立即刷新

首次文本立即刷新是为了减少感知延迟。用户发送消息后尽快看到第一个字，感觉响应更快。

```textn首次 text_delta
  → 立即刷新（不等待 32ms）
  → 用户立即看到第一个字
  → 后续事件进入 32ms 窗口
```

## 源码窗口

### 窗口 1：StreamEventBatcher 类（第 1–120 行）

```typescript
class StreamEventBatcher {
  private buffer: string = '';
  private timer: NodeJS.Timeout | null = null;
  private hasFlushedFirstText = false;
  private readonly FLUSH_INTERVAL = 32; // ms
  private readonly MAX_BUFFER_SIZE = 16 * 1024; // 16KB

  constructor(private options: { onFlush: (events: StreamEvent[]) => void }) {}

  push(event: StreamEvent) {
    if (event.type === 'text_delta') {
      this.buffer += event.data.delta;

      // 首次文本立即刷新
      if (!this.hasFlushedFirstText && this.buffer.length > 0) {
        this.flush();
        this.hasFlushedFirstText = true;
        return;
      }

      // 达到大小阈值立即刷新
      if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
        this.flush();
        return;
      }

      // 启动定时器
      if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL);
      }
    } else {
      // 非 text_delta 事件立即刷新
      this.flush();
      this.options.onFlush([event]);
    }
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.length > 0) {
      this.options.onFlush([{ type: 'text_delta', data: { delta: this.buffer } }]);
      this.buffer = '';
    }
  }

  dispose() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.buffer = '';
  }
}
```

**关键逻辑：**

1. **`push()` 方法**：接收事件，如果是 `text_delta` 类型，追加到缓冲区。
2. **首次立即刷新**：如果 `hasFlushedFirstText` 为 false 且缓冲区有内容，立即调用 `flush()`。
3. **大小阈值**：如果缓冲区达到 16KB，立即刷新。
4. **定时器**：启动 32ms 定时器，到期后刷新。
5. **`flush()` 方法**：清空定时器，发送缓冲区内容，清空缓冲区。
6. **`dispose()` 方法**：清理资源，防止内存泄漏。

### 窗口 2：在流式消息中的使用（agent-session-service.ts 第 588–859 行）

```typescript
// 创建 StreamEventBatcher
const batcher = new StreamEventBatcher({
  onFlush: (events) => {
    sender.send(IPC_CHANNELS.AGENT_EVENT, {
      type: 'batch_events',
      sessionId: request.sessionId,
      data: { events },
    });
  },
});

// Agent 事件订阅
const unsubscribe = agent.subscribe((event) => {
  switch (event.type) {
    case 'message_update':
      batcher.push({ type: 'text_delta', data: { delta: event.delta } });
      break;
    case 'message_end':
      batcher.flush(); // 强制刷新剩余内容
      sender.send(IPC_CHANNELS.AGENT_EVENT, {
        type: 'assistant_message',
        sessionId: request.sessionId,
        data: { content: assistantContent },
      });
      break;
  }
});
```

## 失败路径

### 失败 1：定时器未清理

如果 `dispose()` 没被调用，定时器会一直存在，导致内存泄漏。`agent.prompt()` 完成后必须调用 `batcher.dispose()`。

### 失败 2：缓冲区溢出

如果 Agent 产生大量文本且 `flush()` 未及时调用，缓冲区可能无限增长。`MAX_BUFFER_SIZE` 限制防止内存溢出。

### 失败 3：事件顺序错乱

`message_end` 事件必须在所有 `text_delta` 之后。`flush()` 确保在发送 `assistant_message` 前清空缓冲区。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么首次文本要立即刷新？如果去掉这个优化，用户体验会怎样变化？
2. `FLUSH_INTERVAL` 为什么是 32ms？如果改成 100ms 或 10ms 会怎样？

<details>
<summary>参考答案</summary>

1. 首次文本立即刷新减少感知延迟。用户发送消息后尽快看到第一个字，感觉响应更快。如果也用 32ms 延迟，用户会感觉响应慢了 32ms（虽然绝对值很小，但在交互密集场景下可感知）。

2. 32ms 是平衡性能和延迟的值。100ms 延迟太长，用户会感觉卡顿。10ms 太短，IPC 调用次数增加，性能下降。

</details>

## 口头验收

完成本课后，你应该能用 30 秒口头描述：

> "`StreamEventBatcher` 合并连续 `text_delta` 事件，减少 IPC 调用次数。首次文本立即刷新，减少感知延迟。后续事件进入 32ms 时间窗口或 16KB 大小阈值，达到条件后一次性 IPC 发送。`flush()` 清空缓冲区，`dispose()` 清理定时器防止内存泄漏。"

## 下一课预告

K12 讲了流式事件合并。K13 会看 `SkillService` 怎样处理技能列表和执行。
