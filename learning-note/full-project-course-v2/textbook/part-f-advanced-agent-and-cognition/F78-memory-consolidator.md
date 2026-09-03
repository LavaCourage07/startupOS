# F77：`RecallMemory` —— 对话历史

## 开篇场景

Agent 需要记住之前和用户说了什么。"你之前说要做电商网站"、"上次讨论过用 Next.js"。`RecallMemory` 就是存储和检索对话历史的。

## 核心问题

**`RecallMemory` 如何存储对话历史？如何支持语义搜索和关键词搜索？**

## 概念阶梯

### 1. 存储结构

```
memory/
└── history/
    ├── default.jsonl
    ├── session-abc.jsonl
    └── session-def.jsonl
```

### 2. 搜索方式

| 方式 | 原理 | 适用场景 |
|---|---|---|
| **语义搜索** | ONNX embedding + 余弦相似度 | 理解语义，找相关对话 |
| **关键词搜索** | TF-IDF 词袋模型 | 简单快速，找特定词 |

### 3. Dream Cursor 兼容

```
.dream_cursor  # 记录上次 Dream 处理到的 turn 编号
```

## 源码精读

### 1. recordTurn 实现

[packages/core/src/modules/memory-core/recall/recall-memory.ts 第 35-51 行](../../../../packages/core/src/modules/memory-core/recall/recall-memory.ts#L35)

```typescript
recordTurn(data: {
  turnNumber: number;
  userMessage: string;
  assistantMessage?: string;
  toolCalls?: Array<{ name: string; params?: unknown; result: string; success: boolean }>;
}): void {
  const entry: RecallEntry = {
    turnNumber: data.turnNumber,
    summary: data.userMessage.slice(0, 200),
    userMessage: data.userMessage,
    assistantMessage: data.assistantMessage ?? '',
    toolCalls: data.toolCalls ?? [],
    timestamp: Date.now(),
  };
  this.entries.push(entry);
  this.historyStore.append(entry);
}
```

### 2. searchSemantic 实现

[packages/core/src/modules/memory-core/recall/recall-memory.ts 第 54-73 行](../../../../packages/core/src/modules/memory-core/recall/recall-memory.ts#L54)

```typescript
async searchSemantic(query: string, maxResults = 5): Promise<RecallSearchResult[]> {
  const queryEmbedding = await embeddingEngine.encode(query);

  const scored = await Promise.all(
    this.entries.map(async (entry) => {
      const textContent = `${entry.userMessage} ${entry.assistantMessage ?? ''}`;
      const entryEmbedding = await embeddingEngine.encode(textContent);
      const score = cosineSimilarity(queryEmbedding, entryEmbedding);
      return {
        turnNumber: entry.turnNumber,
        score,
        summary: entry.summary,
        text: entry.userMessage,
      };
    })
  );

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}
```

**注意**：当前实现是对所有 entry 做 embedding，然后计算余弦相似度。对于大量 entry，这会很慢。

### 3. searchKeyword 实现

[packages/core/src/modules/memory-core/recall/recall-memory.ts 第 76-79 行](../../../../packages/core/src/modules/memory-core/recall/recall-memory.ts#L76)

```typescript
searchKeyword(query: string, maxResults = 5): RecallSearchResult[] {
  const scored = this.entries.map((entry) => this.scoreKeyword(entry, query));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}
```

### 4. scoreKeyword 实现

[packages/core/src/modules/memory-core/recall/recall-memory.ts 第 125-138 行](../../../../packages/core/src/modules/memory-core/recall/recall-memory.ts#L125)

```typescript
private scoreKeyword(entry: RecallEntry, query: string): RecallSearchResult {
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const text = `${entry.userMessage} ${entry.assistantMessage ?? ''}`.toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    if (text.includes(term)) score += 1;
  }
  return {
    turnNumber: entry.turnNumber,
    score: score / Math.max(queryTerms.length, 1),
    summary: entry.summary,
    text: entry.userMessage,
  };
}
```

**评分逻辑**：
- 分词（按空格，过滤长度 <= 2 的词）
- 统计匹配的词数
- 归一化（除以查询词数）

## 真实调用链

```
用户发送消息
  → Agent 处理
  → recall.recordTurn({
       turnNumber: 5,
       userMessage: "我想做电商网站",
       assistantMessage: "好的，用什么技术栈？"
    })
       → historyStore.append(entry)
       → 写入 memory/history/default.jsonl

Agent 搜索历史
  → recall.searchSemantic("电商", 5)
       → 对所有 entry 做 embedding
       → 计算余弦相似度
       → 返回 Top 5

Agent 关键词搜索
  → recall.searchKeyword("电商")
       → 分词
       → 统计匹配
       → 返回 Top 5
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| 大量 entry | 语义搜索慢 | 对所有 entry 做 embedding |
| 关键词不匹配 | 返回空数组 | `scoreKeyword` 返回 0 |
| history 文件损坏 | 跳过损坏行 | `HistoryStore` 有 try/catch |
| Dream cursor 不存在 | 返回 0 | `getDreamCursor` 有 fallback |

## 练习与验收

1. **分析性能**：如果有 10000 条 entry，语义搜索需要多长时间？如何优化？
2. **设计回退**：如果 ONNX 不可用，语义搜索如何回退？
3. **比较搜索方式**：语义搜索和关键词搜索分别适合什么场景？

**验收标准**：能理解 RecallMemory 的存储和搜索机制。

## 章节收束

`RecallMemory` 讲完了。下一节课（F78）看 `MemoryConsolidator`——主动记忆整理。
