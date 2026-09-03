# F10：ProjectAgent 的 Accumulation System

## 开篇场景

用户在项目初始化过程中连续三次接受了 Agent 的建议，Agent 的信任值从 0.5 慢慢涨到了 0.65。于是 Agent 的 autonomy level 从 `guided` 变成了 `collaborative`，开始可以主动做一些决策，而不是每一步都询问用户。

相反，如果用户多次纠正 Agent，信任值会下降，Agent 会变得更加谨慎。

这个“信任扩张”机制就是 Accumulation System（Epic T）的核心。本节课看 `project-agent.ts` 中的信任模型、信号读取和自主级别计算。

## 核心问题

**为什么 Taste Engineering 和 Accumulation System 要同时存在？一个是“偏好档案”，一个是“信任历史”，它们如何分工？**

## 概念阶梯

**TasteSignal**：从单条交互中读取的即时信号，如词汇选择、抗拒模式、重复模式。

**TrustModel**：长期信任状态，包括总体信任值、各 domain 信任值、信任事件历史。

**TrustEvent**：影响信任的事件，如成功建议、模式验证、模式拒绝、用户纠正。

**AutonomyLevel**：根据信任值划分的自主级别：`limited`、`guided`、`collaborative`、`autonomous`。

**Observation**：加入 ARIA Infer 队列的观察项，用于后续模式提取。

## 图解：Taste 与 Trust 的关系

```mermaid
flowchart TD
    A[用户消息] --> B[readTasteSignals]
    B --> C[TasteSignal[]]
    C --> D[addObservation]
    E[Skill 执行成功] --> F[processTrustEvent]
    G[用户纠正] --> F
    F --> H[TrustModel 更新]
    H --> I[getAutonomyLevel]
    I --> J[决定 Agent 主动程度]
```

**图后解释**：

- Taste 关注“用户偏好什么风格”；
- Trust 关注“Agent 的决策被接受了多少”；
- 两者都影响 Agent 的行为，但一个偏静态档案，一个偏动态历史。

## 源码精读

### 1. TrustModel 结构

