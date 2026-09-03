# K07 · 进程健康监控怎样检测和处理子进程异常

> **课号** K07 · **轨道** T13 · **文件** `process-health-monitor.ts` · **预计阅读** 20 分钟

---

## 本课要回答的问题

桌面版运行时，主进程、渲染进程和 Agent 子进程同时存在。主进程的事件循环卡顿了怎么办？渲染进程无响应或崩溃了怎样被发现？Agent 当前处于什么阶段（等待模型、流式输出、工具执行）？`ProcessHealthMonitor` 怎样统一观测这些状态？

## 概念阶梯

### 第一层：三类健康信号

| 信号 | 来源 | 检测方法 |
| --- | --- | --- |
| **主事件循环卡顿** | 主进程 | 定时器 tick 间隔超过预期 |
| **渲染进程无响应** | BrowserWindow | `unresponsive` / `responsive` 事件 |
| **渲染进程崩溃** | WebContents | `render-process-gone` 事件 |

### 第二层：事件循环卡顿检测原理

Node.js 的 `setInterval(fn, 1000)` 不保证精确在 1000ms 后执行。如果主线程被阻塞（如大量同步计算），定时器会延迟触发。

`ProcessHealthMonitor` 利用这个特性：

```typescript
private expectedTickAt = 0;

private tick(): void {
  const now = this.now();
  const lagMs = Math.max(0, now - this.expectedTickAt);
  this.expectedTickAt = now + this.sampleIntervalMs;

  if (lagMs >= this.lagWarningMs) {  // 默认 500ms
    this.logWarn(`[ProcessHealth] main-event-loop-lag lagMs=${lagMs} ...`);
  }
}
```

每次 tick 时计算实际触发时间和预期触发时间的差值（`lagMs`）。如果超过 500ms，记录警告日志。

### 第三层：Agent 活动追踪

`ProcessHealthMonitor` 还追踪每个 Agent 会话的当前阶段：

```typescript
type AgentRuntimePhase =
  | 'prompt_start'     // 开始处理用户输入
  | 'model_wait'       // 等待模型响应
  | 'model_stream'     // 流式接收模型输出
  | 'tool_running'     // 执行工具
  | 'completion_check'; // 检查是否完成
```

Agent 运行时在每个阶段切换时调用 `setAgentActivity(sessionId, phase, toolName?)`。健康监控器把这些活动记录在 `activities` Map 中，定期（每 15 秒）输出到日志。

### 第四层：窗口追踪

`trackWindow(window)` 给每个窗口注册三个事件监听器：

1. **`unresponsive`**：渲染进程无响应，记录警告。
2. **`responsive`**：渲染进程恢复响应，记录恢复日志和卡顿时长。
3. **`render-process-gone`**：渲染进程崩溃，记录错误日志和崩溃原因。

## 源码窗口

### 窗口 1：tick() 事件循环卡顿检测（第 152–173 行）

```typescript
private tick(): void {
  const now = this.now();
  const lagMs = Math.max(0, now - this.expectedTickAt);
  this.expectedTickAt = now + this.sampleIntervalMs;

  if (lagMs >= this.lagWarningMs) {
    const memory = this.memoryUsage();
    this.logWarn(
      `[ProcessHealth] main-event-loop-lag lagMs=${lagMs} ` +
      `rssMb=${toMegabytes(memory.rss)} ` +
      `heapUsedMb=${toMegabytes(memory.heapUsed)} ` +
      `${this.describeActivities(now)}`
    );
  }

  if (this.activities.size > 0 &&
      now - this.lastActivityLogAt >= this.activityLogIntervalMs) {
    this.lastActivityLogAt = now;
    this.logInfo(
      `[ProcessHealth] agent-active mainLagMs=${lagMs} ` +
      `${this.describeActivities(now)}`
    );
  }
}
```

**两个日志输出：**

1. **卡顿警告**：`lagMs >= 500ms` 时输出，包含内存使用情况和当前 Agent 活动。
2. **活动日志**：每 15 秒输出一次（如果有 Agent 活动），包含当前卡顿时长和 Agent 活动详情。

### 窗口 2：trackWindow() 渲染进程监控（第 113–146 行）

