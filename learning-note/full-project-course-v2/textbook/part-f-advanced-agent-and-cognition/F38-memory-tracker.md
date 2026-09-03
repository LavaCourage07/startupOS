# F38：`memory-tracker.ts` —— JSONL 历史与 Memory Block

## 开篇场景

RoleAgent 每轮对话后需要记录记忆，达到阈值时刷盘到 `Memory.md`。但直接追加到 `Memory.md` 会导致文件越来越长。系统采用 JSONL 格式存储历史（`memory/history.jsonl`），支持增量读取和关键词检索。同时引入 Memory Block 模式（Letta 三元记忆），支持结构化读写。这节课看 `memory-tracker.ts`。

## 核心问题

**为什么用 JSONL 而不是直接写 Markdown？Memory Block 是什么？`parseBlocksFromMarkdown` 和 `serializeBlocksToMarkdown` 如何工作？**

## 概念阶梯

**MemoryEntry**：单轮记忆条目，包含 turnNumber、summary、keyInfo、timestamp。

**MemoryTrackerState**：MemoryTracker 的内部状态，包含 entries、turnCount、flushThreshold。

**MemoryBlock**：Letta 风格的三元记忆块，包含 label、value、limit、description、metadata、readOnly。

**MemoryBlockManager**：Memory Block 的 CRUD 管理器，委托给 Memory Core。

## 源码精读

### 1. MemoryTracker 构造函数

