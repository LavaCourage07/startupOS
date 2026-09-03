# J14：单个窗口的拖拽、聚焦、关闭行为

## 一个窗口就是一个小型状态机

`AppWindowContainer` 负责列表渲染，`AppWindow` 负责单个窗口的行为。一个 `AppWindow` 实例需要处理：

- 拖拽标题栏移动窗口
- 点击窗口主体聚焦
- 最小化、最大化、关闭
- Resize 拖拽
- 用 React Portal 挂载到 `document.body`
- 在 Electron 环境下隐藏标题栏（因为原生窗口有自己的标题栏）

这节课进入 `components/os/window/AppWindow.tsx`。

## 第一段源码：useAppWindow Hook

[packages/web/src/components/os/window/AppWindow.tsx 第 24—39 行](../../../../packages/web/src/components/os/window/AppWindow.tsx#L24)：

```tsx
const {
  window: windowData,
  isOpen,
  isFocused,
  isMinimized,
  isMaximized,
  isDragging,
  position,
  close,
  minimize,
  maximize,
  focus,
  setPosition,
  setDragging,
  setResizing,
} = useAppWindow({ windowId });
```

`AppWindow` 不直接订阅整个 store，而是通过 `useAppWindow({ windowId })` 只订阅单个窗口的状态。这能避免一个窗口变化时重渲染所有窗口。

`useAppWindow` 是另一个细粒度 Hook，它返回当前窗口的派生状态（`isOpen`、`isFocused`、`isMinimized` 等）和操作函数。J14 不展开它的实现，只需要知道它让 `AppWindow` 只关心自己的状态。

## 第二段源码：聚焦与拖拽开始

[packages/web/src/components/os/window/AppWindow.tsx 第 50—76 行](../../../../packages/web/src/components/os/window/AppWindow.tsx#L50)：

```tsx
const handleFocus = useCallback(() => {
  if (!isFocused) {
    focus();
  }
}, [isFocused, focus]);

const handleDragStart = useCallback(
  (e: React.MouseEvent) => {
    if (isMaximized) return;
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;

    setDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  },
  [isMaximized, position, setDragging]
);
```

两个细节：

1. 最大化窗口不能被拖拽。这是合理的，因为最大化时窗口占满屏幕，拖拽没有意义。
2. `data-no-drag` 属性用于标记标题栏上不可拖拽的区域（例如按钮）。点击按钮时不应该触发拖拽。

`handleFocus` 同时绑定到 `onClick` 和 `onMouseDown`，保证点击窗口任何位置都能聚焦。

## 第三段源码：拖拽中的位置更新

[packages/web/src/components/os/window/AppWindow.tsx 第 79—101 行](../../../../packages/web/src/components/os/window/AppWindow.tsx#L79)：

```tsx
useEffect(() => {
  if (!isDragging || !dragStart) return;

  const handleMouseMove = (e: MouseEvent) => {
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
    setDragStart(null);
  };

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);

  return () => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };
}, [isDragging, dragStart, setPosition, setDragging]);
```

拖拽逻辑是常见的“按下记录偏移 → 移动时更新位置 → 松开结束”模式。注意事件监听绑定在 `window` 上，而不是窗口元素上，这样即使鼠标移出窗口范围，拖拽仍然有效。

`setPosition` 来自 `useAppWindow`，它最终调用 `appWindowStore.updateWindowPosition`。store 里会做约束检查（例如 `keepInBounds`、`minWidth`、`maxWidth`），所以 `AppWindow` 不需要自己处理边界。

## 第四段源码：最小化与关闭

[packages/web/src/components/os/window/AppWindow.tsx 第 115—122 行](../../../../packages/web/src/components/os/window/AppWindow.tsx#L115)：

```tsx
// 未挂载或已关闭时不渲染；最小化时保活但隐藏
if (!mounted || !isOpen || !windowData) return null;

...
style={{
  ...
  display: isMinimized ? 'none' : undefined,
}}
```

最小化窗口不会被卸载，只是 `display: none`。这保证：

- 窗口状态不丢失；
- 点击 Dock 恢复时不需要重新创建组件；
- 窗口内正在运行的会话不会因为最小化而中断。

关闭窗口时，`AppWindow` 调用 `config.onClose?.()` 再调用 `close()`：

```tsx
const handleClose = useCallback(() => {
  config.onClose?.();
  close();
}, [config, close]);
```

注意这里 `config.onClose` 和 `close` 的调用顺序：`AppWindowManager` 注入的 `onClose` 包含 `destroyAgentSession` 和 `consolidateMemory`。`close()` 会触发 store 的 `closeWindow`，store 的 `closeWindow` 也会调用 `onClose`。这意味着 `onClose` 可能被调用两次。

实际上，store 的 `closeWindow` 里保存的是 `windowData.onClose`（即 `AppWindowManager` 注入的回调），而 `AppWindow` 里的 `config.onClose` 也是同一个回调。如果 `AppWindow` 和 store 都调用，确实会重复执行销毁和整理。

这是当前实现中一个需要注意的细节。实际 `destroyAgentSession` 和 `consolidateMemory` 是幂等或幂等友好的操作，所以重复调用通常不会导致严重问题，但确实不是理想设计。

## 第五段源码：Electron 下隐藏标题栏

[packages/web/src/components/os/window/AppWindow.tsx 第 143—156 行](../../../../packages/web/src/components/os/window/AppWindow.tsx#L143)：

```tsx
{!isElectron() && (
  <WindowTitleBar
    title={windowData.title}
    icon={windowData.icon}
    isFocused={isFocused}
    isMaximized={isMaximized}
    constraints={constraints}
    onClose={handleClose}
    onMinimize={minimize}
    onMaximize={maximize}
    onDragStart={handleDragStart}
  />
)}
```

Electron 原生窗口有自己的标题栏和窗口控制按钮，所以 Web 的 `WindowTitleBar` 不渲染。Web 模式下才显示自定义标题栏。

这个条件渲染说明：同一个 `AppWindow` 组件要同时适配两种渲染模式，只是部分 UI 根据环境切换。

## 第六段源码：Portal 渲染

[packages/web/src/components/os/window/AppWindow.tsx 第 177 行](../../../../packages/web/src/components/os/window/AppWindow.tsx#L177)：

```tsx
return createPortal(windowElement, document.body);
```

`AppWindow` 用 `createPortal` 把窗口 DOM 挂载到 `document.body`，而不是父组件 `AppWindowContainer` 的位置。这样做有两个好处：

1. 窗口可以脱离父组件的 CSS 上下文（例如 `overflow-hidden`、transform）。
2. 多个窗口可以独立定位，不会互相影响 z-index。

`AppWindowContainer` 本身可以放在 `page.tsx` 的任何位置，但窗口 DOM 最终都会出现在 `body` 下。

## 本节小结

- `AppWindow` 通过 `useAppWindow({ windowId })` 订阅单窗口状态，避免不必要重渲染。
- 拖拽事件绑定在 `window` 上，最大化窗口不可拖拽，`data-no-drag` 标记不可拖拽区域。
- 最小化窗口 `display: none` 保活，不卸载组件。
- Electron 环境下隐藏 Web 标题栏，由原生窗口控制。
- 窗口用 `createPortal` 挂载到 `document.body`，脱离父组件 CSS 上下文。
- 注意：`config.onClose` 和 store 的 `closeWindow` 都可能调用 `onClose`，存在重复执行可能。

下一节课，我们将看 Electron 原生窗口的内容路由：`app/window/page.tsx`。
