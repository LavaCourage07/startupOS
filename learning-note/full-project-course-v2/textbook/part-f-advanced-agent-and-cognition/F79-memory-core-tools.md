# F79：Memory Core 工具 API

## 开篇场景

Agent 在运行中需要读写记忆。"把用户偏好写入 human block"、"搜索关于项目的记忆"。Memory Core 提供两套工具 API：`core-memory-tools` 操作结构化 Block，`archival-memory-tools` 操作长期语义记忆。

## 核心问题

**Memory Core 暴露哪些工具？Agent 如何通过工具调用读写记忆？**

## 概念阶梯

### 1. 工具分类

```
CoreMemoryTools（结构化 Block）
├── core_memory_append(label, content)   # 追加内容
├── core_memory_replace(label, old, new) # 精确替换
├── core_memory_insert(label, content, index) # 指定位置插入
└── core_memory_read(label)              # 读取 Block

ArchivalMemoryTools（长期语义记忆）
├── archival_memory_insert(text, tags?)   # 插入记忆
└── archival_memory_search(query, options?) # 搜索记忆
```

### 2. 工具注册

```typescript
// 在 Agent 启动时注册工具
const coreTools = new CoreMemoryTools(memory);
const archivalTools = new ArchivalMemoryTools(archivalMemory);

agent.registerTools({
  ...coreTools.getToolDefinitions(),
  ...archivalTools.getToolDefinitions(),
});
```

## 源码精读

### 1. core_memory_append

[packages/core/src/modules/memory-core/tools/core-memory-tools.ts 第 28-52 行](../../../../packages/core/src/modules/memory-core/tools/core-memory-tools.ts#L28)

```typescript
core_memory_append: {
  description: 'Append content to a Core Memory block',
  parameters: z.object({
    label: z.string().describe('Block label (e.g., human, project)'),
    content: z.string().describe('Content to append'),
  }),
  execute: async ({ label, content }) => {
    try {
      this.memory.appendBlock(label, content);
      return { success: true, message: `Appended to ${label}` };
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },
}
```

**关键点**：
- 参数校验（Zod schema）
- 自动追加到 Block
- 返回操作结果

### 2. core_memory_replace

[packages/core/src/modules/memory-core/tools/core-memory-tools.ts 第 55-82 行](../../../../packages/core/src/modules/memory-core/tools/core-memory-tools.ts#L55)

```typescript
core_memory_replace: {
  description: 'Replace content in a Core Memory block',
  parameters: z.object({
    label: z.string(),
    old: z.string().describe('Text to replace'),
    new: z.string().describe('Replacement text'),
  }),
  execute: async ({ label, old, new: newText }) => {
    try {
      const success = this.memory.replaceBlock(label, old, newText);
      return { success, message: success ? 'Replaced' : 'Not found' };
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },
}
```

### 3. archival_memory_insert

[packages/core/src/modules/memory-core/tools/archival-memory-tools.ts 第 32-55 行](../../../../packages/core/src/modules/memory-core/tools/archival-memory-tools.ts#L32)

```typescript
archival_memory_insert: {
  description: 'Insert text into Archival Memory',
  parameters: z.object({
    text: z.string().describe('Text to store'),
    tags: z.array(z.string()).optional().describe('Optional tags'),
  }),
  execute: async ({ text, tags }) => {
    try {
      const id = await this.archivalMemory.insert(text, tags);
      return { success: true, id, message: `Inserted as ${id}` };
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },
}
```

### 4. archival_memory_search

[packages/core/src/modules/memory-core/tools/archival-memory-tools.ts 第 58-85 行](../../../../packages/core/src/modules/memory-core/tools/archival-memory-tools.ts#L58)

```typescript
archival_memory_search: {
  description: 'Search Archival Memory',
  parameters: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().optional().describe('Max results'),
    tags: z.array(z.string()).optional().describe('Filter by tags'),
  }),
  execute: async ({ query, limit, tags }) => {
    try {
      const results = await this.archivalMemory.search(query, {
        limit: limit ?? 10,
        tags: tags ?? [],
      });
      return {
        success: true,
        results: results.map((r) => ({ id: r.id, text: r.text, score: r.score })),
      };
    } catch (err) {
      return { success: false, message: String(err) };
    }
  },
}
```

## 真实调用链

```
Agent 调用工具
  → core_memory_append('human', '用户喜欢深色模式')
       → memory.appendBlock('human', '用户喜欢深色模式')
       → block.value += '\n用户喜欢深色模式'
       → save() → Memory.md + blocks.json

Agent 调用工具
  → archival_memory_insert('用户上周提到要做一个电商网站', ['project'])
       → archivalMemory.insert(text, tags)
       → embeddingEngine.encode(text) → Float32Array(384)
       → hnswIndex.insert(id, embedding)
       → persist() → entries.jsonl + hnsw-index.bin

Agent 调用工具
  → archival_memory_search('电商', { limit: 5 })
       → archivalMemory.search('电商', { limit: 5 })
       → 返回 Top 5 结果
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| Block 不存在 | 返回错误 | `appendBlock` 检查 |
| Block 只读 | 返回错误 | `setBlock` 检查 |
| Archival 索引为空 | 返回空数组 | `search` 检查 |
| ONNX 不可用 | 降级到 TF-IDF | `embeddingEngine.encode` 有 fallback |

## 练习与验收

1. **设计工具**：为 Memory Core 设计一个新的工具（如 `core_memory_clear`）。
2. **分析权限**：为什么 Core Memory 和 Archival Memory 要分开？
3. **比较工具**：`core_memory_replace` 和 `core_memory_insert` 有什么区别？

**验收标准**：能理解 Memory Core 工具 API 的设计。

## 章节收束

Memory Core 工具 API 讲完了。下一节课（F80）是 F.6 单元小结 Workshop。