[packages/core/src/lib/integrations/pi-agent/role-agent/memory-tracker.ts 第 34—49 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/memory-tracker.ts#L34)

```typescript
export class MemoryTracker {
  private readonly agentDir: string;
  private readonly historyFilePath: string;
  private readonly dreamCursorPath: string;
  private entries: MemoryEntry[] = [];
  private _turnCount = 0;
  readonly flushThreshold: number;

  constructor(agentDir: string, threshold?: number) {
    this.agentDir = agentDir;
    this.historyFilePath = path.join(agentDir, 'memory', 'history.jsonl');
    this.dreamCursorPath = path.join(agentDir, '.dream_cursor');
    this.flushThreshold = threshold ?? 50;
    this.ensureHistoryDir();
  }
```

- `historyFilePath`：`memory/history.jsonl`；
- `dreamCursorPath`：`.dream_cursor`（Dream 上次处理到的行号）；
- `flushThreshold`：默认 50 轮刷盘一次。

### 2. recordTurn

[packages/core/src/lib/integrations/pi-agent/role-agent/memory-tracker.ts 第 60—84 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/memory-tracker.ts#L60)

```typescript
recordTurn(userMessage: string, turnNumber: number): void {
  this._turnCount++;

  const summary = userMessage.length > 200
    ? userMessage.slice(0, 200) + '...'
    : userMessage;

  const keyInfo = userMessage
    .split(/[.!?\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && s.length <= 100)
    .slice(0, 3);

  const entry: MemoryEntry = {
    turnNumber,
    summary,
    keyInfo,
    timestamp: Date.now(),
  };

  this.entries.push(entry);
  this.appendHistoryEntry(JSON.stringify(entry));
}
```

- summary：截取前 200 字符；
- keyInfo：按句子分割，过滤长度 10-100 的，取前 3 个；
- 追加写入 JSONL。

### 3. MemoryBlockManager

[packages/core/src/lib/integrations/pi-agent/role-agent/memory-tracker.ts 第 206—294 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/memory-tracker.ts#L206)

```typescript
export class MemoryBlockManager {
  private readonly core: MemoryCore;
  private initialized = false;

  constructor(agentDir: string) {
    this.core = new MemoryCore(agentDir);
    this.initialized = true;
  }

  getBlock(label: string): MemoryBlock | null { ... }
  setBlock(label: string, value: string): void { ... }
  appendBlock(label: string, content: string): void { ... }
  replaceBlock(label: string, oldContent: string, newContent: string): boolean { ... }
  deleteBlock(label: string): void { ... }
  listBlocks(): MemoryBlock[] { ... }
  nearLimit(label: string, threshold = 0.8): boolean { ... }
  getCoreMemory(): string { ... }
}
```

MemoryBlockManager 委托 Memory Core 实现 CRUD。Part H 会详细讲 Memory Core。

### 4. parseBlocksFromMarkdown

[packages/core/src/lib/integrations/pi-agent/role-agent/memory-tracker.ts 第 405—467 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/memory-tracker.ts#L405)

```typescript
export function parseBlocksFromMarkdown(content: string): Map<string, MemoryBlock> {
  const blocks = new Map<string, MemoryBlock>();
  const lines = content.split('\n');

  let currentLabel: string | null = null;
  let currentValue = '';
  let currentMeta: Partial<BlockMeta> = {};
  let inMetaSection = false;

  function saveCurrent(): void {
    if (currentLabel) {
      const def = DEFAULT_BLOCKS.find(d => d.label === currentLabel);
      blocks.set(currentLabel, {
        label: currentLabel,
        value: currentValue.trim(),
        limit: currentMeta.limit ?? def?.limit ?? 2000,
        description: currentMeta.description ?? def?.description ?? '',
        metadata: {},
        readOnly: currentMeta.readOnly ?? def?.readOnly ?? false,
      });
    }
  }

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);

    if (headingMatch) {
      saveCurrent();
      currentLabel = headingMatch[1]?.trim() ?? null;
      currentValue = '';
      currentMeta = {};
      inMetaSection = true;
      continue;
    }

    if (currentLabel && inMetaSection) {
      if (/^\{.+?\}$/.test(line.trim())) {
        const parsed = parseMetaLine(line);
        Object.assign(currentMeta, parsed);
        continue;
      } else if (line.trim() === '') {
        inMetaSection = false;
        continue;
      } else {
        inMetaSection = false;
      }
    }

    if (currentLabel) {
      currentValue += line + '\n';
    }
  }

  saveCurrent();
  return blocks;
}
```

解析逻辑：

1. `## Label` 开始新 block；
2. `{description: xxx}`、`{limit: N}`、`{readOnly: true}` 是元数据行；
3. 空行结束元数据区；
4. 其余是 block content。

## 真实调用链

1. `turn_end` 钩子调用 `memoryTracker.recordTurn(userMessage, turnNumber)`；
2. 如果 `shouldFlush()`，调用 `flushMemory`；
3. `flushMemory` 委托 Memory Core 持久化；
4. Dream 触发时，调用 `readRecentHistory(sinceCursor)` 读取增量历史。

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| memory/ 目录不存在 | 自动创建 | `ensureHistoryDir` |
| JSONL 写入失败 | 打印错误，继续运行 | `try/catch` |
| Block 元数据格式错误 | 使用默认值 | `parseMetaLine` |
| readOnly block 写入 | 忽略 | `appendBlock` 检查 |

## 测试证据

- `memory-tracker.test.ts` 覆盖 JSONL 存储、Dream cursor、flush。
- 建议补测试：
  - `parseBlocksFromMarkdown` 正确解析复杂 Memory.md；
  - `serializeBlocksToMarkdown` 正确序列化；
  - `MemoryBlockManager` 的 CRUD 操作。

## 练习与验收

1. **构造 JSONL 历史**：写入多条记录，验证 `readRecentHistory` 增量读取。
2. **测试 Memory Block**：构造 Memory.md，验证 `parseBlocksFromMarkdown` 输出。
3. **测试 cursor**：设置 cursor，验证 `readRecentHistory` 只返回增量数据。

**验收标准**：能独立使用 MemoryTracker 和 MemoryBlockManager。

## 章节收束

`memory-tracker.ts` 是 RoleAgent 记忆持久化的核心。下一节课（F39）看 `dream.ts`，理解自动记忆维护的两阶段流程。
