# J23：Dock 右键菜单与图标动画

## 右键菜单和动画都是独立封装的

Dock 图标的右键菜单不是直接写在 `DockIcon.tsx` 里的，而是通过 `useDockContextMenu` Hook 生成菜单项；悬停放大动画也通过 `useDockIconAnimation` 单独封装。这节课把这两个适配层拆开看，理解它们如何与 `dockStore` 和 `ContextMenu` 组件协作。

## 第一段源码：右键菜单项生成

[packages/web/src/hooks/useDockContextMenu.ts 第 23—71 行](../../../../packages/web/src/hooks/useDockContextMenu.ts#L23)：

```ts
const { appId, isPinned } = options;
const dockContextMenu = useDockStore((s) => s.dockContextMenu);
const closeDockContextMenu = useDockStore((s) => s.closeDockContextMenu);
const pinApp = useDockStore((s) => s.pinApp);
const removeApp = useDockStore((s) => s.removeApp);
const [items, setItems] = useState<MenuItem[]>([]);

useEffect(() => {
  setItems([
    {
      id: 'open',
      label: '打开',
      icon: '📂',
      onClick: () => {
        console.log(`Open app: ${appId}`);
        window.dispatchEvent(
          new CustomEvent('app-open', { detail: { appId } })
        );
      },
    },
    {
      id: 'separator-1',
      label: '',
      separator: true,
      onClick: () => {},
    },
    {
      id: isPinned ? 'unpin' : 'pin',
      label: isPinned ? '从 Dock 移除' : '固定到 Dock',
      icon: isPinned ? '❌' : '📌',
      onClick: () => (isPinned ? removeApp(appId) : pinApp(appId)),
    },
    {
      id: 'separator-2',
      label: '',
      separator: true,
      onClick: () => {},
    },
    {
      id: 'uninstall',
      label: '卸载',
      icon: '🗑️',
      onClick: () => removeApp(appId),
    },
  ]);
}, [appId, isPinned, pinApp, removeApp]);
```

右键菜单固定包含三项：

1. **打开**：派发 `app-open` 自定义事件。
2. **固定/取消固定**：根据 `isPinned` 切换。
3. **卸载**：从 Dock 移除。

两个分隔线把菜单分成三组。注意“打开”项目前只打印日志并派发事件，实际打开逻辑由监听 `app-open` 的组件处理（目前主要是 `page.tsx`）。

## 第二段源码：菜单的打开与关闭

[packages/web/src/hooks/useDockContextMenu.ts 第 73—111 行](../../../../packages/web/src/hooks/useDockContextMenu.ts#L73)：

```ts
const isOpen = dockContextMenu.isOpen && dockContextMenu.appId === appId;
const position = dockContextMenu.position;

const close = useCallback(() => {
  closeDockContextMenu();
}, [closeDockContextMenu]);

// 点击外部关闭菜单
useEffect(() => {
  if (!isOpen) return;

  const handleClickOutside = () => {
    close();
  };

  const timer = setTimeout(() => {
    document.addEventListener('click', handleClickOutside);
  }, 0);

  return () => {
    clearTimeout(timer);
    document.removeEventListener('click', handleClickOutside);
  };
}, [isOpen, close]);

// ESC 键关闭菜单
useEffect(() => {
  if (!isOpen) return;

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      e.preventDefault();
    }
  };

  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, [isOpen, close]);
```

菜单状态不是每个 `DockIcon` 独立维护，而是统一放在 `dockStore.dockContextMenu` 里。这样保证同一时刻只有一个右键菜单打开。

`isOpen` 的计算条件是 `dockContextMenu.isOpen && dockContextMenu.appId === appId`，只有当前 app 的菜单才会渲染。

点击外部和按 ESC 都会关闭菜单。注意这里用 `setTimeout(..., 0)` 延迟绑定点击外部事件，避免右键点击本身立刻触发关闭。

## 第三段源码：通用 ContextMenu 组件

[packages/web/src/components/os/ContextMenu.tsx 第 8—66 行](../../../../packages/web/src/components/os/ContextMenu.tsx#L8)：

```tsx
export default function ContextMenu({
  position,
  items,
  isOpen,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] bg-gray-900/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl overflow-hidden"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item) => {
        if (item.separator) {
          return <div key={item.id} className="h-px bg-white/20 my-1" />;
        }
        return (
          <button
            key={item.id}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className="w-full px-4 py-2 flex items-center gap-3 text-left text-sm text-white/90 hover:bg-white/10 transition-colors"
          >
            {item.icon && <span className="text-base">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && <span className="text-xs text-white/50">{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}
```

`ContextMenu` 是通用组件：

- 接收 `position`、`items`、`isOpen`、`onClose`。
- 自己处理点击外部关闭。
- 支持分隔线（`separator: true`）和快捷键提示。
- 固定在 `z-[100]`，确保浮在其他 UI 之上。

这个组件不只用于 Dock，也可以用于桌面网格、文件列表等需要右键菜单的地方。

## 第四段源码：Fluent 动画 Hook

[packages/web/src/hooks/useDockIconAnimation.ts 第 33—95 行](../../../../packages/web/src/hooks/useDockIconAnimation.ts#L33)：

```ts
const {
  scale = 1.3,
  pressScale = 0.95,
  duration: animDuration = durations.fast,
  tooltipDelay = 500,
  useSpring = true,
} = options;

const prefersReducedMotion = useReducedMotion();

const [isHovered, setIsHovered] = useState(false);
const [isPressed, setIsPressed] = useState(false);
const [tooltipVisible, setTooltipVisible] = useState(false);
const tooltipTimerRef = useRef<NodeJS.Timeout | null>(null);

const handleMouseEnter = useCallback(() => {
  setIsHovered(true);
  tooltipTimerRef.current = setTimeout(() => {
    setTooltipVisible(true);
  }, tooltipDelay);
}, [tooltipDelay]);

const handleMouseLeave = useCallback(() => {
  setIsHovered(false);
  setIsPressed(false);
  if (tooltipTimerRef.current) {
    clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = null;
  }
  setTooltipVisible(false);
}, []);

const currentScale = isPressed ? pressScale : isHovered ? scale : 1;
const easing = useSpring ? easings.decelerate : easings.standard;

const styles = useMemo(() => {
  if (prefersReducedMotion) return {};
  return {
    transform: `scale(${currentScale})`,
    transition: `transform ${animDuration}ms ${easing}`,
    willChange: 'transform',
  };
}, [currentScale, animDuration, easing, prefersReducedMotion]);
```

这个 Hook 做了四件事：

1. **悬停放大**：默认放大到 1.3 倍。
2. **按下缩小**：按下时缩小到 0.95 倍，模拟物理反馈。
3. **工具提示延迟显示**：悬停 500ms 后才显示 Tooltip，避免快速滑过时闪烁。
4. **无障碍支持**：如果用户设置了减少动画偏好，则禁用动画。

动画时长和缓动函数来自 `@originos/core/lib/features/animations`，保证全系统动画风格一致。

## 本节小结

- `useDockContextMenu` 根据 `isPinned` 生成固定/取消固定、卸载等菜单项，并把打开动作派发给 `app-open` 事件。
- 右键菜单状态统一放在 `dockStore` 中，保证全局只有一个菜单打开。
- `ContextMenu` 是通用浮层组件，支持分隔线、快捷键和点击外部关闭。
- `useDockIconAnimation` 封装 Fluent 风格的悬停/按下动画和 Tooltip 延迟，支持减少动画偏好。

下一节课，我们进入 Spotlight：先看它的状态结构。
