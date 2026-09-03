# F64：`SleepComputeScheduler` —— 睡眠计算

## 开篇场景

Agent 在处理用户请求时，不能花太多时间整理记忆、提取知识、沉淀模式——这会影响响应速度。但这些任务又很重要，不能不做。解决方案是：**把重量计算移到 Agent 空闲时执行**。这就是"睡眠计算"（Sleep-time Compute）——借鉴 Letta 的设计。

## 核心问题

**哪些任务适合睡眠计算？如何调度？如何保证不丢失？**

## 概念阶梯

### 1. 睡眠计算任务类型

```typescript
type SleepTaskType = 'consolidate_memory' | 'extract_knowledge' | 'mine_patterns' | 'update_blocks';
```

| 任务类型 | 说明 | 重量 |
|---|---|---|
| **consolidate_memory** | 记忆整合 | 重（LLM 分析） |
| **extract_knowledge** | 知识提取 | 重（LLM 分析） |
| **mine_patterns** | 模式挖掘 | 重（统计分析） |
| **update_blocks** | 更新记忆块 | 轻（文件操作） |

### 2. 触发器类型

```typescript
type SleepTrigger =
  | { type: 'session_end' }           // 会话结束时
  | { type: 'interval'; everyNTurns: number }  // 每 N 轮
  | { type: 'manual' };               // 手动触发
```

### 3. 调度流程

```
Agent 空闲
  → SleepComputeScheduler.executePendingForSessionEnd()
       → 获取所有待处理任务
       → 逐个执行
       → 从队列中移除
```

## 源码精读

### 1. 调度任务

[packages/core/src/lib/integrations/pi-agent/cognitive/sleep-compute.ts 第 32-40 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/sleep-compute.ts#L32)

```typescript
schedule(task: SleepTask, trigger: SleepTrigger): string {
  const id = `sleep-${++this.idCounter}`;
  this.pendingTasks.set(id, {
    id,
    task,
    trigger,
    scheduledAt: Date.now(),
  });
  return id;
}
```

### 2. Interval 触发检查

[packages/core/src/lib/integrations/pi-agent/cognitive/sleep-compute.ts 第 71-85 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/sleep-compute.ts#L71)

```typescript
checkIntervalTriggers(currentTurn?: number): boolean {
  if (currentTurn !== undefined) {
    this.turnCounter = currentTurn;
  } else {
    this.turnCounter++;
  }

  const triggered = this.getPendingTasks().filter(e => {
    if (e.trigger.type !== 'interval') return false;
    return this.turnCounter % e.trigger.everyNTurns === 0;
  });

  return triggered.length > 0;
}
```

**触发逻辑**：
- 每轮调用 `checkIntervalTriggers()`
- `turnCounter` 递增
- 匹配 `turnCounter % everyNTurns === 0` 的任务

### 3. 执行 Session End 任务

[packages/core/src/lib/integrations/pi-agent/cognitive/sleep-compute.ts 第 107-117 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/sleep-compute.ts#L107)

```typescript
executePendingForSessionEnd(): SleepTaskEntry[] {
  const toExecute = this.getPendingTasks();
  if (toExecute.length === 0) return [];

  // 清除所有已调度的任务（session_end 时全部执行）
  for (const entry of toExecute) {
    this.pendingTasks.delete(entry.id);
  }

  return toExecute;
}
```

**注意**：`session_end` 时执行所有待处理任务，包括 `interval` 和 `manual` 的。

### 4. 辅助函数

[packages/core/src/lib/integrations/pi-agent/cognitive/sleep-compute.ts 第 163-192 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/sleep-compute.ts#L163)

```typescript
export function createConsolidateTask(turnFrom: number, turnTo: number): SleepTask {
  return {
    type: 'consolidate_memory',
    payload: { turnRange: [turnFrom, turnTo] },
  };
}

export function createKnowledgeTask(source: 'turns' | 'documents' = 'turns'): SleepTask {
  return {
    type: 'extract_knowledge',
    payload: { source },
  };
}

export function createPatternTask(lookback = 10): SleepTask {
  return {
    type: 'mine_patterns',
    payload: { lookback },
  };
}

export function createUpdateBlockTask(blockNames: string[]): SleepTask {
  return {
    type: 'update_blocks',
    payload: { blockNames },
  };
}
```

## 真实调用链

```
Agent 启动
  → SleepComputeScheduler.reset()
  → 调度任务（如每 20 轮整合记忆）
       → scheduler.schedule(createConsolidateTask(0, 20), { type: 'interval', everyNTurns: 20 })

每轮对话
  → checkIntervalTriggers()
       → 如果满足触发条件 → 标记为待执行

会话结束
  → executePendingForSessionEnd()
       → 获取所有待执行任务
       → CognitiveManager.on_sleep_tasks(tasks)
            → 各 Provider 处理对应任务
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| 任务执行失败 | 记录错误，不影响其他任务 | 独立执行 |
| 任务重复调度 | 允许重复 | 每个任务有独立 ID |
| 手动任务未执行 | 保留在队列中 | `executeManualTask` 逐个执行 |
| 调度器重置 | 清空所有任务 | `reset()` |

## 练习与验收

1. **设计调度策略**：为 "每 50 轮提取知识" 设计一个调度任务。
2. **分析触发逻辑**：如果 `everyNTurns: 20`，第 21 轮会触发吗？第 40 轮呢？
3. **比较触发器**：`session_end`、`interval`、`manual` 分别适合什么场景？

**验收标准**：能理解 SleepComputeScheduler 的调度机制，能设计睡眠计算任务。

## 章节收束

`SleepComputeScheduler` 讲完了。下一节课（F65）看 `KnowledgeIngest` 业务模型导入。
