# G58：Culture 类型系统——`types.ts` 定义了哪些 Culture Detection 类型

> 本课核心问题：`types.ts` 定义了哪些 Culture Detection 类型？会话状态、消息、TASTE Profile 是怎么设计的？

## 1. 开篇场景：小王的品味检测会话

小王第一次使用 OriginOS，系统问了他几个问题：

1. "最近在做什么类型的项目？"
2. "在这个项目中，你主要负责哪个部分？"
3. "在开发这个项目时，你觉得什么样的做法或特点是你更关注的？"

系统需要定义这些类型来管理对话。

## 2. 两种类型定义策略

### 2.1 松散类型

```ts
interface Session {
  id: string;
  status: string;
  messages: any[];
}
```

缺点：没有运行时验证。

### 2.2 Zod Schema

```ts
export const CultureDetectionSessionSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  status: CultureDetectionStatusSchema,
  messages: z.array(CultureDetectionMessageSchema).optional(),
});
```

OriginOS 选择了**Zod Schema**。

## 3. 源码精读：`types.ts`

打开 [packages/core/src/lib/features/culture/types.ts](../../../../packages/core/src/lib/features/culture/types.ts)。

### 3.1 会话状态

```ts
export const CultureDetectionStatusSchema = z.enum([
  'active',      // Session is active, accepting messages
  'analyzing',   // LLM analysis in progress
  'completed',   // Analysis completed, TASTE profile generated
  'failed',      // Analysis failed
  'expired',     // Session expired
]);
```

对应源码位置：[packages/core/src/lib/features/culture/types.ts 第 18—25 行](../../../../packages/core/src/lib/features/culture/types.ts#L18-L25)。

### 3.2 消息

```ts
export const CultureDetectionMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  turn: z.number().int().min(1),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional(),
});
```

对应源码位置：[packages/core/src/lib/features/culture/types.ts 第 50—58 行](../../../../packages/core/src/lib/features/culture/types.ts#L50-L58)。

### 3.3 TASTE Profile

```ts
export const UserTasteProfileSchema = z.object({
  version: z.string().default('1.0.0'),
  userId: z.string(),

  // Dimension 1: Experience Topology
  experience_topology: z.array(z.string()),

  // Dimension 2: Taste Standards
  taste_standards: z.record(z.string(), z.object({
    positive_vibes: z.array(z.string()),
    negative_vibes: z.array(z.string()),
  })),

  // Dimension 3: Tension Position
  tension_position: z.object({
    control_level: z.number().min(0).max(1),
    trust_level: z.number().min(0).max(1),
    intervention_threshold: z.number().min(0).max(1),
  }),

  // Dimension 4: Symbiosis Boundary
  symbiosis_boundary: z.object({
    delegated_domains: z.array(z.string()),
    reserved_domains: z.array(z.string()),
    contextual_triggers: z.array(z.string()),
  }),
});
```

对应源码位置：[packages/core/src/lib/features/culture/types.ts 第 86—117 行](../../../../packages/core/src/lib/features/culture/types.ts#L86-L117)。

### 3.4 会话

```ts
export const CultureDetectionSessionSchema = z.object({
  version: z.string().default('1.0.0'),
  sessionId: z.string(),
  userId: z.string(),
  status: CultureDetectionStatusSchema,
  currentTurn: z.number().int().min(0),
  maxTurns: z.number().int().min(3).max(5).default(3),
  messages: z.array(CultureDetectionMessageSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

对应源码位置：[packages/core/src/lib/features/culture/types.ts 第 182—214 行](../../../../packages/core/src/lib/features/culture/types.ts#L182-L214)。

## 4. 图解：会话状态机

```
┌─────────┐
│  active │
└────┬────┘
     │ addMessage()
     ▼
─────────┐
│analyzing│
└────┬────┘
     │ analyzeDialogue()
     ▼
─────────┐     ┌─────────┐
│completed│     │  failed │
└─────────┘     └─────────┘
```

## 5. 错误处理

### 5.1 错误码

```ts
export const ERROR_CODES = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_STATE: 'INVALID_STATE',
  ANALYSIS_IN_PROGRESS: 'ANALYSIS_IN_PROGRESS',
  LLM_ERROR: 'LLM_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

### 5.2 错误类

```ts
export class CultureDetectionError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CultureDetectionError';
  }
}
```

对应源码位置：[packages/core/src/lib/features/culture/types.ts 第 381—390 行](../../../../packages/core/src/lib/features/culture/types.ts#L381-L390)。

## 6. 工厂函数

### 6.1 创建会话

```ts
export function createCultureDetectionSession(params: {
  sessionId: string;
  userId: string;
  maxTurns?: number;
}): CultureDetectionSession {
  const now = new Date().toISOString();

  return {
    version: '1.0.0',
    sessionId: params.sessionId,
    userId: params.userId,
    status: 'active',
    currentTurn: 0,
    maxTurns: params.maxTurns ?? 3,
    messages: [],
    dialogueHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}
```

对应源码位置：[packages/core/src/lib/features/culture/types.ts 第 520—542 行](../../../../packages/core/src/lib/features/culture/types.ts#L520-L542)。

## 7. 测试证据与缺口

### 已覆盖

- `types.ts` 没有直接测试。

### 缺口

- Zod Schema 验证没有测试。
- 工厂函数没有测试。
- 错误类没有测试。

## 8. 小实验：创建会话

```ts
import { createCultureDetectionSession, validateCultureDetectionSession } from '@originos/core/lib/features/culture';

const session = createCultureDetectionSession({
  sessionId: 'culture-123',
  userId: 'user-456',
  maxTurns: 3,
});

console.log(session.status); // 'active'

// 验证
const validated = validateCultureDetectionSession(session);
console.log(validated);
```

## 9. 口头验收

读完本课后，应能不看书稿回答：

1. Culture Detection 有哪五种状态？
2. TASTE Profile 有哪四个维度？
3. 会话最多有几轮？
4. `CultureDetectionError` 包含哪些字段？
5. `createCultureDetectionSession` 的默认 `maxTurns` 是多少？

## 10. 章节收束

本课的核心认知是 **`types.ts` 用 Zod Schema 定义了 Culture Detection 的完整类型系统，包括会话状态、消息、TASTE Profile 和错误处理**。

我们看到的几个关键设计：

- **会话状态**：active → analyzing → completed/failed。
- **TASTE Profile**：四个维度（experience_topology、taste_standards、tension_position、symbiosis_boundary）。
- **Zod 验证**：运行时验证 + TypeScript 类型推导。
- **错误处理**：自定义错误类和错误码。
- **无测试**：没有直接测试覆盖。

下一课（G59）我们会看 `CultureDetectionService`，了解对话是怎么被分析提取品味的。