```typescript
trackWindow(window: BrowserWindow): void {
  if (this.trackedWindows.has(window.id)) return;
  this.trackedWindows.add(window.id);

  window.on('unresponsive', () => {
    const now = this.now();
    this.unresponsiveSince.set(window.id, now);
    this.logWarn(
      `[ProcessHealth] renderer-unresponsive ` +
      `${this.describeWindow(window)} ${this.describeActivities(now)}`
    );
  });

  window.on('responsive', () => {
    const now = this.now();
    const startedAt = this.unresponsiveSince.get(window.id);
    this.unresponsiveSince.delete(window.id);
    this.logInfo(
      `[ProcessHealth] renderer-responsive ` +
      `${this.describeWindow(window)} ` +
      `unresponsiveMs=${startedAt === undefined ? 'unknown' : Math.max(0, now - startedAt)}`
    );
  });

  window.webContents.on('render-process-gone',
    (_event, details: RenderProcessGoneDetails) => {
      this.logError(
        `[ProcessHealth] renderer-gone ` +
        `${this.describeWindow(window)} ` +
        `reason=${details.reason} exitCode=${details.exitCode} ` +
        `${this.describeActivities(this.now())}`
      );
    }
  );

  window.once('closed', () => {
    this.trackedWindows.delete(window.id);
    this.unresponsiveSince.delete(window.id);
  });
}
```

**三个事件监听：**

1. **`unresponsive`**：记录开始无响应的时间戳到 `unresponsiveSince` Map。
2. **`responsive`**：计算无响应时长（`now - startedAt`），清除时间戳。
3. **`render-process-gone`**：记录崩溃原因（`reason`）和退出码（`exitCode`）。

**`describeWindow()`** 输出窗口 ID、标题（截断到 120 字符）和 URL（截断到 300 字符）。

### 窗口 3：setAgentActivity() 活动追踪（第 92–107 行）

```typescript
setAgentActivity(sessionId: string, phase: AgentRuntimePhase, toolName?: string): void {
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) return;

  const existing = this.activities.get(normalizedSessionId);
  if (existing?.phase === phase && existing.toolName === toolName) {
    return;  // 相同阶段，跳过
  }

  this.activities.set(normalizedSessionId, {
    sessionId: normalizedSessionId,
    phase,
    ...(toolName ? { toolName } : {}),
    phaseStartedAt: this.now(),
  });
}

clearAgentActivity(sessionId: string): void {
  this.activities.delete(sessionId);
}
```

**去重优化**：如果阶段和工具名都没变，跳过更新。这防止了高频调用时重复写入 Map。

### 窗口 4：describeActivities() 活动描述（第 175–187 行）

```typescript
private describeActivities(now: number): string {
  if (this.activities.size === 0) return 'activeAgents=none';

  const summaries = Array.from(this.activities.values())
    .slice(0, MAX_ACTIVITY_SUMMARIES)  // 最多 5 个
    .map(activity => {
      const tool = activity.toolName
        ? `,tool=${JSON.stringify(activity.toolName)}` : '';
      return `{session=${JSON.stringify(activity.sessionId)},` +
        `phase=${activity.phase},` +
        `phaseElapsedMs=${Math.max(0, now - activity.phaseStartedAt)}` +
        `${tool}}`;
    });

  const omitted = this.activities.size - summaries.length;
  return `activeAgents=[${summaries.join(',')}]` +
    `${omitted > 0 ? ` omittedAgents=${omitted}` : ''}`;
}
```

**输出格式示例：**

```text
activeAgents=[{session="abc123",phase=model_stream,phaseElapsedMs=2340}]
```

如果有超过 5 个 Agent 活动，只显示前 5 个并附加 `omittedAgents=N`。

### 窗口 5：start() 和 stop()（第 71–90 行）

```typescript
start(): void {
  if (this.timer) return;
  const now = this.now();
  this.expectedTickAt = now + this.sampleIntervalMs;
  this.lastActivityLogAt = now;
  this.timer = this.setIntervalFn(() => this.tick(), this.sampleIntervalMs);
  this.timer.unref?.();
}

stop(): void {
  if (this.timer) {
    this.clearIntervalFn(this.timer);
    this.timer = null;
  }
  this.activities.clear();
  this.trackedWindows.clear();
  this.unresponsiveSince.clear();
}
```

**`timer.unref()`**：允许 Node.js 在定时器还在运行时退出。否则主进程退出时会等待定时器完成。

