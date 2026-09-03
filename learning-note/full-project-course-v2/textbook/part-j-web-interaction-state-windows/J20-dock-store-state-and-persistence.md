# J20：Dock 状态结构与持久化

## Dock 不是写死的底部栏

很多桌面系统把 Dock 当成一个固定 UI 组件，但 OriginOS 把 Dock 视为一个可持久化的状态集合。哪些应用被固定、它们的顺序、Dock 停靠在哪一侧，都保存在 Zustand store 里，并通过 `persist` 中间件写入 `localStorage`。

这节课看 `packages/web/src/store/dockStore.ts`，理解 Dock 的状态字段、actions，以及持久化策略。

## 第一段源码：默认 Dock 应用

[packages/web/src/store/dockStore.ts 第 11—97 行](../../../../packages/web/src/store/dockStore.ts#L11)：

```ts
const DEFAULT_DOCK_APPS: DockApp[] = [
  {
    id: 'app-project-create',
    name: '创建项目',
    icon: '➕',
    iconType: 'emoji',
    isRunning: false,
    isPinned: true,
    index: 0,
    appType: 'action',
  },
  {
    id: 'app-workspace',
    name: '工作区',
    icon: '📝',
    iconType: 'emoji',
    isRunning: false,
    isPinned: true,
    index: 1,
    appType: 'action',
  },
  {
    id: 'skill-agent-creator',
    name: '创建 Agent',
    icon: '🤖',
    iconType: 'emoji',
    isRunning: false,
    isPinned: true,
    index: 2,
    appType: 'skill',
    skillName: 'agent-creator',
  },
  // ... 更多默认项
];
```

默认 Dock 包含两类条目：

- **固定动作入口**：`app-project-create`、`app-workspace`，点击后触发创建项目或打开工作区。
- **固定 Skill 入口**：`skill-agent-creator`、`skill-role-agent-creator`、`skill-creator` 等，点击后启动对应 Skill 窗口。
- **非固定示例项**：`app-brainstorming`、`app-workflow-builder`，`isPinned: false`，属于示例性快捷方式。

每个 `DockApp` 都有 `index` 字段，表示在 Dock 中的顺序。

## 第二段源码：应用身份与去重

[packages/web/src/store/dockStore.ts 第 99—118 行](../../../../packages/web/src/store/dockStore.ts#L99)：

```ts
function getDockAppIdentity(app: DockApp): string {
  return app.skillName ? `skill:${app.skillName}` : `id:${app.id}`;
}

export function dedupeDockApps(apps: DockApp[]): DockApp[] {
  const seenIds = new Set<string>();
  const seenSkillNames = new Set<string>();
  const deduped: DockApp[] = [];

  for (const app of apps) {
    if (seenIds.has(app.id)) continue;
    if (app.skillName && seenSkillNames.has(app.skillName)) continue;

    seenIds.add(app.id);
    if (app.skillName) seenSkillNames.add(app.skillName);
    deduped.push({ ...app, index: deduped.length });
  }

  return deduped;
}
```

去重逻辑有两个维度：

1. **id 去重**：同一个 `id` 不能出现两次。
2. **skillName 去重**：同一个 Skill 不能通过不同 `id` 重复出现。

`dedupeDockApps` 还会重新计算 `index`，保证顺序连续。

这个函数在 `setApps`、`addApp`、`persist merge` 时都会调用，是 Dock 数据一致性的关键。

## 第三段源码：状态字段

[packages/web/src/store/dockStore.ts 第 121—137 行](../../../../packages/web/src/store/dockStore.ts#L121)：

```ts
const useDockStore = create<DockState>()(
  persist(
    (set, _get) => ({
      apps: DEFAULT_DOCK_APPS,
      selectedAppId: null,
      draggedAppId: null,
      draggedAppIndex: null,
      hoveringAppId: null,
      dockSide: 'left' as DockSide,
      dockPosition: { x: 0, y: 0 },
      dockWidth: 0,
      dockContextMenu: {
        isOpen: false,
        appId: null,
        position: null,
      },
      // ... actions
    }),
    // ... persist config
  )
);
```

核心字段：

| 字段 | 含义 |
| --- | --- |
| `apps` | Dock 应用列表 |
| `selectedAppId` | 当前选中的应用（视觉反馈） |
| `draggedAppId` / `draggedAppIndex` | 拖拽中应用 |
| `hoveringAppId` | 鼠标悬停应用 |
| `dockSide` | 停靠侧：`left` / `bottom` / `right` |
| `dockPosition` / `dockWidth` | 位置和宽度（Electron 下可能有用） |
| `dockContextMenu` | 右键菜单状态 |

注意 `apps` 是数组，其他拖拽/菜单状态都是 UI 临时状态。

## 第四段源码：Actions

[packages/web/src/store/dockStore.ts 第 139—224 行](../../../../packages/web/src/store/dockStore.ts#L139)：

```ts
setApps: (apps) => set({ apps: dedupeDockApps(apps) }),

addApp: (app) =>
  set((state) => {
    const appKey = getDockAppIdentity(app);
    const exists = state.apps.some((existing) =>
      existing.id === app.id || getDockAppIdentity(existing) === appKey
    );
    if (exists) return state;
    return {
      apps: dedupeDockApps([...state.apps, { ...app, index: state.apps.length }]),
    };
  }),

removeApp: (appId) =>
  set((state) => ({
    apps: state.apps.filter((a) => a.id !== appId),
    draggedAppId: state.draggedAppId === appId ? null : state.draggedAppId,
  })),

updateApp: (appId, updates) =>
  set((state) => ({
    apps: state.apps.map((app) =>
      app.id === appId ? { ...app, ...updates } : app
    ),
  })),

moveApp: (fromIndex, toIndex) =>
  set((state) => {
    if (fromIndex === toIndex) return state;
    const newApps = [...state.apps];
    const [removed] = newApps.splice(fromIndex, 1);
    if (removed) newApps.splice(toIndex, 0, removed);
    return {
      apps: newApps.map((app, idx) => ({ ...app, index: idx })),
    };
  }),

setAppRunning: (appId, isRunning) =>
  set((state) => ({
    apps: state.apps.map((app) =>
      app.id === appId ? { ...app, isRunning } : app
    ),
  })),

pinApp: (appId) =>
  set((state) => ({
    apps: state.apps.map((app) =>
      app.id === appId ? { ...app, isPinned: true } : app
    ),
  })),

unpinApp: (appId) =>
  set((state) => ({
    apps: state.apps.filter((a) => a.id !== appId),
  })),

uninstallApp: (appId) =>
  set((state) => ({
    apps: state.apps.filter((a) => a.id !== appId),
  })),
```

重点区分：

- `removeApp`：从 Dock 列表中移除，不区分是否固定。
- `unpinApp`：取消固定并移除。当前实现和 `removeApp` 一样。
- `uninstallApp`：卸载应用，当前实现也直接移除。
- `pinApp`：把应用设为固定，但不改变顺序。
- `moveApp`：拖拽排序，重新计算 `index`。

## 第五段源码：持久化策略

[packages/web/src/store/dockStore.ts 第 225—251 行](../../../../packages/web/src/store/dockStore.ts#L225)：

```ts
{
  name: 'originos-dock-store',
  partialize: (state) => ({
    dockSide: state.dockSide,
    apps: state.apps.map(({ id, name, icon, iconType, iconUrl, iconComponent, isPinned, appType, skillName }) => ({
      id, name, icon, iconType, iconUrl, iconComponent, isPinned, appType, skillName,
    })),
  }),
  merge: (persistedState, currentState) => {
    const persisted = persistedState as Partial<DockState>;
    const dedupedApps = dedupeDockApps(persisted.apps ?? []);
    const persistedIds = new Set(dedupedApps.map((a) => a.id));
    const persistedKeys = new Set(dedupedApps.map(getDockAppIdentity));
    const missingDefaults = DEFAULT_DOCK_APPS.filter(
      (a) => a.isPinned && !persistedIds.has(a.id) && !persistedKeys.has(getDockAppIdentity(a))
    );
    return {
      ...currentState,
      ...persisted,
      dockSide: isDockSide(persisted.dockSide) ? persisted.dockSide : currentState.dockSide,
      apps: dedupeDockApps([...dedupedApps, ...missingDefaults]),
    };
  },
}
```

持久化策略很精细：

1. **只存位置和固定项**：`partialize` 只保留 `dockSide` 和 `apps` 的元数据（去掉 `isRunning`、`index` 等运行时状态）。
2. **去重 persisted apps**：加载旧数据时先做一次去重。
3. **补回新增默认固定项**：如果后续版本增加了新的默认固定项，而用户本地没有，则自动补上。这样升级体验更平滑。
4. **校验 dockSide**：防止旧数据里的非法值破坏布局。

这意味着：

- 运行时打开的应用不会被持久化，刷新后消失。
- 用户拖拽排序会被持久化（因为 `index` 虽然没单独存，但数组顺序就是顺序）。
- 升级后新增的系统默认固定项会自动出现。

## 本节小结

- `dockStore` 是 Dock 的单一状态源，管理应用列表、拖拽、右键菜单、停靠侧。
- 应用身份按 `id` 或 `skillName` 去重，保证 Skill 不会重复出现。
- Actions 包括添加、移除、更新、排序、固定、运行状态设置。
- 持久化只保存固定项和停靠侧，运行时状态不保存；合并时会补回新默认固定项。

下一节课，我们看 `Dock` 组件如何监听 `appWindowStore`，把窗口运行状态同步为 Dock 上的运行指示灯。
