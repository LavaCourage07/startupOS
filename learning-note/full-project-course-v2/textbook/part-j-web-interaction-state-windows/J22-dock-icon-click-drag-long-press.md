# J22：DockIcon 的点击、拖拽与长按删除

## Dock 上的每个图标都是一个小型交互系统

Dock 图标不只是按钮：它要支持拖拽排序、悬停放大、长按显示删除按钮、右键菜单、工具提示，还要显示运行指示灯。这些交互被拆分到 `DockIcon`、`useDockIconAnimation`、`DockIndicator`、`DockTooltip` 和 `ContextMenu` 中。

这节课聚焦 `packages/web/src/components/os/dock/DockIcon.tsx`，理解一个图标如何同时处理这么多输入。

## 第一段源码：拖拽与长按的状态竞争

[packages/web/src/components/os/dock/DockIcon.tsx 第 24—37 行](../../../../packages/web/src/components/os/dock/DockIcon.tsx#L24)：

```ts
const dragStartPos = useRef<{ x: number; y: number } | null>(null);
const [_isActuallyDragging, setIsActuallyDragging] = useState(false);

const [isLongPressing, setIsLongPressing] = useState(false);
const [showDeleteButton, setShowDeleteButton] = useState(false);
const longPressTimer = useRef<NodeJS.Timeout | null>(null);
```

`DockIcon` 同时处理两种指针手势：

- **拖拽**：通过 `@dnd-kit/core` 的 `useDraggable` 实现，移动超过 5px 视为拖拽。
- **长按**：按住 800ms 后进入删除模式，显示红色删除按钮。

这两种手势会竞争同一个指针事件。代码里用 `dragStartPos` 记录起点，用移动距离判断是不是拖拽；如果是拖拽，就取消长按计时器。

## 第二段源码：指针按下与移动

[packages/web/src/components/os/dock/DockIcon.tsx 第 58—101 行](../../../../packages/web/src/components/os/dock/DockIcon.tsx#L58)：

```ts
const handlePointerDown = useCallback((e: React.PointerEvent) => {
  dragStartPos.current = { x: e.clientX, y: e.clientY };
  setIsActuallyDragging(false);

  longPressTimer.current = setTimeout(() => {
    setIsLongPressing(true);
    setShowDeleteButton(true);
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, 800);
}, []);

const handlePointerMove = useCallback((e: React.PointerEvent) => {
  if (dragStartPos.current) {
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 5) {
      setIsActuallyDragging(true);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      setIsLongPressing(false);
    }
  }
}, []);
```

按下时同时启动拖拽跟踪和长按计时器。移动超过 5px 后：

- 标记为真正拖拽；
- 取消长按；
- 取消长按视觉反馈。

这个 5px 阈值和 800ms 时长是经验值，用来区分“点击”、“拖拽”和“长按”三种意图。

## 第三段源码：删除按钮与点击外部关闭

[packages/web/src/components/os/dock/DockIcon.tsx 第 111—129 行](../../../../packages/web/src/components/os/dock/DockIcon.tsx#L111)：

```ts
const handleDelete = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  removeApp(app.id);
  setShowDeleteButton(false);
}, [app.id, removeApp]);

useEffect(() => {
  if (!showDeleteButton) return;

  const handleClickOutside = () => {
    setShowDeleteButton(false);
  };

  document.addEventListener('click', handleClickOutside);
  return () => {
    document.removeEventListener('click', handleClickOutside);
  };
}, [showDeleteButton]);
```

长按后，非固定图标右上角出现红色 `X` 删除按钮。点击 `X` 调用 `removeApp(app.id)` 从 Dock 移除。点击页面其他地方则退出删除模式。

注意：删除按钮只对非固定项显示（`!app.isPinned`），固定项不能通过长按删除。

## 第四段源码：运行指示灯

[packages/web/src/components/os/dock/Indicator.tsx](../../../../packages/web/src/components/os/dock/Indicator.tsx)：

```tsx
export default function DockIndicator({ isRunning }: DockIndicatorProps) {
  return (
    <div
      className={`w-1.5 h-1.5 rounded-full transition-opacity duration-200 ${
        isRunning ? 'bg-green-500 opacity-100' : 'opacity-0'
      }`}
    />
  );
}
```

指示灯非常简单：运行时显示绿色圆点，不运行时透明。它放在图标底部中央。

这个组件独立出来，是因为它的视觉逻辑单一，可以单独测试和复用。

## 第五段源码：工具提示定位

[packages/web/src/components/os/dock/Tooltip.tsx](../../../../packages/web/src/components/os/dock/Tooltip.tsx)：

```tsx
const style: React.CSSProperties = side === 'left'
  ? { left: position.x + 36, top: position.y, transform: 'translateY(-50%)' }
  : side === 'right'
    ? { left: position.x - 36, top: position.y, transform: 'translate(-100%, -50%)' }
    : { left: position.x, top: position.y - 12, transform: 'translate(-50%, -100%)' };
```

`DockTooltip` 根据 `side` 决定工具提示位置：

- `left`：在图标右侧显示。
- `right`：在图标左侧显示。
- `bottom`：在图标上方居中显示。

Tooltip 通过 `position` 传入图标中心坐标，再用 inline style 偏移。这里用 inline style 是因为位置是动态计算的，Tailwind 类名无法表达这种运行时几何关系。

## 第六段源码：动画 Hook 的使用

[packages/web/src/components/os/dock/DockIcon.tsx 第 39—40 行](../../../../packages/web/src/components/os/dock/DockIcon.tsx#L39)：

```ts
const { styles, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp, tooltipVisible } =
  useDockIconAnimation();
```

`useDockIconAnimation` 封装了悬停放大、按下缩小、工具提示延迟显示等动画细节。`DockIcon` 只需要把返回的 `onMouseEnter` / `onMouseLeave` / `onMouseDown` / `onMouseUp` 绑定到 DOM 事件上。

放大比例默认 1.3，按下比例 0.95，动画时长来自 Fluent 动画系统。这个 Hook 让 DockIcon 主文件保持关注交互分发，而不是动画细节。

## 本节小结

- `DockIcon` 同时处理拖拽（`@dnd-kit`）、长按删除、悬停动画、工具提示和右键菜单。
- 指针按下时同时启动拖拽跟踪和 800ms 长按计时器；移动超过 5px 取消长按。
- 删除按钮只对非固定项显示，点击外部或点击 `X` 退出删除模式。
- `DockIndicator` 和 `DockTooltip` 是独立的视觉组件，职责单一。
- `useDockIconAnimation` 把 Fluent 动画封装成可复用 Hook，简化 DockIcon 主文件。

下一节课，我们看 Dock 的右键菜单和动画 Hook 的具体实现。
