# J03：AppCard 如何把配置变成可点击、可固定、可删除的卡片

## 配置对象不会自己变成 UI

J02 已经知道，`HOME_APPS` 是一个纯数组配置。但配置对象不会自己出现在屏幕上。这节课进入 `components/framework/AppCard.tsx`，看一张配置如何变成 OriginOS 首页上那张带渐变背景、Emoji 图标、固定图钉、删除按钮的卡片。

要回答的核心问题是：`AppCard` 到底处理了哪些交互？哪些事情它自己做，哪些事情交给父组件？

## 第一段源码：AppCardProps 接口

[packages/web/src/components/framework/AppCard.tsx 第 28—47 行](../../../../packages/web/src/components/framework/AppCard.tsx#L28) 定义了组件接收的所有参数：

```ts
interface AppCardProps {
  id: string;
  name: string;
  description: string;
  icon: string;
  path?: string;
  color?: string;
  onClick?: () => void;
  action?: 'install' | 'update' | 'launch';
  rightAction?: React.ReactNode;
  className?: string;
  onDelete?: () => void;
  dockType?: 'agent' | 'skill' | 'action';
  skillName?: string;
  tourId?: string;
}
```

这个接口比 `HomeAppConfig` 多了一些字段，因为 `AppCard` 不仅要渲染首页固定卡片，还要服务其他场景：技能市场、Dock 应用、用户 Agent 列表等。所以它有 `action`、`rightAction`、`onDelete`、`dockType`、`tourId` 等扩展字段。

关键区分：`AppCard` 是通用组件，`HomeAppConfig` 是首页专用配置。`page.tsx` 在渲染时把 `HomeAppConfig` 映射成 `AppCardProps`，例如把 `type: 'skill'` 映射成 `dockType: 'skill'`，把 `skillName` 原样传入。

## 第二段源码：点击行为的两个分支

[packages/web/src/components/framework/AppCard.tsx 第 73—79 行](../../../../packages/web/src/components/framework/AppCard.tsx#L73) 是点击处理：

```ts
const handleClick = () => {
  if (path) {
    window.location.href = path;
  } else if (onClick) {
    onClick();
  }
};
```

这里有一个清晰的优先级：`path` 优先于 `onClick`。如果传入 `path`，卡片变成普通链接跳转；如果只有 `onClick`，卡片变成自定义行为触发器。首页的固定卡片通常不传 `path`，而是传 `onClick`，由 `page.tsx` 决定打开哪个窗口。

这个设计让 `AppCard` 可以同时用于：

- 首页应用卡片（`onClick` 打开窗口）
- Dock 应用列表（`onClick` 恢复窗口）
- 技能市场条目（`path` 跳转到详情页）

## 第三段源码：固定到 Dock

[packages/web/src/components/framework/AppCard.tsx 第 81—98 行](../../../../packages/web/src/components/framework/AppCard.tsx#L81) 处理“固定到 Dock”：

```ts
const handlePinToDock = (e: React.MouseEvent) => {
  e.stopPropagation();
  if (!isPinnedToDock) {
    addApp({
      id,
      name,
      icon,
      iconType: 'emoji',
      isRunning: false,
      isPinned: true,
      appType: dockType,
      skillName,
    });
    const updatedApps = useDockStore.getState().apps;
    syncDockApps(updatedApps);
  }
};
```

这里出现了两个重要依赖：

1. `useDockStore`：Web 端的 Zustand 状态，保存 Dock 应用列表。
2. `syncDockApps`：来自 `@originos/core/lib/integrations/electron/window`，用于把 Dock 状态同步到 Electron 的独立 Dock 窗口。

`e.stopPropagation()` 防止点击图钉时触发卡片的 `handleClick`。

`isPinnedToDock` 通过 `apps.some(app => app.id === id)` 计算，说明 Dock 去重靠 `id` 唯一性。如果同一张卡片被固定两次，第二次不会新增。

`syncDockApps` 的调用说明：即使在 Web 版本中，`AppCard` 也预留了与 Electron Dock 窗口的同步能力。这是 Web 与 Desktop 共享组件的体现。

## 第四段源码：删除确认

[packages/web/src/components/framework/AppCard.tsx 第 100—109 行](../../../../packages/web/src/components/framework/AppCard.tsx#L100) 处理删除：

```ts
const confirmDelete = (e: React.MouseEvent) => {
  e.stopPropagation();
  onDelete?.();
  setShowDeleteConfirm(false);
};

const cancelDelete = (e: React.MouseEvent) => {
  e.stopPropagation();
  setShowDeleteConfirm(false);
};
```

删除不是立即执行，而是先显示一个确认覆盖层（`showDeleteConfirm`）。确认覆盖层用 `absolute inset-0` 覆盖整个卡片，背景半透明毛玻璃。确认后才调用 `onDelete`，而 `onDelete` 的具体逻辑由父组件提供。

这体现了 `AppCard` 的设计原则：**交互 UI 自己管，业务逻辑父组件管**。固定到 Dock 是个例外，因为它需要直接操作 `dockStore`。

## 第五段源码：操作按钮

[packages/web/src/components/framework/AppCard.tsx 第 111—143 行](../../../../packages/web/src/components/framework/AppCard.tsx#L111) 根据 `action` 显示不同按钮：

```ts
const getActionButton = () => {
  switch (action) {
    case 'launch':
      return <Button onClick={handleClick} variant="outline" size="sm" className="mt-3">打开</Button>;
    case 'install':
      return <Button onClick={handleClick} size="sm" className={cn('mt-3 bg-surface', 'hover:bg-surface/80')}>获取</Button>;
    case 'update':
      return <Button onClick={handleClick} variant="outline" size="sm" className="mt-3">更新</Button>;
    default:
      return null;
  }
};
```

注意 `Button` 的 `onClick` 也是 `handleClick`，与卡片整体的 `onClick` 一致。这意味着点击“打开”按钮和点击卡片主体效果相同。按钮只是视觉提示，不是独立行为。

首页固定卡片的 `action` 默认是 `'launch'`，所以显示“打开”。技能市场场景可能会传 `'install'` 或 `'update'`。

## 视觉层：从图标到毛玻璃

[packages/web/src/components/framework/AppCard.tsx 第 170—242 行](../../../../packages/web/src/components/framework/AppCard.tsx#L170) 是 JSX 渲染。重点看两个地方。

图标渲染分支：

```tsx
{icon.startsWith('data:') || icon.startsWith('http') ? (
  <img src={icon} alt={name} className="w-8 h-8" />
) : (
  <AppIcon emoji={icon} size={28} />
)}
```

`icon` 字段虽然是字符串，但可能是三种东西：Emoji、Data URL、HTTP URL。组件通过前缀判断。这是 `AppCard` 比 `HomeAppConfig` 类型更复杂的原因——配置层只声明 `string`，组件层要处理具体语义。

渐变背景：

```tsx
style={{
  '--tw-gradient-from': `${color}20`,
  '--tw-gradient-to': `${color}05`,
} as React.CSSProperties}
```

这里把 `color`（例如 `from-primary`）转换成带透明度的 CSS 变量。注意它用内联 `style` 注入 CSS 变量，再用 Tailwind 的 `bg-gradient-to-br` 类名消费。这是 Tailwind 动态颜色的一种常见 workaround。

## AppCard 与首页的衔接

回到 `app/page.tsx`，它大概这样渲染固定卡片：

```tsx
{HOME_APPS.map((app) => (
  <AppCard
    key={app.id}
    id={app.id}
    name={app.name}
    description={app.description}
    icon={app.icon}
    color={app.color}
    onClick={() => handleSkillLaunch(app.skillName)}
    dockType={app.type}
    skillName={app.skillName}
  />
))}
```

`AppCard` 不关系 `app.type` 是 `'skill'` 还是 `'action'`，它只接收 `onClick`。`page.tsx` 根据 `type` 分发到不同 `handle*` 函数。这再次验证了前一节的结论：配置层做分发，组件层做渲染和通用交互。

## 本节小结

- `AppCard` 是通用卡片组件，props 比 `HomeAppConfig` 更丰富，以支持首页、Dock、技能市场等多场景。
- 点击行为分 `path` 跳转和 `onClick` 回调两路，首页用后者。
- 固定到 Dock 直接操作 `useDockStore` 并调用 `syncDockApps` 同步 Electron Dock 窗口。
- 删除采用二次确认，具体删除逻辑由父组件注入。
- 图标支持 Emoji、Data URL、HTTP URL 三种形式；渐变背景通过 CSS 变量动态生成。
- `AppCard` 不决定打开哪个窗口，只负责把点击事件交回给父组件。

下一节课，我们将暂时离开当前首页的生产路径，去看一组“长得很像首页”但实际上已被弃用的组件：`OSFramework`、`Sidebar`、`Taskbar`、`StatusBar`。理解它们为什么还在仓库里，以及为什么不应该再从它们开始改首页。
