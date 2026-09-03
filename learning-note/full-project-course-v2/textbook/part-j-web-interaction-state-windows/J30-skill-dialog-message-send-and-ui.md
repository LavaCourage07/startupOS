# J30：SkillDialog 消息发送、附件与 UI

## 发送一条消息不只是调用 sendMessageStream

SkillDialog 的消息发送要处理：自动启动初始消息、附件拼接、执行后触发技能进化、停止生成、问题选项点击。这节课看这些细节以及顶部 UI 如何组织。

## 第一段源码：自动发送初始消息

[packages/web/src/components/skills/SkillDialog.tsx 第 537–571 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L537)：

```ts
useEffect(() => {
  if (
    !initialMessage
    || !shouldAutoStartSession({
      isInitialized,
      isRestoring,
      switchingSessionId,
      hasAutoStarted: hasAutoStartedRef.current,
      messageCount: piMessages?.length ?? 0,
      isThinking,
    })
  ) {
    return;
  }

  hasAutoStartedRef.current = true;
  (async () => {
    try {
      await sendMessageStream(initialMessage);
    } catch (error) {
      console.error('[SkillDialog] Failed to send initial message:', error);
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  initialMessage,
  isInitialized,
  isRestoring,
  isThinking,
  piMessages?.length,
  sendMessageStream,
  switchingSessionId,
]);
```

自动发送需要同时满足 `shouldAutoStartSession` 的六个条件：

1. `isInitialized` 为 true；
2. `isRestoring` 为 false；
3. `switchingSessionId` 为空；
4. `hasAutoStarted` 为 false；
5. `messageCount === 0`；
6. `isThinking` 为 false。

一旦发送，`hasAutoStartedRef.current = true` 防止重复发送。注意依赖数组里用了 `piMessages?.length` 而不是 `piMessages`，减少不必要触发。

## 第二段源码：消息转换与跳过初始消息

[packages/web/src/components/skills/SkillDialog.tsx 第 573–592 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L573)：

```ts
const skillMessages = useMemo<SkillMessage[]>(() => {
  return (piMessages ?? []).map((msg: { role: string; content: string; timestamp?: number }) => ({
    role: (msg.role === 'tool' || msg.role === 'toolResult') ? 'system' : msg.role as 'user' | 'assistant' | 'system',
    content: msg.content || '',
    timestamp: msg.timestamp || Date.now(),
    isStreaming: (msg as { isStreaming?: boolean }).isStreaming,
  }));
}, [piMessages]);

const initialMessageIndex = useMemo(() => {
  if (!initialMessage) return -1;
  for (let i = 0; i < skillMessages.length; i++) {
    if (skillMessages[i]?.role === 'user' && skillMessages[i]?.content === initialMessage) {
      return i;
    }
  }
  return -1;
}, [skillMessages, initialMessage]);
```

- `skillMessages` 把 `tool` / `toolResult` 角色映射成 `system`，避免 UI 把它们当成普通消息展示。
- `initialMessageIndex` 找出自动发送的初始消息在列表中的位置，渲染时跳过它，避免用户看到一条“自己没发”的消息孤零零显示。

## 第三段源码：发送消息与技能进化

[packages/web/src/components/skills/SkillDialog.tsx 第 595–630 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L595)：

```ts
const handleSendMessage = useCallback(async (content: string) => {
  if (!content.trim() || isThinking || isRestoring || switchingSessionId || !isInitialized) return;

  const startTime = Date.now();

  if (onMessage) {
    await onMessage(content);
  } else {
    let success = true;
    try {
      await sendMessageStream(content);
    } catch (error) {
      success = false;
      console.error('Failed to send message:', error);
    }

    const skillDir = currentSkillDirRef.current;
    const sessionId = activeSessionId || stableSessionIdRef.current;
    if (skillDir && currentSkill) {
      runSkillEvolution({
        skillDir,
        skillName: currentSkill,
        run: {
          timestamp: new Date().toISOString(),
          sessionId,
          success,
          turnCount: (piMessages?.length ?? 0) + 1,
          duration: Date.now() - startTime,
        },
      }).catch(() => {}); // fire-and-forget
    }
  }
}, [isThinking, isRestoring, switchingSessionId, isInitialized, onMessage, sendMessageStream, currentSkill, activeSessionId, piMessages]);
```

