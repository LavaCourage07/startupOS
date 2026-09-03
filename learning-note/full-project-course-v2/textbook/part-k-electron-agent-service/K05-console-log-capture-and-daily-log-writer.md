# K05 · 控制台日志和按日日志写入是怎样工作的

> **课号** K05 · **轨道** T13 · **文件** `console-log-capture.ts` · `daily-log-writer.ts` · **预计阅读** 25 分钟

---

## 本课要回答的问题

K01 提到 `initializeDesktopLogCapture()` 拦截了 `console.log`。但具体怎样拦截？日志怎样分流到桌面日志和 LLM 日志？敏感信息（API Key、Bearer Token）怎样被脱敏？`BufferedDailyLogWriter` 的缓冲机制怎样工作？

## 概念阶梯

### 第一层：日志拦截的原理

Node.js 的 `console.log` 是一个普通函数，可以被替换：

```typescript
const original = console.log.bind(console);
console.log = (...args: unknown[]) => {
  // 先做自己的处理
  captureConsoleCall({ args, ... });
  // 再调用原始函数
  original(...args);
};
```

`main.ts` 在 `initializeDesktopLogCapture()` 中替换了 `console.log`、`console.info`、`console.warn`、`console.error`。之后所有 `console.*` 调用都会先经过 `captureConsoleCall()`。

### 第二层：日志分流

每条日志会被写入两个地方：

1. **桌面日志（desktop）**：所有 `console.*` 调用都写入 `desktop-{YYYY-MM-DD}.log`。
2. **LLM 日志（llm）**：只有匹配特定前缀的日志写入 `llm-{YYYY-MM-DD}.log`。

前缀匹配逻辑在 `shouldWriteLlm()` 中：

```typescript
const llmLogPrefixes = [
  '[LLM', '[createRuntimeModel]', '[createOriginOSAgent]',
  '[OriginOSAgent]', '[streamFn]', '[anthropic stream]',
  // ... 20+ 个前缀
];

function shouldWriteLlm(line: string): boolean {
  return llmLogPrefixes.some((prefix) => line.includes(prefix));
}
```

### 第三层：敏感信息脱敏

`serializeConsoleArgs()` 在序列化参数后，用正则表达式脱敏：

```typescript
function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+\S+/giu, 'Bearer [REDACTED]')
    .replace(/\b(?:sk|tp)-[A-Za-z0-9._-]{8,}\b/gu, '[REDACTED]')
    .replace(
      /\b(api[_-]?key|token|secret|password)(\s*[:=]\s*["']?)[^\s,"'}]+/giu,
      '$1$2[REDACTED]',
    );
}
```

三个正则分别匹配：

1. `Bearer <token>` → `Bearer [REDACTED]`
2. `sk-...` 或 `tp-...`（API Key 格式）→ `[REDACTED]`
3. `api_key=...`、`token: ...`、`password=...` → `api_key=[REDACTED]`

### 第四层：缓冲写入

`BufferedDailyLogWriter` 不立即写磁盘，而是缓冲到内存：

```typescript
class BufferedDailyLogWriter {
  private readonly pending = new Map<string, string[]>();
  private pendingBytes = 0;
  private timer: NodeJS.Timeout | null = null;

  append(channel: LogChannel, line: string): boolean {
    const filePath = this.resolvePath(channel);
    const chunks = this.pending.get(filePath) ?? [];
    chunks.push(line);
    this.pending.set(filePath, chunks);
    this.pendingBytes += Buffer.byteLength(line, 'utf8');

    if (this.pendingBytes >= this.maxBytes) {
      void this.flush();  // 达到 64KB 立即刷新
    } else if (!this.timer) {
      this.timer = this.setTimer(() => {
        void this.flush();
      }, this.flushDelayMs);  // 100ms 后刷新
      this.timer.unref?.();
    }
    return true;
  }
}
```

**两种刷新触发：**

1. **字节阈值**：`pendingBytes >= maxBytes`（默认 64KB）时立即刷新。
2. **定时器**：第一条日志写入后 100ms（`flushDelayMs`）刷新。

**写入链（writeChain）**：

```typescript
private writeChain: Promise<void> = Promise.resolve();

flush(): Promise<void> {
  this.writeChain = this.writeChain
    .then(async () => {
      await this.ensureDirectory(this.logsDir);
      for (const entry of batch) {
        await this.appendFile(entry.filePath, entry.content);
      }
    })
    .catch(() => undefined);
  return this.writeChain;
}
```

`writeChain` 确保多次 `flush()` 调用串行执行，不会并发写入同一个文件。

## 源码窗口

### 窗口 1：serializeConsoleArgs()（第 22–39 行）

