# J29：SkillDialog 会话初始化与切换

## 同一个 Skill 窗口里可以切换多个会话

`SkillDialog` 不只是打开一个 Skill 就完事，它还支持：

- 打开窗口时自动创建新会话；
- 从历史会话列表里恢复；
- 手动新建会话；
- 切换不同 Skill（Skill 下拉菜单）。

这些操作都可能在网络请求还没返回时就被用户再次点击，因此必须有一种轻量机制防止旧请求覆盖新状态。

## 第一段源码：session-transition-guard

[packages/web/src/components/os/agent-dialog/session-transition-guard.ts 第 21–48 行](../../../../packages/web/src/components/os/agent-dialog/session-transition-guard.ts#L21)：

```ts
export interface SessionTransitionToken {
  epoch: number;
  target: string;
}

export interface SessionTransitionGuard {
  begin: (target: string) => SessionTransitionToken;
  invalidate: () => void;
  isCurrent: (token: SessionTransitionToken) => boolean;
}

export function createSessionTransitionGuard(): SessionTransitionGuard {
  let epoch = 0;
  let target: string | null = null;

  return {
    begin(nextTarget) {
      epoch += 1;
      target = nextTarget;
      return { epoch, target: nextTarget };
    },
    invalidate() {
      epoch += 1;
      target = null;
    },
    isCurrent(token) {
      return token.epoch === epoch && token.target === target;
    },
  };
}
```

`session-transition-guard` 是一个闭包，维护两个私有变量：

- `epoch`：每次 `begin` 或 `invalidate` 都会自增；
- `target`：当前目标标识（例如 `initialize:skill-name:session-id` 或 `restore:session-id`）。

发起一次会话操作时先 `begin(target)` 拿到 token；操作完成后用 `isCurrent(token)` 检查当前 epoch 和目标是否仍然匹配。如果不匹配，说明用户已经切换走了，这次操作的结果要丢弃。

## 第二段源码：新建与选择历史会话

[packages/web/src/components/skills/SkillDialog.tsx 第 357–409 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L357)：

```ts
const createNewSession = useCallback(() => {
  const newSessionId = uuidv4();
  if (!currentSkill) return;
  transitionGuardRef.current.invalidate();
  pendingNewSessionRef.current = {
    target: newSessionId,
    previous: activeSessionId ?? stableSessionIdRef.current,
    skill: currentSkill,
  };
  hasAutoStartedRef.current = false;
  setSwitchingSessionId(newSessionId);
  setActiveSessionId(newSessionId);
  setShowHistory(false);
}, [activeSessionId, currentSkill]);

const selectSession = useCallback(async (selectedSessionId: string) => {
  if (
    !currentSkill
    || selectedSessionId === activeSessionId
    || selectedSessionId === runtimeSessionId
  ) {
    if (selectedSessionId === runtimeSessionId) {
      setActiveSessionId(selectedSessionId);
    }
    setShowHistory(false);
    return;
  }

  hasAutoStartedRef.current = true;
  const restoreToken = transitionGuardRef.current.begin(`restore:${selectedSessionId}`);
  pendingNewSessionRef.current = null;
  setSwitchingSessionId(selectedSessionId);
  try {
    const restored = await restoreSession({
      sessionId: selectedSessionId,
      projectId: `skill-${currentSkill}`,
      entryType: 'skill',
      entryId: currentSkill,
    });
    if (!restored || !transitionGuardRef.current.isCurrent(restoreToken)) return;
    restoredSessionIdRef.current = selectedSessionId;
    lastInitRef.current = { skill: currentSkill, session: selectedSessionId };
    setActiveSessionId(selectedSessionId);
    setShowHistory(false);
  } catch (error) {
    console.error('[SkillDialog] Failed to restore session:', error);
    await loadSessionHistory();
  } finally {
    setSwitchingSessionId((current) => current === selectedSessionId ? null : current);
  }
}, [activeSessionId, currentSkill, loadSessionHistory, restoreSession, runtimeSessionId]);
```

`createNewSession` 的关键动作：

1. 生成新的 `uuidv4()` 会话 ID；
2. `invalidate()` 让之前所有进行中的 token 失效；
3. 记录 `pendingNewSessionRef`，包含目标会话、上一个会话、当前技能；
4. 重置 `hasAutoStartedRef`，让新会话可以自动发送初始消息；
5. 更新 `activeSessionId`，触发初始化 useEffect。

`selectSession` 的关键动作：

1. 如果选中的就是当前已激活会话，直接返回；
2. `begin('restore:sessionId')` 拿到新的 restore token；
3. 调用 `restoreSession` 恢复历史消息；
4. 恢复成功后检查 token 是否仍有效；
5. 用 `restoredSessionIdRef` 和 `lastInitRef` 避免重复初始化。

## 第三段源码：初始化 useEffect

[packages/web/src/components/skills/SkillDialog.tsx 第 412–535 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L412)：

```ts
useEffect(() => {
  console.log('[SkillDialog] useEffect triggered:', { currentSkill, activeSessionId });

  if (!currentSkill) {
    console.log('[SkillDialog] No currentSkill, skipping init');
    return;
  }

  const init = async () => {
    const effectiveSessionId = activeSessionId || currentStableSessionId;
    if (restoredSessionIdRef.current === effectiveSessionId) {
      restoredSessionIdRef.current = null;
      return;
    }

    if (lastInitRef.current.skill === currentSkill && lastInitRef.current.session === effectiveSessionId) {
      console.log('[SkillDialog] Skill+Session already initialized, skipping');
      return;
    }
    lastInitRef.current = { skill: currentSkill, session: effectiveSessionId };
    const initializationToken = transitionGuardRef.current.begin(
      `initialize:${currentSkill}:${effectiveSessionId}`,
    );

    let skillData = skillContentCacheRef.current.get(currentSkill);

    if (!skillData) {
      try {
        skillData = await loadSkillContent(currentSkill);
        if (externalSkillContent) {
          skillData = { ...skillData, content: externalSkillContent };
        }
        skillContentCacheRef.current.set(currentSkill, skillData);
      } catch (error) {
        console.error(`[SkillDialog] Failed to load skill content for: ${currentSkill}`, error);
        skillData = {
          content: externalSkillContent ?? '',
          baseDir: undefined,
          workingDir: undefined,
          outputDir: undefined,
          systemManaged: true,
        };
        skillContentCacheRef.current.set(currentSkill, skillData);
      }
    }
    setCurrentSkillSystemManaged(skillData.systemManaged);

    const content = skillData?.content ?? '';
    const skillDir = skillData?.baseDir;
    const agentWorkDir = skillData?.workingDir ?? skillData?.outputDir ?? skillDir;
    const outputDir = skillData?.outputDir;
    currentSkillDirRef.current = agentWorkDir ?? skillDir;
    const systemPrompt = buildSkillSystemPrompt(currentSkill, content, skillDir, agentWorkDir, outputDir);

    const llmConfig = normalizeRuntimeLLMConfig(getEffectiveConfig());

    try {
      await initialize(
        effectiveSessionId,
        {
          projectId: `skill-${currentSkill}`,
          projectName: `技能: ${currentSkill}`,
        },
        {
          agentType: 'skill',
          systemPrompt,
          ...(agentWorkDir && { agentBaseDir: agentWorkDir }),
          ...(outputDir && { outputDir }),
        },
        llmConfig
      );
      if (!transitionGuardRef.current.isCurrent(initializationToken)) {
        return;
      }
      setActiveSessionId(effectiveSessionId);
      const pendingNewSession = pendingNewSessionRef.current;
      if (
        pendingNewSession?.target === effectiveSessionId
        && pendingNewSession.skill === currentSkill
      ) {
        pendingNewSessionRef.current = null;
        setSwitchingSessionId((current) => current === effectiveSessionId ? null : current);
      }
    } catch (error) {
      if (!transitionGuardRef.current.isCurrent(initializationToken)) {
        return;
      }
      console.error(`[SkillDialog] Failed to initialize skill session: ${currentSkill}`, error);
      const pendingNewSession = pendingNewSessionRef.current;
      if (
        pendingNewSession?.target === effectiveSessionId
        && pendingNewSession.skill === currentSkill
      ) {
        pendingNewSessionRef.current = null;
        lastInitRef.current = {
          skill: currentSkill,
          session: pendingNewSession.previous ?? undefined,
        };
        setActiveSessionId(pendingNewSession.previous);
        setSwitchingSessionId((current) => current === effectiveSessionId ? null : current);
      }
    }
  };

  init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentSkill, activeSessionId]);
```

这个 `useEffect` 是 SkillDialog 的核心：

1. 只在 `currentSkill` 或 `activeSessionId` 变化时触发。
2. 用 `lastInitRef` 避免对同一 skill/session 重复初始化。
3. 优先从 `skillContentCacheRef` 读缓存，没有则调用 `loadSkillContent`。
4. 计算 `agentWorkDir`：优先 `workingDir`，其次 `outputDir`，最后 `skillDir`。
5. 调用 `buildSkillSystemPrompt` 生成 prompt。
6. 调用 `usePiAgent.initialize(sessionId, projectContext, agentConfig, llmConfig)`。
7. 初始化成功后清除 pending 状态；失败时回退到 previous session。

注意这里依赖数组只写了 `[currentSkill, activeSessionId]`，并用 `// eslint-disable-next-line` 禁用 exhaustive-deps。原因是 `init` 内部用到了很多 ref 和函数，但开发者明确希望只有 skill 或 session 变化才触发初始化，避免 `externalSkillContent`、`getEffectiveConfig` 等变化导致意外重初始化。

## 第四段源码：切换 Skill 时重置状态

[packages/web/src/components/skills/SkillDialog.tsx 第 642–653 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L642)：

```ts
const handleSkillSelect = (skillName: string) => {
  transitionGuardRef.current.invalidate();
  pendingNewSessionRef.current = null;
  setSwitchingSessionId(null);
  setCurrentSkillSystemManaged(null);
  setActiveSessionId(null);
  hasAutoStartedRef.current = false;
  lastInitRef.current = { skill: undefined, session: undefined };
  setCurrentSkill(skillName);
  setShowSkillList(false);
  onSkillChange?.(skillName);
};
```

切换 Skill 时，所有会话相关状态都要重置：

- `invalidate()` 取消之前所有进行中的 token；
- 清空 `pendingNewSessionRef`；
- 重置 `activeSessionId`，让初始化 effect 用 `currentStableSessionId` 重新初始化；
- 重置 `lastInitRef`，确保新 Skill 能重新加载内容。

## 本节小结

- `createSessionTransitionGuard` 用 `epoch + target` 防止并发切换导致的旧结果覆盖。
- `createNewSession` 生成新会话 ID、invalidate 旧 token、记录 pending。
- `selectSession` 用 `restoreSession` 恢复历史，恢复后检查 token 是否仍有效。
- 初始化 useEffect 只在 `currentSkill` / `activeSessionId` 变化时触发，并用 `lastInitRef` 去重。
- 切换 Skill 时重置所有会话状态，保证新 Skill 重新加载内容和 prompt。

下一节课看消息发送、自动启动、附件处理，以及 SkillDialog 的 UI 结构。
