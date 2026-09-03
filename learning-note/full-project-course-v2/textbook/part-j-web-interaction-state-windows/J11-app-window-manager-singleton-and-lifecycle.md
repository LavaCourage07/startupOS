# J11：AppWindowManager 如何作为窗口入口并注入生命周期

## 业务代码不直接操作 Store

J10 已经知道 `appWindowStore` 是窗口状态真相来源。但首页 `page.tsx` 打开窗口时，并没有直接调用 `store.openWindow`，而是通过 `AppWindowManager.getInstance().openComponentWindow(...)`。

这节课要回答：`AppWindowManager` 在 store 之上加了哪一层？为什么打开窗口要经过它？

## 第一段源码：单例模式

[packages/web/src/services/AppWindowManager.ts 第 16—26 行](../../../../packages/web/src/services/AppWindowManager.ts#L16)：

```ts
export class AppWindowManager {
  private static instance: AppWindowManager | null = null;

  private constructor() {}

  static getInstance(): AppWindowManager {
    if (!AppWindowManager.instance) {
      AppWindowManager.instance = new AppWindowManager();
    }
    return AppWindowManager.instance;
  }
  ...
}

export const appWindowManager = AppWindowManager.getInstance();
```

`AppWindowManager` 是单例类。单例保证整个应用只有一个窗口管理器实例，避免多个组件各自维护一份窗口逻辑。`page.tsx` 使用 `AppWindowManager.getInstance()`，也可以直接导入 `appWindowManager`。

单例模式在这里是合适的，因为窗口系统是全局唯一的。但也要注意：单例使得测试时需要重置状态，否则测试之间会互相影响。

## 第二段源码：openWindow 的核心逻辑

[packages/web/src/services/AppWindowManager.ts 第 31—55 行](../../../../packages/web/src/services/AppWindowManager.ts#L31)：

```ts
openWindow(config: AppWindowConfig): string {
  const store = useAppWindowStore.getState();
  const metadata = config.metadata;
  console.log('[AppWindowManager] openWindow:', { id: config.id, metadata, hasOnClose: !!config.onClose });

  if (metadata) {
    const entryType = metadata['entryType'] as string | undefined;
    const entryId = metadata['entryId'] as string | undefined;
    const sessionId = metadata['sessionId'] as string | undefined;
    const projectId = metadata['projectId'] as string | undefined;

    if (entryType && entryId && MEMORY_ENTRY_TYPES.has(entryType)) {
      const originalOnClose = config.onClose;
      config = {
        ...config,
        onClose: () => {
          originalOnClose?.();
          destroyAgentSession({ sessionId, projectId }).catch(...);
          consolidateMemory(entryType, entryId).catch(...);
        },
      };
    }
  }
  ...
}
```

这一段是 `AppWindowManager` 最重要的职责：**根据 metadata 注入生命周期回调**。

`MEMORY_ENTRY_TYPES` 包含：

```ts
const MEMORY_ENTRY_TYPES = new Set(['role-agent', 'agent', 'project', 'solution', 'skill']);
```

只有当 `entryType` 属于这些类型时，才会注入 `destroyAgentSession` 和 `consolidateMemory`。这意味着：

- 打开 Skill 窗口 → 关闭时销毁会话 + 整理记忆。
- 打开 Agent 窗口 → 关闭时销毁会话 + 整理记忆。
- 打开 Project/Solution 窗口 → 关闭时销毁会话 + 整理记忆。
- 打开一个普通 iframe 窗口 → 不注入，关闭即移除 store 记录。

`originalOnClose?.()` 保证调用方自定义的关闭回调也会被执行。

## 第三段源码：windowType 推导

[packages/web/src/services/AppWindowManager.ts 第 56—119 行](../../../../packages/web/src/services/AppWindowManager.ts#L56) 处理 Electron 原生窗口：

```ts
if (config.content.type === 'component' && typeof window !== 'undefined' && isElectron()) {
  const windowId = config.id ?? `native-${Date.now()}`;
  const entryType = metadata?.['entryType'] as string | undefined;
  ...
  let windowType: string;
  if (entryType === 'skill') {
    windowType = 'skill';
  } else if (windowId.includes('interview')) {
    windowType = 'interview';
  } else if (entryType === 'role-agent' || entryType === 'agent') {
    windowType = entryType;
  } else if (entryType === 'collaboration') {
    windowType = 'collaboration';
  } else if (entryType === 'solution') {
    windowType = 'solution';
  } else if (entryType === 'project-workspace') {
    windowType = 'project-workspace';
  } else if (entryType === 'sandbox') {
    windowType = 'sandbox';
  } else {
    windowType = 'workspace';
  }
  ...
}
```

Electron 模式下，`AppWindowManager` 需要根据窗口内容推断 `windowType`，然后作为 URL query 参数传给 `/window` 路由。`windowType` 决定 Electron 原生窗口里渲染哪个内容组件。

注意推导逻辑里有两条规则：

1. `entryType === 'skill'` → `windowType = 'skill'`
2. `windowId.includes('interview')` → `windowType = 'interview'`

第二条说明 `interview` 窗口的识别不完全依赖 metadata，而是依赖 ID 字符串包含 "interview"。这是一个历史遗留或简化约定，读者需要知道它的存在，以免以后改 ID 命名时破坏窗口类型推导。

## 第四段源码：与 Dock 同步

[packages/web/src/services/AppWindowManager.ts 第 144—178 行](../../../../packages/web/src/services/AppWindowManager.ts#L144)：

```ts
private syncWindowToDock(windowId: string, title: string, config: AppWindowConfig): void {
  if (!isElectron()) return;
  const dock = useDockStore.getState();
  const existing = dock.apps.find(a => a.id === windowId);
  const icon = (config.content as ComponentContent).props?.['icon'] as string | undefined;
  if (existing) {
    dock.updateApp(windowId, { isRunning: true });
  } else {
    const newApp: DockApp = {
      id: windowId,
      name: title,
      icon: icon || '📄',
      iconType: 'emoji',
      isRunning: true,
      isMinimized: false,
      isPinned: false,
      index: dock.apps.length,
    };
    dock.addApp(newApp);
  }
  this.broadcastDockApps();
}
```

打开窗口时，Electron 模式下会自动把窗口同步到 Dock：

- 如果 Dock 里已经有对应应用，更新 `isRunning: true`；
- 如果没有，新增一个 `isPinned: false` 的运行中应用；
- 通过 IPC 广播给 Dock 窗口。

这是窗口系统与 Dock 系统之间的正式耦合点。Unit 3 会详细讲 Dock。

## 第五段源码：closeWindow 的 Dock 清理

[packages/web/src/services/AppWindowManager.ts 第 127—139 行](../../../../packages/web/src/services/AppWindowManager.ts#L127)：

```ts
closeWindow(windowId: string): void {
  useAppWindowStore.getState().closeWindow(windowId);
  if (isElectron()) {
    const dock = useDockStore.getState();
    const app = dock.apps.find(a => a.id === windowId);
    if (app && !app.isPinned) {
      dock.removeApp(windowId);
    } else if (app) {
      dock.updateApp(windowId, { isRunning: false });
    }
    this.broadcastDockApps();
  }
}
```

关闭窗口时：

1. 先调用 store 的 `closeWindow`，触发 `onClose` 生命周期；
2. 在 Electron 模式下更新 Dock：未固定的应用直接移除，固定的应用标记为 `isRunning: false`；
3. 广播 Dock 状态。

这体现了固定应用（pinned）和运行中应用（running）的区分：固定应用即使窗口关闭也留在 Dock，运行中应用关闭后从 Dock 消失。

## 本节小结

- `AppWindowManager` 是单例服务，作为业务代码打开窗口的统一入口。
- 它根据 `metadata.entryType` 为 Skill/Agent/Project/Solution 窗口注入 `destroyAgentSession` 和 `consolidateMemory` 生命周期回调。
- Electron 模式下，它推导 `windowType` 并创建原生 BrowserWindow，同时把窗口同步到 Dock。
- 关闭窗口时，它更新 store、清理 Dock，并区分固定应用与运行中应用。
- `AppWindowManager` 的职责是“协调”，而不是“渲染”。渲染由 `AppWindowContainer` 和 `AppWindow` 负责。

下一节课，我们将看 `useAppWindowManager`，了解 React 组件如何订阅和操作窗口状态。
