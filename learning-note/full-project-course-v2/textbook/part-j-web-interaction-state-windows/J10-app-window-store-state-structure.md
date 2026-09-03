# J10：窗口状态存在哪里，长什么样

## 窗口不是 DOM 元素的副产品

在普通 Web 应用里，弹窗通常是一个条件渲染的组件，开关由本地 `useState` 控制。OriginOS 不同：它的窗口先写入一个全局 Zustand store，再由 store 驱动渲染。即使屏幕上还没有任何窗口元素，`appWindowStore` 里也可能已经有一条窗口记录。

这节课进入 `store/appWindowStore.ts`，看窗口状态的数据结构、基本操作和约束规则。

## 第一段源码：Store 的整体形状

[packages/web/src/store/appWindowStore.ts 第 31—37 行](../../../../packages/web/src/store/appWindowStore.ts#L31)：

```ts
export const useAppWindowStore = create<AppWindowStoreState>()(
  subscribeWithSelector((set, get) => ({
    windows: {},
    windowOrder: [],
    focusedWindowId: null,
    maxZIndex: WINDOW_ZINDEX_BASE,
    ...
  }))
);
```

四个核心字段：

| 字段 | 类型 | 作用 |
| --- | --- | --- |
| `windows` | `Record<string, AppWindowData>` | 所有窗口记录，以 `id` 为键 |
| `windowOrder` | `string[]` | 窗口打开顺序，用于排序和确定新的聚焦窗口 |
| `focusedWindowId` | `string \| null` | 当前聚焦的窗口 ID |
| `maxZIndex` | `number` | 当前最大 z-index，每次聚焦或打开窗口时递增 |

为什么同时需要 `windows` 和 `windowOrder`？因为 `Record` 不保证遍历顺序，而 `windowOrder` 可以稳定地按打开顺序排列窗口。关闭窗口时，也靠 `windowOrder` 找到“最上层”窗口作为新的聚焦目标。

## 第二段源码：单条窗口记录

[packages/web/src/store/appWindowStore.ts 第 75—97 行](../../../../packages/web/src/store/appWindowStore.ts#L75) 是 `openWindow` 里创建的数据对象：

```ts
const windowData: AppWindowData = {
  id,
  type: config.type,
  title: config.title,
  icon: config.icon,
  state: 'normal',
  position: {
    x: config.position?.x ?? centered.x,
    y: config.position?.y ?? centered.y,
    width,
    height,
    zIndex: get().maxZIndex + WINDOW_ZINDEX_STEP,
  },
  constraints: { ...DEFAULT_WINDOW_CONSTRAINTS, ...config.constraints },
  content: config.content,
  isFocused: true,
  isDragging: false,
  isResizing: false,
  createdAt: Date.now(),
  lastActivatedAt: Date.now(),
  metadata: config.metadata,
  onClose: config.onClose,
};
```

重点字段解释：

- `state`: `'normal' | 'minimized' | 'maximized'`。最小化时窗口保活但隐藏，最大化时占满屏幕。
- `position`: 包含 `x`、`y`、`width`、`height`、`zIndex`。z-index 由 store 统一管理。
- `constraints`: 最小/最大尺寸、是否允许 resize、是否限制在屏幕内。
- `content`: 窗口内容，可能是 React 组件、iframe 或 microapp。
- `metadata`: 任意键值对，用于传递 `entryType`、`entryId`、`sessionId`、`projectId`、`renderMode` 等。
- `onClose`: 窗口关闭时要执行的回调，通常由 `AppWindowManager` 注入生命周期逻辑。

## 第三段源码：openWindow 的幂等性

[packages/web/src/store/appWindowStore.ts 第 38—68 行](../../../../packages/web/src/store/appWindowStore.ts#L38) 处理“窗口已存在”的情况：

```ts
openWindow: (config: AppWindowConfig): string => {
  const existingId = config.id;
  if (existingId && get().windows[existingId]) {
    const id = existingId;
    set((state) => {
      const updatedWindows = Object.fromEntries(
        Object.entries(state.windows).map(([wid, w]) => [
          wid,
          wid === id
            ? { ...w, isFocused: true, isDragging: false, isResizing: false,
                state: w.state === 'minimized' ? 'normal' : w.state,
                position: { ...w.position, zIndex: state.maxZIndex + WINDOW_ZINDEX_STEP } }
            : { ...w, isFocused: false },
        ])
      );
      return {
        windows: updatedWindows,
        windowOrder: [...state.windowOrder.filter((wid) => wid !== id), id],
        focusedWindowId: id,
        maxZIndex: state.maxZIndex + WINDOW_ZINDEX_STEP,
      };
    });
    return id;
  }
  ...
}
```

如果 `config.id` 已经存在，store 不会创建新窗口，而是：

1. 把该窗口置顶（移到 `windowOrder` 末尾）；
2. 赋予新的 `zIndex`；
3. 如果是最小化状态，恢复为 `normal`；
4. 聚焦该窗口，取消其他窗口聚焦。

这保证了同一技能/项目不会被重复打开多个窗口。例如，已经打开了“头脑风暴”窗口，再次点击卡片只会聚焦原窗口。

## 第四段源码：closeWindow 如何转移焦点

[packages/web/src/store/appWindowStore.ts 第 125—145 行](../../../../packages/web/src/store/appWindowStore.ts#L125)：

```ts
closeWindow: (windowId: string) => {
  const closingWindow = get().windows[windowId];
  console.log('[appWindowStore] closeWindow:', windowId, 'hasOnClose:', !!closingWindow?.onClose);
  closingWindow?.onClose?.();
  set((state) => {
    const { [windowId]: closed, ...remaining } = state.windows;
    const newOrder = state.windowOrder.filter((id) => id !== windowId);
    const newFocusedId = newOrder.length > 0 ? newOrder[newOrder.length - 1] : null;
    return {
      windows: remaining,
      windowOrder: newOrder,
      focusedWindowId: newFocusedId,
    };
  });
},
```

关闭窗口时：

1. 先调用 `onClose`（生命周期回调，可能销毁 Agent 会话）；
2. 从 `windows` 中移除记录；
3. 从 `windowOrder` 中移除 ID；
4. 把焦点转移给 `windowOrder` 中最后一个窗口（即最上层窗口）。

注意 `onClose` 在状态更新之前调用。如果 `onClose` 抛异常，会影响关闭流程吗？当前实现没有 try-catch，所以异常会中断后续状态更新。不过 `destroyAgentSession` 和 `consolidateMemory` 都是 `.catch(...)` 的 Promise，不会抛出同步异常。

## 第五段源码：z-index 的递增策略

每次打开或聚焦窗口，`maxZIndex` 都会增加 `WINDOW_ZINDEX_STEP`：

```ts
maxZIndex: state.maxZIndex + WINDOW_ZINDEX_STEP,
```

这个策略简单但有效：

- 永远不会有重复的 z-index；
- 后聚焦的窗口一定在前一个之上；
- 不需要重新计算所有窗口的 z-index。

潜在问题是：如果窗口打开/聚焦非常频繁，`maxZIndex` 可能无限增长。但在正常使用场景下，这个数值不会触及 JavaScript 安全整数上限。

## 本节小结

- `appWindowStore` 是窗口状态的唯一真相来源，包含 `windows`、`windowOrder`、`focusedWindowId`、`maxZIndex`。
- 单条窗口记录包含状态、位置、约束、内容、metadata 和 `onClose` 回调。
- `openWindow` 是幂等的：相同 ID 已存在时聚焦并置顶，而不是创建新窗口。
- `closeWindow` 先调用 `onClose`，再移除记录，并把焦点转移给最上层窗口。
- z-index 通过 `maxZIndex + WINDOW_ZINDEX_STEP` 递增，保证聚焦窗口始终在最前。

下一节课，我们将看 `AppWindowManager` 如何作为业务代码的窗口入口，并注入 Agent 生命周期回调。