**`stop()` 清理**：清除定时器、活动记录、窗口追踪和无响应时间戳。

## 失败路径

### 失败 1：定时器被阻塞

如果主线程被长时间阻塞（如大文件同步读取），定时器可能延迟几秒才触发。`lagMs` 会很大，触发警告日志。但监控本身不会崩溃。

### 失败 2：窗口已销毁

`describeWindow()` 中 `window.getTitle()` 和 `window.webContents.getURL()` 可能抛出异常（窗口已销毁）。`try/catch` 捕获异常，`title` 和 `url` 保持空字符串。

### 失败 3：Agent 活动未清理

如果 Agent 会话异常结束，`clearAgentActivity()` 没被调用，活动记录会一直留在 Map 中。这会导致日志中持续显示"活跃 Agent"，但不影响功能。

## 测试证据

健康监控的正确性通过单元测试验证：

- **`process-health-monitor.test.ts`**：测试事件循环卡顿检测（`lagMs >= lagWarningMs`）、Agent 活动记录（`setAgentActivity` / `describeActivities`）、窗口追踪（`trackWindow` 的 `unresponsive` / `responsive` / `render-process-gone` 事件）。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么 `setInterval(fn, 1000)` 的触发时间不精确？什么情况下会延迟？

2. `unresponsive` 和 `render-process-gone` 有什么区别？一个是暂时卡顿，一个是永久崩溃？

3. `timer.unref()` 的作用是什么？如果去掉它，`app.quit()` 时会怎样？

<details>
<summary>参考答案</summary>

1. Node.js 的事件循环是单线程的。如果主线程被阻塞（同步计算、文件 I/O），定时器回调无法在预期时间执行，会延迟到主线程空闲后。

2. `unresponsive` 是渲染进程暂时卡顿（如大量 DOM 操作），但还在运行，会恢复。`render-process-gone` 是渲染进程彻底崩溃或退出，不会恢复。

3. `unref()` 让定时器不阻止 Node.js 退出。如果去掉，`app.quit()` 时会等待定时器完成（最多 1 秒），导致退出延迟。

</details>

### 练习 2（源码阅读）

阅读 `tick()` 函数（第 152–173 行），回答：

1. `lagMs` 的计算中，为什么用 `Math.max(0, now - this.expectedTickAt)`？如果 `now < this.expectedTickAt` 会怎样？

2. 活动日志的输出条件是 `this.activities.size > 0 && now - this.lastActivityLogAt >= this.activityLogIntervalMs`。为什么需要两个条件？

3. `describeActivities()` 为什么限制最多 5 个活动？如果有 100 个 Agent 会话同时运行会怎样？

<details>
<summary>参考答案</summary>

1. `Math.max(0, ...)` 防止负数。如果定时器提前触发（理论上可能），`now < this.expectedTickAt`，差值为负。负数的卡顿没有意义，所以用 0。

2. `activities.size > 0` 防止没有 Agent 活动时输出无意义的日志。`now - lastActivityLogAt >= activityLogIntervalMs` 控制输出频率（每 15 秒一次）。两个条件确保只在有活动时定期输出。

3. 防止日志过长。如果有 100 个 Agent，日志会包含 100 个活动描述，占用大量空间。限制 5 个并附加 `omittedAgents=95` 保持日志简洁。

</details>

## 口头验收

完成本课后，你应该能用 45 秒口头描述：

> "进程健康监控每秒 tick 一次，计算实际触发时间和预期时间的差值。如果超过 500ms，记录事件循环卡顿警告，包含内存使用和 Agent 活动。`trackWindow()` 给每个窗口注册三个事件：`unresponsive` 记录无响应开始时间，`responsive` 计算无响应时长，`render-process-gone` 记录崩溃原因和退出码。`setAgentActivity()` 追踪每个 Agent 会话的当前阶段（`prompt_start` → `model_wait` → `model_stream` → `tool_running` → `completion_check`）。每 15 秒输出一次活动日志。`describeActivities()` 最多显示 5 个活动，超出部分用 `omittedAgents=N` 表示。"

## 下一课预告

K07 是单元一的最后一节正式课。K08 是单元小结课（workshop），会把 K01–K07 的分散知识重新组织成系统能力，建立排查地图，完成口头验收。
