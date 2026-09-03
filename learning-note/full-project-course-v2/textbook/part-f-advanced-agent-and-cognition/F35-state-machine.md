# F35：`state-machine.ts` —— 状态机解析与阶段推进

## 开篇场景

RoleAgent 的 `Role.md` 定义了多个阶段（如“准备阶段”→“执行阶段”→“复盘阶段”），以及阶段之间的转换规则。Agent 在运行中需要根据 LLM 的输出检测阶段转换，并更新当前阶段。这节课看 `state-machine.ts` 如何解析和推进状态机。

## 核心问题

**`parseStateMachine` 如何从 `Role.md` 解析 YAML frontmatter？`determinePhase` 和 `checkTransition` 有什么区别？`applyTransition` 如何更新状态？**

## 概念阶梯

**StateMachine**：包含阶段列表、转换规则、当前阶段的状态机对象。

**RolePhase**：单个阶段的定义，包含名称、行为特征、进入条件、退出条件。

**TransitionRule**：阶段转换规则，包含 from、to、condition。

**TransitionResult**：转换检测结果，包含是否触发、from、to、reason。

## 源码精读

### 1. 类型定义

[packages/core/src/lib/integrations/pi-agent/role-agent/state-machine.ts 第 14—38 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/state-machine.ts#L14)

```typescript
export interface RolePhase {
  name: string;
  behavior: string;
  entryCondition: string;
  exitCondition: string;
}

export interface TransitionRule {
  from: string;
  to: string;
  condition: string;
}

export interface StateMachine {
  phases: RolePhase[];
  transitions: TransitionRule[];
  currentPhase: string;
}

export interface TransitionResult {
  triggered: boolean;
  from: string;
  to: string;
  reason: string;
}
```

### 2. parseStateMachine

[packages/core/src/lib/integrations/pi-agent/role-agent/state-machine.ts 第 44—89 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/state-machine.ts#L44)

```typescript
export function parseStateMachine(roleMd: string | null): StateMachine {
  if (!roleMd) {
    return { phases: [], transitions: [], currentPhase: 'default' };
  }

  const fm = parseFrontmatter(roleMd);
  if (!fm) {
    return { phases: [], transitions: [], currentPhase: 'default' };
  }

  const phases: RolePhase[] = [];
  if (Array.isArray(fm.phases)) {
    for (const p of fm.phases) {
      if (p && typeof p === 'object' && 'name' in p && p.name) {
        const item = p as Record<string, unknown>;
        phases.push({
          name: String(item['name']),
          behavior: String(item['behavior'] ?? ''),
          entryCondition: String(item['entryCondition'] ?? ''),
          exitCondition: String(item['exitCondition'] ?? ''),
        });
      }
    }
  }

  const transitions: TransitionRule[] = [];
  if (Array.isArray(fm.transitions)) {
    for (const t of fm.transitions) {
      if (t && typeof t === 'object' && 'from' in t && 'to' in t && t.from && t.to) {
        const item = t as Record<string, unknown>;
        transitions.push({
          from: String(item['from']),
          to: String(item['to']),
          condition: String(item['condition'] ?? ''),
        });
      }
    }
  }

  const cp = fm.currentPhase;
  const currentPhase = typeof cp === 'string' && cp
    ? cp
    : (phases.length > 0 ? phases[0]!.name : 'default');

  return { phases, transitions, currentPhase };
}
```

解析逻辑：

1. 从 `Role.md` 提取 YAML frontmatter；
2. 解析 `phases` 数组，每个元素必须有 `name`；
3. 解析 `transitions` 数组，每个元素必须有 `from` 和 `to`；
4. `currentPhase` 优先使用 frontmatter 中的值，否则默认第一个阶段名。

### 3. determinePhase

[packages/core/src/lib/integrations/pi-agent/role-agent/state-machine.ts 第 95—120 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/state-machine.ts#L95)

```typescript
export function determinePhase(
  stateMachine: StateMachine,
  messages: AgentMessage[],
): string {
  if (stateMachine.phases.length === 0) {
    return stateMachine.currentPhase;
  }

  let currentPhase = stateMachine.currentPhase;

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;

    const content = typeof msg.content === 'string' ? msg.content : '';

    const phaseMatch = content.match(/\[PHASE:(.+?)\]/);
    if (phaseMatch?.[1]) {
      const newPhase = phaseMatch[1].trim();
      if (stateMachine.phases.some(p => p.name === newPhase)) {
        currentPhase = newPhase;
      }
    }
  }

  return currentPhase;
}
```

从消息历史中扫描 `[PHASE:xxx]` 标记，更新当前阶段。注意：它只更新本地变量，不修改 `stateMachine` 对象。

### 4. checkTransition

[packages/core/src/lib/integrations/pi-agent/role-agent/state-machine.ts 第 126—158 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/state-machine.ts#L126)

```typescript
export function checkTransition(
  stateMachine: StateMachine,
  messages: AgentMessage[],
): TransitionResult | null {
  if (stateMachine.phases.length === 0) return null;

  const lastMsg = messages.filter(m => m.role === 'assistant').pop();
  if (!lastMsg) return null;

  const content = typeof lastMsg.content === 'string' ? lastMsg.content : '';

  const phaseMatch = content.match(/\[PHASE:(.+?)\]/);
  if (!phaseMatch?.[1]) return null;

  const targetPhase = phaseMatch[1].trim();
  if (!stateMachine.phases.some(p => p.name === targetPhase)) {
    return null;
  }

  const fromPhase = stateMachine.currentPhase;
  if (fromPhase === targetPhase) return null;

  const matchingRule = stateMachine.transitions.find(
    t => t.from === fromPhase && t.to === targetPhase,
  );

  return {
    triggered: true,
    from: fromPhase,
    to: targetPhase,
    reason: matchingRule?.condition ?? 'LLM 触发阶段转换',
  };
}
```

`checkTransition` 和 `determinePhase` 的区别：

- `determinePhase`：遍历所有消息，返回最新的阶段名（只读）。
- `checkTransition`：只检查最后一条 assistant 消息，返回结构化的 `TransitionResult`（包含触发原因）。

### 5. applyTransition

[packages/core/src/lib/integrations/pi-agent/role-agent/state-machine.ts 第 160—165 行](../../../../packages/core/src/lib/integrations/pi-agent/role-agent/state-machine.ts#L160)

```typescript
export function applyTransition(
  stateMachine: StateMachine,
  newPhase: string,
): void {
  stateMachine.currentPhase = newPhase;
}
```

直接修改 `stateMachine.currentPhase`。调用方负责持久化。

## 真实调用链

1. `RoleAgentLauncher` 在 `turn_end` 钩子中调用 `checkTransition`。
2. 如果返回 `TransitionResult`，调用 `applyTransition` 更新状态。
3. 更新后的 `currentPhase` 被写入 `Role.md` frontmatter（或重新构建 prompt）。
4. 下一轮对话的 system prompt 中的 `Layer 2: StateMemory` 会反映新的阶段。

## 关键类型与数据示例

### Role.md 示例

```markdown
---
currentPhase: preparation
phases:
  - name: preparation
    behavior: 收集需求，制定计划
    entryCondition: 用户提出新任务
    exitCondition: 计划已确认
  - name: execution
    behavior: 执行计划，调用工具
    entryCondition: 计划已确认
    exitCondition: 任务完成
  - name: review
    behavior: 复盘总结，收集反馈
    entryCondition: 任务完成
    exitCondition: 用户确认

transitions:
  - from: preparation
    to: execution
    condition: 用户确认计划
  - from: execution
    to: review
    condition: 任务完成
  - from: review
    to: preparation
    condition: 用户提出新任务
---

# Role Definition

...
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| Role.md 不存在 | 返回空状态机 | 可选文件 |
| frontmatter 无 phases | `phases = []` | 无阶段定义 |
| `[PHASE:xxx]` 指向不存在阶段 | 忽略 | `phases.some()` 检查 |
| 无 assistant 消息 | `checkTransition` 返回 null | 无消息可分析 |
| 同一阶段重复转换 | 返回 null | `fromPhase === targetPhase` |

## 测试证据

- `state-machine.ts` 当前无直接单元测试。
- 建议补测试：
  - `parseStateMachine` 正确解析 YAML frontmatter；
  - `determinePhase` 从消息历史提取最新阶段；
  - `checkTransition` 正确匹配转换规则；
  - `applyTransition` 更新状态机。

## 练习与验收

1. **构造 Role.md**：定义 3 个阶段和 2 条转换规则，验证 `parseStateMachine` 输出。
2. **模拟阶段转换**：构造包含 `[PHASE:execution]` 的消息历史，验证 `checkTransition` 输出。
3. **边界测试**：测试无效阶段名、重复转换、无 assistant 消息的场景。

**验收标准**：能独立构造状态机定义，能模拟阶段转换并验证结果。

## 章节收束

`state-machine.ts` 是 RoleAgent 行为变化的核心。下一节课（F36）看 `system-prompt.ts`，理解 7 层 prompt 如何构建。
