# F61：`PatternProvider` —— 模式识别与沉淀（上）

## 开篇场景

Agent 发现：每次用户说"帮我查一下天气"，它都会调用 `weather` 工具，而且成功率 100%。这是一个可以沉淀的模式。下次用户说类似的话，Agent 可以直接调用 `weather` 工具，不需要重新推理。`PatternProvider` 就是做这个的——它从实践中识别成功的工具链模式，供后续复用。

## 核心问题

**`PatternProvider` 如何识别工具链模式？如何评估模式的有效性？模式存储在哪里？**

## 概念阶梯

### 1. 模式注册表结构

```typescript
interface PatternRegistry {
  patterns: PatternEntry[];
  lastAnalyzedTurn: number;
  lastUpdated: number;
}

interface PatternEntry {
  id: string;
  name: string;
  triggerCondition: string;     // 触发条件
  toolChain: string[];          // 工具链（如 ['read_file', 'edit_file']）
  principle?: string;           // 可复用原则
  effectiveness: {
    avgToolCalls: number;       // 平均工具调用数
    successRate: number;       // 成功率（%）
    sampleCount: number;        // 样本数
  };
  isAntiPattern: boolean;       // 是否为反模式
}
```

### 2. 模式识别流程

```
每轮对话
  → 收集工具调用链
  → 匹配已有模式
       ├─ 匹配成功 → 更新统计（sampleCount++, successRate 更新）
       └─ 匹配失败 → 创建新模式（如果工具链长度 <= 3）
```

### 3. 反模式

当成功率 < 50% 或平均工具链长度 > 5 时，标记为反模式：

```typescript
const isAntiPattern = successRate < 50 || avgLength > 5;
```

## 源码精读

### 1. sync_turn 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts 第 71-119 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts#L71)

```typescript
async sync_turn(data: TurnCognitiveData): Promise<void> {
  const currentChain = data.toolCalls.map(t => t.name);

  // 检测失败
  const hasErrors = data.toolCalls.some(t => !t.success);
  const resolved = data.outcome.resolved;

  if (!resolved || hasErrors) {
    await this.on_failure(data);  // 失败处理 → F62
    return;
  }

  // 非失败：记录工具链模式
  if (currentChain.length === 0) return;

  const registry = this.readRegistry();
  const matched = registry.patterns.find(p =>
    !p.isAntiPattern && this.chainsMatch(p.toolChain, currentChain)
  );

  if (matched) {
    // 更新已有模式
    matched.effectiveness.sampleCount++;
    matched.effectiveness.avgToolCalls =
      (matched.effectiveness.avgToolCalls * (matched.effectiveness.sampleCount - 1) + currentChain.length)
      / matched.effectiveness.sampleCount;
    matched.effectiveness.successRate =
      ((matched.effectiveness.successRate * (matched.effectiveness.sampleCount - 1)) + 100)
      / matched.effectiveness.sampleCount;
  } else if (currentChain.length <= 3) {
    // 创建新模式（限制工具链长度）
    const newPattern: PatternEntry = {
      id: `pattern-${Date.now()}`,
      name: `Auto: ${currentChain.join(' → ')}`,
      triggerCondition: `当用户需要类似 ${currentChain[0]} 功能时`,
      toolChain: currentChain,
      effectiveness: {
        avgToolCalls: currentChain.length,
        successRate: 100,
        sampleCount: 1,
      },
      isAntiPattern: false,
    };
    registry.patterns.push(newPattern);
  }

  this.writeRegistry(registry);
}
```

**关键点**：
- 失败时调用 `on_failure`（F62 详细讲）
- 成功时匹配已有模式或创建新模式
- 新模式的 `sampleCount` 初始为 1，`successRate` 初始为 100%
- 只记录工具链长度 <= 3 的模式（避免过长的工具链）

### 2. chainsMatch 实现

[packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts 第 654-656 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts#L654)

```typescript
private chainsMatch(pattern: string[], current: string[]): boolean {
  if (pattern.length !== current.length) return false;
  return pattern.every((p, i) => p.toLowerCase() === current[i]?.toLowerCase());
}
```

**匹配规则**：
- 长度必须相同
- 每个工具名称不区分大小写匹配

### 3. on_session_end 批量分析

[packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts 第 160-241 行](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/pattern-provider.ts#L160)

```typescript
async on_session_end(_messages: unknown[]): Promise<void> {
  const registry = this.readRegistry();
  const lastAnalyzed = registry.lastAnalyzedTurn;

  // 读取最近未分析的 turn 文件
  const turnFiles = this.listTurnFiles();
  const recentTurns = turnFiles
    .map(f => {
      const match = f.match(/turn-(\d+)\.json/);
      return match?.[1] ? { num: parseInt(match[1]), file: f } : null;
    })
    .filter(Boolean)
    .filter(t => t!.num > lastAnalyzed)
    .sort((a, b) => a!.num - b!.num);

  if (recentTurns.length === 0) return;

  // 收集每个工具链的统计 + 最佳 thinking 样本
  const chainStats = new Map<string, {
    count: number; resolved: number; totalLength: number;
    lastScene: string; bestThinking: string;
  }>();

  for (const turn of recentTurns) {
    const turnData: TurnCognitiveData = JSON.parse(readFileSync(turnPath, 'utf-8'));
    const chainKey = turnData.toolCalls.map(t => t.name).join(' → ');

    const stats = chainStats.get(chainKey) ?? { count: 0, resolved: 0, totalLength: 0, lastScene: '', bestThinking: '' };
    stats.count++;
    if (turnData.outcome.resolved) stats.resolved++;
    stats.totalLength += turnData.toolCalls.length;
    stats.lastScene = turnData.userMessage.slice(0, 100);
    // 保留最长 thinking（通常包含最完整的决策推理）
    if (turnData.assistantThinking.length > stats.bestThinking.length) {
      stats.bestThinking = turnData.assistantThinking;
    }
    chainStats.set(chainKey, stats);
  }

  // 更新注册表
  for (const [chainKey, stats] of chainStats) {
    const existing = registry.patterns.find(p => p.toolChain.join(' → ') === chainKey);
    if (existing) {
      existing.effectiveness.sampleCount += stats.count;
      existing.effectiveness.avgToolCalls = stats.totalLength / stats.count;
      existing.effectiveness.successRate = (stats.resolved / stats.count) * 100;
    } else if (stats.count >= 2) {
      // 创建新模式的逻辑...
    }
  }

  registry.lastAnalyzedTurn = recentTurns[recentTurns.length - 1]?.num ?? lastAnalyzed;
  this.writeRegistry(registry);
  this.updatePatternsMd(registry);
}
```

**批量分析的关键**：
- 只分析上次分析之后的新 turn
- 收集每个工具链的统计信息
- 保留"最佳 thinking"样本（最长的 thinking，通常包含最完整的推理）
- 更新注册表后生成 `Patterns.md`

## 真实调用链

```
用户："帮我查一下北京天气"
  → Agent 调用 weather 工具 → 成功
  → on_turn_end
       → PatternProvider.sync_turn(data)
            → currentChain = ['weather']
            → 匹配已有模式？
                 ├─ 匹配成功 → sampleCount++, successRate 更新
                 └─ 匹配失败 → 创建新模式（toolChain: ['weather']）
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| 工具链为空 | 跳过处理 | `currentChain.length === 0` |
| 工具链过长 | 不创建新模式 | `currentChain.length <= 3` |
| 反模式匹配 | 跳过 | `!p.isAntiPattern` |
| registry.json 损坏 | 创建新的空注册表 | `readRegistry` 有 fallback |

## 练习与验收

1. **分析模式统计**：假设一个模式的 `sampleCount: 10`, `successRate: 30%`，它会被标记为反模式吗？为什么？
2. **设计新策略**：如果工具链长度超过 3 但成功率很高，是否应该记录？为什么？
3. **比较 on_turn_end 和 on_session_end**：它们分别更新什么？为什么需要两个钩子？

**验收标准**：能理解 PatternProvider 的模式识别和统计更新逻辑。

## 章节收束

`PatternProvider` 的模式识别讲完了。下一节课（F62）看失败反思与 Reflexion 机制。
