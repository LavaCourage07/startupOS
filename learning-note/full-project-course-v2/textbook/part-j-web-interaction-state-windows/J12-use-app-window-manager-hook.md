# J12：React 组件如何订阅和操作窗口

## 组件不直接访问 Manager

`AppWindowManager` 是单例类，适合在非 React 上下文里使用（例如事件回调、工具函数）。但在 React 组件里，如果每次操作窗口都调用 `AppWindowManager.getInstance()`，就无法自动响应窗口状态变化。

`useAppWindowManager` 把 Zustand store 的订阅能力和 Manager 的操作能力打包成一个 Hook。这节课看它如何桥接 React 与窗口状态。

## 第一段源码：Hook 返回什么

[packages/web/src/hooks/useAppWindowManager.ts 第 43—79 行](../../../../packages/web/src/hooks/useAppWindowManager.ts#L43)：

```ts
export interface UseAppWindowManagerReturn {
  // 状态
  windows: Record<string, AppWindowData>;
  windowOrder: string[];
  focusedWindowId: string | null;
  openWindowCount: number;

  // 窗口操作
  openWindow: (config: AppWindowConfig) => string;
  closeWindow: (windowId: string) => void;
  closeAllWindows: () => void;
  minimizeWindow: (windowId: string) => void;
  maximizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;

  // 查询
  getWindow: (windowId: string) => AppWindowData | undefined;
  getOpenWindows: () => AppWindowData[];
  isWindowOpen: (windowId: string) => boolean;

  // 快捷方法
  openComponentWindow: (...) => string;
  openIframeWindow: (...) => string;
}
```

Hook 返回三类东西：

1. **状态**：`windows`、`windowOrder`、`focusedWindowId`、`openWindowCount`。组件订阅这些字段，窗口变化时自动重渲染。
2. **操作**：打开、关闭、最小化、最大化、还原、聚焦。
3. **查询**：获取单个窗口、获取所有未最小化窗口、判断是否已打开。

这与直接使用 `useAppWindowStore` 的区别在于：`useAppWindowManager` 还处理了 Electron native 窗口的桥接。

## 第二段源码：openWindow 的 Native 桥接

[packages/web/src/hooks/useAppWindowManager.ts 第 93—151 行](../../../../packages/web/src/hooks/useAppWindowManager.ts#L93)：

```ts
const openWindow = useCallback(
  (config: AppWindowConfig) => {
    config = withAgentLifecycleOnClose(config);
    const metadata = config.metadata;

    if (config.content.type === 'component' && typeof window !== 'undefined' && isElectron()) {
      const windowId = config.id ?? `native-${Date.now()}`;
      const entryType = metadata?.['entryType'] as string | undefined;
      const props = (config.content as ComponentContent).props ?? {};

      let windowType: string;
      if (entryType === 'skill') {
        windowType = 'skill';
      } else if (windowId.includes('interview')) {
        windowType = 'interview';
      } else if (entryType === 'role-agent' || entryType === 'agent') {
        windowType = entryType;
      } else {
        windowType = 'workspace';
      }

      const query: Record<string, string> = { windowType, title: config.title };
      for (const [k, v] of Object.entries(props)) {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          query[k] = String(v);
        }
      }
      const metaKeys = ['entryType', 'entryId', 'sessionId', 'projectId'];
      for (const k of metaKeys) {
        const v = metadata?.[k];
        if (typeof v === 'string') query[k] = v;
      }

      void createNativeWindow({
        id: windowId,
        title: config.title,
        width: config.position?.width,
        height: config.position?.height,
        x: config.position?.x,
        y: config.position?.y,
        minWidth: config.constraints?.minWidth,
        minHeight: config.constraints?.minHeight,
        route: '/window',
        query,
      }).catch(...);

      return store.openWindow({
        ...config,
        id: windowId,
        metadata: { ...metadata, renderMode: 'native' },
      });
    }

    return store.openWindow(config);
  },
  [store]
);
```

这段代码与 `AppWindowManager.openWindow` 高度相似，都包含：

1. `withAgentLifecycleOnClose` 注入生命周期回调；
2. Electron 环境下推导 `windowType`、序列化 props、创建原生窗口；
3. 写入 store 并标记 `renderMode: 'native'`。

这说明 `useAppWindowManager` 和 `AppWindowManager` 在窗口打开逻辑上是**平行实现**，而不是一个调用另一个。这种重复是 Part J 中需要注意的代码组织问题：同一个逻辑出现在服务层和 Hook 层。

## 第三段源码：Native 窗口关闭订阅

[packages/web/src/hooks/useAppWindowManager.ts 第 215—222 行](../../../../packages/web/src/hooks/useAppWindowManager.ts#L215)：

```ts
useEffect(() => {
  return electronWindow.subscribeToClosed((windowId) => {
    const current = useAppWindowStore.getState().windows[windowId];
    if (current) {
      useAppWindowStore.getState().closeWindow(windowId);
    }
  });
}, [electronWindow]);
```

当 Electron 原生窗口被用户关闭时，主进程会通知渲染进程。Hook 订阅这个事件，同步从 store 移除对应记录。否则会出现“原生窗口已经关了，但 store 里还有记录”的状态不一致。

这是一个关键的同步点：原生窗口的物理关闭动作来自 Electron 主进程，但状态真相必须回到 Zustand store。

## 第四段源码：Native 窗口操作桥接

[packages/web/src/hooks/useAppWindowManager.ts 第 153—213 行](../../../../packages/web/src/hooks/useAppWindowManager.ts#L153) 是 close/minimize/maximize/focus 的桥接：

```ts
const closeWindow = useCallback(
  (windowId: string) => {
    const windowData = store.windows[windowId];
    if (windowData?.metadata?.['renderMode'] === 'native' && isElectron()) {
      void electronWindow.closeWindow(windowId).catch(...);
    }
    store.closeWindow(windowId);
  },
  [electronWindow, store]
);
```

对于 native 窗口：

- 先调用 `electronWindow.closeWindow` 关闭物理窗口；
- 再调用 `store.closeWindow` 更新状态。

如果顺序反过来，先移除 store 记录，就无法再找到对应的 native 窗口 ID 去关闭它。这个顺序很重要。

`minimizeWindow`、`maximizeWindow`、`focusWindow` 也有同样的 native 桥接模式：先操作物理窗口，再更新 store。

## Manager vs Hook：什么时候用哪个

| 场景 | 推荐方式 | 原因 |
| --- | --- | --- |
| 在 React 组件内订阅窗口状态 | `useAppWindowManager` | 自动重渲染 |
| 在事件回调/工具函数中打开窗口 | `AppWindowManager.getInstance()` | 不需要订阅状态 |
| 在 `page.tsx` 的点击回调中 | `AppWindowManager.getInstance()` | 简单直接，不需要 Hook 开销 |
| 需要监听 native 窗口关闭 | `useAppWindowManager` | 内部订阅了 Electron 关闭事件 |

实际代码中，`page.tsx` 使用 `AppWindowManager`，而 `AppWindow` 组件内部使用 `useAppWindow`（另一个更细粒度的 Hook）。`useAppWindowManager` 目前的使用场景相对较少，但它提供了最完整的窗口操作接口。

## 本节小结

- `useAppWindowManager` 把 Zustand store 订阅和窗口操作封装成 React Hook。
- 它也包含 Electron native 窗口的创建、关闭、最小化、最大化、聚焦桥接。
- 它订阅了 native 窗口关闭事件，保证物理窗口关闭时 store 状态同步更新。
- `useAppWindowManager` 和 `AppWindowManager` 在窗口打开逻辑上有重复，这是当前代码组织的一个注意点。
- React 组件内优先用 Hook，非 React 上下文优先用单例 Manager。

下一节课，我们将看 Web 模式下窗口如何从 store 渲染到 DOM：`AppWindowContainer`。
