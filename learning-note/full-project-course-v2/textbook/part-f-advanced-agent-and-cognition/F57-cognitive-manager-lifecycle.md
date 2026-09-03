# F56：认知系统架构总览

## 开篇场景

你正在和 OriginOS 的 Agent 进行第 50 轮对话。Agent 已经帮你完成了多个任务：分析业务模型、设计解决方案、编写代码。它记得你之前提到的所有关键概念，知道你喜欢用哪种方式组织信息，甚至能预测你下一步可能需要什么工具。

这不是魔法，而是**认知系统**在工作。

## 核心问题

**Agent 如何在服务过程中积累经验？知识、模式、反思分别存储在哪里？它们之间是什么关系？**

## 概念阶梯

### 1. 认知系统的三个核心组件

OriginOS 的认知系统借鉴了人类认知的三个维度：

| 组件 | 人类对应 | 职责 | 存储位置 |
|---|---|---|---|
| **知识库 (Knowledge Base)** | 长期记忆 | 理解世界 — 领域知识、事实、概念 | `knowledge/ontology.json` + `wiki/` |
| **实践日志 (Practice Log)** | 工作日志 | 记录行为 — 每轮决策、工具选择、执行结果 | `practice/turns/turn-{N}.json` |
| **经验模式 (Pattern Library)** | 肌肉记忆 | 优化行为 — 最佳路径、反模式 | `patterns/registry.json` + `episodic-memory/` |

### 2. CognitiveProvider 接口

所有认知组件都实现 `CognitiveProvider` 接口：

```typescript
interface CognitiveProvider {
  readonly name: string;
  sync_turn(data: TurnCognitiveData): Promise<void>;  // 每轮触发
  prefetch(query: string): Promise<string | null>;     // 召回相关上下文
  system_prompt_block(): Promise<string>;              // 生成 Frozen Snapshot
}
```

### 3. 认知生命周期

```
┌─────────────────────────────────────────────────────────┐
│                    Agent 会话生命周期                      │
├─────────────────────────────────────────────────────────┤
│  on_turn_end                                             │
│    ├── PracticeLogger.sync_turn()   → 写入 practice/    │
│    ├── KnowledgeProvider.sync_turn() → 提取实体 → ontology│
│    └── PatternProvider.sync_turn()  → 检测工具链模式     │
│                                                          │
│  on_session_end                                          │
│    ├── PatternProvider.on_session_end() → 批量分析      │
│    └── CognitiveManager.build_snapshot_prompt()         │
│                                                          │
│  sleep_tasks                                             │
│    └── SleepComputeScheduler → 异步执行重量操作          │
└─────────────────────────────────────────────────────────┘
```

## 源码精读

### 1. TurnCognitiveData 结构

[packages/core/src/lib/integrations/pi-agent/cognitive/types.ts](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/types.ts)

```typescript
interface TurnCognitiveData {
  turnNumber: number;
  userMessage: string;
  assistantThinking: string;
  toolCalls: Array<{
    name: string;
    success: boolean;
    result: string;
  }>;
  outcome: {
    resolved: boolean;
  };
}
```

每轮对话结束后，`TurnCognitiveData` 包含：
- **用户消息**：用户说了什么
- **助手思考过程**：Agent 的推理过程
- **工具调用链**：调用了哪些工具、是否成功、结果是什么
- **结果**：任务是否解决

### 2. CognitiveManager 注册机制

[packages/core/src/lib/integrations/pi-agent/cognitive/manager.ts](../../../../packages/core/src/lib/integrations/pi-agent/cognitive/manager.ts)

```typescript
export class CognitiveManager {
  private providers = new Map<string, CognitiveProvider>();

  register(provider: CognitiveProvider): void {
    this.providers.set(provider.name, provider);
  }

  async on_turn_end(data: TurnCognitiveData): Promise<void> {
    setImmediate(async () => {
      for (const [, provider] of this.providers) {
        await provider.sync_turn(data);
      }
    });
  }
}
```

**关键点**：
- `setImmediate`：异步执行，不阻塞 Agent 响应
- 每个 Provider 独立处理，互不阻塞
- 错误被捕获，不影响其他 Provider

### 3. Frozen Snapshot 模式

```
Agent 启动
  └─ CognitiveManager.build_snapshot_prompt()
       ├─ KnowledgeProvider.system_prompt_block() → Knowledge.md
       └─ PatternProvider.system_prompt_block()   → Patterns.md
```

Frozen Snapshot 保持 LLM prefix cache 稳定：
- 启动时加载一次，中途不修改
- 新产生的知识只写入磁盘，不更新内存快照
- 下次启动时重新加载

## 真实调用链

1. 用户发送消息 → Agent 处理 → 工具调用 → 结果返回
2. `PersistentAgent` 触发 `on_turn_end`
3. `CognitiveManager.on_turn_end()` 遍历所有 Provider
4. 各 Provider 异步处理：
   - `PracticeLogger` 写入 `practice/turns/turn-{N}.json`
   - `KnowledgeProvider` 提取实体 → `knowledge/ontology.json`
   - `PatternProvider` 检测工具链 → `patterns/registry.json`
5. 会话结束时，`PatternProvider.on_session_end()` 批量分析
6. `CognitiveManager.build_snapshot_prompt()` 生成 Frozen Snapshot

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| Provider.sync_turn 抛出异常 | 被 catch，不影响其他 Provider | 每个 Provider 有独立 try/catch |
| 磁盘写入失败 | 记录错误，继续执行 | 异步执行，不阻塞主流程 |
| ontology.json 损坏 | 创建新的空本体 | `loadOrCreateOntology` 有 fallback |
| 大量 turn 文件 | 可能影响性能 | 需要定期清理或归档 |

## 练习与验收

1. **画出认知系统架构图**：包含三个核心组件、CognitiveManager、生命周期钩子。
2. **解释 Frozen Snapshot**：为什么启动时加载后不再修改？有什么好处？
3. **分析 TurnCognitiveData**：如果某轮没有工具调用，哪些 Provider 会受到影响？

**验收标准**：能解释认知系统的三个核心组件及其关系，理解 Frozen Snapshot 模式。

## 章节收束

认知系统架构讲完了。下一节课（F57）深入 `CognitiveManager` 的生命周期管理。
