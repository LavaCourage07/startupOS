# K06 · 流式事件批处理和助手消息状态管理

> **课号** K06 · **轨道** T13 · **文件** `stream-event-batcher.ts` · `assistant-stream-state.ts` · **预计阅读** 20 分钟

---

## 本课要回答的问题

Agent 的流式回复会产生大量 SSE 事件（每秒几十个 `text_delta`）。如果每个事件都立即通过 IPC 转发给 renderer，会造成什么性能问题？`StreamEventBatcher` 怎样把连续的文本事件合并成一次刷新？`applyAssistantMessageEnd()` 在流式结束时怎样和最终内容做调和？

## 概念阶梯

### 第一层：为什么需要批处理

Agent 流式回复的事件序列可能是：

```text
text_delta: "你"
text_delta: "好"
text_delta: "，"
text_delta: "我是"
text_delta: "OriginOS"
...
```

如果每个 `text_delta` 都立即通过 IPC 发送到 renderer，renderer 的 React 状态更新会非常频繁（每秒 30+ 次），导致 UI 卡顿。批处理把连续的文本事件合并成一次刷新，减少 IPC 和状态更新次数。

### 第二层：合并策略

`StreamEventBatcher` 的合并策略：

1. **连续同类型文本事件合并**：如果当前事件和上一个事件都是 `text_delta`（或都是 `assistant_message` 的流式文本），把文本追加到同一个 `textChunks` 数组。
2. **非文本事件不合并**：`tool_use`、`tool_result` 等事件直接入队，不和前后合并。
3. **类型切换不合并**：`text_delta` 后面跟 `assistant_message` 不合并，即使都是文本。

### 第三层：刷新触发

三种刷新触发：

1. **首次文本立即刷新**：第一个文本事件到达时立即刷新，让 renderer 尽快看到第一个字。
2. **字节阈值**：缓冲达到 16KB 时刷新。
3. **定时器**：第一个事件到达后 32ms 刷新。

### 第四层：最终内容调和

流式结束时，Agent 会发送一个 `assistant_message` 包含完整内容。但流式过程中已经发送了部分文本。`reconcileFinalStreamContent()` 确保最终内容和流式内容一致，防止重复发送。

## 源码窗口

### 窗口 1：可合并文本检测（第 23–40 行）

```typescript
function getMergeableText(
  event: BatchedStreamEvent
): { field: 'delta' | 'content'; value: string } | null {
  if (!event.data || typeof event.data !== 'object') return null;

  if (event.type === 'text_delta') {
    const delta = (event.data as { delta?: unknown }).delta;
    return typeof delta === 'string' ? { field: 'delta', value: delta } : null;
  }

  if (event.type === 'assistant_message') {
    const data = event.data as { content?: unknown; isStreaming?: unknown };
    return data.isStreaming === true && typeof data.content === 'string'
      ? { field: 'content', value: data.content }
      : null;
  }

  return null;
}
```

**两种可合并事件：**

1. **`text_delta`**：`data.delta` 是字符串，`field` 为 `'delta'`。
2. **`assistant_message`（流式中）**：`data.isStreaming === true` 且 `data.content` 是字符串，`field` 为 `'content'`。

其他事件（`tool_use`、`tool_result`、非流式 `assistant_message`）返回 `null`，不可合并。

### 窗口 2：push() 合并逻辑（第 65–103 行）

```typescript
push(event: BatchedStreamEvent): void {
  if (this.disposed) return;

  const text = getMergeableText(event);
  const previous = this.events[this.events.length - 1];

  if (text && previous && previous.textField === text.field
      && previous.event.type === event.type && previous.textChunks) {
    // 连续同类型文本 → 追加到上一个事件的 textChunks
    previous.textChunks.push(text.value);
  } else {
    // 非文本或类型切换 → 新建条目
    this.events.push({
      event,
      ...(text ? { textField: text.field, textChunks: [text.value] } : {}),
    });
  }

  this.byteCount += text === null
    ? Buffer.byteLength(JSON.stringify(event), 'utf8')
    : Buffer.byteLength(text.value, 'utf8');

  // 首次文本立即刷新
  if (text !== null && !this.hasFlushedFirstText) {
    this.hasFlushedFirstText = true;
    this.flush();
    return;
  }
  // 字节阈值刷新
  if (this.byteCount >= this.maxBytes) {
    this.flush();
    return;
  }
  // 定时器刷新
  if (!this.timer) {
    this.timer = this.setTimer(() => this.flush(), this.maxDelayMs);
  }
}
```

**合并条件**（四个同时满足）：

1. 当前事件有可合并文本（`text !== null`）
2. 上一个事件也有文本（`previous.textChunks` 存在）
3. 文本字段相同（`previous.textField === text.field`）
4. 事件类型相同（`previous.event.type === event.type`）

### 窗口 3：flush() 合并输出（第 105–129 行）

```typescript
flush(): void {
  if (this.timer) {
    this.clearTimer(this.timer);
    this.timer = null;
  }
  if (this.events.length === 0) return;

  const events = this.events.map(({ event, textField, textChunks }) => {
    if (!textField || !textChunks) return event;
    return {
      ...event,
      data: {
        ...(event.data as object),
        [textField]: textChunks.join(''),
      },
    };
  });

  this.events = [];
  this.byteCount = 0;
  this.onFlush(events);
}
```

**合并过程**：遍历所有待刷新事件，如果有 `textChunks`，用 `join('')` 合并成一个字符串，替换原来的 `delta` 或 `content` 字段。

**示例**：

