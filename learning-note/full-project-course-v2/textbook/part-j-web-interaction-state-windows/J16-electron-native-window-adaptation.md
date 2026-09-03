# J16：Electron 原生窗口如何创建和通信

## Web 窗口和 Native 窗口不是同一套实现

前几节课一直提到“Electron 模式下走原生窗口”。这节课具体看：

1. 原生窗口由谁创建？
2. 渲染进程如何与主进程通信？
3. `useElectronWindow` 这个 Hook 封装了什么？

## 第一段源码：Core Electron window 集成

[packages/core/src/lib/integrations/electron/window.ts](../../../../packages/core/src/lib/integrations/electron/window.ts) 是渲染进程调用原生窗口的 API：

```ts
export interface NativeWindowConfig {
  id: string;
  title: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  minWidth?: number;
  minHeight?: number;
  route?: string;
  query?: Record<string, string>;
}

export async function createNativeWindow(config: NativeWindowConfig): Promise<string> {
  if (!isElectron()) {
    throw new Error('Native windows are only available in Electron');
  }
  return getIpcRenderer().invoke<string>(IPC_CHANNELS.WINDOW_CREATE, config);
}
```

所有原生窗口操作都通过 IPC（Inter-Process Communication）调用：

| 函数 | IPC Channel | 作用 |
| --- | --- | --- |
| `createNativeWindow` | `WINDOW_CREATE` | 让主进程创建 BrowserWindow |
| `closeNativeWindow` | `WINDOW_CLOSE` | 关闭指定 ID 的 BrowserWindow |
| `focusNativeWindow` | `WINDOW_FOCUS` | 聚焦指定 BrowserWindow |
| `minimizeNativeWindow` | `WINDOW_MINIMIZE` | 最小化 |
| `maximizeNativeWindow` | `WINDOW_MAXIMIZE` | 最大化 |
| `subscribeToNativeWindowClosed` | `WINDOW_CLOSED` | 监听主进程通知窗口已关闭 |

这些函数都先检查 `isElectron()`，非 Electron 环境下要么是 no-op，要么抛错。这是防御性设计，防止 Web 代码误调用。

## 第二段源码：useElectronWindow Hook

[packages/web/src/hooks/useElectronWindow.ts](../../../../packages/web/src/hooks/useElectronWindow.ts) 是对 Core API 的 React 封装：

```ts
export interface ElectronWindowAPI {
  isAvailable: boolean;
  createWindow: (config: NativeWindowConfig) => Promise<string>;
  closeWindow: (windowId: string) => Promise<void>;
  focusWindow: (windowId: string) => Promise<void>;
  minimizeWindow: (windowId: string) => Promise<void>;
  maximizeWindow: (windowId: string) => Promise<void>;
  subscribeToClosed: (listener: (windowId: string) => void) => () => void;
}
```

`isAvailable` 在客户端挂载后通过 `isElectron()` 确定。这避免了 SSR 期间 `window` 未定义的问题。

Hook 本身没有太多额外逻辑，主要是把 Core 的异步函数包装成 `useCallback`，并提供订阅原生窗口关闭的接口。它的价值在于：

- 让 React 组件以统一接口访问原生窗口能力；
- 隐藏 IPC channel 名称；
- 提供 `isAvailable` 标志，组件可以根据它切换行为。

## 第三段源码：IPC 协议中的窗口相关 Channel

虽然 IPC 主进程处理逻辑在 Part K，但渲染进程侧可以看到协议定义。`IPC_CHANNELS` 大致包含：

```ts
WINDOW_CREATE = 'window:create',
WINDOW_CLOSE = 'window:close',
WINDOW_FOCUS = 'window:focus',
WINDOW_MINIMIZE = 'window:minimize',
WINDOW_MAXIMIZE = 'window:maximize',
WINDOW_CLOSED = 'window:closed',
```

主进程收到 `WINDOW_CREATE` 后，会：

1. 创建一个新的 BrowserWindow；
2. 加载 Next.js 的 `/window` 路由，附带 query 参数；
3. 返回窗口 ID 给渲染进程。

`WINDOW_CLOSED` 是主进程主动发给渲染进程的：当用户点击原生窗口关闭按钮时，主进程通知渲染进程同步更新 store。

## 第四段源码：Dock 同步的 IPC

[packages/core/src/lib/integrations/electron/window.ts 第 61—92 行](../../../../packages/core/src/lib/integrations/electron/window.ts#L61) 还有两个 Dock 相关函数：

```ts
export function sendDockAction(detail: Record<string, unknown>): void {
  if (isElectron()) {
    void getIpcRenderer().invoke(IPC_CHANNELS.DOCK_ACTION, detail);
  } else {
    window.dispatchEvent(new CustomEvent('dock:action', { detail }));
  }
}

export function syncDockApps(apps: unknown[]): void {
  if (isElectron()) {
    getIpcRenderer().send(IPC_CHANNELS.DOCK_SYNC_APPS, apps);
  }
}
```

- `sendDockAction`：在 Electron 下通过 IPC 把 Dock 动作发给主窗口；在 Web 下通过 `CustomEvent` 广播。
- `syncDockApps`：在 Electron 下把 Dock 应用列表同步给独立的 Dock 窗口；在 Web 下是 no-op，因为 Web 下 Dock 和主窗口共享同一个 store。

这说明 Electron 模式下 Dock 可能是一个独立的 BrowserWindow，因此需要 IPC 同步。Web 模式下 Dock 是同一个页面内的组件，直接共享 Zustand。

## 原生窗口与 Web 窗口的状态一致性

Electron 模式下有两层“窗口”：

1. **BrowserWindow**：真正的操作系统窗口，由 Electron 主进程管理。
2. **appWindowStore 记录**：Zustand 状态，用于 Dock 同步、聚焦管理、生命周期回调。

当用户点击原生窗口关闭按钮时：

1. 主进程销毁 BrowserWindow；
2. 主进程通过 `WINDOW_CLOSED` IPC 通知渲染进程；
3. `useAppWindowManager` 订阅该事件，调用 `store.closeWindow(windowId)`；
4. `store.closeWindow` 触发 `onClose` 回调，执行 `destroyAgentSession` 和 `consolidateMemory`。

这个链条说明：即使窗口是原生的，Agent 生命周期清理仍然发生在渲染进程的 store 层。

## 本节小结

- 原生窗口由 Electron 主进程创建，渲染进程通过 IPC 调用。
- `useElectronWindow` 封装了创建、关闭、聚焦、最小化、最大化、订阅关闭等操作。
- `IPC_CHANNELS` 定义了窗口和 Dock 的通信协议。
- Electron 模式下 Dock 可能是独立窗口，需要 IPC 同步；Web 模式下 Dock 与主窗口共享 store。
- 原生窗口关闭时，主进程通知渲染进程，再由 store 触发 Agent 生命周期清理。

下一节课，我们将回到 `appWindowStore`，详细看窗口位置、层级、最小化/最大化的约束实现。
