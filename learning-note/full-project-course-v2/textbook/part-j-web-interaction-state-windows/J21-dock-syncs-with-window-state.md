# J21：Dock 如何监听窗口状态

## Dock 上的运行指示灯不是手动的

上一节课看完 `dockStore` 的字段和 actions，但 `isRunning` 由谁来更新？答案是：`Dock` 组件会订阅 `appWindowStore.windows`，每当窗口集合变化时，自动把窗口信息同步到 Dock 应用列表。

这节课看 `packages/web/src/components/os/dock/index.tsx` 和 `Container.tsx`，理解 Dock 的监听逻辑、图标点击分发，以及 Web 与 Electron 下的布局差异。

## 第一段源码：订阅 appWindowStore

[packages/web/src/components/os/dock/index.tsx 第 32—82 行](../../../../packages/web/src/components/os/dock/index.tsx#L32)：

```ts
// 窗口状态
const windows = useAppWindowStore((state) => state.windows);

// 监听窗口状态变化，同步到 Dock app 的 isMinimized 状态
useEffect(() => {
  const currentApps = useDockStore.getState().apps;

  Object.entries(windows).forEach(([windowId, win]) => {
    // 窗口 ID 就是 appId，不需要转换
    const appId = windowId;

    // 检查 app 是否已存在于 Dock
    const existingApp = currentApps.find((a) => a.id === appId);

    if (existingApp) {
      // 更新现有 app
      updateApp(appId, { isRunning: true });
    } else {
      // 添加新 app 到 Dock
      const newApp: DockApp = {
        id: appId,
        name: win.title,
        icon: win.icon || '📄',
        iconType: 'emoji',
        isRunning: true,
        isPinned: false,
        index: currentApps.length,
      };
      useDockStore.getState().addApp(newApp);
    }
  });

  // 清理已关闭窗口的 app（仅非固定的）
  currentApps.forEach((app) => {
    if (!app.isPinned) {
      // 直接使用 app.id 作为 windowId
      if (!windows[app.id]) {
        useDockStore.getState().removeApp(app.id);
      }
    }
  });
}, [windows, updateApp]);
```

这个 `useEffect` 是 Dock 与窗口系统的核心粘合点：

1. **遍历所有窗口**：对每个 `windowId`，直接把它当成 `appId`。
2. **如果 Dock 已有该 app**：更新 `isRunning: true`。
3. **如果 Dock 没有**：新增一个非固定条目，使用窗口标题和图标。
4. **清理已关闭窗口**：如果某个非固定 app 在 `windows` 中不存在，就从 Dock 移除。

关键假设：**窗口 ID 等于 Dock app ID**。这个假设在 `AppWindowManager` / `useAppWindowManager` 中通常成立，因为打开窗口时会传入 `id: appId`。

## 第二段源码：图标点击分发

[packages/web/src/components/os/dock/index.tsx 第 101—155 行](../../../../packages/web/src/components/os/dock/index.tsx#L101)：

```ts
const handleIconClick = (appId: string) => {
  const app = apps.find((a) => a.id === appId);
  if (!app) return;

  // 如果窗体已打开，恢复并聚焦（而非打开新窗体）
  const existingWindow = windows[appId];
  if (existingWindow) {
    const { restoreWindow, focusWindow } = useAppWindowStore.getState();
    if (existingWindow.state === 'minimized') {
      restoreWindow(appId);
    }
    focusWindow(appId);
    return;
  }

  // 对于正在运行的 app（native 原生窗口，由主窗口 renderer 管理），
  // dock 窗口的 appWindowStore 为空，需要通过 IPC 让主窗口聚焦对应窗体
  if (app.isRunning) {
    sendDockAction({ action: 'focus-window', windowId: appId });
    return;
  }

  // 快捷入口：通过 IPC/CustomEvent 发送到主窗口
  if (appId === 'app-project-create') {
    sendDockAction({ action: 'create-project' });
    return;
  }
  if (appId === 'app-workspace') {
    sendDockAction({ action: 'open-workspace' });
    return;
  }

  // Skill 类型
  if (app.appType === 'skill' && app.skillName) {
    sendDockAction({ action: 'launch-skill', skillId: app.skillName });
    return;
  }

  // Sandbox 类型
  if (app.appType === 'sandbox') {
    sendDockAction({ action: 'launch-sandbox' });
    return;
  }

  // Agent 类型
  setActiveAgent(appId);
  sendDockAction({
    action: 'launch-agent',
    agentId: app.id,
    agentName: app.name,
    agentType: app.id.startsWith('agent-') ? 'role-agent' : 'agent',
  });
  setAppRunning(appId, true);
  setAgentStatus(appId, AgentStatus.RUNNING as AgentStatus);
};
```

点击图标时，按优先级处理：

1. **已有窗口**：恢复 + 聚焦。这是最常见路径。
2. **正在运行但没有本地窗口记录**：说明是 Electron 原生窗口且在 Dock 独立窗口中，通过 `sendDockAction('focus-window')` 让主窗口聚焦。
3. **系统快捷入口**：创建项目、打开工作区。
4. **Skill 类型**：通过 `sendDockAction('launch-skill')` 启动。
5. **Sandbox 类型**：启动沙箱。
6. **Agent 类型**：设置 active agent 并发送 `launch-agent`。

这里大量依赖 `sendDockAction`，它是 Dock 与主窗口通信的统一抽象。

## 第三段源码：sendDockAction 的跨平台实现

[packages/core/src/lib/integrations/electron/window.ts 第 100—112 行](../../../../packages/core/src/lib/integrations/electron/window.ts#L100)：

```ts
export function sendDockAction(detail: Record<string, unknown>): void {
  if (isElectron()) {
    void getIpcRenderer().invoke(IPC_CHANNELS.DOCK_ACTION, detail);
  } else {
    window.dispatchEvent(new CustomEvent('dock:action', { detail }));
  }
}
```

- **Electron**：通过 IPC `DOCK_ACTION` 把动作发送给主进程/主窗口。
- **Web**：派发自定义事件 `dock:action`，由 `page.tsx` 监听并处理。

这意味着 Dock 组件本身不直接打开窗口，而是把动作广播出去，由主窗口的消费方决定如何响应。这种设计让 Dock 可以在独立窗口中运行。

## 第四段源码：DockContainer 布局

[packages/web/src/components/os/dock/Container.tsx 第 40—70 行](../../../../packages/web/src/components/os/dock/Container.tsx#L40)：

```tsx
if (desktop) {
  if (side === 'bottom') {
    return (
      <div
        className={`fixed bottom-0 left-0 z-50 flex w-full items-end justify-center transition-[height] duration-300 ease-in-out ${visible ? 'h-20' : 'h-2'}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className={`flex items-center gap-4 px-4 py-3 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed top-0 ${side === 'right' ? 'right-0' : 'left-0'} h-full z-50 flex transition-[width] duration-300 ease-in-out ${visible ? 'w-16' : 'w-2'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`flex flex-col items-center gap-4 py-4 w-full overflow-hidden transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {children}
      </div>
    </div>
  );
}
```

`DockContainer` 的行为分两套：

- **Electron（desktop=true）**：Dock 默认收起，鼠标悬停时展开。支持 `bottom` / `left` / `right` 三侧。
- **Web（desktop=false）**：Dock 常驻显示，`side` 只影响 `left` / `right` 时显示在屏幕两侧，否则在底部居中。

注意：Web 模式下 `side='bottom'` 时 Dock 在底部居中；`side='left'` 或 `'right'` 时 Dock 在屏幕两侧垂直居中。这看起来和 Electron 的垂直布局复用了同一套 JSX，但交互行为不同（Web 不自动收起）。

## 第五段源码：悬停事件广播

[packages/web/src/components/os/dock/Container.tsx 第 30—38 行](../../../../packages/web/src/components/os/dock/Container.tsx#L30)：

```ts
const handleMouseEnter = useCallback(() => {
  setExpanded(true);
  window.dispatchEvent(new CustomEvent('dock:hover', { detail: { expanded: true, side } }));
}, [side]);

const handleMouseLeave = useCallback(() => {
  setExpanded(false);
  window.dispatchEvent(new CustomEvent('dock:hover', { detail: { expanded: false, side } }));
}, [side]);
```

Dock 展开/收起时还会广播 `dock:hover` 自定义事件。其他组件（如窗口容器）可以监听这个事件，调整自身布局避免被收起的 Dock 遮挡。

## 本节小结

- `Dock` 组件通过监听 `appWindowStore.windows`，把窗口运行状态同步到 Dock 列表。
- 窗口 ID 被直接当作 Dock app ID，这是 Dock 与窗口系统之间的隐式约定。
- 图标点击不直接打开窗口，而是通过 `sendDockAction` 广播动作，支持 Electron 跨窗口通信。
- `DockContainer` 根据 `isElectron()` 和 `dockSide` 切换布局与悬停行为。
- `dock:hover` 自定义事件让其他组件感知 Dock 展开状态。

下一节课，我们看 `DockIcon` 如何处理拖拽、长按删除、工具提示和点击反馈。
