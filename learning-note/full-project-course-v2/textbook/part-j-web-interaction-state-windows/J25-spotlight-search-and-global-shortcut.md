# J25：Spotlight 搜索与全局快捷键

## 从按下快捷键到打开窗口，Spotlight 分几步？

上一节课看完 Spotlight 的 store 设计，这节课看视图层和搜索逻辑：`useSpotlight` 负责快捷键绑定和键盘导航，`useSpotlightSearch` 负责防抖过滤，`Spotlight` 组件负责面板渲染，`SpotlightSearch` / `SpotlightResults` 负责输入和结果列表。

## 第一段源码：全局快捷键绑定

[packages/web/src/hooks/useGlobalShortcut.ts 第 20—46 行](../../../../packages/web/src/hooks/useGlobalShortcut.ts#L20)：

```ts
export function useGlobalShortcutForKey(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) {
        return;
      }

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        e.ctrlKey === (options.ctrl ?? false) &&
        e.metaKey === (options.meta ?? false) &&
        e.shiftKey === (options.shift ?? false)
      ) {
        e.preventDefault();
        e.stopPropagation();
        callback();
      }
    };

    window.addEventListener('keydown', handler, { capture: true, passive: false });
    return () => window.removeEventListener('keydown', handler, true);
  }, [callback, key, options.ctrl, options.meta, options.shift]);
}
```

`useGlobalShortcutForKey` 在 `capture` 阶段监听 `window` 的 `keydown`，确保优先级最高。它会跳过可编辑元素（input、textarea、contentEditable），避免在输入框里按 `Cmd+K` 误触发 Spotlight。

还有一个 `useGlobalShortcut` 版本不用 capture 阶段，适用于优先级较低的场景。

## 第二段源码：useSpotlight 整合快捷键与键盘导航

[packages/web/src/hooks/useSpotlight.ts 第 13—46 行](../../../../packages/web/src/hooks/useSpotlight.ts#L13)：

```ts
export function useSpotlight() {
  const { isOpen, open, close, selectNext, selectPrevious, executeSelected } = useSpotlightStore();

  const isMac = typeof window !== 'undefined' && /Mac/.test(navigator.platform);
  const shortcutOptions = useMemo(
    () => (isMac ? { meta: true } : { ctrl: true }),
    [isMac]
  );
  useGlobalShortcutForKey('k', open, shortcutOptions);

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectPrevious();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        executeSelected();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close, selectNext, selectPrevious, executeSelected]);

  return { isOpen, open, close };
}
```

`useSpotlight` 做了两件事：

1. **注册全局快捷键**：Mac 用 `Cmd+K`，其他平台用 `Ctrl+K`。
2. **面板内键盘导航**：打开后监听 `Escape`（关闭）、`ArrowDown` / `ArrowUp`（选择上下）、`Enter`（执行）。

注意：全局快捷键和面板内导航是两个独立监听器。全局快捷键始终注册，面板导航只在 `isOpen` 为 true 时注册。

## 第三段源码：搜索过滤与防抖

[packages/web/src/hooks/useSpotlightSearch.ts 第 9—38 行](../../../../packages/web/src/hooks/useSpotlightSearch.ts#L9)：

```ts
export function useSpotlightSearch(items: SpotlightItem[]) {
  const { query, setResults } = useSpotlightStore();
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const filteredResults = useMemo(() => {
    if (!debouncedQuery.trim()) return items;

    const lowerQuery = debouncedQuery.toLowerCase();
    return items.filter(item => {
      const titleMatch = item.title.toLowerCase().includes(lowerQuery);
      const subtitleMatch = item.subtitle?.toLowerCase().includes(lowerQuery);
      const keywordsMatch = item.keywords?.some(k => k.toLowerCase().includes(lowerQuery));
      return titleMatch || subtitleMatch || keywordsMatch;
    });
  }, [debouncedQuery, items]);

  useEffect(() => {
    setResults(filteredResults);
  }, [filteredResults, setResults]);

  return filteredResults;
}
```

搜索逻辑：

1. **防抖**：输入后 150ms 才更新 `debouncedQuery`，减少高频渲染。
2. **空查询返回全部**：如果没有输入，显示完整 `items` 列表。
3. **多字段匹配**：标题、副标题、关键词任一匹配即入选。
4. **不区分大小写**：统一转小写后比较。

这个 Hook 不直接返回 JSX，只负责计算并写入 store 的 `results`。

## 第四段源码：Spotlight 面板入口

[packages/web/src/components/os/spotlight/index.tsx 第 23—57 行](../../../../packages/web/src/components/os/spotlight/index.tsx#L23)：

```tsx
export default function Spotlight({ items: providedItems }: SpotlightProps = {}) {
  const { isOpen, close } = useSpotlight();
  const items = useSpotlightStore((state) => state.items);
  const setItems = useSpotlightStore((state) => state.setItems);

  useEffect(() => {
    if (providedItems) {
      setItems(providedItems);
    }
  }, [providedItems, setItems]);

  useSpotlightSearch(items);

  if (!isOpen) {
    return <div className="hidden" aria-hidden="true" />;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={close}
    >
      <div
        className="w-full max-w-2xl bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <SpotlightSearch />
        <div className="border-t border-white/20" />
        <SpotlightResults />
      </div>
    </div>
  );
}
```

`Spotlight` 组件的职责：

1. 调用 `useSpotlight()` 注册快捷键和获取 `isOpen`。
2. 接收外部传入的 `items` 并写入 store。
3. 调用 `useSpotlightSearch(items)` 启动搜索过滤。
4. 关闭时渲染一个隐藏占位符（保证 Hook 不被卸载，快捷键持续监听）。
5. 打开时渲染全屏遮罩和搜索面板。

点击遮罩关闭面板，点击面板内部不冒泡。

## 第五段源码：搜索输入与结果列表

[packages/web/src/components/os/spotlight/SpotlightSearch.tsx](../../../../packages/web/src/components/os/spotlight/SpotlightSearch.tsx)：

```tsx
export default function SpotlightSearch() {
  const { query, setQuery } = useSpotlightStore();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="搜索应用、项目、Agent、技能..."
      className="w-full bg-transparent px-5 py-4 text-lg text-white outline-none placeholder-white/50"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
    />
  );
}
```

输入框在挂载时自动聚焦并全选，方便用户直接输入。`autoComplete`/`autoCorrect`/`spellCheck` 都关闭，避免浏览器干扰命令面板体验。

[packages/web/src/components/os/spotlight/SpotlightResults.tsx 第 19—66 行](../../../../packages/web/src/components/os/spotlight/SpotlightResults.tsx#L19)：

```tsx
export default function SpotlightResults() {
  const { results, selectedIndex, setSelectedIndex, executeSelected } = useSpotlightStore();

  if (results.length === 0) {
    return <div className="px-4 py-8 text-center text-white/50">没有匹配结果</div>;
  }

  const handleClick = (index: number) => {
    setSelectedIndex(index);
    executeSelected();
  };

  return (
    <div className="max-h-96 overflow-y-auto">
      {results.map((item, index) => (
        <div
          key={item.id}
          onClick={() => handleClick(index)}
          className={`flex cursor-pointer items-center gap-3 border-l-2 px-4 py-3 transition-colors ${
            index === selectedIndex
              ? 'bg-white/20 border-blue-400'
              : 'hover:bg-white/10 border-transparent'
          }`}
        >
          <span className="text-2xl">{item.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium text-white">{item.title}</div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/45">
                {TYPE_LABELS[item.type]}
              </span>
            </div>
            {item.subtitle && <div className="text-white/60 text-sm">{item.subtitle}</div>}
          </div>
          {item.shortcut && <div className="text-white/40 text-xs">{item.shortcut}</div>}
        </div>
      ))}
    </div>
  );
}
```

结果列表：

- 无结果时显示空状态。
- 鼠标悬停和键盘选中都有视觉反馈。
- 每项显示图标、标题、类型标签、副标题、快捷键。
- 点击某一项会选中并立即执行。

## 本节小结

- `useGlobalShortcutForKey` 在 capture 阶段监听快捷键，跳过可编辑元素。
- `useSpotlight` 绑定 `Cmd+K` / `Ctrl+K`，并在面板打开后监听方向键和回车。
- `useSpotlightSearch` 做 150ms 防抖，按标题/副标题/关键词过滤。
- `Spotlight` 组件始终挂载，关闭时渲染隐藏占位符以保持快捷键监听。
- `SpotlightResults` 显示过滤结果，支持键盘高亮和鼠标点击执行。

下一节课，我们看通知中心：通知如何产生、展示、清除。
