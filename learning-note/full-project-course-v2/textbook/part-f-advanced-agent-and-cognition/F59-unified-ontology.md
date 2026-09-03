# F58：`PracticeLogger` —— 实践日志记录

## 开篇场景

Agent 每轮对话都在做决策：调用什么工具、怎么组合、结果如何。这些决策如果记录下来，就能分析 Agent 的行为模式，找出哪里可以优化。`PracticeLogger` 就是做这个的——它把每轮对话的结构化数据写入文件，供后续分析。

## 核心问题

**`PracticeLogger` 记录什么数据？如何聚合统计？这些统计数据有什么用？**

## 概念阶梯

### 1. 实践日志结构

```
practice/
├── turns/
│   ├── turn-1.json
│   ├── turn-2.json
│   └── ...
└── summary.json          # 聚合统计
```

### 2. PracticeSummary 统计指标

```typescript
interface PracticeSummary {
  totalTurns: number;              // 总轮数
  totalToolCalls: number;          // 总工具调用次数
  averageToolChainLength: number;  // 平均工具链长度
  successRate: number;             // 成功率（%）
  resolvedCount: number;          // 成功解决数
  lastUpdated: number;            // 最后更新时间
}
```

### 3. 统计数据的意义

| 指标 | 正常范围 | 异常信号 |
|---|---|---|
| averageToolChainLength | 1-3 | >5 可能说明工具选择不够精准 |
| successRate | >80% | <50% 需要分析失败原因 |
| totalToolCalls / totalTurns | 1-2 | 过高说明每轮调用太多工具 |

## 源码精读

### 1. 构造函数

[packages/core/src/lib/integrations/pi-agent/cognitive/practice-logger.ts 第 29-39 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/practice-logger.ts#L29)

```typescript
export class PracticeLogger implements CognitiveProvider {
  readonly name = 'practice';
  private readonly turnsDir: string;
  private readonly summaryPath: string;

  constructor(agentDir: string) {
    this.turnsDir = path.join(agentDir, 'practice', 'turns');
    this.summaryPath = path.join(agentDir, 'practice', 'summary.json');
    this.ensurePracticeDir();
  }
}
```

### 2. sync_turn 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/practice-logger.ts 第 41-44 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/practice-logger.ts#L41)

```typescript
async sync_turn(data: TurnCognitiveData): Promise<void> {
  const turnFile = path.join(this.turnsDir, `turn-${data.turnNumber}.json`);
  writeFileSync(turnFile, JSON.stringify(data, null, 2), 'utf-8');
  await this.updateSummary(data);
}
```

**关键点**：
- 每个 turn 一个文件，便于后续批量分析
- 写入后立即更新 summary
- `JSON.stringify(data, null, 2)`：格式化输出，便于人工查看

### 3. updateSummary 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/practice-logger.ts 第 94-107 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/practice-logger.ts#L94)

```typescript
private async updateSummary(data: TurnCognitiveData): Promise<void> {
  const summary = this.readSummary();

  summary.totalTurns++;
  summary.totalToolCalls += data.toolCalls.length;
  summary.resolvedCount += data.outcome.resolved ? 1 : 0;
  summary.lastUpdated = Date.now();

  if (summary.totalTurns > 0) {
    summary.averageToolChainLength = +(summary.totalToolCalls / summary.totalTurns).toFixed(2);
    summary.successRate = +(summary.resolvedCount / summary.totalTurns * 100).toFixed(2);
  }

  this.writeSummary(summary);
}
```

**计算逻辑**：
- `averageToolChainLength` = 总工具调用次数 / 总轮数
- `successRate` = 成功解决数 / 总轮数 × 100%

### 4. readSummary 的容错设计

[packages/core/src/lib/integrations/pi-agent/cognitive/practice-logger.ts 第 65-87 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/practice-logger.ts#L65)

```typescript
private readSummary(): PracticeSummary {
  if (!existsSync(this.summaryPath)) {
    return { totalTurns: 0, totalToolCalls: 0, averageToolChainLength: 0, successRate: 0, resolvedCount: 0, lastUpdated: Date.now() };
  }
  try {
    return JSON.parse(readFileSync(this.summaryPath, 'utf-8'));
  } catch {
    return { /* 默认值 */ };
  }
}
```

**容错设计**：
- 文件不存在 → 返回默认空统计
- 文件损坏 → 返回默认空统计（不抛异常）

## 真实调用链

```
用户发送消息
  → Agent 处理 → 工具调用 → 结果返回
  → PersistentAgent.on_turn_end()
       → CognitiveManager.on_turn_end(data)
            → PracticeLogger.sync_turn(data)
                 ├─ 写入 practice/turns/turn-{N}.json
                 └─ 更新 practice/summary.json
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| turns 目录不存在 | 自动创建 | `ensurePracticeDir()` |
| summary.json 损坏 | 返回默认统计 | `readSummary` 有 try/catch |
| 磁盘空间不足 | 写入失败 | 需要监控磁盘空间 |
| turn 编号重复 | 覆盖旧文件 | 需要确保 turnNumber 唯一 |

## 练习与验收

1. **分析统计数据**：假设 summary.json 显示 `averageToolChainLength: 5.2`，`successRate: 45%`，说明什么问题？
2. **设计监控告警**：基于 PracticeSummary，设计一个监控告警规则。
3. **实现 turn 归档**：当 turn 文件超过 1000 个时，如何实现归档？

**验收标准**：能理解 PracticeLogger 的数据结构和统计逻辑，能分析统计数据。

## 章节收束

`PracticeLogger` 讲完了。下一节课（F59）看 `UnifiedOntology`——统一本体模型，这是认知系统的数据基础。
