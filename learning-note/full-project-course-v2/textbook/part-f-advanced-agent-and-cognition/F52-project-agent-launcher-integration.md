# F52：ProjectAgent 与 Launcher 的集成

## 开篇场景

F.2 讲了 `ProjectLauncher` 如何启动 ProjectAgent。这节课深入看 Launcher 和 ProjectAgent 内部模块的集成关系。

## 核心问题

**ProjectLauncher 的启动流程和 RoleAgentLauncher 有什么不同？`provisionProjectSkills` 在什么时候调用？**

## 源码精读

### 1. ProjectLauncher.launch 回顾

[packages/core/src/lib/features/services/launcher/project.ts 第 1—50 行](../../../../packages/core/src/lib/features/services/launcher/project.ts#L1)

```typescript
export class ProjectLauncher extends Launcher {
  readonly entryType = 'project' as const;

  async launch(ctx: LaunchContext): Promise<LaunchResult> {
    // 1. 加载 ProjectContext
    const projectContext = await loadProjectContext(ctx.agentBaseDir!);
    if (!projectContext) {
      return { success: false, sessionId: '', systemPrompt: '', agentType: '', baseDir: '', error: 'Agent.md not found' };
    }

    // 2. 幂等补齐技能
    await provisionProjectSkills(projectContext.workingDirectory);

    // 3. 构建 6 层 system prompt
    const systemPrompt = assembleProjectPrompt(buildProjectPromptLayers(projectContext));

    // 4. 创建会话
    const sessionId = ctx.sessionId ?? generateSessionId();
    await this.registerAgent(sessionId, ctx.projectId ?? '', {
      systemPrompt,
      agentType: 'project',
      agentBaseDir: projectContext.workingDirectory,
      isWindowBound: ctx.isWindowBound,
      llmConfig: ctx.llmConfig,
    });

    return { success: true, sessionId, systemPrompt, agentType: 'project', baseDir: projectContext.workingDirectory };
  }
}
```

和 RoleAgentLauncher 的区别：

1. 加载 `ProjectContext` 而非 `RoleContext`；
2. 调用 `provisionProjectSkills` 幂等补齐技能；
3. 构建 6 层 prompt 而非 7 层；
4. 无状态机，不注册 `turn_end` 钩子。

## 真实调用链

1. 用户点击项目卡片；
2. `ProjectLauncher.launch()` 加载 `ProjectContext`；
3. 调用 `provisionProjectSkills` 补齐技能；
4. 构建 6 层 system prompt；
5. 注册 Agent；
6. 返回 `LaunchResult`。

## 失败路径与边界

| 场景 | 会发生什么 | 原因 |
|---|---|---|
| Agent.md 缺失 | 返回错误 | 项目身份必须存在 |
| 技能补齐失败 | 继续启动 | 非关键错误 |
| business-model.json 不存在 | 进入访谈模式 | 阶段判断 |

## 练习与验收

1. **追踪启动流程**：从入口点击到 Agent 注册，画出完整调用链。
2. **比较 RoleAgent**：对比 RoleAgentLauncher 和 ProjectLauncher 的差异。

**验收标准**：能解释 ProjectAgent 的启动流程。

## 章节收束

ProjectAgent 的集成讲完了。下一节课（F53）看测试策略。
