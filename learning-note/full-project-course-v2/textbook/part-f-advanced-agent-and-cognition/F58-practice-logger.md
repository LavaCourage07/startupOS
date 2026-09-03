# F57：`CognitiveManager` 生命周期管理

## 开篇场景

认知系统有多个 Provider（PracticeLogger、KnowledgeProvider、PatternProvider），它们需要在正确的时机被调用。`CognitiveManager` 就是它们的"指挥家"——负责注册、调度、生命周期管理。

## 核心问题

**`CognitiveManager` 如何管理多个 Provider 的生命周期？`on_turn_end`、`on_session_end`、`on_sleep_tasks` 分别在什么时候触发？**

## 概念阶梯

### 1. Provider 注册与注销

```typescript
const manager = new CognitiveManager(agentDir);
manager.register(new PracticeLogger(agentDir));
manager.register(new KnowledgeProvider(agentDir));
manager.register(new PatternProvider(agentDir));
```

### 2. 生命周期钩子

| 钩子 | 触发时机 | 用途 | 阻塞性 |
|---|---|---|---|
| `on_turn_end` | 每轮对话结束 | 记录实践、提取知识、检测模式 | 非阻塞（setImmediate） |
| `on_session_end` | 会话结束 | 批量分析、沉淀模式 | 阻塞（同步等待） |
| `on_sleep_tasks` | Agent 空闲时 | 异步执行重量计算 | 非阻塞 |
| `build_snapshot_prompt` | Agent 启动时 | 加载 Frozen Snapshot | 阻塞 |

### 3. prefetch 机制

```typescript
const results = await manager.prefetch("用户需要什么？");
// results = [
//   { provider: 'knowledge', content: '...' },
//   { provider: 'pattern', content: '...' }
// ]
```

## 源码精读

### 1. 构造函数

[packages/core/src/lib/integrations/pi-agent/cognitive/manager.ts 第 13-22 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/manager.ts#L13)

```typescript
export class CognitiveManager {
  private providers = new Map<string, CognitiveProvider>();
  private providerPaths = new Map<string, string>();

  constructor(_agentDir?: string) {
    if (!_agentDir) {
      throw new Error('CognitiveManager requires a valid agentDir');
    }
  }
}
```

**注意**：构造函数只接收 `agentDir`，不自动创建 Provider。Provider 需要外部注册。

### 2. on_turn_end 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/manager.ts 第 39-49 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/manager.ts#L39)

```typescript
async on_turn_end(data: TurnCognitiveData): Promise<void> {
  setImmediate(async () => {
    for (const [, provider] of this.providers) {
      try {
        await provider.sync_turn(data);
      } catch (e) {
        console.error(`[CognitiveManager] ${provider.name} sync_turn error:`, e);
      }
    }
  });
}
```

**关键点**：
- `setImmediate`：放入事件循环的下一个 tick，不阻塞当前响应
- 每个 Provider 独立执行，错误被捕获
- 即使某个 Provider 失败，其他 Provider 仍能继续

### 3. on_session_end 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/manager.ts 第 53-63 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/manager.ts#L53)

```typescript
async on_session_end(messages: unknown[]): Promise<void> {
  for (const [, provider] of this.providers) {
    try {
      if ('on_session_end' in provider) {
        await (provider as any).on_session_end(messages);
      }
    } catch (e) {
      console.error(`[CognitiveManager] ${provider.name} on_session_end error:`, e);
    }
  }
}
```

**与 on_turn_end 的区别**：
- 不使用 `setImmediate`，同步等待（会话结束可以承受延迟）
- 使用 `'on_session_end' in provider` 检查 Provider 是否实现了该方法
- 不是所有 Provider 都需要 `on_session_end`

### 4. build_snapshot_prompt

[packages/core/src/lib/integrations/pi-agent/cognitive/manager.ts 第 67-78 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/manager.ts#L67)

```typescript
async build_snapshot_prompt(): Promise<string> {
  const blocks: string[] = [];
  for (const [, provider] of this.providers) {
    try {
      const block = await provider.system_prompt_block();
      if (block) blocks.push(block);
    } catch (e) {
      console.error(`[CognitiveManager] ${provider.name} system_prompt_block error:`, e);
    }
  }
  return blocks.join('\n\n');
}
```

**调用时机**：Agent 启动时，由 `PersistentAgent` 调用。

### 5. prefetch 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/manager.ts 第 81-93 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/manager.ts#L81)

```typescript
async prefetch(query: string): Promise<Array<{ provider: string; content: string }>> {
  const results = [];
  for (const [, provider] of this.providers) {
    try {
      const content = await provider.prefetch(query);
      if (content) {
        results.push({ provider: provider.name, content });
      }
    } catch (e) {
      console.error(`[CognitiveManager] ${provider.name} prefetch error:`, e);
    }
  }
  return results;
}
```

**用途**：在 Agent 处理用户消息前，从认知系统召回相关上下文。

## 真实调用链

```
PersistentAgent 启动
  ├─ new CognitiveManager(agentDir)
  ├─ manager.register(new PracticeLogger(agentDir))
  ├─ manager.register(new KnowledgeProvider(agentDir))
  ├─ manager.register(new PatternProvider(agentDir))
  └─ systemPrompt += await manager.build_snapshot_prompt()

每轮对话
  └─ on_turn_end(data)
       ├─ PracticeLogger.sync_turn(data)     → practice/turns/turn-{N}.json
       ├─ KnowledgeProvider.sync_turn(data)  → knowledge/ontology.json
       └─ PatternProvider.sync_turn(data)    → patterns/registry.json

会话结束
  └─ on_session_end(messages)
       └─ PatternProvider.on_session_end(messages) → 批量分析

Agent 空闲
  └─ on_sleep_tasks(tasks)
       └─ 各 Provider 处理睡眠任务
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| Provider 未注册 | 被跳过 | `providers` Map 中没有该 Provider |
| Provider.sync_turn 失败 | 记录错误，其他 Provider 继续 | 独立 try/catch |
| build_snapshot_prompt 失败 | 返回空字符串 | 不影响 Agent 启动 |
| prefetch 失败 | 返回空结果 | 不影响主流程 |

## 练习与验收

1. **为什么 on_turn_end 用 setImmediate？** 如果不用会发生什么？
2. **设计一个新的 Provider**：如果要实现一个"情感分析 Provider"，它应该实现哪些方法？在什么时候触发？
3. **分析生命周期**：画出 `CognitiveManager` 的完整生命周期图，标注每个钩子的触发时机。

**验收标准**：能理解 `CognitiveManager` 的生命周期管理，能设计新的 CognitiveProvider。

## 章节收束

`CognitiveManager` 讲完了。下一节课（F58）看 `PracticeLogger` 如何记录实践日志。