```text
输入（3 个 text_delta）：
  { type: 'text_delta', data: { delta: '你' } }
  { type: 'text_delta', data: { delta: '好' } }
  { type: 'text_delta', data: { delta: '，' } }

输出（1 个合并后的 text_delta）：
  { type: 'text_delta', data: { delta: '你好，' } }
```

### 窗口 4：applyAssistantMessageEnd()（第 17–34 行）

```typescript
export function applyAssistantMessageEnd(
  state: AssistantStreamState,
  message: AssistantMessageEnd
): AssistantMessageTransition {
  // 空内容 → 不发送
  if (!message.content) {
    return { ...state, shouldSend: false };
  }
  // 完成失败 → 不发送
  if (message.completionFailure) {
    return { ...state, shouldSend: false };
  }
  // 调和最终内容
  const content = reconcileFinalStreamContent(state.content, message.content);
  const shouldSend = !state.sent;
  return {
    content,
    sent: state.sent || shouldSend,
    shouldSend,
  };
}
```

**三个判断：**

1. **空内容**：不发送，保持原状态。
2. **完成失败**（`completionFailure: true`）：不发送，保持原状态。
3. **正常完成**：用 `reconcileFinalStreamContent()` 调和流式内容和最终内容。如果还没发送过（`!state.sent`），标记为需要发送。

**`reconcileFinalStreamContent()`** 来自 Core 的 `stream-dedupe` 模块，它处理流式内容和最终内容之间的差异（如重复文本、缺失文本）。

## 失败路径

### 失败 1：非连续文本事件

如果文本事件中间插入了 `tool_use` 事件，合并会断开。例如：

```text
text_delta: "你好"
tool_use: { name: 'search', ... }
text_delta: "，世界"
```

刷新后会输出三个事件：合并的 `text_delta: "你好"`、`tool_use`、合并的 `text_delta: "，世界"`。renderer 需要正确处理分段文本。

### 失败 2：flush 延迟

32ms 的 `maxDelayMs` 意味着用户看到的文本有最多 32ms 的延迟。首次文本立即刷新缓解了这个问题——第一个字没有延迟。

### 失败 3：reconcileFinalStreamContent 调和失败

如果流式内容和最终内容差异太大（如网络中断导致部分内容丢失），`reconcileFinalStreamContent()` 可能无法正确调和。此时 `shouldSend` 仍为 `true`（如果之前没发送过），renderer 会收到最终内容作为兜底。

## 测试证据

流式批处理的正确性通过单元测试验证：

- **`assistant-stream-state.test.ts`**：测试 `applyAssistantMessageEnd()` 的正常结束、失败结束、重复发送场景。
- **`stream-event-batcher`** 的测试验证文本合并、首次立即刷新、字节阈值刷新和定时器刷新。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么第一个文本事件要立即刷新？如果也用 32ms 延迟会怎样？

2. `text_delta` 和 `assistant_message`（`isStreaming: true`）都是文本事件，但它们的 `field` 不同（`'delta'` vs `'content'`）。为什么不能合并？

3. `shouldSend` 的作用是什么？如果流式过程中已经发送了所有内容，最终消息还需要发送吗？

<details>
<summary>参考答案</summary>

1. 第一个字立即刷新让用户尽快看到响应，减少感知延迟。如果也用 32ms 延迟，用户会感觉响应慢了 32ms。

2. `text_delta` 的 `delta` 字段是增量文本（每次只有几个字），`assistant_message` 的 `content` 字段是累积文本（每次包含到目前为止的所有文本）。两者的语义不同，合并会导致内容错误。

3. `shouldSend` 防止重复发送。如果流式过程中已经发送了所有内容（`state.sent === true`），最终消息不需要再发送（`shouldSend: false`）。但如果流式过程中有内容丢失，最终消息作为兜底需要发送。

</details>

### 练习 2（源码阅读）

阅读 `push()` 函数（第 65–103 行），回答：

1. 如果当前事件是 `text_delta`，上一个事件是 `assistant_message`（`isStreaming: true`），它们会合并吗？为什么？

2. `byteCount` 的计算中，为什么非文本事件用 `JSON.stringify(event)` 而文本事件只用 `text.value`？

3. `dispose()` 调用 `flush()` 后设置 `this.disposed = true`。如果 `dispose()` 之后再调用 `push()` 会怎样？

<details>
<summary>参考答案</summary>

1. 不会。合并条件要求 `previous.event.type === event.type`，`text_delta` 和 `assistant_message` 类型不同，不满足条件。

2. 非文本事件需要完整序列化（包括 `type` 和 `data`）来计算字节数，因为它们不会被合并。文本事件只计算文本部分的字节数，因为合并后只有文本内容会被输出。

3. `push()` 的第一行检查 `if (this.disposed) return`，直接返回，不做任何处理。

</details>

## 口头验收

完成本课后，你应该能用 45 秒口头描述：

> "流式批处理器把连续的 `text_delta` 或 `assistant_message`（`isStreaming: true`）合并成一次刷新。合并条件：同类型、同字段、连续。首次文本立即刷新减少感知延迟。之后用 32ms 定时器或 16KB 字节阈值触发刷新。`flush()` 把 `textChunks` 数组 `join('')` 合并成一个字符串。`applyAssistantMessageEnd()` 在流式结束时调和最终内容和流式内容。空内容或完成失败不发送。`shouldSend` 防止重复发送——如果流式过程中已经发送过，最终消息不再发送。"

## 下一课预告

K06 讲了流式批处理。K07 会看进程健康监控——主事件循环卡顿、渲染进程崩溃和 Agent 活动怎样被观测。
