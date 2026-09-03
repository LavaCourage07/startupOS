# J24：Spotlight 状态与索引

## Spotlight 是一个命令面板，不是文件搜索

Spotlight 在 OriginOS 里承担“全局快速启动器”的角色：用户按 `Cmd+K` / `Ctrl+K` 打开搜索面板，输入关键词，选择项目、Skill、Agent 或命令，回车即可打开对应窗口。

这节课先看状态层 `packages/web/src/store/spotlightStore.ts`，理解它的字段设计和执行模型。

## 第一段源码：状态字段

[packages/web/src/store/spotlightStore.ts 第 8—14 行](../../../../packages/web/src/store/spotlightStore.ts#L8)：

```ts
export const useSpotlightStore = create<SpotlightState>((set, get) => ({
  isOpen: false,
  query: '',
  selectedIndex: 0,
  results: [],
  items: [],
  // ... actions
}));
```

五个核心字段：

| 字段 | 含义 |
| --- | --- |
| `isOpen` | 面板是否打开 |
| `query` | 当前搜索词 |
| `selectedIndex` | 当前选中结果的索引 |
| `results` | 过滤后的结果列表 |
| `items` | 完整索引（所有可搜索项） |

`items` 和 `results` 分离：

- `items` 是一次性构建的完整索引；
- `results` 是根据 `query` 实时过滤后的子集。

## 第二段源码：打开、关闭、切换

[packages/web/src/store/spotlightStore.ts 第 15—26 行](../../../../packages/web/src/store/spotlightStore.ts#L15)：

```ts
open: () => set({ isOpen: true, query: '', selectedIndex: 0 }),

toggle: () => {
  const { isOpen } = get();
  if (isOpen) {
    set({ isOpen: false, query: '', selectedIndex: 0, results: [] });
    return;
  }
  set({ isOpen: true, query: '', selectedIndex: 0 });
},

close: () => set({ isOpen: false, query: '', selectedIndex: 0, results: [] }),
```

打开时清空搜索词和选中索引，但不清空 `items`。关闭时清空 `query` 和 `results`，下次打开时重新过滤。

`toggle` 用于快捷键：按一次打开，再按一次关闭。

## 第三段源码：搜索与结果设置

[packages/web/src/store/spotlightStore.ts 第 28—33 行](../../../../packages/web/src/store/spotlightStore.ts#L28)：

```ts
setQuery: (query: string) => set({ query, selectedIndex: 0 }),

setSelectedIndex: (index: number) => set({ selectedIndex: index }),

setResults: (results: SpotlightItem[]) => set({ results, selectedIndex: 0 }),
```

每次修改 `query` 都把 `selectedIndex` 重置为 0，保证用户输入时第一个结果始终高亮。`setResults` 也会重置选中索引。

## 第四段源码：执行选中项

[packages/web/src/store/spotlightStore.ts 第 36—43 行](../../../../packages/web/src/store/spotlightStore.ts#L36)：

```ts
executeSelected: async () => {
  const { results, selectedIndex } = get();
  const selected = results[selectedIndex];
  if (selected) {
    await selected.action();
    get().close();
  }
},
```

`executeSelected` 是 Spotlight 与业务逻辑的桥接点：

1. 从 `results` 中取出当前选中的 `SpotlightItem`；
2. 调用 `item.action()`（这是一个异步函数）；
3. 执行完成后关闭面板。

`action` 通常由调用方注入，例如打开项目工作区、启动 Skill、聚焦 Agent 窗口等。这使得 Spotlight 本身保持通用，不依赖具体业务。

## 第五段源码：键盘导航

[packages/web/src/store/spotlightStore.ts 第 45—57 行](../../../../packages/web/src/store/spotlightStore.ts#L45)：

```ts
selectNext: () => {
  const { selectedIndex, results } = get();
  if (results.length > 0) {
    set({ selectedIndex: (selectedIndex + 1) % results.length });
  }
},

selectPrevious: () => {
  const { selectedIndex, results } = get();
  if (results.length > 0) {
    set({ selectedIndex: selectedIndex === 0 ? results.length - 1 : selectedIndex - 1 });
  }
},
```

`selectNext` / `selectPrevious` 支持循环导航：

- 向下到最后一项后回到第一项；
- 向上到第一项后回到最后一项。

这是命令面板的常见交互模式。

## 索引从哪里来

`items` 不是由 `spotlightStore` 自己构建的，而是由调用方传入。在 `app/page.tsx` 中，`items` 通常来自：

- 用户项目列表（`useProjects`）
- 用户 Agent 列表（`loadUserAgents`）
- 用户 Skill 列表（`loadUserSkills`）
- 系统命令（如设置、创建项目）

每个 `SpotlightItem` 包含：

```ts
interface SpotlightItem {
  id: string;
  type: SpotlightItemType;
  title: string;
  subtitle?: string;
  icon?: string;
  keywords?: string[];
  shortcut?: string;
  action: () => void | Promise<void>;
}
```

`keywords` 用于提高搜索命中率，例如一个项目可以用别名、标签等被搜索到。

## 本节小结

- `spotlightStore` 管理 Spotlight 面板的开关、搜索词、结果列表和选中索引。
- `items` 是完整索引，`results` 是过滤后的结果，两者分离支持实时搜索。
- `executeSelected` 调用选中项的 `action()`，是 Spotlight 与业务逻辑的桥接点。
- 键盘导航支持循环，搜索词变化时重置选中索引。

下一节课，我们看 `useSpotlight` 和 `useSpotlightSearch` 如何把快捷键、防抖过滤和面板渲染串起来。
