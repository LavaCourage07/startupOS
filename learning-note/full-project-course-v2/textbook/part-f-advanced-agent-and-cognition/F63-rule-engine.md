# F62：`PatternProvider` —— 失败反思与 Reflexion

## 开篇场景

Agent 调用了一个工具链，但失败了。它应该从这个错误中学习：为什么失败？下次应该怎么做？`PatternProvider` 的 Reflexion（反思）机制就是做这个的——它从失败中提取教训，存储到情景记忆中，避免下次再犯同样的错误。

## 核心问题

**Reflexion 如何工作？如何存储反思？如何检索相关反思？如何防止反思无限增长？**

## 概念阶梯

### 1. Reflexion 数据结构

```typescript
interface ReflectionEntry {
  id: string;                    // 唯一 ID
  turnId: string;               // 对应的 turn
  timestamp: string;            // ISO 时间
  scene: string;                // 场景（用户消息摘要）
  toolChain: string[];         // 失败的工具链
  failureReason: string;        // 失败原因
  reflection: {
    whatWentWrong: string;     // 发生了什么
    tryNextTime: string;       // 下次尝试
    lesson: string;             // 教训
  };
  tags: string[];              // 标签（用于检索）
  ttl: string;                 // 过期时间（默认 30 天）
  usedCount: number;          // 被引用次数
  alternativeAttempts?: Array<{ // 替代尝试
    timestamp: string;
    whatWentWrong: string;
    tryNextTime: string;
  }>;
}
```

### 2. 情景记忆存储结构

```
patterns/
├── registry.json
├── episodic-memory/
│   ├── reflection-index.jsonl   # 索引（轻量，用于快速检索）
│   ├── reflection-123.json      # 完整反思（重）
│   └── reflection-456.json
└── compaction-report.md        # 压缩报告
```

### 3. 反思生命周期

```
失败发生
  → on_failure(data)
       → 生成 ReflectionEntry
       → 提取标签（工具名 + 失败关键词 + 场景词）
       → 去重（Jaccard 相似度 > 0.8 合并）
       → 保存到 episodic-memory/
       → 更新 reflection-index.jsonl

检索时
  → searchReflections(query)
       → 提取查询标签
       → 计算标签重叠度 + 时效性 + 使用次数
       → 返回 Top 3 相关反思
       → 更新 usedCount 和 TTL
```

## 源码精读

### 1. on_failure 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts 第 297-327 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts#L297)

```typescript
async on_failure(data: TurnCognitiveData): Promise<void> {
  const toolChain = data.toolCalls.map(t => t.name);
  const errors = data.toolCalls
    .filter(t => !t.success)
    .map(t => `${t.name}: ${t.result || 'unknown error'}`)
    .join('; ');

  const failureReason = errors || 'Task unresolved';

  // 生成标签
  const tags = this.extractReflectionTags(toolChain, data.userMessage, failureReason);

  // 生成反思内容
  const reflection = this.generateReflection(toolChain, failureReason, tags);

  const entry: ReflectionEntry = {
    id: `reflection-${data.turnNumber}`,
    turnId: `turn-${data.turnNumber}`,
    timestamp: new Date().toISOString(),
    scene: data.userMessage.slice(0, 200),
    toolChain,
    failureReason,
    reflection,
    tags,
    ttl: new Date(Date.now() + DEFAULT_REFLECTION_TTL_DAYS * 86400000).toISOString(),
    usedCount: 0,
  };

  // 去重后保存
  await this.deduplicateAndSaveReflection(entry);
}
```

### 2. 标签提取

[packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts 第 348-374 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts#L348)

```typescript
private extractReflectionTags(
  toolChain: string[],
  userMessage: string,
  failureReason: string
): string[] {
  const tags = new Set<string>();

  // 工具名称作为标签
  for (const tool of toolChain) {
    tags.add(tool);
  }

  // 从失败原因中提取关键词
  const keywords = ['error', 'timeout', 'failed', 'empty', 'invalid', 'not found'];
  const lowerReason = failureReason.toLowerCase();
  for (const kw of keywords) {
    if (lowerReason.includes(kw)) tags.add(kw);
  }

  // 从用户消息中提取场景关键词（>3 字符的词）
  const words = userMessage.split(/\s+/).filter(w => w.length > 3);
  for (const word of words.slice(0, 3)) {
    tags.add(word.toLowerCase());
  }

  return Array.from(tags);
}
```

**标签来源**：
1. 工具名称（如 `read_file`, `edit_file`）
2. 失败关键词（如 `error`, `timeout`, `failed`）
3. 场景关键词（用户消息中的长词）

### 3. 去重与合并

[packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts 第 379-418 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts#L379)

```typescript
private async deduplicateAndSaveReflection(entry: ReflectionEntry): Promise<void> {
  // 计算 Jaccard 相似度
  let bestMatch: ReflectionIndexEntry | null = null;
  let bestScore = 0;

  for (const existing of this.reflectionIndex) {
    const score = this.jaccardSimilarity(new Set(entry.tags), new Set(existing.tags));
    if (score > bestScore) {
      bestScore = score;
      bestMatch = existing;
    }
  }

  if (bestScore >= DEDUP_JACCARD_THRESHOLD && bestMatch) {
    // 合并到已有反思
    const existingFile = path.join(this.episodicMemoryDir, `${bestMatch.id}.json`);
    const existingContent = JSON.parse(readFileSync(existingFile, 'utf-8'));
    if (!existingContent.alternativeAttempts) {
      existingContent.alternativeAttempts = [];
    }
    existingContent.alternativeAttempts.push({
      timestamp: entry.timestamp,
      whatWentWrong: entry.reflection.whatWentWrong,
      tryNextTime: entry.reflection.tryNextTime,
    });
    writeFileSync(existingFile, JSON.stringify(existingContent, null, 2), 'utf-8');
  } else {
    // 保存为新反思
    this.saveReflection(entry);
  }

  // 检查是否需要压缩
  if (this.reflectionIndex.length >= COMPACTION_THRESHOLD) {
    await this.compactEpisodicMemory();
  }
}
```

**去重策略**：
- Jaccard 相似度 > 0.8 视为同一类失败
- 合并到已有反思的 `alternativeAttempts`
- 超过 100 条时触发压缩

### 4. 检索反思

[packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts 第 444-491 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts#L444)

```typescript
async searchReflections(query: string): Promise<string | null> {
  const now = new Date();
  this.pruneExpiredReflections();

  const queryTags = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  // 评分：标签重叠 + 时效性 - 使用次数
  const scored = this.reflectionIndex
    .filter(entry => new Date(entry.ttl) > now)
    .map(entry => {
      const tagOverlap = this.jaccardSimilarity(queryTags, new Set(entry.tags));
      const recencyBonus = Math.max(0, (new Date(entry.ttl).getTime() - now.getTime()) / (30 * 86400000));
      const usagePenalty = Math.min(entry.usedCount * 0.1, 1);
      const score = tagOverlap * 2 + recencyBonus - usagePenalty;
      return { entry, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // 更新 usedCount 和 TTL
  for (const { entry } of scored) {
    entry.usedCount++;
    entry.ttl = new Date(currentTtl + REFLECTION_EXTENSION_DAYS * 86400000).toISOString();
  }

  return lines.join('\n');
}
```

**评分公式**：
```
score = tagOverlap * 2 + recencyBonus - usagePenalty
```

- `tagOverlap * 2`：标签匹配度权重最高
- `recencyBonus`：越新的反思分数越高
- `usagePenalty`：被引用越多的反思分数越低（避免过度依赖）

### 5. 压缩机制

[packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts 第 541-601 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts#L541)

```typescript
async compactEpisodicMemory(): Promise<void> {
  const beforeCount = this.reflectionIndex.length;

  // 合并标签重叠 > 50% 的反思
  const merged: Set<string> = new Set();
  const kept: ReflectionIndexEntry[] = [];

  for (let i = 0; i < this.reflectionIndex.length; i++) {
    const entryI = this.reflectionIndex[i]!;
    if (merged.has(entryI.id)) continue;
    kept.push(entryI);
    merged.add(entryI.id);

    for (let j = i + 1; j < this.reflectionIndex.length; j++) {
      const entryJ = this.reflectionIndex[j]!;
      if (merged.has(entryJ.id)) continue;
      const overlap = this.jaccardSimilarity(new Set(entryI.tags), new Set(entryJ.tags));
      if (overlap >= 0.5) {
        merged.add(entryJ.id);
        // 合并 alternative attempts
        // 删除 entryJ 的文件
      }
    }
  }

  this.reflectionIndex = kept;
  this.rewriteReflectionIndexFile();
}
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| 反思索引损坏 | 重新加载为空 | `loadReflectionIndex` 有 try/catch |
| 磁盘空间不足 | 写入失败 | 需要监控 |
| 大量反思 | 触发压缩 | `COMPACTION_THRESHOLD = 100` |
| 反思过期 | 被清理 | `pruneExpiredReflections` |
| Jaccard 计算 | 空集返回 0 | 边界处理 |

## 练习与验收

1. **计算 Jaccard 相似度**：两个反思的标签分别为 `['read_file', 'error', 'config']` 和 `['read_file', 'timeout', 'config']`，Jaccard 相似度是多少？
2. **分析评分公式**：为什么 `usagePenalty` 要减去使用次数？有什么好处？
3. **设计压缩策略**：除了标签重叠，还可以用什么标准合并反思？

**验收标准**：能理解 Reflexion 的完整流程，包括标签提取、去重、检索、压缩。

## 章节收束

`PatternProvider` 的 Reflexion 讲完了。下一节课（F63）看 `RuleEngine` 混合模式规则引擎。
