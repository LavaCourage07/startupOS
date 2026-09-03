# M15 数据文件格式如何阅读——JSON、JSONL、Markdown 与二进制

小林打开 Agent 的数据目录，看到 `.json`、`.jsonl`、`.md`、`.bin` 等多种文件格式。她困惑了：为什么同一个 Agent 的数据要用这么多种格式？每种格式适合存储什么类型的数据？

本课解决一个理解问题：当你面对 OriginOS 的多种数据文件格式时，怎样理解每种格式的特点、适用场景、以及阅读方法。

## 场景：从"多种格式"到"每种格式都有明确用途"

### 1.1 OriginOS 的数据文件格式概览

OriginOS 使用四种主要的数据文件格式：

| 格式 | 扩展名 | 用途 | 特点 |
| --- | --- | --- | --- |
| JSON | `.json` | 结构化数据（配置、摘要） | 人类可读，支持嵌套 |
| JSONL | `.jsonl` | 事件流、历史记录 | 每行独立，支持追加写入 |
| Markdown | `.md` | 文本内容（记忆、知识库） | 人类可读，支持富文本 |
| Binary | `.bin` | 索引、模型（HNSW） | 机器高效，不可读 |

### 1.2 格式选择的原则

OriginOS 选择数据格式的原则：

| 数据特征 | 选择格式 | 原因 |
| --- | --- | --- |
| 结构化、需要随机访问 | JSON | 支持嵌套，易于解析 |
| 顺序写入、增量读取 | JSONL | 每行独立，追加写入高效 |
| 文本内容、需要人类阅读 | Markdown | 可读性好，支持标题/列表/代码块 |
| 大量数值、需要高效计算 | Binary | 体积小，读取速度快 |

## 2. JSON 格式精读

### 2.1 `blocks.json` 的结构

```json
{
  "id": "agent-xiaofengjun",
  "name": "xiaofengjun",
  "type": "role-agent",
  "createdAt": "2026-08-20T16:22:00.000Z",
  "updatedAt": "2026-09-02T10:30:00.000Z",
  "config": {
    "role": "test-engineer",
    "allowedTools": ["bash", "file", "skill"]
  }
}
```

**关键字段**：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | string | Agent 的唯一标识符 |
| `name` | string | Agent 的显示名称 |
| `type` | string | Agent 类型（role-agent、project-agent 等） |
| `createdAt` | ISO 8601 | 创建时间 |
| `updatedAt` | ISO 8601 | 最后更新时间 |
| `config` | object | Agent 的配置（角色、工具等） |

### 2.2 `practice/summary.json` 的结构

```json
{
  "agentId": "agent-xiaofengjun",
  "totalTurns": 8,
  "lastTurnAt": "2026-09-02T10:30:00.000Z",
  "metrics": {
    "averageResponseTime": 1200,
    "successRate": 0.95
  }
}
```

**关键理解**：JSON 文件适合存储结构化的元数据和统计信息。它的优势是易于解析和修改，劣势是不适合存储大量数据（因为需要一次性读取整个文件）。

## 3. JSONL 格式精读

### 3.1 JSONL 与 JSON 的区别

| 特征 | JSON | JSONL |
| --- | --- | --- |
| 格式 | 单个 JSON 对象 | 每行一个 JSON 对象 |
| 读取方式 | 一次性读取整个文件 | 逐行读取，支持增量 |
| 写入方式 | 覆盖整个文件 | 追加到文件末尾 |
| 适用场景 | 配置、元数据 | 事件流、历史记录 |
| 示例 | `blocks.json` | `events.jsonl` |

### 3.2 `events.jsonl` 的结构

```jsonl
{"timestamp":"2026-09-02T10:30:00.000Z","type":"session_start","agentId":"agent-1","data":{}}
{"timestamp":"2026-09-02T10:30:01.000Z","type":"message","agentId":"agent-1","data":{"content":"Hello"}}
{"timestamp":"2026-09-02T10:30:02.000Z","type":"message","agentId":"agent-2","data":{"content":"Hi there"}}
```

**关键理解**：JSONL 的每行是一个独立的 JSON 对象，这意味着：

1. **追加写入高效**：不需要读取整个文件，直接追加到末尾
2. **增量读取高效**：可以逐行读取，不需要一次性加载整个文件
3. **容错性好**：如果某一行损坏，不影响其他行的解析

### 3.3 JSONL 的读取方法

```javascript
// Node.js 逐行读取 JSONL
const fs = require('fs');
const readline = require('readline');

async function readJSONL(filePath) {
  const events = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    if (line.trim()) {
      events.push(JSON.parse(line));
    }
  }

  return events;
}
```

**关键理解**：JSONL 的读取应该使用流式读取，避免一次性加载大量数据到内存。

## 4. Markdown 格式精读

### 4.1 Markdown 在 OriginOS 中的用途

OriginOS 使用 Markdown 存储需要人类阅读的内容：

| 文件 | 内容 | 更新时机 |
| --- | --- | --- |
| `Memory.md` | 历史会话摘要 | 每 N 轮落盘时 |
| `Knowledge.md` | 知识库快照 | 周期更新 |
| `Patterns.md` | 经验模式 | 周期更新 |
| `knowledge/log.md` | 知识库操作日志 | 知识更新时 |
| `knowledge/index.md` | 知识库索引 | 周期更新 |