```typescript
export function serializeConsoleArgs(
  args: unknown[],
  maxLineLength = DEFAULT_MAX_LINE_LENGTH,
): string {
  const line = args.map((arg) => {
    if (typeof arg === 'string') {
      return arg;
    }
    return util.inspect(arg, {
      depth: 4,
      breakLength: 160,
      maxArrayLength: 30,
      maxStringLength: 1000,
      compact: true,
    });
  }).join(' ');
  return truncateLine(redactSensitiveText(line), maxLineLength);
}
```

**处理流程：**

1. **字符串参数**：直接返回，不用 `util.inspect`。
2. **非字符串参数**：用 `util.inspect()` 序列化为字符串。配置：
   - `depth: 4`：对象最多展开 4 层。
   - `breakLength: 160`：超过 160 字符换行。
   - `maxArrayLength: 30`：数组最多显示 30 个元素。
   - `maxStringLength: 1000`：字符串最多显示 1000 字符。
   - `compact: true`：紧凑格式，不展开多行。
3. **拼接**：多个参数用空格连接。
4. **脱敏**：`redactSensitiveText()` 替换敏感信息。
5. **截断**：`truncateLine()` 超过 8KB 时截断，附加 `[console line truncated, originalLength=...]`。

### 窗口 2：captureConsoleCall()（第 52–60 行）

```typescript
export function captureConsoleCall(options: CaptureConsoleCallOptions): void {
  const line = (options.serialize ?? serializeConsoleArgs)(options.args);
  const prefixed = `${options.methodName.toUpperCase()} ${line}`;
  options.appendDesktop(prefixed);
  if (options.llmEnabled && options.shouldWriteLlm(line)) {
    options.appendLlm(prefixed);
  }
  options.writeTerminal(line);
}
```

**三个输出：**

1. `appendDesktop(prefixed)`：写入桌面日志，带方法名前缀（`LOG`、`INFO`、`WARN`、`ERROR`）。
2. `appendLlm(prefixed)`：如果 LLM 日志启用且匹配前缀，写入 LLM 日志。
3. `writeTerminal(line)`：调用原始的 `console.*` 方法，输出到终端。

### 窗口 3：DailyLogWriter（同步版本，第 21–59 行）

```typescript
export class DailyLogWriter {
  resolvePath(channel: LogChannel, at: Date = this.now()): string {
    return path.join(this.logsDir, `${channel}-${formatLocalDate(at)}.log`);
  }

  append(channel: LogChannel, line: string): boolean {
    if (!line) return true;

    try {
      this.ensureDirectory(this.logsDir);
      this.appendFile(this.resolvePath(channel), line);
      return true;
    } catch {
      return false;
    }
  }
}
```

**路径格式**：`{logsDir}/{channel}-{YYYY-MM-DD}.log`，例如 `desktop-2026-09-02.log`。

**同步写入**：`appendFileSync()` 阻塞直到写入完成。适合低频日志。

### 窗口 4：BufferedDailyLogWriter（异步缓冲版本，第 72–159 行）

```typescript
export class BufferedDailyLogWriter {
  private readonly pending = new Map<string, string[]>();
  private pendingBytes = 0;
  private timer: NodeJS.Timeout | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  append(channel: LogChannel, line: string): boolean {
    if (this.disposed || !line) return !this.disposed;

    const filePath = this.resolvePath(channel);
    const chunks = this.pending.get(filePath) ?? [];
    chunks.push(line);
    this.pending.set(filePath, chunks);
    this.pendingBytes += Buffer.byteLength(line, 'utf8');

    if (this.pendingBytes >= this.maxBytes) {
      void this.flush();
    } else if (!this.timer) {
      this.timer = this.setTimer(() => {
        void this.flush();
      }, this.flushDelayMs);
      this.timer.unref?.();
    }
    return true;
  }

  flush(): Promise<void> {
    if (this.timer) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    if (this.pending.size === 0) return this.writeChain;

    const batch = Array.from(this.pending, ([filePath, chunks]) => ({
      filePath,
      content: chunks.join(''),
    }));
    this.pending.clear();
    this.pendingBytes = 0;
    this.writeChain = this.writeChain
      .then(async () => {
        await this.ensureDirectory(this.logsDir);
        for (const entry of batch) {
          await this.appendFile(entry.filePath, entry.content);
        }
      })
      .catch(() => undefined);
    return this.writeChain;
  }

  async dispose(): Promise<void> {
    await this.flush();
    this.disposed = true;
  }
}
```

**关键设计：**

1. **`pending` Map**：key 是文件路径，value 是待写入的日志行数组。支持同时缓冲 desktop 和 llm 两个 channel。
2. **`pendingBytes`**：累计缓冲的字节数。达到 `maxBytes`（默认 64KB）时立即刷新。
3. **`timer`**：第一条日志写入后启动 100ms 定时器。定时器触发时刷新。`unref()` 允许 Node.js 在定时器还在运行时退出。
4. **`writeChain`**：Promise 链，确保多次 `flush()` 串行执行。`.catch(() => undefined)` 防止写入失败导致未捕获的 Promise rejection。
5. **`dispose()`**：刷新缓冲并标记为已销毁。之后 `append()` 返回 `false`。

