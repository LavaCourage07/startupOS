# J26：通知中心与全局 Toast

## 通知不止是一个铃铛图标

OriginOS 的通知系统分为两部分：

1. **通知中心**：通过 `NotificationBell` 展示所有持久化通知，支持已读/关闭/全部已读。
2. **全局 Toast**：通过 `SystemNotificationToastHost` 展示临时弹窗，通常来自系统事件或协作运行时消息。

这节课看这两部分如何分别管理状态和渲染。

## 第一段源码：NotificationStore

[packages/web/src/store/notificationStore.ts 第 21—31 行](../../../../packages/web/src/store/notificationStore.ts#L21)：

```ts
interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  fetchNotifications: (options?: { silent?: boolean }) => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}
```

通知 store 的核心状态：

- `notifications`：所有通知列表；
- `unreadCount`：未读数（`status === 'pending'`）；
- `isLoading`：加载状态。

Actions 全部异步，因为通知数据通常来自后端或 Electron 主进程。

## 第二段源码：拉取通知

[packages/web/src/store/notificationStore.ts 第 38—61 行](../../../../packages/web/src/store/notificationStore.ts#L38)：

```ts
fetchNotifications: async ({ silent = false } = {}) => {
  if (!silent) {
    set({ isLoading: true });
  }
  try {
    const result = await listNotifications();
    if (result.success) {
      const raw = result.data;
      const notifications: Notification[] = Array.isArray(raw)
        ? raw
        : (raw as { notifications: Notification[] })?.notifications ?? [];
      const unreadCount = notifications.filter(
        (n) => n.status === 'pending',
      ).length;
      set({ notifications, unreadCount });
    }
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
  } finally {
    if (!silent) {
      set({ isLoading: false });
    }
  }
},
```

`fetchNotifications` 调用 Core 的 `listNotifications()`，兼容两种返回格式：数组或 `{ notifications: [] }`。未读数通过过滤 `status === 'pending'` 计算。

`silent: true` 用于后台轮询，不触发 loading 状态。

## 第三段源码：通知铃铛与轮询

[packages/web/src/components/os/notification/NotificationBell.tsx 第 19—23 行](../../../../packages/web/src/components/os/notification/NotificationBell.tsx#L19)：

```ts
useEffect(() => {
  fetchNotifications();
  const interval = setInterval(() => fetchNotifications({ silent: true }), 30000);
  return () => clearInterval(interval);
}, [fetchNotifications]);
```

`NotificationBell` 挂载时立即拉取一次通知，然后每 30 秒后台轮询。铃铛图标右上角显示未读数，超过 9 条显示 `9+`。

点击铃铛切换 `NotificationPanel` 的显示。面板外点击关闭。

## 第四段源码：通知面板与激活目标

[packages/web/src/components/os/notification/NotificationPanel.tsx 第 200—224 行](../../../../packages/web/src/components/os/notification/NotificationPanel.tsx#L200)：

```ts
function getNotificationActivationTarget(notification: Notification): SystemNotificationActivationTarget | null {
  const activationTarget = notification.payload["activationTarget"];
  if (isActivationTarget(activationTarget)) return activationTarget;

  const action = notification.payload["action"];
  if (!action || typeof action !== 'object') return null;
  const record = action as Record<string, unknown>;
  if (record["type"] === 'agent' && typeof record["agentName"] === 'string') {
    return {
      entryType: 'agent',
      entryId: record["agentName"],
      title: typeof notification.title === 'string' ? notification.title : record["agentName"],
      ...(typeof record["prompt"] === 'string' && record["prompt"].trim() ? { initialMessage: record["prompt"].trim() } : {}),
    };
  }
  if (record["type"] === 'skill' && typeof record["skillName"] === 'string') {
    return {
      entryType: 'skill',
      entryId: record["skillName"],
      title: record["skillName"],
      ...(typeof record["prompt"] === 'string' && record["prompt"].trim() ? { initialMessage: record["prompt"].trim() } : {}),
    };
  }
  return null;
}
```

通知不仅是只读消息，还可以点击跳转。`getNotificationActivationTarget` 从 `payload` 中提取激活目标：

- 优先读取 `activationTarget`；
- 否则从 `action` 中解析 `agent` 或 `skill` 类型。

点击通知时，先标记为已读，然后派发 `originos:notification-activate` 自定义事件。`page.tsx` 监听该事件并调用 `AppWindowManager` 打开对应窗口。

## 第五段源码：全局 Toast 宿主

[packages/web/src/components/os/notification/SystemNotificationToastHost.tsx 第 30—59 行](../../../../packages/web/src/components/os/notification/SystemNotificationToastHost.tsx#L30)：

```ts
export function SystemNotificationToastHost({ onActivate }: { onActivate?: (target: SystemNotificationActivationTarget) => void }) {
  const [toasts, setToasts] = React.useState<SystemNotificationToast[]>([]);

  React.useEffect(() => {
    function handleNotification(event: Event) {
      const detail = (event as CustomEvent<SystemNotificationEventDetail>).detail;
      if (!detail?.title) return;
      const id = `system-notification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((current) => [
        { id, title: detail.title, body: detail.body, activationTarget: detail.activationTarget, delivery: detail.result?.delivery },
        ...current.slice(0, 2),
      ]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 12000);
    }

    window.addEventListener('originos:system-notification', handleNotification);
    return () => window.removeEventListener('originos:system-notification', handleNotification);
  }, []);

  if (toasts.length === 0) return null;
  // ...
}
```

Toast 宿主：

- 监听 `originos:system-notification` 自定义事件；
- 最多同时显示 3 条 Toast（新 Toast + 保留前 2 条）；
- 每条 Toast 12 秒后自动消失；
- 如果 Toast 携带 `activationTarget`，点击可跳转到对应窗口。

这个组件通常挂载在 `layout.tsx` 或 `page.tsx` 的顶层，确保任何页面都能显示系统通知。

## 本节小结

- `notificationStore` 管理持久化通知，支持拉取、已读、关闭、全部已读。
- `NotificationBell` 每 30 秒轮询通知，并显示未读数徽章。
- `NotificationPanel` 展示通知列表，支持点击跳转到项目/Agent/Skill。
- `SystemNotificationToastHost` 管理临时 Toast，最多 3 条、12 秒自动消失。
- 通知激活通过自定义事件 `originos:notification-activate` 与窗口系统解耦。

下一节课是 Unit 3 小结课，把 Dock、Spotlight、通知串成全局导航的排查地图。