这里有两个分支：

1. 如果外部传入 `onMessage`，说明宿主想自己处理发送逻辑，SkillDialog 只透传内容；
2. 否则使用 `sendMessageStream` 走 Pi Agent 流式发送。

发送后还会 fire-and-forget 调用 `runSkillEvolution`，把本次运行的结果（时间、会话 ID、成功/失败、轮数、耗时）写入技能目录，用于后续技能自我进化。

## 第四段源码：附件与输入栏

[packages/web/src/components/skills/SkillDialog.tsx 第 727–748 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L727)：

```ts
const wrappedSendMessage = useCallback((content: string) => {
  if (skillUploadedFiles.length > 0) {
    const fileNames = skillUploadedFiles.map(f => f.name).join('、');
    const fileHint = `[附件: ${fileNames}]\n${content}`;
    setSkillUploadedFiles([]);
    handleSendMessage(fileHint);
  } else {
    handleSendMessage(content);
  }
}, [skillUploadedFiles, handleSendMessage]);

const handleUpload = useFileUpload({
  basePath: () => {
    if (!currentSkill) return null;
    const skillData = skillContentCacheRef.current.get(currentSkill);
    return skillData?.outputDir ?? skillData?.workingDir ?? currentSkillDirRef.current ?? skillData?.baseDir ?? null;
  },
  onUploaded: handleSkillFileUploaded,
  onError: handleSkillFileError,
  onStateChange: handleSkillUploadStateChange,
});
```

- 附件上传使用共享 Hook `useFileUpload`，`basePath` 是一个函数，动态根据当前 Skill 的 `outputDir` / `workingDir` / `baseDir` 决定上传到哪个目录。
- 发送时如果有附件，把文件名拼成 `[附件: name1、name2]\ncontent` 的形式一起发送给 Agent。

## 第五段源码：打开技能目录

[packages/web/src/components/skills/SkillDialog.tsx 第 662–697 行](../../../../packages/web/src/components/skills/SkillDialog.tsx#L662)：

```ts
const handleOpenDirectory = useCallback(async () => {
  if (!currentSkill) return;

  const skillBaseDir = skillContentCacheRef.current.get(currentSkill)?.baseDir;

  let basePath = skillBaseDir;
  if (basePath && basePath.startsWith('/')) {
    const match = basePath.match(/originos\/(.+)$/);
    if (match) {
      basePath = match[1];
    }
  }

  const windowManager = AppWindowManager.getInstance();
  windowManager.openComponentWindow(
    `workspace-skill-${currentSkill}`,
    `技能目录: ${displaySkillName}`,
    WorkspaceWindow,
    {
      projectId: `skill-${currentSkill}`,
      projectName: displaySkillName,
      basePath,
      entryType: 'skill' as const,
      entryId: currentSkill,
    },
    {
      position: {
        width: 1200,
        height: 800,
      },
    }
  );
}, [currentSkill, displaySkillName]);
```

点击标题栏的文件夹图标时，系统用 `AppWindowManager` 打开一个 `WorkspaceWindow`，把 Skill 的工作区展示出来。这里做了一个路径转换：如果 `basePath` 是绝对路径，就尝试截取出 `originos/...` 之后的相对路径，交给服务端解析。

## 本节小结

- 初始消息通过 `shouldAutoStartSession` 守卫，满足 6 个条件后才发送，并用 `hasAutoStartedRef` 去重。
- `skillMessages` 把 `tool` / `toolResult` 映射为 `system`，并计算 `initialMessageIndex` 跳过自动发送的消息。
- `handleSendMessage` 支持外部 `onMessage` 覆盖，否则走 `sendMessageStream` 并 fire-and-forget 触发 `runSkillEvolution`。
- 附件通过 `useFileUpload` 上传到 Skill 目录，发送时拼接成提示文本。
- 标题栏提供 Skill 切换下拉、历史会话、导出、打开工作区、关闭等功能。

下一节课转到 Agent 会话的主组件 `AgentDialogContent`，看 Agent 如何通过 Launcher API 初始化。
