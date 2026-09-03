# F75：`ArchivalMemory` —— 长期语义记忆

## 开篇场景

Agent 需要记住很多非结构化的信息："用户上周提到要做一个电商网站"、"之前讨论过用 Next.js 做前端"。这些信息不适合放在 Core Memory 的 Block 中，因为它们是线性的、非结构化的。`ArchivalMemory` 就是存储这类信息的——它用向量索引支持语义搜索。

## 核心问题

**`ArchivalMemory` 如何存储和搜索？什么是 HNSW？Embedding 如何工作？**

## 概念阶梯

### 1. ArchivalMemory 架构

```
ArchivalMemory
├── entries[]
│     ├── id: "arch-123"
│     ├── text: "用户上周提到要做一个电商网站"
│     ├── tags: ["project", "ecommerce"]
│     ├── createdAt: 1690000000000
│     └── embedding: Int8Array(384)
├── HNSWIndex（向量索引）
└── 持久化
      ├── entries.jsonl
      └── hnsw-index.bin
```

### 2. 存储流程

```
text → embeddingEngine.encode(text) → Float32Array(384)
  → quantizeInt8 → Int8Array(384)
  → hnswIndex.insert(id, embedding)
  → persist() → entries.jsonl + hnsw-index.bin
```

### 3. 搜索流程

```
query → embeddingEngine.encode(query) → Float32Array(384)
  → hnswIndex.search(queryEmbedding, k)
  → 按标签过滤
  → 余弦相似度 RRF 融合
  → MMR 去重
  → 返回结果
```

## 源码精读

### 1. insert 实现

[packages/core/src/modules/memory-core/archival/archival-memory.ts 第 65-87 行](../../../../packages/core/src/modules/memory-core/archival/archival-memory.ts#L65)

```typescript
async insert(text: string, tags?: string[]): Promise<string> {
  const id = `arch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const embedding = await embeddingEngine.encode(text);
  const quantized = new Int8Array(embedding.length);
  for (let i = 0; i < embedding.length; i++) {
    const v = embedding[i] ?? 0;
    quantized[i] = v > 0 ? Math.min(127, Math.round(v * 127)) : Math.max(-128, Math.round(v * 127));
  }

  const entry: ArchivalEntry = {
    id,
    text,
    tags: tags ?? [],
    createdAt: Date.now(),
    embedding: quantized,
  };

  this.entries.push(entry);
  this.hnswIndex.insert(id, embedding);
  await this.persist();

  return id;
}
```

**关键点**：
- 生成唯一 ID
- 编码为 384 维向量
- Int8 量化（节省存储）
- 插入 HNSW 索引
- 持久化到磁盘

### 2. search 实现

[packages/core/src/modules/memory-core/archival/archival-memory.ts 第 90-139 行](../../../../packages/core/src/modules/memory-core/archival/archival-memory.ts#L90)

```typescript
async search(query: string, options?: SearchOptions): Promise<ArchivalSearchResult[]> {
  await this.ensureIndexReady();

  const { limit = 10, minScore = 0.1, tags, diversity = 0.7 } = options ?? {};

  const queryEmbedding = await embeddingEngine.encode(query);
  const candidates = this.hnswIndex.search(queryEmbedding, limit * 3);

  // 按标签过滤
  let filtered = candidates;
  if (tags && tags.length > 0) {
    filtered = candidates.filter((c) => {
      const entry = this.getEntryById(c.id);
      return entry && entry.tags.some((t) => tags.includes(t));
    });
  }

  // 余弦相似度 RRF 融合
  const scored = filtered.map((c) => {
    const entry = this.getEntryById(c.id)!;
    const entryEmbedding = this.dequantize(entry.embedding!);
    const relevance = cosineSimilarity(queryEmbedding, entryEmbedding);

    // 时间衰减
    const ageDays = (Date.now() - entry.createdAt) / (1000 * 60 * 60 * 24);
    const temporalScore = 1 / (1 + 0.1 * ageDays);

    // RRF 融合
    const rank = filtered.indexOf(c) + 1;
    const rrfScore = 1 / (60 + rank);

    const finalScore = relevance * 0.6 + temporalScore * 0.2 + rrfScore * 10 * 0.2;

    return { id: entry.id, text: entry.text, score: finalScore, tags: entry.tags, createdAt: entry.createdAt };
  });

  // MMR 去重
  const diverse = this.applyMMR(scored, diversity);

  return diverse.filter((r) => r.score >= minScore).slice(0, limit);
}
```

**评分公式**：
```
finalScore = relevance * 0.6 + temporalScore * 0.2 + rrfScore * 10 * 0.2
```

- `relevance`：余弦相似度
- `temporalScore`：时间衰减（越新的记忆分数越高）
- `rrfScore`：RRF 融合（排名倒数）

### 3. MMR 去重

[packages/core/src/modules/memory-core/archival/archival-memory.ts 第 268-304 行](../../../../packages/core/src/modules/memory-core/archival/archival-memory.ts#L268)

```typescript
private applyMMR(results: ArchivalSearchResult[], lambda: number): ArchivalSearchResult[] {
  if (results.length <= 1) return results;

  const selected: number[] = [];
  const remaining = results.map((_, i) => i);

  while (remaining.length > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (const i of remaining) {
      const relevance = results[i]?.score ?? 0;
      let maxSimilarity = 0;
      for (const j of selected) {
        const sim = cosineSimilarity(
          this.getEntryById(results[i]?.id ?? '')?.embedding ?? new Int8Array(384),
          this.getEntryById(results[j]?.id ?? '')?.embedding ?? new Int8Array(384),
        );
        if (sim > maxSimilarity) maxSimilarity = sim;
      }
      const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    selected.push(bestIdx);
    remaining.splice(remaining.indexOf(bestIdx), 1);
  }

  return selected.map((i) => results[i]).filter((r): r is ArchivalSearchResult => r !== undefined);
}
```

**MMR 公式**：
```
mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity
```

- `lambda`：相关性权重（默认 0.7）
- `relevance`：与查询的相似度
- `maxSimilarity`：与已选结果的相似度

## 真实调用链

```
Agent 记录长期记忆
  → archivalMemory.insert("用户上周提到要做一个电商网站", ["project"])
       → embeddingEngine.encode(text) → Float32Array(384)
       → quantizeInt8 → Int8Array(384)
       → hnswIndex.insert(id, embedding)
       → persist() → entries.jsonl + hnsw-index.bin

Agent 搜索长期记忆
  → archivalMemory.search("电商", { limit: 5 })
       → embeddingEngine.encode("电商") → Float32Array(384)
       → hnswIndex.search(queryEmbedding, 15)
       → 按标签过滤
       → 余弦相似度 RRF 融合
       → MMR 去重
       → 返回 Top 5
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| ONNX 不可用 | 降级到 TF-IDF | `embeddingEngine.encode` 有 fallback |
| HNSW 索引为空 | 返回空数组 | `search` 检查 |
| 标签不匹配 | 过滤掉 | `tags` 过滤 |
| 所有结果分数低 | 返回空数组 | `minScore` 过滤 |

## 练习与验收

1. **分析评分公式**：为什么 `finalScore` 中 `relevance` 权重最高？
2. **设计 MMR 参数**：如果 `lambda = 0.3`，搜索结果会怎样？
3. **比较 TF-IDF 和 ONNX**：什么场景下 TF-IDF 可能比 ONNX 更好？

**验收标准**：能理解 ArchivalMemory 的存储和搜索机制。

## 章节收束

`ArchivalMemory` 讲完了。下一节课（F76）看 `HNSWIndex`——向量索引。
