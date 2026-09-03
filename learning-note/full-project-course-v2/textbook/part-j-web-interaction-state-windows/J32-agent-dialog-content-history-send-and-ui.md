# J32：AgentDialogContent 历史、发送与 UI

## 历史会话、自动欢迎语、工作区按钮

上节课看完 AgentDialogContent 的初始化流程，这节课看剩余部分：历史会话列表、自动启动初始消息或欢迎语、消息发送、附件、工作区按钮，以及顶部的 UI 组织。

## 第一段源码：加载历史会话

[packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx 第 154–178 行](../../../../packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx#L154)：

```ts
const loadSessionHistory = useCallback(async () => {
  setIsLoadingHistory(true);
  try {
    const result = await listAgentSessions(agentId);
    if (result.success && (result.data as { sessions?: unknown[] })?.sessions) {
      const sessions = (result.data as { sessions: Array<{ sessionId: string; createdAt: number; updatedAt: number; messageCount: number; summary?: string }> }).sessions;
      setSessionHistory(sessions.map((s) => ({
        sessionId: s.sessionId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messageCount,
        summary: s.summary,
      })));
    }
  } catch (error) {
    console.error('Failed to load session history:', error);
  } finally {
    setIsLoadingHistory(false);
  }
}, [agentId]);

useEffect(() => {
  void loadSessionHistory();
}, [loadSessionHistory]);
```

`loadSessionHistory` 调用 Core 的 `listAgentSessions(agentId)`，把返回的会话数组整理成本地状态。组件挂载时立即加载一次。

## 第二段源码：选择历史会话

[packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx 第 195–229 行](../../../../packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx#L195)：

```ts
const selectSession = useCallback(async (selectedSessionId: string) => {
  if (selectedSessionId === activeSessionId) {
    setShowHistory(false);
    return;
  }

  hasAutoStartedRef.current = true;
  const restoreToken = transitionGuardRef.current.begin(`restore:${selectedSessionId}`);
  pendingNewSessionRef.current = null;
  isInitializingSessionRef.current = null;
  setSwitchingSessionId(selectedSessionId);
  try {
    const entryType = resolvedAgentType === 'role-agent'
      ? 'role-agent'
      : resolvedAgentType === 'skill'
        ? 'skill'
        : 'agent';
    const restored = await restoreSession({
      sessionId: selectedSessionId,
      projectId: agentId,
      entryType,
      entryId: agentId,
    });
    if (!restored || !transitionGuardRef.current.isCurrent(restoreToken)) return;
    initializedSessionRef.current = selectedSessionId;
    setActiveSessionId(selectedSessionId);
    setShowHistory(false);
    setToolExecutions([]);
  } catch (error) {
    console.error('[AgentDialogContent] Failed to restore session:', error);
    await loadSessionHistory();
  } finally {
    setSwitchingSessionId((current) => current === selectedSessionId ? null : current);
  }
}, [activeSessionId, agentId, loadSessionHistory, resolvedAgentType, restoreSession]);
```

与 SkillDialog 的 `selectSession` 类似，但有一个关键区别：恢复前要先确定 `entryType`。Role Agent 用 `'role-agent'`，Skill 用 `'skill'`，其他用 `'agent'`。恢复成功后清空工具执行记录，因为旧会话的工具历史不需要再展示。

## 第三段源码：自动发送初始消息与动态欢迎语

[packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx 第 332–402 行](../../../../packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx#L332)：

```ts
useEffect(() => {
  if (
    !initialMessage?.trim()
    || !shouldAutoStartSession({
      isInitialized,
      isRestoring,
      switchingSessionId,
      hasAutoStarted: hasAutoStartedRef.current,
      messageCount: messages.length,
      isThinking,
    })
  ) return;

  hasAutoStartedRef.current = true;
  const sendInitialMessage = async () => {
    try {
      await sendMessageStream(initialMessage);
    } catch (error) {
      console.error('[AgentDialogContent] Failed to send initial message:', error);
    }
  };

  sendInitialMessage();
}, [
  initialMessage,
  isInitialized,
  isRestoring,
  isThinking,
  messages.length,
  sendMessageStream,
  switchingSessionId,
]);
```

如果外部传入了 `initialMessage`（例如通知激活时带了一条提示），Agent 初始化后会自动发送。守卫条件与 SkillDialog 相同。

如果没有 `initialMessage`，且是 `role-agent`，组件还会主动生成一段欢迎语：

```ts
useEffect(() => {
  if (
    initialMessage?.trim()
    || resolvedAgentType !== 'role-agent'
    || !shouldAutoStartSession({...})
  ) return;

  hasAutoStartedRef.current = true;

  const generateWelcome = async () => {
    try {
      await sendMessageStream(
        '你好！请根据你的人设做一段简短有趣的自我介绍。'
      );
    } catch (error) {
      console.error('[AgentDialogContent] Failed to generate welcome:', error);
    }
  };

  generateWelcome();
}, [...]);
```

这段逻辑让 Role Agent 打开时不会冷场，自动触发一段自我介绍。注意它也会把 `hasAutoStartedRef` 置为 true，因此不会重复触发。

## 第四段源码：打开 Agent 工作区

[packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx 第 474–494 行](../../../../packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx#L474)：

```ts
const handleOpenDirectory = () => {
  const windowManager = AppWindowManager.getInstance();
  windowManager.openComponentWindow(
    `workspace-agent-${agentId}`,
    `${displayName} 的工作区`,
    WorkspaceWindow,
    {
      projectId: `agent-${agentId}`,
      projectName: displayName,
      basePath: `data/agents/${agentId}`,
      entryType: resolvedAgentType as 'agent' | 'role-agent',
      entryId: agentId,
    },
    {
      position: {
        width: 1200,
        height: 800,
      },
    }
  );
};
```

点击标题栏的文件夹图标，打开该 Agent 的工作区窗口。`basePath` 直接写 `data/agents/${agentId}`，由服务端解析到实际数据目录。

## 第五段源码：消息发送与附件

[packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx 第 404–472 行](../../../../packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx#L404)：

```ts
const handleSendMessage = useCallback(
  async (content: string) => {
    setToolExecutions([]);
    if (!isInitialized || switchingSessionId || isRestoring || !content.trim()) return;
    try {
      await sendMessageStream(content);
    } catch (error) {
      console.error('[AgentDialogContent] Failed to send message:', error);
    }
  },
  [isInitialized, isRestoring, sendMessageStream, switchingSessionId]
);

const wrappedSendMessage = useCallback((content: string) => {
  if (agentUploadedFiles.length > 0) {
    const fileInfos = agentUploadedFiles.map(f => {
      if (f.path) {
        return `文件名: ${f.name}, 路径: ${f.path}`;
      }
      return f.name;
    }).join('\n');
    const fileHint = `我上传了以下文件：\n${fileInfos}\n\n请读取文件内容后，${content}`;
    setAgentUploadedFiles([]);
    handleSendMessage(fileHint);
  } else {
    handleSendMessage(content);
  }
}, [agentUploadedFiles, handleSendMessage]);
```

- 每次发送前清空 `toolExecutions`，避免旧工具记录干扰。
- 发送时检查 `isInitialized`、`switchingSessionId`、`isRestoring`。
- 附件通过 `useFileUpload` 上传到 `data/agents/${agentId}`，发送时把文件名/路径拼成提示文本。

## 本节小结

- `listAgentSessions` 拉取历史，恢复时根据 `resolvedAgentType` 选择正确的 `entryType`。
- 传入 `initialMessage` 时自动发送；未传入且为 `role-agent` 时自动生成欢迎自我介绍。
- 工作区按钮用 `AppWindowManager` 打开 `WorkspaceWindow`，`basePath` 指向 `data/agents/${agentId}`。
- 消息发送前清空工具执行记录，附件提示比 SkillDialog 更详细（包含路径）。
- 顶部 UI 展示 Agent 图标、名称、状态、导出按钮、历史会话下拉、工作区按钮。

下一节课看 `agent-dialog` 子组件：`ChatInput`、`MessageList`、`StatusIndicator`、`ToolExecutionFrame`。
