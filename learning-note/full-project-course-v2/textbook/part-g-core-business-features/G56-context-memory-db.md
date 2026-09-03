# G56：Context Memory DB——`ContextMemoryDB` 是怎么存储和检索品味记忆的

> 本课核心问题：`ContextMemoryDB` 是怎么写入、检索和蒸馏品味记忆的？所有权晋升是怎么工作的？

## 1. 开篇场景：小王的品味记忆

小王在 OriginOS 中做了几次决策：
- 选择 React 而不是 Vue（positive feedback）。
- 选择 Tailwind 而不是 CSS Modules（positive feedback）。
- 选择 Redux 而不是 Zustand（negative feedback）。

系统需要存储这些记忆，并在小王做新决策时检索相关记忆。

## 2. 两种存储策略

### 2.1 简单数组

```ts
const memories: TasteMemory[] = [];
```

缺点：检索效率低，没有关联。

### 2.2 图数据库

```ts
class MemoryGraph {
  private nodes: Map<string, TasteMemory>;
  private edges: Map<string, Set<string>>;
}
```

OriginOS 选择了**图数据库**。

## 3. 源码精读：`context-memory-db.ts`

打开 [packages/core/src/lib/features/taste/context-memory-db.ts](../../../../packages/core/src/lib/features/taste/context-memory-db.ts)。

### 3.1 写入记忆

```ts
async writeMemory(memory: TasteMemory): Promise<void> {
  if (!this.shouldWrite(memory)) {
    return;
  }

  const existing = await this.findSimilar(memory.context);
  if (existing.length > 0) {
    // 强化现有记忆
    const existingMemory = await this.graph.getMemory(existing[0].id);
    const feedbackFactor = memory.feedback.feedback.outcome === 'positive' ? 0.1 : -0.05;
    const newWeight = Math.min(1, Math.max(0, existingMemory.decay_weight + feedbackFactor));
    await this.graph.updateDecayWeight(existing[0].id, newWeight);
    await this.graph.incrementReferenceCount(existing[0].id);
    this.logEvent({
      type: 'memory_reinforced',
      memory_id: existing[0].id,
      timestamp: Date.now(),
    });
  } else {
    // 创建新记忆
    await this.graph.addNode(memory);
    await this.graph.addContextRelations(memory);
    this.logEvent({
      type: 'memory_created',
      memory_id: memory.id,
      timestamp: Date.now(),
    });
  }
}
```

