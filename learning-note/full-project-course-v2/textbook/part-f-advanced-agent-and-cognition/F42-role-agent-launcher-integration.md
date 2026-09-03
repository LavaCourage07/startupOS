# F42：RoleAgent 与 Launcher 的集成

## 开篇场景

F.2 讲了 `RoleAgentLauncher` 如何启动 RoleAgent。这节课深入看 Launcher 和 RoleAgent 内部模块的集成关系：Launcher 如何调用 `loadRoleContext`、`buildRoleSystemPrompt`、注册 `turn_end` 钩子。

## 核心问题

**RoleAgentLauncher 的启动流程和普通 AgentLauncher 有什么不同？`turn_end` 钩子如何触发状态机转换和 Dream？**

## 源码精读

### 1. RoleAgentLauncher.launch 回顾

[packages/core/src/lib/features/services/launcher/role-agent.ts 第 1—50 行](../../../../packages/core/src/lib/features/services/launcher/role-agent.ts#L1)

```typescript
export class RoleAgentLauncher extends Launcher {
  readonly entryType = 'role-agent' as const;

  async launch(ctx: LaunchContext): Promise<LaunchResult> {
    // 1. 加载 RoleContext
    const roleContext = await loadRoleContext(ctx.agentBaseDir!);
    if (!roleContext) {
      return { success: false, sessionId: '', systemPrompt: '', agentType: '', baseDir: '', error: 'Agent.md not found' };
    }

    // 2. 解析状态机
    const stateMachine = parseStateMachine(roleContext.roleMd);

    // 3. 构建 7 层 system prompt
    const systemPrompt = buildRoleSystemPrompt(roleContext, stateMachine);

    // 4. 创建会话
    const sessionId = ctx.sessionId ?? generateSessionId();
    await this.registerAgent(sessionId, ctx.projectId ?? '', {
      systemPrompt,
      agentType: 'role-agent',
      agentBaseDir: roleContext.agentBaseDir,
      isWindowBound: ctx.isWindowBound,
      llmConfig: ctx.llmConfig,
    });

    // 5. 注册 turn_end 钩子
    this.registerTurnEndHook(sessionId, roleContext, stateMachine);

    return { success: true, sessionId, systemPrompt, agentType: 'role-agent', baseDir: roleContext.agentBaseDir };
  }
}
```

### 2. registerTurnEndHook

```typescript
private registerTurnEndHook(sessionId: string, roleContext: RoleContext, stateMachine: StateMachine): void {
  const memoryTracker = new MemoryTracker(roleContext.agentBaseDir);
  const dream = new Dream(roleContext.agentBaseDir);

  agentManager.subscribeToAgent(sessionId, 'turn_end', async (event) => {
    // 1. 记录记忆
    memoryTracker.recordTurn(event.userMessage, event.turnNumber);

    // 2. 检查状态机转换
    const transition = checkTransition(stateMachine, event.messages);
    if (transition) {
      applyTransition(stateMachine, transition.to);
      // 更新 Role.md 中的 currentPhase
      await this.updateRoleMdPhase(roleContext.agentBaseDir, transition.to);
    }

    // 3. 检查 Dream 触发
    if (memoryTracker.turnCount % dream.turnInterval === 0) {
      const recentHistory = memoryTracker.readRecentHistory(memoryTracker.getDreamCursor());
      const existingMemoryMd = readFileSync(path.join(roleContext.agentBaseDir, 'Memory.md'), 'utf-8');
      // 构造 Phase 1 prompt，调用 LLM
      const llmOutput = await this.callDreamPhase1(existingMemoryMd, recentHistory);
      await dream.run(llmOutput);
      memoryTracker.setDreamCursor(memoryTracker.turnCount);
    }

    // 4. 检查是否需要 flush
    if (memoryTracker.shouldFlush()) {
      await memoryTracker.flushMemory(null);
    }
  });
}
```

## 真实调用链

1. 用户点击 RoleAgent 入口；
2. `RoleAgentLauncher.launch()` 加载 `RoleContext`；
3. 构建 7 层 system prompt；
4. 注册 `turn_end` 钩子；
5. 用户发送消息，Agent 回复；
6. `turn_end` 触发：记录记忆 → 检查转换 → 检查 Dream → 检查 flush。

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| Agent.md 缺失 | 返回错误 | 角色身份必须存在 |
| Role.md 缺失 | 状态机为空 | 无阶段转换 |
| turn_end 钩子抛错 | 不影响主流程 | 异步事件 |

## 练习与验收

1. **追踪启动流程**：从入口点击到 `turn_end` 钩子注册，画出完整调用链。
2. **模拟 turn_end**：构造事件，验证钩子执行顺序。

**验收标准**：能解释 RoleAgent 的启动和运行时流程。

## 章节收束

RoleAgent 的集成讲完了。下一节课（F43）看测试策略。
