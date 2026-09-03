# G55：Taste Schema——`taste-schema.ts` 是怎么定义品味类型和验证的

> 本课核心问题：`taste-schema.ts` 定义了哪些类型？Taste Memory 的三元组结构是什么？验证函数是怎么工作的？

## 1. 开篇场景：小王的品味档案

小王使用 OriginOS 一段时间后，系统生成了小王的 Taste Profile：

```json
{
  "experience_topology": ["web-development", "enterprise-systems"],
  "taste_standards": {
    "development": {
      "positive_vibes": ["简洁", "可维护性"],
      "negative_vibes": ["过度设计"]
    }
  },
  "tension_position": {
    "control_level": 0.5,
    "trust_level": 0.5,
    "intervention_threshold": 0.7
  },
  "symbiosis_boundary": {
    "delegated_domains": [],
    "reserved_domains": [],
    "contextual_triggers": []
  }
}
```

系统是怎么定义和验证这些数据的？

## 2. 两种类型定义策略

### 2.1 手写 TypeScript 接口

```ts
interface TasteMemory {
  id: string;
  context: { /* ... */ };
  judgment: { /* ... */ };
  feedback: { /* ... */ };
}
```

缺点：没有运行时验证。

### 2.2 Zod Schema

```ts
export const TasteMemorySchema = z.object({
  id: z.string(),
  context: TasteContextSchema,
  judgment: TasteJudgmentSchema,
  feedback: TasteFeedbackSchema,
});
```

OriginOS 选择了**Zod Schema**。

## 3. 源码精读：`taste-schema.ts`

打开 [packages/core/src/lib/features/taste/taste-schema.ts](../../../../packages/core/src/lib/features/taste/taste-schema.ts)。

### 3.1 Taste Memory 三元组

```ts
export const TasteMemorySchema = z.object({
  id: z.string(),
  context: TasteContextSchema,
  judgment: TasteJudgmentSchema,
  feedback: TasteFeedbackSchema,
  decay_weight: z.number().min(0).max(1),
  reference_count: z.number().int().min(0),
  ownership: z.enum(['personal', 'role', 'organization']),
  created_at: z.string(),
  updated_at: z.string(),
});
```

