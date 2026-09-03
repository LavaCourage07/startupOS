# J04：OSFramework、Sidebar、Taskbar、StatusBar 是什么关系

## 一套看起来像首页，但已经不在生产路径中的组件

读完 J01–J03，小林知道当前 OriginOS 首页由 `app/page.tsx` 主导，它自己组合了 `TopMenuBar`、`Dock`、`AppWindowContainer` 等组件。但仓库里还有另一组组件：`components/framework/OSFramework.tsx`、`Sidebar.tsx`、`Taskbar.tsx`、`StatusBar.tsx`。它们的名字听起来也像首页框架，甚至文件注释里写着“OriginOS 主框架组件”。

这节课要回答：它们是什么？为什么还在仓库里？如果读者想改首页，为什么不能从它们开始？

## 第一段源码：OSFramework 的组成

[packages/web/src/components/framework/OSFramework.tsx 第 35—67 行](../../../../packages/web/src/components/framework/OSFramework.tsx#L35) 是旧版 OS 框架的顶层组装：

```ts
export function OSFramework({
  children,
  sidebarOpen = true,
  onSidebarToggle,
  className,
}: OSFrameworkProps) {
  useTaskbarClock();

  return (
    <div className={cn('min-h-screen bg-background flex flex-col', className)}>
      <StatusBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar isCollapsed={!sidebarOpen} onCollapseToggle={onSidebarToggle} />
        <main className="flex-1 overflow-auto relative">{children}</main>
      </div>
      <Taskbar />
    </div>
  );
}
```

`OSFramework` 的 layout 是经典桌面 OS 模板：顶部状态栏、左侧边栏、中间主工作区、底部任务栏。它通过 `children` 把主内容区域开放给调用方。

这个结构本身没有问题，但它与当前生产路径不匹配。当前 `app/page.tsx` 不再导入 `OSFramework`，而是自己组装了一套新的桌面布局（全屏背景、顶部 `TopMenuBar`、底部 `Dock`、浮动 `AppWindowContainer`）。

## 第二段源码：Sidebar 的导航项是写死的

[packages/web/src/components/framework/Sidebar.tsx 第 29—49 行](../../../../packages/web/src/components/framework/Sidebar.tsx#L29) 定义了侧边栏导航项：

```ts
const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: '主页', icon: '🏠', path: '/' },
  { id: 'apps', label: '应用中心', icon: '📱', path: '/apps', badge: '12' },
  { id: 'settings', label: '设置', icon: '⚙️', path: '/settings' },
];
```

导航项只有三个：主页、应用中心、设置。其中 `path: '/apps'` 和 `path: '/settings'` 在当前生产路径中可能并不存在完整页面。`badge: '12'` 也是硬编码的占位数据。

这说明 `Sidebar` 当前更多是一个 UI 演示组件，而不是与真实路由、真实数据联动的导航器。如果读者把它当成当前首页的侧边栏去修改，会发现修改后首页没有变化。

## 第三段源码：Taskbar 的运行中应用是本地状态

[packages/web/src/components/framework/Taskbar.tsx 第 66—104 行](../../../../packages/web/src/components/framework/Taskbar.tsx#L66) 是任务栏组件：

```ts
export function Taskbar({
  pinnedApps = PINNED_APPS,
  onStartMenuClick,
  className,
}: TaskbarProps) {
  const [runningApps, setRunningApps] = useState<RunningApp[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  const startApp = (app: PinnedApp) => {
    setRunningApps((prev) => {
      const exists = prev.find((a) => a.id === app.id);
      if (exists) {
        return prev.map((a) =>
          a.id === app.id ? { ...a, isMinimized: !a.isMinimized } : a
        );
      }
      return [...prev, { id: app.id, name: app.name, icon: app.icon, isMinimized: false }];
    });
  };
```

`Taskbar` 自己维护了 `runningApps` 本地状态，点击固定应用时在该状态里增删。这与当前生产路径中的 `Dock` 完全不同：

- `Dock` 的固定应用列表来自 `dockStore`（Zustand），可被多个组件共享。
- `Dock` 的运行中状态与 `appWindowStore` 联动，点击 Dock 图标可以恢复/最小化真实窗口。
- `Taskbar` 的运行中状态是组件内部自娱自乐的数组，不与真实窗口系统通信。

因此 `Taskbar` 不能被当作当前 Dock 的实现。它只是一个旧的、自包含的演示组件。

## 第四段源码：StatusBar 的数据是写死的占位值

[packages/web/src/components/framework/StatusBar.tsx 第 42—70 行](../../../../packages/web/src/components/framework/StatusBar.tsx#L42) 渲染顶部状态栏：

```tsx
<div className="...">
  <div className="flex items-center gap-4">
    <div>... 25°C ...</div>
    <div>{new Date().toLocaleDateString('zh-CN', ...)}</div>
  </div>
  <div className="flex items-center gap-4">
    <button onClick={() => setIsConnected(!isConnected)}>... 已连接 ...</button>
    <div>... 85% ...</div>
    <button onClick={() => setHasNotifications(!hasNotifications)}>... 通知 ...</button>
  </div>
</div>
```

天气 `25°C`、电量 `85%` 都是硬编码。网络连接和通知状态通过点击切换，只是演示交互，没有连接真实系统服务。

当前生产路径中的顶部栏是 `page.tsx` 里的 `TopMenuBar`，它由 `TopMenuBar` 组件实现，与 `OSFramework` 的 `StatusBar` 不是同一个文件。下一节课会进入 `TopMenuBar`。

## 概念阶梯：旧框架 vs 新首页

把两组组件放在一起对比，就能理解为什么不要再从 `OSFramework` 开始改首页：

| 维度 | OSFramework 体系 | 当前生产路径（page.tsx） |
| --- | --- | --- |
| 顶部栏 | `StatusBar`（硬编码数据） | `TopMenuBar`（真实菜单、设置入口、通知铃铛） |
| 侧边栏 | `Sidebar`（硬编码三个导航项） | 无侧边栏 |
| 底部栏 | `Taskbar`（本地 runningApps 状态） | `Dock`（Zustand + appWindowStore 联动） |
| 主内容区 | `children` 渲染在 `<main>` 中 | 全屏背景 + 浮动 `AppWindowContainer` |
| 窗口管理 | 无 | `AppWindowManager` + `appWindowStore` |
| 当前使用状态 | 演示/历史代码 | 默认首页 |

这不是说 `OSFramework` 写得不好，而是说它属于另一个设计阶段。它的顶部栏、侧边栏、任务栏都是自包含的演示实现，没有与当前的真实状态层、窗口层、会话层连接。

## 为什么这些文件还在仓库里

常见原因有几种：

1. **过渡期保留**：新首页上线后，旧框架暂时没有删除，以防需要回退。
2. **演示页面使用**：`app/desktop/page.tsx` 等测试/演示页面可能仍在使用 `OSFramework` 或 `Desktop.tsx`。
3. **组件复用**：`useTaskbarClock` 等工具函数可能被其他页面临时引用。

无论原因是什么，对读者而言最重要的事实是：**默认路由 `/` 不再经过 `OSFramework`**。如果读者从 `OSFramework` 开始修改首页顶部栏，修改不会生效。

## 如何验证哪条路径是生产路径

最可靠的验证方式是看 `app/page.tsx` 的导入：

```ts
// page.tsx 里没有这一行
// import { OSFramework } from '@/components/framework/OSFramework';

// 而是直接自己组装
// import Dock from '@/components/os/dock';
// import { AppWindowContainer } from '@/components/os/window/AppWindowContainer';
```

另一个验证方式是打开浏览器开发者工具，检查 DOM 结构：

- 如果看到 `<aside>` 侧边栏元素，说明当前页面可能在使用 `OSFramework`。
- 如果看到 `TopMenuBar`、`Dock`、`AppWindowContainer`，说明当前页面是 `page.tsx` 的新实现。

## 本节小结

- `OSFramework` 是旧版 OS 框架，组合了 `StatusBar`、`Sidebar`、`Taskbar` 和主工作区。
- `Sidebar`、`Taskbar`、`StatusBar` 当前都是演示级组件，数据硬编码或状态本地自包含。
- 当前生产路径的默认首页由 `app/page.tsx` 自己组装，不再使用 `OSFramework`。
- 修改首页应该改 `page.tsx`、`Dock`、`TopMenuBar`、`AppWindowContainer`，而不是 `OSFramework`。
- 保留旧文件不等于使用旧文件。判断生产路径要看实际导入关系和渲染输出。

下一节课，我们将进入当前生产路径的顶部栏，看看 `TopMenuBar` 到底由谁实现、包含哪些真实功能。
