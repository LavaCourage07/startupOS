# J31：AgentDialogContent 结构与 Launcher 初始化

## Agent 会话不是直接调用 usePiAgent

与 SkillDialog 自己加载 SKILL.md 不同，AgentDialogContent 通过 Launcher API 初始化 Agent。Launcher 负责根据 `entryType` 和 `entryId` 找到对应的 Agent 定义，生成 system prompt 和工作目录，然后 AgentDialogContent 再用 `usePiAgent.initialize` 启动会话。

## 第一段源码：组件 Props 与状态定义

[packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx 第 36–82 行](../../../../packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx#L36)：

```ts
interface SessionHistoryItem {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  summary?: string;
}

interface AgentDialogContentProps {
  agentId: string;
  agentName?: string;
  agentType?: string;
  initialMessage?: string;
}

export default function AgentDialogContent({ agentId, agentName, agentType: propAgentType, initialMessage }: AgentDialogContentProps) {
  const agents = useAgentRegistryStore((state) => state.agents);
  const agent = agents ? Object.values(agents).filter(Boolean).find((a) => a?.id === agentId) : undefined;
  const setAgentStatus = useAgentRegistryStore((state) => state.setAgentStatus);

  const displayName = agentName || agent?.displayName || agent?.name || agentId;
  const resolvedAgentType = propAgentType || agent?.type || 'role-agent';
  let exportEntryType: 'agent' | 'role-agent' | null = 'agent';
  if (resolvedAgentType === 'role-agent') {
    exportEntryType = 'role-agent';
  } else if (resolvedAgentType === 'project' || resolvedAgentType === 'skill') {
    exportEntryType = null;
  }
```

组件接收 `agentId`、`agentName`、`agentType`、`initialMessage`。它从 `agentRegistry` 查找 Agent 元数据，解析显示名和类型，并决定导出按钮的类型。

## 第二段源码：会话 ID 与 transition guard

[packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx 第 66–83 行](../../../../packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx#L66)：

```ts
const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
const [showHistory, setShowHistory] = useState(false);
const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
const [isLoadingHistory, setIsLoadingHistory] = useState(false);
const [switchingSessionId, setSwitchingSessionId] = useState<string | null>(null);
const transitionGuardRef = useRef(createSessionTransitionGuard());
const pendingNewSessionRef = useRef<{ target: string; previous: string | null } | null>(null);
const initializedSessionRef = useRef<string | null>(null);
const isInitializingSessionRef = useRef<string | null>(null);

const fallbackSessionIdRef = useRef<string | null>(null);
if (!fallbackSessionIdRef.current) {
  fallbackSessionIdRef.current = `agent-${agentId}-${Date.now()}`;
}
const sessionId = activeSessionId || fallbackSessionIdRef.current;
```

与 SkillDialog 类似，AgentDialogContent 也维护：

- `activeSessionId`：用户选择或新建的历史会话；
- `fallbackSessionIdRef`：组件创建时生成的稳定会话 ID；
- `transitionGuardRef`：竞态守卫；
- `pendingNewSessionRef` / `initializedSessionRef` / `isInitializingSessionRef`：跟踪初始化状态。

会话 ID 优先级：`activeSessionId` > `fallbackSessionId`。fallback ID 用 `agent-${agentId}-${Date.now()}` 生成，可读性比 `uuidv4()` 更好。

## 第三段源码：工具执行订阅

[packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx 第 103–132 行](../../../../packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx#L103)：

```ts
const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
const toolCallIdRef = useRef(0);

useEffect(() => {
  const unsubscribe = subscribe?.((event: any) => {
    if (event.type === 'tool_execution_start') {
      const id = event.toolCallId || `tool-${Date.now()}-${++toolCallIdRef.current}`;
      setToolExecutions(prev => [...prev, {
        id,
        name: event.toolName,
        status: 'running',
        args: event.args,
        timestamp: Date.now(),
      }]);
    } else if (event.type === 'tool_execution_end') {
      setToolExecutions(prev => {
        const runningTool = event.toolCallId
          ? prev.find(t => t.id === event.toolCallId)
          : [...prev].reverse().find(t => t.name === event.toolName && t.status === 'running');
        if (!runningTool) return prev;
        return prev.map(t =>
          t.id === runningTool.id
            ? { ...t, status: event.isError ? 'error' as const : 'completed' as const, result: event.result }
            : t
        );
      });
    }
  });
  return unsubscribe || undefined;
}, [subscribe]);
```

`usePiAgent` 提供 `subscribe` 方法，用于监听底层 Agent 事件。这里监听两类事件：

- `tool_execution_start`：新增一条运行中的工具执行记录；
- `tool_execution_end`：把对应的运行中记录标记为完成或错误。

如果没有 `toolCallId`，就按名称从后往前找最近一条运行中的记录匹配。

## 第四段源码：通过 Launcher API 初始化

[packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx 第 249–330 行](../../../../packages/web/src/components/os/agent-dialog/AgentDialogContent.tsx#L249)：

```ts
useEffect(() => {
  if (
    !sessionId
    || isInitializingSessionRef.current === sessionId
    || (isInitialized && initializedSessionRef.current === sessionId)
  ) return;
  isInitializingSessionRef.current = sessionId;
  const initializationToken = transitionGuardRef.current.begin(`initialize:${sessionId}`);

  const initAgent = async () => {
    try {
      setAgentStatus(agentId, AgentStatus.RUNNING);

      const entryTypeMap: Record<string, EntryType> = {
        'role-agent': 'role-agent',
        'assistant': 'agent',
        'project': 'project',
        'skill': 'skill',
      };
      const entryType = entryTypeMap[resolvedAgentType] || 'role-agent';

      const launchResult = await launchEntry({
        entryType,
        entryId: agentId,
      });

      if (!launchResult.success) {
        throw new Error(launchResult.error?.message || 'Failed to launch agent');
      }

      const { systemPrompt = '', baseDir } = launchResult.data as { systemPrompt?: string; baseDir?: string };

      const llmConfig = normalizeRuntimeLLMConfig(getEffectiveConfig());

      await initialize(
        sessionId,
        {
          projectId: agentId,
          projectName: displayName,
        },
        {
          agentType: resolvedAgentType,
          systemPrompt,
          ...(baseDir ? { agentBaseDir: baseDir } : {}),
        },
        llmConfig
      );
      if (!transitionGuardRef.current.isCurrent(initializationToken)) {
        return;
      }
      initializedSessionRef.current = sessionId;
      setActiveSessionId(sessionId);
      // ...
    } catch (error) {
      // ...
    }
  };

  initAgent();
}, [sessionId, isInitialized, initialize, setAgentStatus, agentId, resolvedAgentType, displayName, getEffectiveConfig]);
```

这是 AgentDialogContent 与 SkillDialog 最大的不同之处：

1. 先调用 `launchEntry({ entryType, entryId })`；
2. Launcher 返回 `systemPrompt` 和 `baseDir`；
3. 再调用 `usePiAgent.initialize`，把 `systemPrompt` 和 `agentBaseDir` 传进去。

`entryTypeMap` 把组件内部的 `resolvedAgentType` 映射成 Launcher 能识别的 `EntryType`：

- `role-agent` → `'role-agent'`
- `assistant` → `'agent'`
- `project` / `skill` → 对应类型

## 本节小结

- AgentDialogContent 从 `agentRegistry` 解析 Agent 元数据，决定显示名和导出类型。
- 用 `transitionGuard` + 多个 ref 管理初始化、切换、新建会话的并发状态。
- 通过 `subscribe` 监听 `tool_execution_start/end` 事件，维护工具执行列表。
- 核心初始化流程：`launchEntry` → 取 `systemPrompt` / `baseDir` → `initialize()`。
- `entryTypeMap` 把 UI 层类型映射为 Launcher 的 `EntryType`。

下一节课看 AgentDialogContent 的历史会话切换、自动启动、消息发送、工作区按钮等剩余逻辑。