对应源码位置：[packages/core/src/lib/features/taste/taste-schema.ts 第 69—79 行](../../../../packages/core/src/lib/features/taste/taste-schema.ts#L69-L79)。

### 3.2 三元组结构

```
Taste Memory
  ├── Context（情境）
  │   ├── domain: string
  │   ├── user_type: string
  │   ├── task_type: string
  │   ├── environment: string
  │   ├── time_context: string
  │   └── risk_level: 'low' | 'medium' | 'high'
  │
  ├── Judgment（判断）
  │   ├── type: 'decision' | 'preference' | 'boundary'
  │   ├── action: string
  │   ├── rationale?: string
  │   └── confidence: number (0-1)
  │
  └── Feedback（反馈）
      ├── outcome: 'positive' | 'negative' | 'neutral'
      ├── effectiveness: number (0-1)
      ├── timestamp: string
      ├── iteration: number
      └── user_confirmation?: boolean
```

### 3.3 TASTE Profile

```ts
export const TASTEProfileSchema = z.object({
  version: z.string().default('1.0.0'),
  generated_at: z.string(),
  summary: z.object({
    experience_topology: z.array(z.string()),
    taste_standards: z.record(z.string(), z.object({
      positive_vibes: z.array(z.string()),
      negative_vibes: z.array(z.string()),
    })),
    tension_position: z.object({
      control_level: z.number().min(0).max(1),
      trust_level: z.number().min(0).max(1),
      intervention_threshold: z.number().min(0).max(1),
    }),
    symbiosis_boundary: z.object({
      delegated_domains: z.array(z.string()),
      reserved_domains: z.array(z.string()),
      contextual_triggers: z.array(z.string()),
    }),
  }),
  memory_stats: z.object({
    total_memories: z.number().int().min(0),
    high_confidence_count: z.number().int().min(0),
    avg_confidence: z.number().min(0).max(1),
    domains: z.array(z.string()),
  }),
});
```

对应源码位置：[packages/core/src/lib/features/taste/taste-schema.ts 第 95—121 行](../../../../packages/core/src/lib/features/taste/taste-schema.ts#L95-L121)。

## 4. 图解：Taste Memory 生命周期

```
用户做出决策
  │
  ▼
──────────────────┐
│ Context Memory   │
│ (context_features) │
└────────┬─────────┘
         │
         ▼
──────────────────┐
│ Judgment         │
│ (decision/action)│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Feedback         │
│ (positive/       │
│  negative)       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Taste Memory     │
│ (三元组)          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Memory Graph     │
│ (存储 + 关联)     │
└────────┬─────────┘
         │
         ▼
──────────────────┐
│ TASTE Profile    │
│ (周期性蒸馏)      │
└──────────────────┘
```

## 5. 验证函数

### 5.1 验证 Taste Memory

```ts
export function validateTasteMemory(data: unknown): TasteMemory {
  return TasteMemorySchema.parse(data);
}
```

### 5.2 工厂函数

```ts
export function createTasteMemory(params: {
  id?: string;
  context: TasteContext;
  judgment: TasteJudgment;
  feedback: TasteFeedback;
  ownership?: OwnershipLevel;
  initialDecayWeight?: number;
}): TasteMemory {
  const now = new Date().toISOString();

  return {
    id: params.id || `memory-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    context: params.context,
    judgment: params.judgment,
    feedback: params.feedback,
    decay_weight: params.initialDecayWeight ?? 0.5,
    reference_count: 0,
    ownership: params.ownership ?? 'personal',
    created_at: now,
    updated_at: now,
  };
}
```

对应源码位置：[packages/core/src/lib/features/taste/taste-schema.ts 第 324—345 行](../../../../packages/core/src/lib/features/taste/taste-schema.ts#L324-L345)。

## 6. 设计亮点

### 6.1 Zod 运行时验证

```ts
const memory = validateTasteMemory(data);
// 如果 data 不符合 schema，会抛出 ZodError
```

### 6.2 类型推导

```ts
export type TasteMemory = z.infer<typeof TasteMemorySchema>;
```

TypeScript 类型自动从 Zod Schema 推导。

### 6.3 所有权层级

```ts
export type OwnershipLevel = 'personal' | 'role' | 'organization';
```

- **personal**：个人记忆。
- **role**：角色共享记忆。
- **organization**：组织共享记忆。

## 7. 测试证据与缺口

### 已覆盖

- `taste-schema.ts` 没有直接测试。

### 缺口

- Zod Schema 验证没有测试。
- 工厂函数没有测试。
- 边界条件没有测试。

## 8. 小实验：创建 Taste Memory

```ts
import { createTasteMemory, createContext, createJudgment, createFeedback } from '@originos/core/lib/features/taste';

const memory = createTasteMemory({
  context: createContext({
    domain: 'web-development',
    user_type: 'developer',
    task_type: 'frontend',
    environment: 'production',
  }),
  judgment: createJudgment({
    type: 'preference',
    action: 'use-react',
    confidence: 0.9,
  }),
  feedback: createFeedback({
    outcome: 'positive',
    effectiveness: 0.95,
  }),
});

console.log(memory);
```

## 9. 口头验收

读完本课后，应能不看书稿回答：

1. Taste Memory 的三元组是什么？
2. `decay_weight` 和 `reference_count` 的作用是什么？
3. 所有权层级有哪三个？
4. Zod Schema 是怎么提供运行时验证的？
5. `createTasteMemory` 的默认 `decay_weight` 是多少？

## 10. 章节收束

本课的核心认知是 **`taste-schema.ts` 用 Zod Schema 定义了 Taste Memory 的三元组结构（Context + Judgment + Feedback），支持运行时验证和类型推导**。

我们看到的几个关键设计：

- **三元组结构**：Context + Judgment + Feedback。
- **Zod 验证**：运行时验证 + TypeScript 类型推导。
- **所有权层级**：personal → role → organization。
- **衰减机制**：decay_weight 控制记忆衰减。
- **无测试**：没有直接测试覆盖。

下一课（G56）我们会看 `ContextMemoryDB`，了解品味记忆是怎么被存储和检索的。
