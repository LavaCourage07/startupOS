# F67：认知系统与 RoleAgent 集成

## 开篇场景

RoleAgent 有 MemoryTracker（记录每轮对话）和 Dream（自动记忆维护）。认知系统（KnowledgeProvider、PatternProvider）如何与这些组件协作？它们的数据如何互通？

## 核心问题

**认知系统如何与 RoleAgent 的 MemoryTracker、Dream 协作？数据流向是什么？**

## 概念阶梯

### 1. RoleAgent 的记忆架构

```
RoleAgent
├── MemoryTracker
│   ├── memory/history.jsonl      # 每轮记录
│   └── Memory.md               # 周期性落盘
├── Dream
│   ├── Phase 1: LLM 分析 → 指令
│   └── Phase 2: 执行指令 → 更新 Memory.md
└── CognitiveManager（Epic C）
    ├── PracticeLogger
    │     └── practice/turns/turn-{N}.json
    ├── KnowledgeProvider
    │     ├── knowledge/ontology.json
    │     └── Knowledge.md（Frozen Snapshot）
    └── PatternProvider
          ├── patterns/registry.json
          └── Patterns.md（Frozen Snapshot）
```

### 2. 数据流向

```
每轮对话
  → MemoryTracker.recordTurn()     → history.jsonl
  → PracticeLogger.sync_turn()     → practice/turns/turn-{N}.json
  → KnowledgeProvider.sync_turn()  → knowledge/ontology.json
  → PatternProvider.sync_turn()    → patterns/registry.json

每 N 轮（如 20 轮）
  → Dream.run()
       → 分析 history.jsonl
       → 生成 ADD/UPDATE/REMOVE/SKILL 指令
       → 更新 Memory.md

会话结束
  → PatternProvider.on_session_end()
       → 批量分析 practice/turns/
       → 更新 patterns/registry.json
       → 生成 Patterns.md

Agent 启动
  → MemoryTracker 加载 Memory.md
  → CognitiveManager.build_snapshot_prompt()
       → KnowledgeProvider.system_prompt_block() → Knowledge.md
       → PatternProvider.system_prompt_block() → Patterns.md
```

### 3. 集成点

| 组件 | 认知系统对应 | 关系 |
|---|---|---|
| MemoryTracker | PracticeLogger | 互补：MemoryTracker 记录对话历史，PracticeLogger 记录结构化数据 |
| Dream | KnowledgeProvider + PatternProvider | Dream 更新 Memory.md，认知系统更新 Knowledge.md/Patterns.md |
| Memory.md | Knowledge.md + Patterns.md | 都是 Frozen Snapshot，但内容不同 |

## 源码精读

### 1. RoleAgent 启动时的认知系统初始化

```typescript
// 伪代码，展示集成关系
class PersistentAgent {
  private cognitiveManager: CognitiveManager;

  async startAgent(agentDir: string) {
    // 1. 初始化认知系统
    this.cognitiveManager = new CognitiveManager(agentDir);
    this.cognitiveManager.register(new PracticeLogger(agentDir));
    this.cognitiveManager.register(new KnowledgeProvider(agentDir));
    this.cognitiveManager.register(new PatternProvider(agentDir));

    // 2. 加载 Frozen Snapshot
    const cognitiveSnapshot = await this.cognitiveManager.build_snapshot_prompt();

    // 3. 构建 system prompt
    const systemPrompt = buildRoleSystemPrompt({
      ...roleContext,
      cognitiveSnapshot,  // 注入认知快照
    });
  }
}
```

### 2. on_turn_end 的集成

```typescript
// 伪代码
async onTurnEnd(turnData: TurnData) {
  // 1. MemoryTracker 记录
  await this.memoryTracker.recordTurn(turnData);

  // 2. 认知系统处理
  await this.cognitiveManager.on_turn_end({
    turnNumber: turnData.turnNumber,
    userMessage: turnData.userMessage,
    assistantThinking: turnData.thinking,
    toolCalls: turnData.toolCalls,
    outcome: { resolved: turnData.resolved },
  });

  // 3. Dream 触发检查
  if (turnData.turnNumber % 20 === 0) {
    await this.dream.run();
  }
}
```

### 3. CognitiveManager 的 prefetch 在 RoleAgent 中的应用

```typescript
// 在用户消息处理前，召回相关上下文
const cognitiveContext = await this.cognitiveManager.prefetch(userMessage);
// cognitiveContext = [
//   { provider: 'knowledge', content: 'GrowMap: SaaS company...' },
//   { provider: 'pattern', content: 'Relevant Patterns: ...' }
// ]
```

## 真实调用链

```
RoleAgent 启动
  → 初始化 CognitiveManager
  → 注册 PracticeLogger、KnowledgeProvider、PatternProvider
  → build_snapshot_prompt()
       → KnowledgeProvider.system_prompt_block() → Knowledge.md
       → PatternProvider.system_prompt_block() → Patterns.md
  → 注入 system prompt（Layer 2: StateMemory）

每轮对话
  → 用户发送消息
  → prefetch(userMessage) → 召回相关知识/模式
  → Agent 处理 → 工具调用
  → on_turn_end
       → MemoryTracker.recordTurn() → history.jsonl
       → PracticeLogger.sync_turn() → practice/turns/turn-{N}.json
       → KnowledgeProvider.sync_turn() → knowledge/ontology.json
       → PatternProvider.sync_turn() → patterns/registry.json

每 20 轮
  → Dream.run()
       → 分析 history.jsonl
       → 更新 Memory.md

会话结束
  → PatternProvider.on_session_end()
       → 批量分析 practice/turns/
       → 更新 registry.json
       → 生成 Patterns.md
```

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| CognitiveManager 未初始化 | 跳过认知处理 | 不影响主流程 |
| Provider 失败 | 被 catch，其他 Provider 继续 | 独立 try/catch |
| Memory.md 和 Knowledge.md 冲突 | 内容不同，不冲突 | 分别存储不同信息 |
| Frozen Snapshot 过大 | 可能影响 LLM 性能 | 需要控制大小 |

## 练习与验收

1. **分析数据流向**：画出 RoleAgent 启动、每轮对话、会话结束时的完整数据流图。
2. **设计集成点**：如果要让 Dream 也能访问认知系统的知识，如何设计？
3. **比较 Memory.md 和 Knowledge.md**：它们分别存储什么？为什么需要分开？

**验收标准**：能理解认知系统与 RoleAgent 的集成关系。

## 章节收束

认知系统与 RoleAgent 的集成讲完了。下一节课（F68）看认知系统与 ProjectAgent 的集成。
