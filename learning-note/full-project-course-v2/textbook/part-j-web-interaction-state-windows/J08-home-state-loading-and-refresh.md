# J08：首页状态联动：项目 / Agent / 技能列表的加载与刷新

## 首页上的卡片不是静态的

除了 `HOME_APPS` 固定的 6 张应用卡片，OriginOS 首页还会显示：

- 项目卡片列表
- 用户创建的 Agent 列表
- 用户安装的技能列表

这些数据来自后端或本地文件系统，需要异步加载。这节课要追踪：项目、Agent、技能分别是如何加载的？删除后如何刷新？Skill 会话关闭后为什么也要刷新首页数据？

## 第一段源码：useProjects Hook

[packages/web/src/lib/hooks/use-projects.ts](../../../../packages/web/src/lib/hooks/use-projects.ts) 封装了项目列表的状态管理。它接收三个选项：

```ts
export interface UseProjectsOptions {
  autoLoad?: boolean;
  query?: ProjectQuery;
  refreshInterval?: number;
}
```

`page.tsx` 中使用它的方式在 [packages/web/src/app/page.tsx 第 743—753 行](../../../../packages/web/src/app/page.tsx#L743)：

```ts
const {
  projects,
  isLoading: isLoadingProjects,
  loadProjects,
  createProject,
} = useProjects({
  autoLoad: true,
  query: {}, // Load all projects (both draft and active)
  refreshInterval: -1, // Disable polling
});
```

这里的选择很关键：

- `autoLoad: true`：组件挂载时自动加载。
- `query: {}`：加载所有项目，不筛选状态。
- `refreshInterval: -1`：禁用轮询，只在显式调用或创建项目时刷新。

禁用轮询是合理的，因为项目列表不会频繁变化，持续轮询会增加不必要的 I/O。刷新主要靠事件驱动（例如创建项目、删除项目、窗口关闭）。

## 第二段源码：Agent 和技能的加载

[packages/web/src/app/page.tsx 第 558—594 行](../../../../packages/web/src/app/page.tsx#L558) 用本地 `useState` 管理 Agent 和技能：

```ts
const [userAgents, setUserAgents] = React.useState<UserAgent[]>([]);
const [userSkills, setUserSkills] = React.useState<Array<{ id; name; description; icon; color; skillName }>>([]);

const loadUserAgents = React.useCallback(() => {
  listUserAgents()
    .then(result => {
      if (result.success) setUserAgents(result.data as UserAgent[]);
    })
    .catch(() => {});
}, []);

const loadUserSkills = React.useCallback(() => {
  listUserSkills()
    .then(result => {
      if (result.success) {
        const skills = (result.data || []) as Array<{ id; name; description }>;
        setUserSkills(skills.map((s) => ({
          id: `user-skill-${s.id}`,
          name: s.name,
          description: s.description,
          icon: '⚡',
          color: 'from-amber-500',
          skillName: s.id,
        })));
      }
    })
    .catch(() => {});
}, []);
```

与 `useProjects` 不同，Agent 和技能没有封装成 Hook，而是直接在 `page.tsx` 里用 `useState` + `useCallback`。原因可能是它们的使用范围目前只限于首页，不需要复用。

注意 `loadUserSkills` 做了数据转换：后端返回的 `id` 被包装成 `user-skill-${s.id}`，同时补全了 `icon` 和 `color`。这说明 `userSkills` 的状态形状是为了适配 `AppCard` 渲染，而不是后端原始数据。

## 第三段源码：删除后的刷新

[packages/web/src/app/page.tsx 第 596—614 行](../../../../packages/web/src/app/page.tsx#L596) 是删除回调：

```ts
const handleDeleteAgent = React.useCallback(async (agentId: string) => {
  try {
    await deleteUserAgent(agentId);
    loadUserAgents();
  } catch (error) {
    console.error('[HomePage] Failed to delete agent:', error);
  }
}, [loadUserAgents]);

const handleDeleteSkill = React.useCallback(async (skillId: string) => {
  try {
    const rawId = skillId.replace('user-skill-', '');
    await deleteUserSkill(rawId);
    loadUserSkills();
  } catch (error) {
    console.error('[HomePage] Failed to delete skill:', error);
  }
}, [loadUserSkills]);
```

删除 Agent 后直接调用 `loadUserAgents()` 刷新列表。删除技能时需要先把 `user-skill-${id}` 还原成原始 `id`，再调用 `deleteUserSkill`。

这里没有乐观更新：先等待 API 返回成功，再刷新列表。如果删除失败，列表不会变化。这是一个保守但稳妥的策略。

## 第四段源码：事件驱动的刷新

[packages/web/src/app/page.tsx 第 716—741 行](../../../../packages/web/src/app/page.tsx#L716) 注册了三个刷新事件：

```ts
// 监听原生窗口关闭事件，同步更新 dock 图标并刷新首页数据
React.useEffect(() => {
  if (!isElectron()) return;
  return subscribeToNativeWindowClosed((windowId) => {
    AppWindowManager.getInstance().closeWindow(windowId);
    loadUserAgents();
    loadUserSkills();
  });
}, [loadUserAgents, loadUserSkills]);

// Initial data load
React.useEffect(() => {
  loadUserAgents();
  loadUserSkills();
}, [loadUserAgents, loadUserSkills]);

// 监听 SkillDialog 关闭事件，刷新 Agent 和技能列表
React.useEffect(() => {
  const handleSessionClose = () => {
    loadUserAgents();
    loadUserSkills();
  };
  window.addEventListener('skill:session-close', handleSessionClose);
  return () => window.removeEventListener('skill:session-close', handleSessionClose);
}, [loadUserAgents, loadUserSkills]);
```

刷新路径可以总结成下表：

| 触发时机 | 刷新内容 | 说明 |
| --- | --- | --- |
| 组件挂载 | Agent + 技能 | 初始加载 |
| 删除 Agent/技能 | 对应列表 | 用户主动删除 |
| Electron 原生窗口关闭 | Agent + 技能 | 窗口关闭可能伴随 Agent/Skill 产物变化 |
| `skill:session-close` 事件 | Agent + 技能 | Skill 会话结束可能创建了新 Agent 或安装了新 Skill |

项目列表的刷新与 Agent/技能 是分离的，因为 `useProjects` 自己管理刷新逻辑。这种分离导致首页有三种不同的数据刷新模型：

1. `useProjects`：封装式，有 `loadProjects`/`createProject`。
2. `userAgents`/`userSkills`：手动式，由 `page.tsx` 直接管理。
3. `settingsStore`：Zustand 式，订阅全局状态。

## 第五段源码：dock:action 事件也触发加载

上一段源码之前的 [packages/web/src/app/page.tsx 第 616—714 行](../../../../packages/web/src/app/page.tsx#L616) 监听 `dock:action`。虽然它主要处理窗口打开/聚焦，但其中某些 action 也会间接影响列表：

- `create-project`：创建新项目后，`useProjects` 内部会刷新项目列表。
- `launch-skill` / `launch-agent`：打开 Skill/Agent 窗口，不直接刷新列表。
- `focus-window`：聚焦已有窗口，不刷新列表。

Dock 动作的处理逻辑比较长，因为它要根据不同 action 调用不同的 `openComponentWindow`。这部分与窗口管理器强相关，Unit 2 会再展开。

## 数据未加载时的表现

`page.tsx` 用 `isLoadingProjects` 控制项目列表的加载状态。Agent 和技能列表没有显式 loading 状态，所以它们的初始渲染是空数组，页面直接显示为空。如果加载失败，`loadUserAgents`/`loadUserSkills` 的 `.catch(() => {})` 会静默吞掉错误，页面上没有任何错误提示。

这是当前实现的一个弱点：Agent/技能加载失败时，用户只能看到空白，无法知道是网络问题、文件系统问题还是配置问题。

## 本节小结

- 项目列表通过 `useProjects` Hook 管理，支持自动加载、查询、创建、删除、轮询刷新。
- Agent 和技能列表由 `page.tsx` 直接用 `useState` + `useCallback` 管理，做了状态形状转换。
- 删除操作成功后调用对应的 `load*` 函数刷新列表，没有乐观更新。
- 首页监听原生窗口关闭和 `skill:session-close` 事件，在会话结束后刷新 Agent/技能列表。
- 项目、Agent、技能使用三种不同的状态管理模型，这是首页状态层的一个重要特征。
- Agent/技能加载失败被静默捕获，当前没有错误提示。

下一节课是 Unit 1 小结课，我们将把 J01–J08 的源码串成一张可排查的首页链路地图。