[packages/core/src/lib/features/agent/project-agent.ts 第 147—155 行](../../../../packages/core/src/lib/features/agent/project-agent.ts#L147)

```typescript
export interface TrustModel {
  overallTrust: number;
  domainTrust: Map<string, number>;
  history: {
    timestamp: number;
    event: TrustEvent;
    delta: number;
  }[];
}
```

- `overallTrust`：总体信任值，0-1。
- `domainTrust`：各领域的信任值，未来可以按 domain 差异化授权。
- `history`：信任事件历史，可审计、可回放。

[packages/core/src/lib/features/agent/project-agent.ts 第 271—275 行](../../../../packages/core/src/lib/features/agent/project-agent.ts#L271)

```typescript
private trustModel: TrustModel = {
  overallTrust: 0.5,
  domainTrust: new Map(),
  history: [],
};
```

初始信任值为 0.5，表示中立。

### 2. 读取 Taste 信号

[packages/core/src/lib/features/agent/project-agent.ts 第 677—689 行](../../../../packages/core/src/lib/features/agent/project-agent.ts#L677)

```typescript
async readTasteSignals(_sessionId: string, interaction: string): Promise<TasteSignal[]> {
  const signals: TasteSignal[] = [];

  const wordChoiceSignals = this.detectWordChoice(interaction);
  signals.push(...wordChoiceSignals);

  const resistanceSignals = this.detectResistancePatterns(interaction);
  signals.push(...resistanceSignals);

  return signals;
}
```

当前支持两种信号：

1. **WordChoiceSignal**：从词汇选择判断用户态度（积极、犹豫等）。
2. **ResistanceSignal**：抗拒模式，如沉默、话题转移、语气变化。当前实现返回空数组，因为单条消息无法判断抗拒。

### 3. 处理信任事件

[packages/core/src/lib/features/agent/project-agent.ts 第 696—707 行](../../../../packages/core/src/lib/features/agent/project-agent.ts#L696)

```typescript
async processTrustEvent(event: TrustEvent): Promise<void> {
  const delta = this.calculateTrustDelta(event);

  this.trustModel.overallTrust = Math.min(1, Math.max(0, this.trustModel.overallTrust + delta));
  this.trustModel.history.push({
    timestamp: Date.now(),
    event,
    delta,
  });

  console.log(`[ProjectAgent] Trust event processed. Overall trust: ${this.trustModel.overallTrust}`);
}
```

逻辑：

1. 根据事件类型计算 delta。
2. 更新总体信任值，并限制在 [0, 1]。
3. 记录事件历史。

### 4. 信任 delta 计算

[packages/core/src/lib/features/agent/project-agent.ts 第 975—997 行](../../../../packages/core/src/lib/features/agent/project-agent.ts#L975)

```typescript
private calculateTrustDelta(event: TrustEvent): number {
  switch (event.type) {
    case 'successful_suggestion':
      return 0.05;
    case 'pattern_verified':
      return 0.03;
    case 'pattern_rejected':
      return -0.02;
    case 'correction_applied':
      switch (event.severity) {
        case 'minor': return -0.01;
        case 'major': return -0.05;
        case 'critical': return -0.1;
        default: return 0;
      }
    default:
      return 0;
  }
}
```

规则：

- 成功建议：+0.05
- 模式验证：+0.03
- 模式拒绝：-0.02
- 用户纠正：按严重程度 -0.01 / -0.05 / -0.1

### 5. 计算自主级别

[packages/core/src/lib/features/agent/project-agent.ts 第 709—718 行](../../../../packages/core/src/lib/features/agent/project-agent.ts#L709)

```typescript
getAutonomyLevel(domain?: string): AutonomyLevel {
  const trust = domain
    ? this.trustModel.domainTrust.get(domain) || this.trustModel.overallTrust
    : this.trustModel.overallTrust;

  if (trust < 0.3) return 'limited';
  if (trust < 0.5) return 'guided';
  if (trust < 0.8) return 'collaborative';
  return 'autonomous';
}
```

自主级别划分：

- `limited`（信任 < 0.3）：Agent 只能做很有限的决策。
- `guided`（0.3 ≤ 信任 < 0.5）：Agent 提出建议，用户确认后执行。
- `collaborative`（0.5 ≤ 信任 < 0.8）：Agent 可以主动执行大部分任务，关键决策仍需确认。
- `autonomous`（信任 ≥ 0.8）：Agent 可以自主决策。

### 6. 词汇选择信号检测

[packages/core/src/lib/features/agent/project-agent.ts 第 904—967 行](../../../../packages/core/src/lib/features/agent/project-agent.ts#L904)

```typescript
private detectWordChoice(message: string): WordChoiceSignal[] {
  const signals: WordChoiceSignal[] = [];

  const positivePatterns = [/可行/g, /不错/g, /可以/g, /喜欢/g];
  const hesitantPatterns = [/有点意思/g, /也许/g, /可能/g, /考虑/g];

  positivePatterns.forEach(pattern => {
    const matches = message.match(pattern);
    if (matches) {
      signals.push({
        type: 'word_choice',
        confidence: 0.7,
        timestamp: Date.now(),
        context: message,
        evidence: [matches[0]],
        chosen: matches[0],
        alternatives: [],
        sentimentDirection: 'positive',
        nuance: { cautiousness: 0.3, decisiveness: 0.8, conservativeness: 0.5, adventurousness: 0.4 },
      });
    }
  });

  // ... hesitantPatterns 类似
}
```

用正则匹配中文关键词，生成 `WordChoiceSignal`。每个信号包含：

- `confidence`：置信度；
- `sentimentDirection`：情感方向；
- `nuance`：四个维度的细粒度态度分数。

## 真实调用链

Accumulation System 在项目初始化中的使用：

1. `sendMessage` 收到用户消息。
2. `readTasteSignals` 提取 WordChoiceSignal 等。
3. 每个 signal 被包装成 observation，调用 `addObservation`（当前只是日志）。
4. Skill 执行成功后，调用 `processTrustEvent({ type: 'successful_suggestion' })`。
5. `trustModel.overallTrust` 增加 0.05。
6. `getAutonomyLevel()` 根据更新后的信任值返回新的自主级别。
7. `ProjectAgentResponse` 把 `trustLevel` 和 `autonomyLevel` 返回给 Web，UI 可以展示或据此调整交互。

## 关键类型与数据示例

### TrustEvent

```typescript
type TrustEvent =
  | { type: 'successful_suggestion' }
  | { type: 'correction_applied'; severity: 'minor' | 'major' | 'critical' }
  | { type: 'pattern_verified' }
  | { type: 'pattern_rejected' };
```

### WordChoiceSignal

```typescript
{
  type: 'word_choice',
  confidence: 0.7,
  timestamp: 1725000000000,
  context: '这个方案可行',
  evidence: ['可行'],
  chosen: '可行',
  alternatives: [],
  sentimentDirection: 'positive',
  nuance: {
    cautiousness: 0.3,
    decisiveness: 0.8,
    conservativeness: 0.5,
    adventurousness: 0.4,
  },
}
```

### 信任历史片段

```typescript
{
  timestamp: 1725000000000,
  event: { type: 'successful_suggestion' },
  delta: 0.05,
}
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| 信任值超过 1.0 | 被 `Math.min(1, ...)` 限制 | 显式边界 |
| 信任值低于 0.0 | 被 `Math.max(0, ...)` 限制 | 显式边界 |
| `domainTrust` 中无对应 domain | 回退到 `overallTrust` | `getAutonomyLevel` 的 fallback |
| 未识别的事件类型 | delta 为 0 | `default` 分支 |
| `detectResistancePatterns` 返回空 | 当前无法从单条消息检测抗拒 | 需要更多上下文 |

**一个关键边界**：当前 `addObservation` 没有真正写入队列，只是 `console.log`。这意味着 ARIA Infer 阶段目前没有数据可用，是 Epic T 的未完整实现部分。

## 测试证据

- Accumulation System 相关方法当前无直接测试。
- 缺口说明：建议补测试覆盖 `calculateTrustDelta` 的各种事件、`processTrustEvent` 的边界、`getAutonomyLevel` 的分级、`detectWordChoice` 的正则匹配。

## 练习与验收

1. **信任值边界**：连续调用 20 次 `processTrustEvent({ type: 'successful_suggestion' })`，验证信任值不超过 1.0。
2. **自主级别分级**：构造 trust 为 0.2、0.4、0.6、0.9 的场景，分别调用 `getAutonomyLevel`，验证返回值。
3. **事件 delta 验证**：遍历所有 `TrustEvent` 类型，调用 `calculateTrustDelta`，确认 delta 符号和大小。
4. **WordChoice 检测**：用“这个方案不错，但可能还要考虑”调用 `detectWordChoice`，验证同时命中积极和犹豫模式。

**验收标准**：能解释 Accumulation System 的组成部分，能独立模拟信任事件并计算自主级别。

## 章节收束

本节课看了 ProjectAgent 中的 Accumulation System。它通过信任事件历史动态调整 Agent 的自主级别，与 Taste Engineering 一起构成 ProjectAgent 的“个性适应”能力。

下节课（F11）会跳出 `project-agent.ts`，看 `features/agent/prompts/` 下的两个 Prompt 文件：通用 Agent Prompt 和项目访谈 Prompt。
