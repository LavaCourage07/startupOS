# J36：Agent 生命周期 Hooks

## 用 Hooks 封装 Agent 的注册、查询与生命周期

Web 包在 Core 的 `usePiAgent` 之上又封装了一层更贴近业务场景的 Hooks：`useAgent` 系列负责从注册表读写 Agent，`useAgentLifecycle` 负责启动/停止 Agent 会话。

## 第一段源码：useAgentRegistry

[packages/web/src/hooks/useAgent.ts 第 26–99 行](../../../../packages/web/src/hooks/useAgent.ts#L26)：

```ts
export function useAgentRegistry(): UseAgentRegistryReturn {
  const { agents, activeAgentId, setAgent, removeAgent, updateAgent, setActiveAgent, setAgentStatus } =
    useAgentRegistryStore();

  const agentsArray = useMemo(() => Object.values(agents), [agents]);

  const activeAgent = useMemo(
    () => (activeAgentId ? agents[activeAgentId] ?? null : null),
    [activeAgentId, agents]
  );

  const registerAgent = useCallback(
    (agent: AgentObject) => {
      setAgent(agent.id, agent);
    },
    [setAgent]
  );

  const unregisterAgent = useCallback(
    (id: string) => {
      removeAgent(id);
    },
    [removeAgent]
  );

  const searchAgents = useCallback(
    (query: string): AgentObject[] => {
      if (!query) return agentsArray;
      const lowerQuery = query.toLowerCase();
      return agentsArray.filter(
        (agent) =>
          agent.name.toLowerCase().includes(lowerQuery) ||
          agent.displayName.toLowerCase().includes(lowerQuery) ||
          agent.capabilities.some((cap) => cap.toLowerCase().includes(lowerQuery))
      );
    },
    [agentsArray]
  );

  const getAgentsByType = useCallback(
    (type: AgentType): AgentObject[] => {
      return agentsArray.filter((agent) => agent.type === type);
    },
    [agentsArray]
  );

  const getAgentsByStatus = useCallback(
    (status: AgentStatus): AgentObject[] => {
      return agentsArray.filter((agent) => agent.status === status);
    },
    [agentsArray]
  );

  return {
    agents: agentsArray,
    agentMap: agents,
    activeAgent,
    registerAgent,
    unregisterAgent,
    updateAgent,
    setActiveAgent,
    setAgentStatus,
    searchAgents,
    getAgentsByType,
    getAgentsByStatus,
  };
}
```

`useAgentRegistry` 把 Zustand store 的原始接口转换成更友好的形态：

- `agents` 返回数组，方便列表渲染；
- `agentMap` 保留对象形态，方便按 ID 查找；
- `searchAgents` 按名称、显示名、能力搜索；
- `getAgentsByType` / `getAgentsByStatus` 按类型/状态过滤。

## 第二段源码：useAgent

[packages/web/src/hooks/useAgent.ts 第 108–157 行](../../../../packages/web/src/hooks/useAgent.ts#L108)：

```ts
export function useAgent(id: string): UseAgentReturn {
  const { agentMap, setAgentStatus, setActiveAgent } = useAgentRegistry();

  const agent = useMemo(() => agentMap[id] ?? null, [id, agentMap]);
  const status = useMemo(() => agent?.status ?? AgentStatus.UNREGISTERED, [agent]);
  const typeInfo = useMemo(
    () => (agent ? AGENT_TYPE_INFO[agent.type] : AGENT_TYPE_INFO[AgentType.DEVELOPER]),
    [agent]
  );

  const isRunning = status === AgentStatus.RUNNING;
  const isIdle = status === AgentStatus.IDLE;
  const isError = status === AgentStatus.ERROR;
  const isPaused = status === AgentStatus.PAUSED;

  const setStatus = useCallback(
    (newStatus: AgentStatus) => {
      if (agent) {
        setAgentStatus(agent.id, newStatus);
      }
    },
    [agent, setAgentStatus]
  );

  const activate = useCallback(() => {
    if (agent) {
      setAgentStatus(agent.id, AgentStatus.RUNNING);
      setActiveAgent(agent.id);
    }
  }, [agent, setAgentStatus, setActiveAgent]);

  const deactivate = useCallback(() => {
    if (agent) {
      setAgentStatus(agent.id, AgentStatus.IDLE);
    }
  }, [agent, setAgentStatus]);

  return {
    agent,
    status,
    typeInfo,
    isRunning,
    isIdle,
    isError,
    isPaused,
    setStatus,
    activate,
    deactivate,
  };
}
```

`useAgent(id)` 提供单个 Agent 的便捷访问：

- `agent`：对象或 null；
- `status`：当前状态，默认 `UNREGISTERED`；
- `typeInfo`：Agent 类型的元信息（图标、颜色等）；
- `isRunning` / `isIdle` / `isError` / `isPaused`：布尔派生状态；
- `setStatus` / `activate` / `deactivate`：状态变更辅助函数。

## 第三段源码：useAgentLifecycle

[packages/web/src/hooks/useAgentLifecycle.ts 第 16–51 行](../../../../packages/web/src/hooks/useAgentLifecycle.ts#L16)：

```ts
export function useAgentLifecycle(agentId: string) {
  const [status, setStatus] = useState<AgentStatus>(AgentStatus.IDLE);
  const piAgentStore = usePiAgentStore();
  const getEffectiveConfig = useSettingsStore((s) => s.getEffectiveConfig);

  const start = async (projectContext: ProjectContext) => {
    setStatus(AgentStatus.INITIALIZING);
    try {
      const llmConfig = normalizeRuntimeLLMConfig(getEffectiveConfig());
      await piAgentStore.initialize(agentId, projectContext as any, {}, llmConfig);
      setStatus(AgentStatus.RUNNING);
    } catch (error) {
      setStatus(AgentStatus.ERROR);
      throw error;
    }
  };

  const stop = async () => {
    setStatus(AgentStatus.PAUSED);
    try {
      piAgentStore.abort();
      setStatus(AgentStatus.UNREGISTERED);
    } catch (error) {
      setStatus(AgentStatus.ERROR);
      throw error;
    }
  };

  useEffect(() => {
    return () => {
      piAgentStore.destroy();
    };
  }, []);

  return { status, start, stop };
}
```

`useAgentLifecycle` 是一个更底层的生命周期 Hook：

- `start`：调用 `piAgentStore.initialize`，状态从 `IDLE` → `INITIALIZING` → `RUNNING`；
- `stop`：调用 `piAgentStore.abort`，状态先 `PAUSED` 再 `UNREGISTERED`；
- 组件卸载时调用 `piAgentStore.destroy()` 清理资源。

注意它直接操作 Core 的 `usePiAgentStore`（全局单例），而不是 `usePiAgent` Hook。这意味着它更适合用于非 React 流式会话的生命周期管理，例如项目 Agent 或后台 Agent。

## 第四段源码：useAgentSearch

[packages/web/src/hooks/useAgent.ts 第 194–210 行](../../../../packages/web/src/hooks/useAgent.ts#L194)：

```ts
export function useAgentSearch(): UseAgentSearchReturn {
  const [query, setQuery] = useState('');
  const { searchAgents } = useAgentRegistry();

  const results = useMemo(() => searchAgents(query), [query, searchAgents]);

  const hasResults = results.length > 0;
  const resultCount = results.length;

  return {
    query,
    results,
    setQuery,
    hasResults,
    resultCount,
  };
}
```

`useAgentSearch` 把搜索词状态与 `searchAgents` 组合，适合 Spotlight 或搜索框直接绑定。

## 本节小结

- `useAgentRegistry`：把 Agent 注册表 store 转换成数组/搜索/过滤友好的接口。
- `useAgent(id)`：单个 Agent 的便捷读写，包含派生状态和业务辅助函数。
- `useAgentLifecycle`：直接操作 Core `piAgentStore` 的启动/停止/清理。
- `useAgentSearch`：本地搜索词 + 注册表搜索的封装。
- 这些 Hook 都建立在 Core 类型 `AgentObject`、`AgentStatus`、`AgentType` 之上，保证 UI 层与业务类型一致。

下一节课看三个 Agent store：`agentRegistry`、`agentLauncherStore`、`agentHostStore`。