对应源码位置：[packages/core/src/lib/features/taste/context-memory-db.ts 第 54—80 行](../../../../packages/core/src/lib/features/taste/context-memory-db.ts#L54-L80)。

### 3.2 写入条件

```ts
private shouldWrite(memory: TasteMemory): boolean {
  const isDecision = memory.judgment.judgment.type !== 'preference';
  const hasFeedback = memory.feedback.feedback.outcome !== 'neutral';
  const hasReuse = this.isReusableContext(memory.context);

  return isDecision && hasFeedback && hasReuse;
}
```

三个条件（AND）：
1. 是决策（不是偏好查询）。
2. 有明确反馈。
3. 上下文可复用。

### 3.3 检索记忆

```ts
async retrieveMemories(
  context: TasteContext,
  options: QueryOptions = {}
): Promise<TasteMemory[]> {
  return await this.graph.query(context, {
    minDecayWeight: options.minDecayWeight ?? 0.3,
    maxAge: options.maxAgeDays ? `${options.maxAgeDays}d` : '90d',
    limit: options.limit ?? 5,
  });
}
```

对应源码位置：[packages/core/src/lib/features/taste/context-memory-db.ts 第 87—96 行](../../../../packages/core/src/lib/features/taste/context-memory-db.ts#L87-L96)。

### 3.4 蒸馏 Taste Profile

```ts
async distillTasteProfile(): Promise<TASTEProfile> {
  const memories = await this.getAllMemories({ minDecayWeight: 0.5 });
  const summary = await this.generateProfileSummary(memories);

  return {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    summary,
    memory_stats: this.calculateMemStats(memories),
  };
}
```

对应源码位置：[packages/core/src/lib/features/taste/context-memory-db.ts 第 114—124 行](../../../../packages/core/src/lib/features/taste/context-memory-db.ts#L114-L124)。

## 4. 图解：写入流程

```
用户做出决策
  │
  ▼
┌──────────────────┐
│ shouldWrite?     │
│  - isDecision?   │
│  - hasFeedback?  │
│  - hasReuse?     │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌──────────┐
│ 否    │ │ 是       │
│ 跳过  │ │ findSimilar│
└───────┘ └────┬─────┘
               │
          ┌────┴────
          ▼         ▼
      ┌───────┐ ┌──────────┐
      │ 找到  │ │ 没找到   │
      │ 强化  │ │ 创建新记忆│
      └───────┘ └──────────┘
```

## 5. 所有权晋升

### 5.1 晋升条件

```ts
async evaluateOwnershipPromotion(memoryId: string): Promise<{
  shouldPromote: boolean;
  targetLevel: OwnershipLevel;
  reason: string;
}> {
  const memory = await this.graph.getMemory(memoryId);
  const cr = this.promotionCriteria;

  if (memory.ownership === 'personal') {
    const meetsConfidence = memory.decay_weight >= cr.personal_to_position.min_confidence;
    const meetsValidations = memory.reference_count >= cr.personal_to_position.min_validations;
    const meetsReuse = await this.getCrossUserReuse(memoryId) >= cr.personal_to_position.min_cross_user_reuse;

    if (meetsConfidence && meetsValidations && meetsReuse) {
      return { shouldPromote: true, targetLevel: 'role', reason: 'Meets personal->role criteria' };
    }
  }

  return { shouldPromote: false, targetLevel: 'personal', reason: 'Does not meet promotion criteria' };
}
```

对应源码位置：[packages/core/src/lib/features/taste/context-memory-db.ts 第 129—172 行](../../../../packages/core/src/lib/features/taste/context-memory-db.ts#L129-L172)。

### 5.2 默认晋升标准

```ts
export const DEFAULT_PROMOTION_CRITERIA: OwnershipPromotionCriteria = {
  personal_to_position: {
    min_confidence: 0.85,
    min_validations: 5,
    min_cross_user_reuse: 2,
    time_window: '30d',
  },
  position_to_organization: {
    min_confidence: 0.92,
    min_validations: 15,
    min_cross_position_reuse: 3,
    min_success_rate: 0.8,
    manual_review_required: true,
  },
};
```

## 6. 测试证据与缺口

### 已覆盖

- `ContextMemoryDB` 没有直接测试。

### 缺口

- 写入条件没有测试。
- 检索逻辑没有测试。
- 蒸馏过程没有测试。
- 晋升逻辑没有测试。

## 7. 小实验：写入和检索记忆

```ts
import { ContextMemoryDB, createTasteMemory } from '@originos/core/lib/features/taste';

const db = new ContextMemoryDB();

// 写入记忆
const memory = createTasteMemory({
  context: { context_features: { domain: 'web', user_type: 'dev', task_type: 'frontend', environment: 'prod', time_context: '2024', risk_level: 'low' } },
  judgment: { judgment: { type: 'decision', action: 'use-react', confidence: 0.9 } },
  feedback: { feedback: { outcome: 'positive', effectiveness: 0.95, timestamp: '2024-01-01', iteration: 0 } },
});

await db.writeMemory(memory);

// 检索记忆
const memories = await db.retrieveMemories(memory.context, { limit: 5 });
console.log(memories);

// 蒸馏 Profile
const profile = await db.distillTasteProfile();
console.log(profile);
```

## 8. 口头验收

读完本课后，应能不看书稿回答：

1. `writeMemory` 的三个条件是什么？
2. 如果找到相似记忆，会发生什么？
3. `retrieveMemories` 的默认参数是什么？
4. 所有权晋升的条件是什么？
5. `distillTasteProfile` 是怎么工作的？

## 9. 章节收束

本课的核心认知是 **`ContextMemoryDB` 通过图数据库存储品味记忆，支持写入条件过滤、相似记忆强化、检索和周期性蒸馏**。

我们看到的几个关键设计：

- **写入条件**：决策 + 反馈 + 可复用上下文。
- **强化机制**：找到相似记忆时更新权重和引用计数。
- **检索过滤**：按权重和年龄过滤。
- **周期性蒸馏**：从记忆生成 Taste Profile。
- **所有权晋升**：personal → role → organization。
- **无测试**：没有直接测试覆盖。

下一课（G57）我们会看 `MemoryGraph`，了解图结构是怎么管理记忆的。
