# J13：Web 模式下窗口如何从 Store 渲染到 DOM

## Store 里有了记录，屏幕上还没有窗口

J10-J12 读完状态层和入口层后，一个自然的问题是：`appWindowStore` 里的窗口记录，是怎么变成屏幕上那个可拖拽的窗口的？

答案分两步：

1. `AppWindowContainer` 从 store 读取所有窗口记录；
2. 对每个记录渲染一个 `AppWindow` 组件，并用 React Portal 挂载到 `document.body`。

这节课看第一步：容器如何选择、排序、过滤窗口。

## 第一段源码：AppWindowContainer 的读取

[packages/web/src/components/os/window/AppWindowContainer.tsx 第 15—25 行](../../../../packages/web/src/components/os/window/AppWindowContainer.tsx#L15)：

```tsx
export function AppWindowContainer() {
  const windows = useAppWindowStore((state) => state.windows);
  const windowOrder = useAppWindowStore((state) => state.windowOrder);

  // 获取所有窗口（包括最小化），按 z-index 排序；最小化窗口保活但隐藏
  const allWindows = windowOrder
    .map((id) => windows[id])
    .filter((win): win is NonNullable<typeof win> => win != null)
    .filter((win) => !(isElectron() && win.metadata?.['renderMode'] === 'native'))
    .sort((a, b) => a.position.zIndex - b.position.zIndex);
  ...
}
```

这里有几个关键决策：

1. 按 `windowOrder` 遍历，而不是直接遍历 `windows` 对象。这样保证渲染顺序稳定。
2. `.filter((win) => win != null)` 防御性过滤，防止 `windowOrder` 里有 stale ID。
3. `.filter((win) => !(isElectron() && win.metadata?.['renderMode'] === 'native'))` 过滤掉 Electron native 窗口。Native 窗口由 BrowserWindow 自己渲染，不需要 React DOM。
4. `.sort((a, b) => a.position.zIndex - b.position.zIndex)` 按 z-index 升序排列。z-index 小的先渲染，z-index 大的后渲染，自然覆盖在前。

注意：最小化窗口不会被过滤掉，只是渲染时会隐藏。这保证了窗口状态保活，点击 Dock 或任务栏可以恢复。

## 第二段源码：渲染 AppWindow

[packages/web/src/components/os/window/AppWindowContainer.tsx 第 30—48 行](../../../../packages/web/src/components/os/window/AppWindowContainer.tsx#L30)：

```tsx
return (
  <>
    {allWindows.map((windowData) => (
      <AppWindow
        key={windowData.id}
        windowId={windowData.id}
        config={{
          id: windowData.id,
          type: windowData.type,
          title: windowData.title,
          icon: windowData.icon,
          position: windowData.position,
          constraints: windowData.constraints,
          content: windowData.content,
          metadata: windowData.metadata,
        }}
      />
    ))}
  </>
);
```

`AppWindowContainer` 把 `AppWindowData` 的部分字段提取成 `AppWindowConfig` 传给 `AppWindow`。它自己不处理任何交互逻辑，只负责“遍历 store 并渲染”。

这是一个清晰的职责分离：

- `AppWindowContainer`：列表渲染。
- `AppWindow`：单窗口交互。
- `appWindowStore`：状态真相。

## 为什么用 windowOrder 而不是 Object.keys

如果用 `Object.keys(windows)` 遍历，窗口的渲染顺序取决于对象键的插入顺序。虽然 JavaScript 对象在大多数现代引擎中保留插入顺序，但依赖这个特性不够显式。`windowOrder` 数组明确表达了“窗口打开顺序”这一业务概念。

更重要的是，`windowOrder` 在关闭窗口时用于确定新的聚焦窗口（取数组最后一个）。如果用 `Object.keys`，就无法稳定地知道“最上层”窗口。

## 过滤 native 窗口的意义

Electron 模式下，`AppWindowManager` 会创建真实的 BrowserWindow，并把 `renderMode: 'native'` 写入 metadata。`AppWindowContainer` 过滤掉这些记录，避免在 DOM 中渲染一个“影子窗口”。

但 store 里仍然保留 native 窗口记录，原因有：

1. Dock 同步需要知道有哪些运行中窗口；
2. `focusWindow` / `closeWindow` 需要找到对应 native 窗口 ID；
3. `getOpenWindows` 等查询需要包含所有窗口。

所以 native 窗口记录是“逻辑存在、DOM 不存在”。

## 空状态处理

```tsx
if (allWindows.length === 0) {
  return null;
}
```

没有窗口时，`AppWindowContainer` 返回 `null`。这意味着页面上不会有多余的 DOM 节点。`page.tsx` 可以一直挂载 `<AppWindowContainer />` 而不用担心空窗口时的性能开销。

## 本节小结

- `AppWindowContainer` 从 `appWindowStore` 读取 `windows` 和 `windowOrder`。
- 它按 `windowOrder` 遍历，过滤掉 native 窗口，按 z-index 升序排序后渲染 `AppWindow`。
- 最小化窗口不被过滤，只是在 `AppWindow` 内部隐藏，保证状态保活。
- `AppWindowContainer` 只负责列表渲染，单窗口交互交给 `AppWindow`。
- 保留 native 窗口的 store 记录，是为了 Dock 同步、窗口操作和状态查询。

下一节课，我们将进入 `AppWindow`，看单个窗口的拖拽、聚焦、关闭、Portal 渲染和内容挂载。
