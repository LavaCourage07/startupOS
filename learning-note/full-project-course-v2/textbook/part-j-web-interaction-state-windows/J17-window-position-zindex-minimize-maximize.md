# J17：窗口位置、层级、最小化/最大化的约束

## 窗口状态不只是可见性

一个窗口在屏幕上呈现时，系统需要同时管理：位置（x, y）、大小（width, height）、层级（zIndex）、状态（normal/minimized/maximized）。这些都在 `appWindowStore` 里统一维护，而不是分散在各个组件中。

这节课详细看 `appWindowStore` 中的位置更新、层级管理和状态转换。

## 第一段源码：位置更新与约束检查

[packages/web/src/store/appWindowStore.ts 第 256—290 行](../../../../packages/web/src/store/appWindowStore.ts#L256)：

```ts
updateWindowPosition: (windowId: string, position: Partial<AppWindowPosition>) => {
  set((state) => {
    const windowData = state.windows[windowId];
    if (!windowData) return state;

    const constrainedPosition = { ...windowData.position, ...position };

    if (windowData.constraints.keepInBounds && typeof globalThis !== 'undefined' && typeof window !== 'undefined') {
      constrainedPosition.x = Math.max(0, Math.min(constrainedPosition.x, window.innerWidth - 100));
      constrainedPosition.y = Math.max(0, Math.min(constrainedPosition.y, window.innerHeight - 100));
    }

    if (position.width !== undefined) {
      constrainedPosition.width = Math.max(
        windowData.constraints.minWidth,
        Math.min(position.width, windowData.constraints.maxWidth)
      );
    }

    if (position.height !== undefined) {
      constrainedPosition.height = Math.max(
        windowData.constraints.minHeight,
        Math.min(position.height, windowData.constraints.maxHeight)
      );
    }

    return {
      windows: {
        ...state.windows,
        [windowId]: { ...windowData, position: constrainedPosition },
      },
    };
  });
},
```

`updateWindowPosition` 是拖拽和 resize 的底层支撑。它做三类约束：

1. **边界约束**：如果 `keepInBounds` 为 true，窗口不能超出屏幕。留 100px 余量，保证用户总能拖回窗口。
2. **最小尺寸约束**：`width` 不能小于 `minWidth`，`height` 不能小于 `minHeight`。
3. **最大尺寸约束**：`width` 不能大于 `maxWidth`，`height` 不能大于 `maxHeight`。

注意这里检查 `typeof globalThis !== 'undefined' && typeof window !== 'undefined'`，是为了 SSR 安全。在服务端渲染时，`window` 不存在，位置约束跳过。

## 第二段源码：最小化窗口

[packages/web/src/store/appWindowStore.ts 第 156—169 行](../../../../packages/web/src/store/appWindowStore.ts#L156)：

```ts
minimizeWindow: (windowId: string) => {
  set((state) => {
    const windowData = state.windows[windowId];
    if (!windowData) return state;

    return {
      windows: {
        ...state.windows,
        [windowId]: { ...windowData, state: 'minimized' as AppWindowState, isFocused: false },
      },
      focusedWindowId: state.focusedWindowId === windowId ? null : state.focusedWindowId,
    };
  });
},
```

最小化时：

- 窗口状态设为 `'minimized'`；
- `isFocused` 设为 false；
- 如果当前聚焦窗口就是这个窗口，把 `focusedWindowId` 清空。

窗口记录不会被删除，所以恢复时状态完整保留。

## 第三段源码：最大化与还原

[packages/web/src/store/appWindowStore.ts 第 171—212 行](../../../../packages/web/src/store/appWindowStore.ts#L171)：

```ts
maximizeWindow: (windowId: string) => {
  set((state) => {
    const windowData = state.windows[windowId];
    if (!windowData) return state;

    const isMaximized = windowData.state === 'maximized';

    const screenWidth = typeof globalThis !== 'undefined' && typeof window !== 'undefined' ? window.innerWidth : 1920;
    const screenHeight = typeof globalThis !== 'undefined' && typeof window !== 'undefined' ? window.innerHeight : 1080;

    const prevPosition = isMaximized
      ? {
          x: Math.max(0, (screenWidth - 800) / 2),
          y: Math.max(0, (screenHeight - 600) / 2),
          width: 800,
          height: 600,
          zIndex: windowData.position.zIndex,
        }
      : windowData.position;

    return {
      windows: {
        ...state.windows,
        [windowId]: {
          ...windowData,
          state: isMaximized ? 'normal' as AppWindowState : 'maximized' as AppWindowState,
          position: isMaximized
            ? prevPosition
            : { x: 0, y: 0, width: screenWidth, height: screenHeight, zIndex: windowData.position.zIndex },
        },
      },
    };
  });
},
```

`maximizeWindow` 同时承担“最大化”和“还原”两种职责：

- 如果当前不是最大化，把窗口设为全屏（x=0, y=0, width=screenWidth, height=screenHeight）。
- 如果当前是最大化，恢复到默认 800x600 居中位置。

还原位置是硬编码的 800x600 居中，没有保存最大化前的真实位置。这意味着如果用户最大化前窗口在 `(100, 100)`、大小为 `600x400`，点击还原后会变成屏幕居中 800x600。这是一个可以优化的地方。

## 第四段源码：聚焦窗口的 z-index 递增

[packages/web/src/store/appWindowStore.ts 第 228—254 行](../../../../packages/web/src/store/appWindowStore.ts#L228)：

```ts
focusWindow: (windowId: string) => {
  set((state) => {
    const windowData = state.windows[windowId];
    if (!windowData) return state;

    const updatedWindows = Object.fromEntries(
      Object.entries(state.windows).map(([wid, w]) => [
        wid,
        wid === windowId
          ? {
              ...w,
              isFocused: true,
              state: w.state === 'minimized' ? 'normal' as AppWindowState : w.state,
              position: { ...w.position, zIndex: state.maxZIndex + WINDOW_ZINDEX_STEP },
            }
          : { ...w, isFocused: false },
      ])
    );

    return {
      windows: updatedWindows,
      focusedWindowId: windowId,
      maxZIndex: state.maxZIndex + WINDOW_ZINDEX_STEP,
    };
  });
},
```

聚焦窗口时：

- 该窗口 `isFocused: true`，其他窗口 `isFocused: false`；
- 该窗口 z-index 设为新的最大值；
- 如果是最小化状态，自动恢复为 `normal`。

`maxZIndex` 每次聚焦都递增，保证最新聚焦的窗口永远在最前面。这也是 Web 模式下点击窗口即可置顶的原因。

## 第五段源码：打开窗口时的居中计算

[packages/web/src/store/appWindowStore.ts 第 21—29 行](../../../../packages/web/src/store/appWindowStore.ts#L21)：

```ts
const getCenteredPosition = (width: number, height: number): { x: number; y: number } => {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.max(0, (window.innerWidth - width) / 2),
    y: Math.max(0, (window.innerHeight - height) / 2),
  };
};
```

打开窗口时，如果没有指定 x/y，窗口会按尺寸居中显示。SSR 时返回 `(0, 0)`，因为无法知道浏览器视口大小。

## 约束配置的默认值

`DEFAULT_WINDOW_CONSTRAINTS` 来自 `@originos/core/types`，通常包含：

```ts
{
  minWidth: 400,
  minHeight: 300,
  maxWidth: Infinity,
  maxHeight: Infinity,
  allowResize: true,
  keepInBounds: true,
}
```

`page.tsx` 打开窗口时可以覆盖这些约束，例如 Skill 窗口约束 `minWidth: 600, minHeight: 400`。

## 本节小结

- `updateWindowPosition` 统一处理位置更新和边界/尺寸约束。
- 最小化只改状态、取消聚焦，不删除记录。
- 最大化/还原用同一个函数，`maximized` 状态时点击即还原，但还原位置是硬编码的 800x600 居中。
- `focusWindow` 会给窗口新的最大 z-index，并取消其他窗口聚焦。
- 打开窗口时默认按尺寸居中，SSR 期间位置为 `(0, 0)`。

下一节课，我们将把窗口关闭和会话清理串成完整链路：从用户点击关闭按钮，到 `destroyAgentSession` 和 `consolidateMemory` 执行。
