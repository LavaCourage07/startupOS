# J50：视图协调、本地 Agent 与 Agent 查询 Hook

## 三个不同层级的 Hook

上节课讲了通用 Hook（右键菜单、网格、响应式、快捷键）。这节课讲三个更专业的 Hook：

1. `useViewReconciler`：封装 `ViewReconcilerAdapter`，管理视图的创建/启动/暂停/销毁生命周期。
2. `useLocalAgent`：Electron 本地 Agent 的启动/停止/消息/事件订阅。
3. `agent.ts`：Agent 注册表的查询 Hook（`useAgentRegistry`、`useAgent`、`useAgentType`、`useAgentSearch`）。

最后读 `hooks/index.ts`，看 Web 包的 Hook 导出结构。

## 第一段源码：useViewReconciler 的返回值接口

[packages/web/src/hooks/useViewReconciler.ts 第 13–48 行](../../../../packages/web/src/hooks/useViewReconciler.ts#L13)：

```ts
export interface UseViewReconcilerOptions {
  windowId: string;
  content: AppWindowContent;
  containerId?: string;
  context?: Record<string, unknown>;
  autoCreate?: boolean;
  lifecycleCallbacks?: Partial<ViewLifecycleCallbacks>;
}

export interface UseViewReconcilerReturn {
  // 状态
  viewId: string | null;
  isCreated: boolean;
  isLoading: boolean;
  error: string | null;

  // 视图操作
  createView: () => string | null;
  startView: () => void;
  pauseView: () => void;
  resumeView: (isActive?: boolean) => void;
  stopView: () => void;
  destroyView: () => void;
  refreshView: () => void;

  // 通信
  sendMessage: (type: string, payload: any) => void;
  broadcast: (type: string, payload: any) => void;
  onMessage: (type: string, callback: (payload: any) => void) => void;
  offMessage: (type: string) => void;

  // 工具
  isModulesAvailable: () => boolean;
  getViewIds: () => string[];
  hasView: (viewId: string) => boolean;
}
```

`useViewReconciler` 的返回值分四组：

| 分组 | 字段 | 说明 |
| --- | --- | --- |
| 状态 | `viewId`、`isCreated`、`isLoading`、`error` | 视图当前状态 |
| 视图操作 | `createView`/`startView`/`pauseView`/`resumeView`/`stopView`/`destroyView`/`refreshView` | 生命周期控制 |
| 通信 | `sendMessage`/`broadcast`/`onMessage`/`offMessage` | 与视图的双向消息 |
| 工具 | `isModulesAvailable`/`getViewIds`/`hasView` | 查询适配器和视图状态 |

> 这个 Hook 是 `ViewReconcilerAdapter` 的 React 封装。适配器是单例服务，Hook 把它和 React 组件的生命周期绑定。

## 第二段源码：useViewReconciler 的自动创建与清理

[packages/web/src/hooks/useViewReconciler.ts 第 227–248 行](../../../../packages/web/src/hooks/useViewReconciler.ts#L227)：

```ts
  // 自动创建视图
  useEffect(() => {
    if (autoCreate && !isCreated && !isLoading) {
      createView();
    }
  }, [autoCreate, isCreated, isLoading, createView]);

  // 清理
  useEffect(() => {
    return () => {
      // 销毁视图
      if (viewId) {
        viewReconcilerAdapter.destroyView(viewId);
      }

      // 清理所有消息监听器
      messageListenersRef.current.forEach((_, type) => {
        viewReconcilerAdapter.offMessage(type);
      });
      messageListenersRef.current.clear();
    };
  }, [viewId]);
```

两个 `useEffect` 管理视图的自动生命周期：

1. **自动创建**：`autoCreate` 为 true（默认）且视图未创建、未在加载中时，自动调用 `createView`。
2. **清理**：组件卸载时销毁视图，并清理所有消息监听器。

> `messageListenersRef` 用 `useRef` 而不是 `useState` 存储监听器 Map，因为监听器的变化不需要触发重新渲染。

## 第三段源码：useViewReconciler 的视图类型过滤

[packages/web/src/hooks/useViewReconciler.ts 第 95–104 行](../../../../packages/web/src/hooks/useViewReconciler.ts#L95)：

```ts
  const createView = useCallback((): string | null => {
    // 只处理需要 ViewReconciler 的类型
    if (
      content.type !== 'view' &&
      content.type !== 'microapp' &&
      content.type !== 'qiankun'
    ) {
      console.warn('useViewReconciler: Content type does not require ViewReconciler');
      return null;
    }
```

`createView` 只处理三种内容类型：

- `view`：普通视图；
- `microapp`：微前端应用；
- `qiankun`：qiankun 微前端框架。

其他类型（如 `component`、`iframe`）不需要 ViewReconciler 管理，直接返回 `null`。

> 这说明 ViewReconciler 是专门为微前端/外部视图设计的，不管理 React 组件类型的窗口内容。

## 第四段源码：useLocalAgent 的 Electron 绑定

[packages/web/src/hooks/useLocalAgent.ts 第 15–50 行](../../../../packages/web/src/hooks/useLocalAgent.ts#L15)：

```ts
export function useLocalAgent() {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    setIsAvailable(isElectron());
  }, []);

  const startAgent = useCallback(async (config: LocalAgentConfig) => {
    return startLocalAgent(config);
  }, []);

  const stopAgent = useCallback(async (agentId: string) => {
    await stopLocalAgent(agentId);
  }, []);

  const sendMessage = useCallback(async (agentId: string, message: string) => {
    await sendLocalAgentMessage(agentId, message);
  }, []);

  const abortAgent = useCallback(async (agentId: string) => {
    await abortLocalAgent(agentId);
  }, []);

  const onEvent = useCallback((listener: (payload: LocalAgentEventEnvelope) => void) => {
    return subscribeToLocalAgentEvents(listener);
  }, []);

  return {
    isAvailable,
    startAgent,
    stopAgent,
    sendMessage,
    abortAgent,
    onEvent,
  };
}
```

`useLocalAgent` 是 Core 层 `local-agent` 模块的薄封装：

- `isAvailable`：检测是否在 Electron 环境中；
- `startAgent`/`stopAgent`/`sendMessage`/`abortAgent`：直接调用 Core 的对应函数；
- `onEvent`：订阅本地 Agent 事件流。

> 这个 Hook 在 Web 版本中 `isAvailable` 始终为 `false`，只有 Electron 桌面版才能使用本地 Agent。

## 第五段源码：useAgentRegistry 的查询辅助

[packages/web/src/hooks/agent.ts 第 35–73 行](../../../../packages/web/src/hooks/agent.ts#L35)：

```ts
export function useAgentRegistry(): UseAgentRegistryReturn {
  const state = useAgentRegistryStore();
  const agents = useMemo(() => selectAgents(state), [state]);
  const activeAgent = useMemo(() => selectAgent(state.activeAgentId || '')(state), [state]);

  const getAgentsByType = useCallback((type: AgentType) => {
    return agents.filter(agent => agent.type === type);
  }, [agents]);

  const getAgentsByStatus = useCallback((status: AgentStatus) => {
    return selectAgentsByStatus(status)(state);
  }, [state]);

  const searchAgents = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return agents.filter(agent =>
      agent.displayName.toLowerCase().includes(lowerQuery) ||
      agent.name.toLowerCase().includes(lowerQuery) ||
      agent.capabilities.some(cap => cap.toLowerCase().includes(lowerQuery))
    );
  }, [agents]);

  return {
    agents,
    agentMap: state.agents,
    activeAgentId: state.activeAgentId,
    activeAgent,
    setAgent: state.setAgent,
    removeAgent: state.removeAgent,
    updateAgent: state.updateAgent,
    setAgentStatus: state.setAgentStatus,
    setActiveAgent: state.setActiveAgent,
    bulkSetAgents: state.bulkSetAgents,
    clearAll: state.clearAll,
    getAgentsByType,
    getAgentsByStatus,
    searchAgents,
  };
}
```

`useAgentRegistry` 是 Agent 注册表的完整查询接口：

- `agents`：所有 Agent 列表（用 `useMemo` 缓存）；
- `activeAgent`：当前激活的 Agent；
- `getAgentsByType`：按类型过滤；
- `getAgentsByStatus`：按状态过滤；
- `searchAgents`：按名称/显示名/能力搜索。

搜索逻辑匹配三个字段：`displayName`、`name`、`capabilities`（数组，逐项匹配）。

## 第六段源码：useAgent 的单个 Agent 查询

[packages/web/src/hooks/agent.ts 第 91–129 行](../../../../packages/web/src/hooks/agent.ts#L91)：

```ts
export function useAgent(id: string | null): UseAgentReturn {
  const agent = useAgentRegistryStore(state => state.agents[id || ''] || null);
  const setAgentStatus = useAgentRegistryStore(state => state.setAgentStatus);

  const typeInfo = useMemo(() =>
    agent ? AGENT_TYPE_INFO[agent.type] : {} as AgentTypeInfo,
    [agent]
  );

  const statusIcon = useMemo(() => 
    agent ? AGENT_STATUS_ICON[agent.status] : '',
    [agent]
  );

  const statusColor = useMemo(() => 
    agent ? AGENT_STATUS_COLOR[agent.status] : '#9CA3AF',
    [agent]
  );

  const setStatus = useCallback((status: AgentStatus) => {
    if (agent) {
      setAgentStatus(agent.id, status);
    }
  }, [agent, setAgentStatus]);

  return {
    agent,
    status: agent?.status || ('unregistered' as AgentStatus),
    typeInfo,
    isRunning: agent?.status === ('running' as AgentStatus) || false,
    isIdle: agent?.status === ('idle' as AgentStatus) || false,
    isError: agent?.status === ('error' as AgentStatus) || false,
    isPaused: agent?.status === ('paused' as AgentStatus) || false,
    isUnregistered: agent?.status === ('unregistered' as AgentStatus) || false,
    statusIcon,
    statusColor,
    setStatus,
  };
}
```

`useAgent` 查询单个 Agent 的状态和元数据：

- `agent`：Agent 对象；
- `status`：当前状态，不存在时默认 `'unregistered'`；
- `typeInfo`：类型信息（图标、颜色、能力列表）；
- `isRunning`/`isIdle`/`isError`/`isPaused`/`isUnregistered`：状态布尔值；
- `statusIcon`/`statusColor`：状态对应的图标和颜色。

> `useAgentRegistryStore(state => state.agents[id || ''] || null)` 这种选择器模式只订阅单个 Agent 的变化，不会因为其他 Agent 变化而触发重新渲染。

## 第七段源码：useAgentSearch 的搜索状态

[packages/web/src/hooks/agent.ts 第 177–201 行](../../../../packages/web/src/hooks/agent.ts#L177)：

```ts
export function useAgentSearch(): UseAgentSearchReturn {
  const [query, setQuery] = useState('');
  const agents = useAgentRegistryStore(state => selectAgents(state));

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return agents.filter(agent =>
      agent.displayName.toLowerCase().includes(lowerQuery) ||
      agent.name.toLowerCase().includes(lowerQuery) ||
      agent.capabilities.some(cap => cap.toLowerCase().includes(lowerQuery))
    );
  }, [query, agents]);

  const hasResults = results.length > 0;
  const resultCount = results.length;

  return { query, results, setQuery, hasResults, resultCount };
}
```

`useAgentSearch` 封装了搜索框的状态和结果：

- `query`/`setQuery`：搜索关键词；
- `results`：过滤后的 Agent 列表；
- `hasResults`/`resultCount`：结果数量和是否有结果。

搜索逻辑和 `useAgentRegistry.searchAgents` 一样，但 `useAgentSearch` 把 `query` 状态也封装了，适合直接绑定到搜索输入框。

## 第八段源码：hooks/index.ts 的导出结构

[packages/web/src/hooks/index.ts 第 1–33 行](../../../../packages/web/src/hooks/index.ts#L1)：

```ts
// OS.9: 应用窗口系统
export { useAppWindow } from './useAppWindow';
export type { UseAppWindowOptions, UseAppWindowReturn } from './useAppWindow';

export { useAppWindowManager } from './useAppWindowManager';
export type { UseAppWindowManagerReturn } from './useAppWindowManager';

export { useViewReconciler } from './useViewReconciler';
export type { UseViewReconcilerOptions, UseViewReconcilerReturn } from './useViewReconciler';

// Agent hooks
export { useAgent } from './useAgent';
export { useAgentLifecycle } from './useAgentLifecycle';
export { useAgentLauncher } from './useAgentLauncher';

// Desktop hooks
export { useDesktopGrid } from './useDesktopGrid';
export { useResponsive } from './useResponsive';
export { useContextMenu } from './useContextMenu';
export { useDockContextMenu } from './useDockContextMenu';
export { useDockIconAnimation } from './useDockIconAnimation';

// Spotlight hooks
export { useSpotlight } from './useSpotlight';
export { useSpotlightSearch } from './useSpotlightSearch';

// UI hooks
export { useGlobalShortcut } from './useGlobalShortcut';
export { useAcrylic } from './useAcrylic';
```

`hooks/index.ts` 按功能分组导出所有 Hook：

| 分组 | Hook | 说明 |
| --- | --- | --- |
| 窗口系统 | `useAppWindow`、`useAppWindowManager`、`useViewReconciler` | 窗口实例、管理器、视图协调 |
| Agent | `useAgent`、`useAgentLifecycle`、`useAgentLauncher` | Agent 查询、生命周期、启动器 |
| Desktop | `useDesktopGrid`、`useResponsive`、`useContextMenu`、`useDockContextMenu`、`useDockIconAnimation` | 桌面网格、响应式、右键菜单、Dock |
| Spotlight | `useSpotlight`、`useSpotlightSearch` | Spotlight 开关和搜索 |
| UI | `useGlobalShortcut`、`useAcrylic` | 全局快捷键、亚克力效果 |

> 注意 `agent.ts` 里的 `useAgentRegistry`、`useAgentType`、`useAgentSearch` 没有在 `index.ts` 里导出。这说明它们可能只在 `agent.ts` 内部使用，或者通过其他路径导出。

## 本节小结

- `useViewReconciler` 封装 `ViewReconcilerAdapter`，管理视图的创建/启动/暂停/销毁/刷新，支持自动创建和组件卸载时清理。
- `useViewReconciler` 只处理 `view`/`microapp`/`qiankun` 三种内容类型，不管理 React 组件。
- `useLocalAgent` 是 Core `local-agent` 的薄封装，只在 Electron 环境可用。
- `useAgentRegistry` 提供完整的 Agent 查询接口（按类型/状态/搜索），`useAgent` 查询单个 Agent 的状态和元数据。
- `useAgentSearch` 封装搜索框状态和结果，适合直接绑定到输入框。
- `hooks/index.ts` 按功能分组导出所有 Hook，但 `agent.ts` 里的部分 Hook 未在 index 中导出。

下一节课读共享 UI 基础组件：`button`、`card`、`textarea`、`progress`、`close-button`、`MermaidDiagram`、`icon-registry`、`pixel-icons`、`progress-dots`。