### 4.2 `Memory.md` 的结构示例

```markdown
# Memory

## Session 2026-09-02

### Key Events
- User asked about project setup
- Agent provided step-by-step guide

### Insights
- User prefers concise answers
- Technical depth: intermediate

## Session 2026-09-01

### Key Events
- User explored collaboration features
- Agent demonstrated multi-agent workflow
```

**关键理解**：Markdown 文件通常有结构化的标题层级（`#`、``、``），便于 LLM 解析和人类阅读。`Memory.md` 的内容是由 LLM 自动生成的摘要，用于在 Agent 启动时快速加载历史上下文。

### 4.3 Markdown 的 Frontmatter

有些 Markdown 文件包含 YAML frontmatter：

```markdown
---
agentId: agent-xiaofengjun
updatedAt: 2026-09-02T10:30:00.000Z
type: memory-summary
---

# Memory

## Session 2026-09-02
...
```

**关键理解**：Frontmatter 用于存储元数据，便于程序解析时快速获取关键信息，而不需要解析整个 Markdown 内容。

## 5. 二进制格式精读

### 5.1 `hnsw-index.bin` 的用途

`archival/hnsw-index.bin` 是 HNSW（Hierarchical Navigable Small World）算法的语义索引文件。HNSW 是一种近似最近邻搜索算法，用于快速检索语义相似的文档。

**关键理解**：二进制文件不适合人类阅读，但适合机器高效处理。HNSW 索引的读取需要专门的库（如 `hnswlib` 或 `faiss`）。

### 5.2 二进制文件的特点

| 特征 | 说明 |
| --- | --- |
| 体积小 | 比文本格式小 50-80% |
| 读取速度快 | 直接映射到内存，无需解析 |
| 不可读 | 无法用文本编辑器打开 |
| 版本敏感 | 不同版本的库可能不兼容 |

## 6. 文档覆盖台账

| 本课直接精读的内容 | 精读范围 | 配对验证 | 本课只证明什么 |
| --- | --- | --- | --- |
| `blocks.json` 示例 | 示例内容 | 对照 JSON 标准验证 | JSON 格式的结构 |
| `events.jsonl` 示例 | 示例内容 | 对照 JSONL 标准验证 | JSONL 格式的结构 |
| `Memory.md` 示例 | 示例内容 | 对照 Markdown 标准验证 | Markdown 格式的结构 |
| `hnsw-index.bin` | 目录确认 | — | 二进制文件的存在 |

本课没有精读的内容也要明说：

- `hnsw-index.bin` 的内部结构未精读（需要专门的二进制分析工具）
- Markdown frontmatter 的完整规范未精读
- JSON Schema 或类型定义未涉及

## 7. 练习：格式选择

### 任务 A：选择合适的格式

已知信息：需要存储 Agent 的每轮会话记录，记录量可能很大（数千轮）。

问题：应该选择 JSON、JSONL、Markdown 还是 Binary？为什么？

### 任务 B：读取 JSONL 文件

已知信息：有一个 `events.jsonl` 文件，包含 10000 条事件记录。

问题：应该如何读取？需要注意什么？

### 任务 C：理解 Markdown 的结构

已知信息：`Memory.md` 包含多级标题和列表。

问题：程序应该如何解析这个文件？Frontmatter 的作用是什么？

### 参考答案

**任务 A：**

| 格式 | 适用性 | 原因 |
| --- | --- | --- |
| JSON | ❌ 不适合 | 需要一次性读取整个文件，不适合大量数据 |
| JSONL | ✅ 适合 | 支持追加写入和增量读取，适合大量顺序数据 |
| Markdown | ❌ 不适合 | 不适合存储结构化的事件数据 |
| Binary | ❌ 不适合 | 事件数据不适合用二进制存储 |

**任务 B：**

| 方法 | 说明 |
| --- | --- |
| 流式读取 | 使用 `fs.createReadStream` + `readline`，逐行读取 |
| 避免一次性加载 | 不要 `fs.readFileSync`，会占用大量内存 |
| 错误处理 | 某一行解析失败时，跳过该行，继续读取下一行 |

**任务 C：**

| 方法 | 说明 |
| --- | --- |
| 解析 Frontmatter | 使用正则表达式或专门的库（如 `gray-matter`）提取 `---` 之间的 YAML |
| 解析 Markdown | 使用 Markdown 解析器（如 `marked`、`remark`）提取标题和内容 |
| Frontmatter 作用 | 存储元数据，便于程序快速获取关键信息 |

## 8. 口头验收

学完本课后，不看正文也应能回答下面五个问题：

1. OriginOS 使用哪四种数据文件格式？每种格式适合存储什么类型的数据？
2. JSON 和 JSONL 的区别是什么？为什么 JSONL 适合存储事件流？
3. Markdown 文件中的 Frontmatter 是什么？有什么作用？
4. 二进制文件（如 `hnsw-index.bin`）的特点是什么？为什么使用二进制格式？
5. 当你需要选择数据格式时，应该考虑哪些因素？

合格回答不要求背诵每种格式的具体语法，但必须能说清每种格式的特点、适用场景、以及选择依据。能说清"为什么用这种格式"比只说清"这种格式是什么"更重要。
