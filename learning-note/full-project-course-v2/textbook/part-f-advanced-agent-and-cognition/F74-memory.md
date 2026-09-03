# F73：`Block` —— 记忆基本单元

## 开篇场景

Agent 需要记住"用户叫小明"、"用户喜欢深色模式"、"当前项目叫 GrowMap"。这些信息需要结构化的方式存储。`Block` 就是 Memory Core 的基本存储单元——它有 label、value、limit 等属性。

## 核心问题

**Block 有哪些属性？如何创建和验证？LegacyMemoryBlock 是什么？**

## 概念阶梯

### 1. Block 结构

```typescript
interface Block {
  id: string;           // 唯一 ID
  label: string;        // 标签（如 "human"）
  value: string;        // 内容
  limit: number;        // 容量限制（字符数）
  description: string;  // 描述
  metadata: BlockMetadata;  // 元数据
  readOnly: boolean;    // 是否只读
  tags: string[];       // 标签
  namespace?: string;    // 命名空间
  createdAt: number;     // 创建时间
  updatedAt: number;     // 更新时间
  version: number;      // 版本号
}
```

### 2. 默认 Block

```typescript
const DEFAULT_BLOCKS: BlockDefinition[] = [
  { label: 'human', description: '用户画像、偏好、历史习惯', limit: 2000, namespace: 'system' },
  { label: 'persona', description: 'Agent 角色认知、工作风格、专业语言', limit: 2000, namespace: 'system' },
  { label: 'project', description: '当前项目状态、活跃任务、关键决策', limit: 3000, namespace: 'system' },
  { label: 'scratchpad', description: '临时笔记、待办、注意项', limit: 1000, namespace: 'system' },
  { label: 'temporal', description: '关键事件时间线', limit: 3000, readOnly: true, namespace: 'system' },
];
```

### 3. LegacyMemoryBlock 兼容层

```typescript
interface LegacyMemoryBlock {
  label: string;
  value: string;
  limit: number;
  description: string;
  metadata: Record<string, unknown>;
  readOnly: boolean;
}
```

**兼容层**：旧版 `cognitive/types.ts` 中的 `MemoryBlock` 可以转换为新版 `Block`。

## 源码精读

### 1. createBlock 工厂函数

[packages/core/src/modules/memory-core/core/block.ts 第 84-99 行](../../../../packages/core/src/modules/memory-core/core/block.ts#L84)

```typescript
export function createBlock(def: BlockDefinition, value = ''): Block {
  const now = Date.now();
  return {
    id: generateId(),
    label: def.label,
    value,
    limit: def.limit,
    description: def.description,
    metadata: {},
    readOnly: def.readOnly ?? false,
    tags: def.tags ?? [],
    namespace: def.namespace,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}
```

### 2. validateBlock 验证

[packages/core/src/modules/memory-core/core/block.ts 第 103-114 行](../../../../packages/core/src/modules/memory-core/core/block.ts#L103)

```typescript
export function validateBlock(block: Block): string | null {
  if (!block.label || block.label.trim() === '') {
    return 'Block label must not be empty';
  }
  if (block.value.length > block.limit) {
    return `Block value exceeds limit (${block.value.length} > ${block.limit})`;
  }
  if (block.limit <= 0) {
    return 'Block limit must be positive';
  }
  return null;
}
```

**验证规则**：
- label 不能为空
- value 长度不能超过 limit
- limit 必须为正数

### 3. 兼容转换

[packages/core/src/modules/memory-core/core/block.ts 第 117-145 行](../../../../packages/core/src/modules/memory-core/core/block.ts#L117)

```typescript
export function toLegacyBlock(block: Block): LegacyMemoryBlock {
  return {
    label: block.label,
    value: block.value,
    limit: block.limit,
    description: block.description,
    metadata: block.metadata as Record<string, unknown>,
    readOnly: block.readOnly,
  };
}

export function fromLegacyBlock(legacy: LegacyMemoryBlock, overrides?: Partial<Block>): Block {
  const now = Date.now();
  return {
    id: overrides?.id ?? generateId(),
    label: legacy.label,
    value: legacy.value,
    limit: legacy.limit,
    description: legacy.description,
    metadata: legacy.metadata as BlockMetadata,
    readOnly: legacy.readOnly,
    tags: overrides?.tags ?? [],
    namespace: overrides?.namespace,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    version: overrides?.version ?? 1,
  };
}
```

## 真实调用链

```
Memory 初始化
  → initializeDefaults(DEFAULT_BLOCKS)
       → createBlock(def) for each def
       → blocks.set(block.label, block)
       → save() → Memory.md + blocks.json

Agent 编辑 Block
  → core_memory_append(label, content)
       → memory.setBlock(label, newValue)
            → validateBlock(block)
            → block.value = newValue
            → block.updatedAt = Date.now()
            → block.version += 1
            → save()
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| label 为空 | 验证失败 | `validateBlock` |
| value 超过 limit | 验证失败 | `validateBlock` |
| limit <= 0 | 验证失败 | `validateBlock` |
| readOnly block 被编辑 | 抛出 Error | `setBlock` 检查 |

## 练习与验收

1. **设计 Block**：为 "用户偏好" 设计一个 Block，包含 label、description、limit。
2. **分析验证**：如果 value 长度等于 limit，是否通过验证？
3. **兼容转换**：将旧版 MemoryBlock 转换为新版 Block，哪些字段会丢失？

**验收标准**：能理解 Block 的结构和验证规则。

## 章节收束

Block 讲完了。下一节课（F74）看 `Memory`——Block 集合管理。
