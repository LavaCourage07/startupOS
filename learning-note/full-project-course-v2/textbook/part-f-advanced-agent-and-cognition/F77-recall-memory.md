# F76：`HNSWIndex` —— 向量索引

## 开篇场景

ArchivalMemory 有成千上万条记忆，如何快速找到与查询最相关的？暴力搜索太慢了。`HNSWIndex` 使用分层导航小世界图（Hierarchical Navigable Small World）算法，可以在大量向量中快速找到最近邻居。

## 核心问题

**HNSW 是什么？如何构建和搜索？为什么比暴力搜索快？**

## 概念阶梯

### 1. HNSW 原理

```
Layer 3: 稀疏层（节点少，连接少）
    ○─────○
         │
    ○────┼───○
         │
Layer 2: 中等层
    ○──○──○──○
    │  │  │  │
    ○──○──○──○
    │  │  │  │
Layer 1: 密集层（节点多，连接多）
    ○─○─○─○─○
    │ │ │ │ │
    ○─○─○─○─○
    │ │ │ │ │
    ○─○─○─○─○
```

**搜索流程**：
1. 从顶层随机节点开始
2. 在当前层找到最近的邻居
3. 下降到下一层，从该位置继续搜索
4. 直到最底层，返回最近邻居

### 2. 参数

```typescript
interface HNSWIndexOptions {
  m?: number;              // 每层最大连接数（默认 16）
  efConstruction?: number;  // 构建时的搜索深度（默认 200）
  efSearch?: number;       // 搜索时的搜索深度（默认 10）
}
```

### 3. 当前实现

当前实现是简化版：
- 小规模（<1000）时用暴力搜索
- 大规模时用 HNSW 搜索

## 源码精读

### 1. insert 实现

[packages/core/src/modules/memory-core/archival/hnsw-index.ts 第 39-74 行](../../../../packages/core/src/modules/memory-core/archival/hnsw-index.ts#L39)

```typescript
insert(id: string, embedding: Float32Array): void {
  const nodeIndex = this.nodes.length;
  const node: HNSWNode = {
    id,
    embedding,
    layers: [],
  };

  // 随机层数（geometric distribution）
  let level = 0;
  while (Math.random() < 1 / Math.log2(this.m + 1) && level < 3) level++;
  for (let i = 0; i <= level; i++) {
    node.layers.push(new Set<number>());
  }

  // 在每层连接到最近邻居
  for (let layer = 0; layer < node.layers.length; layer++) {
    const neighbors = this.findNearestInLayer(node.embedding, layer, this.m);
    for (const n of neighbors) {
      node.layers[layer]!.add(n);
      // 双向连接
      const targetNode = this.nodes[n];
      if (targetNode && targetNode.layers[layer]) {
        targetNode.layers[layer]!.add(nodeIndex);
        // 限制最大连接数
        while (targetNode.layers[layer]!.size > this.m * 2) {
          const first = targetNode.layers[layer]!.values().next().value;
          if (first !== undefined) targetNode.layers[layer]!.delete(first);
        }
      }
    }
  }

  this.nodes.push(node);
  this.idToIndex.set(id, nodeIndex);
}
```

**关键点**：
- 随机层数（geometric distribution）
- 每层连接到最近邻居
- 双向连接
- 限制最大连接数

### 2. search 实现

[packages/core/src/modules/memory-core/archival/hnsw-index.ts 第 77-113 行](../../../../packages/core/src/modules/memory-core/archival/hnsw-index.ts#L77)

```typescript
search(query: Float32Array, k: number): Array<{ id: string; score: number }> {
  if (this.nodes.length === 0) return [];

  // 小规模用暴力搜索
  if (this.nodes.length <= 1000) {
    return this.bruteForceSearch(query, k);
  }

  // HNSW 搜索
  let currentIdx = Math.floor(Math.random() * this.nodes.length);

  for (let layer = this.getMaxLayer(); layer >= 0; layer--) {
    let improved = true;
    while (improved) {
      improved = false;
      const currentNode = this.nodes[currentIdx];
      const currentLayer = currentNode?.layers[layer];
      if (!currentLayer) continue;

      let bestDist = -Infinity;
      for (const neighborIdx of currentLayer) {
        const neighbor = this.nodes[neighborIdx];
        if (!neighbor) continue;
        const score = cosineSimilarity(query, neighbor.embedding);
        if (score > bestDist) {
          bestDist = score;
          currentIdx = neighborIdx;
          improved = true;
        }
      }
    }
  }

  // 从最终位置进行 efSearch 扩展
  return this.expandSearch(currentIdx, k);
}
```

### 3. 暴力搜索

[packages/core/src/modules/memory-core/archival/hnsw-index.ts 第 182-191 行](../../../../packages/core/src/modules/memory-core/archival/hnsw-index.ts#L182)

```typescript
private bruteForceSearch(query: Float32Array, k: number): Array<{ id: string; score: number }> {
  const results: Array<{ id: string; score: number }> = [];
  for (const node of this.nodes) {
    if (!node) continue;
    const score = cosineSimilarity(query, node.embedding);
    results.push({ id: node.id, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k);
}
```

## 复杂度对比

| 方法 | 时间复杂度 | 空间复杂度 | 适用场景 |
|---|---|---|---|
| 暴力搜索 | O(n) | O(n) | n < 1000 |
| HNSW 搜索 | O(log n) | O(n * m) | n >= 1000 |

## 练习与验收

1. **分析层数**：为什么层数是随机的？有什么好处？
2. **比较搜索方法**：什么情况下暴力搜索比 HNSW 更快？
3. **设计优化**：如果节点数在 500-1500 之间，如何优化？

**验收标准**：能理解 HNSW 的原理和实现。

## 章节收束

`HNSWIndex` 讲完了。下一节课（F77）看 `RecallMemory`——对话历史。
