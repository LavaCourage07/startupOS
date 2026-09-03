# G57：Memory Graph——`MemoryGraph` 是怎么用图结构管理记忆的

> 本课核心问题：`MemoryGraph` 是怎么用图结构存储和查询记忆的？节点、边和上下文索引是怎么工作的？

## 1. 开篇场景：小王的记忆关联

小王在"前端开发"领域选择了 React，在"后端开发"领域选择了 Node.js。

系统需要：
- 存储这些记忆（节点）。
- 关联相似的记忆（边）。
- 快速检索相关记忆（索引）。

## 2. 两种数据结构

### 2.1 数组

```ts
const memories: TasteMemory[] = [];
// 检索：O(n)
```

### 2.2 图

```ts
class MemoryGraph {
  private nodes: Map<string, TasteMemory>;     // O(1) 查找
  private edges: Map<string, Set<string>>;     // O(1) 邻居访问
  private contextIndex: Map<string, Set<string>>; // O(1) 上下文检索
}
```

OriginOS 选择了**图**。

## 3. 源码精读：`memory-graph.ts`

打开 [packages/core/src/lib/features/taste/memory-graph.ts](../../../../packages/core/src/lib/features/taste/memory-graph.ts)。

### 3.1 数据结构

```ts
export class MemoryGraph {
  private nodes: Map<string, TasteMemory> = new Map();
  private edges: Map<string, Set<string>> = new Map(); // adjacency list
  private contextIndex: Map<string, Set<string>> = new Map();
```

对应源码位置：[packages/core/src/lib/features/taste/memory-graph.ts 第 17—20 行](../../../../packages/core/src/lib/features/taste/memory-graph.ts#L17-L20)。

### 3.2 添加节点

```ts
async addNode(memory: TasteMemory): Promise<void> {
  this.nodes.set(memory.id, memory);

  // Index by context
  const contextKey = this.getContextKey(memory.context);
  if (!this.contextIndex.has(contextKey)) {
    this.contextIndex.set(contextKey, new Set());
  }
  this.contextIndex.get(contextKey)!.add(memory.id);
}
```

对应源码位置：[packages/core/src/lib/features/taste/memory-graph.ts 第 25—34 行](../../../../packages/core/src/lib/features/taste/memory-graph.ts#L25-L34)。

### 3.3 添加上下文关联

```ts
async addContextRelations(memory: TasteMemory): Promise<void> {
  const similarIds = await this.findSimilarContexts(memory.context, 0.6);

  if (!this.edges.has(memory.id)) {
    this.edges.set(memory.id, new Set());
  }

  for (const similarId of similarIds) {
    if (similarId !== memory.id) {
      this.edges.get(memory.id)!.add(similarId);

      if (!this.edges.has(similarId)) {
        this.edges.set(similarId, new Set());
      }
      this.edges.get(similarId)!.add(memory.id); // undirected
    }
  }
}
```

对应源码位置：[packages/core/src/lib/features/taste/memory-graph.ts 第 39—56 行](../../../../packages/core/src/lib/features/taste/memory-graph.ts#L39-L56)。

### 3.4 查询

```ts
async query(
  context: TasteContext,
  options: { minDecayWeight?: number; maxAge?: string; limit?: number }
): Promise<TasteMemory[]> {
  const contextKey = this.getContextKey(context);
  const candidateIds = this.contextIndex.get(contextKey) || new Set();

  let results: TasteMemory[] = [];

  for (const id of candidateIds) {
    const memory = this.nodes.get(id);
    if (!memory) continue;

    if (options.minDecayWeight && memory.decay_weight < options.minDecayWeight) {
      continue;
    }

    if (options.maxAge) {
      const days = this.parseAge(options.maxAge);
      if (this.daysSince(memory.updated_at) > days) {
        continue;
      }
    }

    results.push(memory);
  }

  results.sort((a, b) => b.decay_weight - a.decay_weight);
  return results.slice(0, options.limit);
}
```

对应源码位置：[packages/core/src/lib/features/taste/memory-graph.ts 第 61—94 行](../../../../packages/core/src/lib/features/taste/memory-graph.ts#L61-L94)。

## 4. 图解：图结构

```
Context Index
┌─────────────────────────────────────┐
│ "web:frontend:low" → { "m1", "m2" }│
│ "web:backend:low"  → { "m3" }      │
│ "mobile:frontend:medium" → { "m4" }│
└─────────────────────────────────────┘

Nodes
┌─────────────────────────────────────┐
│ "m1" → TasteMemory { ... }          │
│ "m2" → TasteMemory { ... }          │
│ "m3" → TasteMemory { ... }          │
│ "m4" → TasteMemory { ... }          │
└─────────────────────────────────────┘

Edges (Adjacency List)
┌─────────────────────────────────────┐
│ "m1" → { "m2" }                    │
│ "m2" → { "m1" }                    │
│ "m3" → {}                          │
│ "m4" → {}                          │
└─────────────────────────────────────┘

Graph Visualization
    m1 ───── m2
    │
   (web:frontend:low)

    m3
   (web:backend:low)

    m4
   (mobile:frontend:medium)
```

## 5. 遍历

```ts
async traverse(fromId: string, depth: number): Promise<TasteMemory[]> {
  const visited = new Set<string>([fromId]);
  const queue: [string, number][] = [[fromId, 0]];
  const results: TasteMemory[] = [];

  while (queue.length > 0) {
    const [nodeId, currentDepth] = queue.shift()!;
    const memory = this.nodes.get(nodeId);

    if (memory) {
      results.push(memory);
    }

    if (currentDepth >= depth) continue;

    const neighbors = this.edges.get(nodeId) || new Set();
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push([neighborId, currentDepth + 1]);
      }
    }
  }

  return results;
}
```

对应源码位置：[packages/core/src/lib/features/taste/memory-graph.ts 第 207—232 行](../../../../packages/core/src/lib/features/taste/memory-graph.ts#L207-L232)。

## 6. 测试证据与缺口

### 已覆盖

- `MemoryGraph` 没有直接测试。

### 缺口

- 节点添加没有测试。
- 边添加没有测试。
- 查询没有测试。
- 遍历没有测试。

## 7. 小实验：构建记忆图

```ts
import { MemoryGraph } from '@originos/core/lib/features/taste';

const graph = new MemoryGraph();

// 添加节点
await graph.addNode(memory1);
await graph.addNode(memory2);

// 添加关联
await graph.addContextRelations(memory1);
await graph.addContextRelations(memory2);

// 查询
const results = await graph.query(context, { limit: 5 });
console.log(results);

// 遍历
const neighbors = await graph.traverse(memory1.id, 2);
console.log(neighbors);
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `MemoryGraph` 用哪三个 Map 存储数据？
2. 上下文索引的 key 是怎么生成的？
3. 边是单向的还是双向的？
4. `traverse` 用的是什么算法？
5. 查询时是怎么过滤的？

## 9. 章节收束

本课的核心认知是 **`MemoryGraph` 用三个 Map（nodes、edges、contextIndex）实现图结构存储，支持 O(1) 的节点查找和上下文检索**。

我们看到的几个关键设计：

- **节点存储**：`Map<string, TasteMemory>`，O(1) 查找。
- **边存储**：`Map<string, Set<string>>`，邻接表。
- **上下文索引**：`Map<string, Set<string>>`，O(1) 上下文检索。
- **BFS 遍历**：`traverse` 方法用队列实现广度优先搜索。
- **无测试**：没有直接测试覆盖。

下一课（G58）我们会进入 Culture 模块，了解 `types.ts` 是怎么定义 Culture Detection 类型的。
