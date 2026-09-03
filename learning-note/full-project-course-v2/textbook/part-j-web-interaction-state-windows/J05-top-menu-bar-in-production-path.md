# J05：当前首页的顶部菜单栏由谁实现

## 顶部栏不是 StatusBar

J04 读完旧版 `StatusBar` 后，读者可能会有一个疑问：既然 `StatusBar` 是硬编码的演示组件，那浏览器里看到的顶部 OriginOS 标签、时间、设置按钮又在哪里实现？

答案在 `app/page.tsx` 内部。当前生产路径的顶部栏不是 `components/framework/StatusBar.tsx`，而是 `page.tsx` 里一个名为 `TopMenuBar` 的局部组件。

## 第一段源码：TopMenuBar 的定义

[packages/web/src/app/page.tsx 第 408—468 行](../../../../packages/web/src/app/page.tsx#L408) 定义了 `TopMenuBar`：

```tsx
function TopMenuBar({ onOpenGuide, onOpenSettings }: { onOpenGuide: () => void; onOpenSettings: () => void }) {
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-40 h-10 px-4 flex items-center justify-between border-b border-white/10 bg-black/30 backdrop-blur-2xl">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">OriginOS</span>
          <div className="hidden items-center gap-2 text-xs text-white/50 md:flex">
            <Layers className="h-3.5 w-3.5" />
            Desktop Session
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          ...
          <NotificationBell />
          ...
          <ScheduleButton />
          <button onClick={onOpenSettings}>...</button>
          <button onClick={onOpenGuide}>...</button>
        </div>
      </div>
    </>
  );
}
```

`TopMenuBar` 是一个局部函数组件，只在 `page.tsx` 内部使用，没有被单独导出。这解释了为什么搜索 `components/` 目录找不到它——它嵌套在页面文件里。

## 第二段源码：TopMenuBar 被渲染的位置

[packages/web/src/app/page.tsx 第 1276—1283 行](../../../../packages/web/src/app/page.tsx#L1276) 是首页 JSX：

```tsx
return (
  <div className="relative w-screen h-screen overflow-hidden bg-[#050816]">
    <div className="pointer-events-none absolute inset-0 ..." />
    <TopMenuBar
      onOpenGuide={() => setShowDesktopOnboarding(true)}
      onOpenSettings={() => setShowSettings(true)}
    />
    ...
  </div>
);
```

`TopMenuBar` 被放在全屏背景之上，`z-40` 保证它浮在大部分内容之上。它接收两个回调：`onOpenGuide` 打开桌面引导（Onboarding），`onOpenSettings` 打开设置对话框。

这两个回调都直接修改 `page.tsx` 的本地状态（`showDesktopOnboarding`、`showSettings`），说明顶部栏与页面状态是紧耦合的。这也是它没有被提取成独立组件的原因之一——它的行为高度依赖首页当前状态。

## 顶部栏里有哪些真实功能

把 `TopMenuBar` 的右侧元素拆开：

| 元素 | 来源 | 功能 |
| --- | --- | --- |
| OriginOS 标签 | 硬编码 JSX | 品牌标识 |
| Desktop Session | 硬编码 JSX + `Layers` 图标 | 当前会话模式提示 |
| Spotlight 提示 | 硬编码 JSX + `Search` 图标 | 提示用户按快捷键打开 Spotlight |
| 网络状态 | 内联 SVG，title="离线" | 视觉占位，当前固定显示离线图标 |
| 时间 | `useState` + `setInterval` | 每秒更新日期和时间 |
| `NotificationBell` | `components/os/notification/NotificationBell.tsx` | 通知中心入口 |
| `ScheduleButton` | `components/os/schedules` | 日程/计划入口 |
| 设置按钮 | 调用 `onOpenSettings` | 打开 `SettingsDialog` |
| 帮助按钮 | 调用 `onOpenGuide` | 打开 `DesktopOnboarding` |

与旧版 `StatusBar` 相比，`TopMenuBar` 的右侧集成了真实业务组件（`NotificationBell`、`ScheduleButton`），而不是硬编码天气/电量。左侧也更简洁，没有日期显示。

## 一个需要注意的耦合点

`TopMenuBar` 的时间更新完全靠自己：

```ts
const [currentTime, setCurrentTime] = React.useState(new Date());
React.useEffect(() => {
  const timer = setInterval(() => setCurrentTime(new Date()), 1000);
  return () => clearInterval(timer);
}, []);
```

这意味着每个 `TopMenuBar` 实例都有自己的定时器。虽然当前首页只有一个实例，但如果以后把它提取成独立组件并在多个页面复用，就会有多份定时器。更好的做法是把时间逻辑下沉到共享 Hook 或 store，不过当前实现是简单直接的。

## 与旧版 StatusBar 的对比

| 维度 | StatusBar（旧） | TopMenuBar（当前） |
| --- | --- | --- |
| 位置 | `components/framework/StatusBar.tsx` | `app/page.tsx` 内部 |
| 时间 | 自己维护 `useEffect` 定时器 | 自己维护 `useEffect` 定时器 |
| 天气/电量 | 硬编码 `25°C` / `85%` | 无 |
| 网络 | 点击切换演示状态 | 固定显示离线 SVG |
| 通知 | 点击切换徽章状态 | 真实 `NotificationBell` 组件 |
| 设置 | 无 | 真实设置按钮 |
| 帮助/引导 | 无 | 真实桌面引导按钮 |
| 是否在生产路径 | 否 | 是 |

这张表说明，判断一个组件是否在生产路径中，不能只看文件名或功能描述，而要看实际渲染关系和导入链。

## 本节小结

- 当前生产路径的顶部栏是 `app/page.tsx` 内部的局部组件 `TopMenuBar`，不是 `components/framework/StatusBar.tsx`。
- `TopMenuBar` 左侧显示 OriginOS 品牌和 Desktop Session，右侧显示 Spotlight 提示、时间、通知、日程、设置、帮助。
- 设置和帮助按钮通过回调直接驱动 `page.tsx` 的本地状态，打开 `SettingsDialog` 和 `DesktopOnboarding`。
- `NotificationBell` 和 `ScheduleButton` 是真实业务组件，而旧版 `StatusBar` 只有演示数据。
- 修改顶部栏应该定位到 `page.tsx` 第 408 行，而不是 `components/framework/StatusBar.tsx`。

下一节课，我们将看 `DesktopOnboarding` 和 `settingsStore`，理解新用户引导和设置状态如何联动。