## 失败路径

### 失败 1：日志目录创建失败

`ensureDirectory()` 失败时，`append()` 返回 `false`（同步版本）或 `flush()` 的 Promise 被 catch（异步版本）。日志丢失但不崩溃。

### 失败 2：日志文件写入失败

`appendFile()` 失败时，同步版本返回 `false`，异步版本的 `writeChain` 被 catch。日志丢失但不崩溃。

### 失败 3：敏感信息脱敏不完整

正则表达式可能无法匹配所有敏感信息格式。例如，自定义的 API Key 格式（不以 `sk-` 或 `tp-` 开头）不会被脱敏。这是已知的限制。

### 失败 4：日志行过长

超过 8KB 的日志行被截断，附加 `[console line truncated, originalLength=...]`。截断后的日志可能不完整，但不会导致写入失败。

## 测试证据

日志系统的正确性通过单元测试验证：

- **`console-log-capture.test.ts`**：测试 `serializeConsoleArgs()` 的序列化、脱敏和截断。
- **`daily-log-writer.test.ts`**：测试 `DailyLogWriter` 和 `BufferedDailyLogWriter` 的路径解析、缓冲刷新和 dispose。

## 练习

### 练习 1（概念）

回答以下问题：

1. 为什么 `console.log` 可以被替换？如果它是原生方法（不能被替换），日志拦截怎样实现？

2. `BufferedDailyLogWriter` 为什么要用 `writeChain` 串行化写入？如果去掉它，多个 `flush()` 并发执行会怎样？

3. `timer.unref()` 的作用是什么？如果去掉它，Node.js 退出时会怎样？

<details>
<summary>参考答案</summary>

1. Node.js 的 `console.log` 是 JavaScript 层面的函数，可以被赋值替换。如果它是原生方法，可以通过 `process.stdout.write()` 拦截（`console.log` 底层调用它），或者用 `--inspect` 启动 Node.js 通过调试协议捕获。

2. `writeChain` 防止并发写入同一个文件。如果去掉，多个 `flush()` 可能同时调用 `appendFile()`，导致日志行交错或文件损坏。

3. `unref()` 允许 Node.js 在定时器还在运行时退出。如果去掉，Node.js 会等待 100ms 定时器触发后才退出，导致退出延迟。

</details>

### 练习 2（源码阅读）

阅读 `redactSensitiveText()` 函数（第 12–20 行），回答：

1. 三个正则表达式分别匹配什么格式？
2. 第二个正则 `\b(?:sk|tp)-[A-Za-z0-9._-]{8,}\b` 中的 `\b` 是什么？如果去掉会怎样？
3. 第三个正则的 `$1$2[REDACTED]` 中，`$1` 和 `$2` 分别是什么？

<details>
<summary>参考答案</summary>

1. 第一个匹配 `Bearer <token>`，第二个匹配 `sk-...` 或 `tp-...`（Anthropic/OpenAI API Key 格式），第三个匹配 `api_key=...`、`token: ...`、`password=...`。

2. `\b` 是单词边界，确保匹配完整的单词（如 `sk-abc123` 而不是 `xxxsk-abc123`）。去掉后会匹配子串，可能误脱敏。

3. `$1` 是第一个捕获组（`api_key`、`token`、`password`），`$2` 是第二个捕获组（`=`、`: `、`= "` 等分隔符）。替换后保留键名和分隔符，只脱敏值。

</details>

## 口头验收

完成本课后，你应该能用 60 秒口头描述：

> "日志系统拦截 `console.*` 调用，分流到桌面日志和 LLM 日志。`serializeConsoleArgs()` 用 `util.inspect()` 序列化参数，深度 4 层，字符串最多 1000 字符。然后 `redactSensitiveText()` 脱敏 Bearer Token、API Key（`sk-`、`tp-` 开头）和键值对（`api_key=...`）。最后 `truncateLine()` 截断超过 8KB 的行。`captureConsoleCall()` 把日志写入 desktop channel，如果匹配前缀（如 `[LLM`、`[OriginOSAgent]`）也写入 llm channel，再调用原始 `console.*` 输出到终端。`BufferedDailyLogWriter` 缓冲日志到内存，达到 64KB 或 100ms 后刷新。`writeChain` 确保多次 `flush()` 串行执行。`dispose()` 刷新并标记为已销毁。"

## 下一课预告

K05 讲了日志系统。K06 会看流式事件批处理——Agent 的流式回复怎样被合并和转发。
