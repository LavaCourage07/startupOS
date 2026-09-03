# J15：`/window` 路由是做什么的

## Electron 原生窗口里也要跑 React

J11 和 J12 都提到：Electron 模式下，`AppWindowManager` / `useAppWindowManager` 会调用 `createNativeWindow` 创建一个 BrowserWindow。但 BrowserWindow 里显示什么？

答案是：它加载 Next.js 的 `/window` 路由。`app/window/page.tsx` 就是专门为 Electron 原生窗口准备的内容入口。

这节课看 `/window` 如何根据 URL query 参数渲染不同的窗口内容。

## 第一段源码：动态导入的内容组件

[packages/web/src/app/window/page.tsx 第 8—16 行](../../../../packages/web/src/app/window/page.tsx#L8)：

```tsx
const SkillDialog = dynamic<any>(() => import('@/components/skills/SkillDialog').then(m => ({ default: m.SkillDialog })), { ssr: false });
const WorkspaceWindow = dynamic<any>(() => import('@/components/os/workspace/WorkspaceWindow').then(m => ({ default: m.WorkspaceWindow })), { ssr: false });
const ProjectWorkspace = dynamic<any>(() => import('@/components/os/workspace/ProjectWorkspace').then(m => ({ default: m.ProjectWorkspace })), { ssr: false });
const InterviewWindow = dynamic<any>(() => import('@/components/interview/InterviewWindow').then(m => ({ default: m.InterviewWindow })), { ssr: false });
const AgentDialogContent = dynamic(() => import('@/components/os/agent-dialog/AgentDialogContent'), { ssr: false });
const SolutionDesign = dynamic<any>(() => import('@/components/solution/SolutionDesign').then(m => ({ default: m.SolutionDesign })), { ssr: false });
const CollaborationWindow = dynamic(() => import('./CollaborationWindow'), { ssr: false });
const SandboxWindow = dynamic<any>(() => import('@/components/sandbox/SandboxWindow').then(m => ({ default: m.SandboxWindow })), { ssr: false });
```

所有内容组件都用 `dynamic(..., { ssr: false })` 动态导入。原因：

1. 原生窗口是客户端环境，不需要服务端渲染；
2. 某些组件可能依赖 `window`、`document` 等浏览器 API，SSR 会报错；
3. 代码分割，减少初始包体积。

注意 `AgentDialogContent` 和 `CollaborationWindow` 没有 `<any>` 类型断言，因为它们默认导出就是组件。其他组件需要 `.then(m => ({ default: m.NamedExport }))` 是因为它们使用命名导出。

## 第二段源码：读取 URL Query 参数

[packages/web/src/app/window/page.tsx 第 17—50 行](../../../../packages/web/src/app/window/page.tsx#L17)：

```tsx
function WindowContent() {
  const params = useSearchParams();
  const isNativeWindow = params.get('nativeWindow') === '1';

  const windowType = params.get('windowType') ?? '';
  const title = params.get('title') ?? '';

  const projectId = params.get('projectId') ?? '';
  const projectName = params.get('projectName') ?? title;
  const ontologyId = params.get('ontologyId') ?? undefined;
  const entryType = params.get('entryType') ?? undefined;
  const entryId = params.get('entryId') ?? undefined;
  const sessionId = params.get('sessionId') ?? undefined;
  const skillName = params.get('skillName') ?? undefined;
  const initialMessage = params.get('initialMessage') ?? undefined;
  const agentId = params.get('agentId') ?? '';
  const agentName = params.get('agentName') ?? undefined;
  const agentType = params.get('agentType') ?? undefined;
  const projectDescription = params.get('projectDescription') ?? undefined;
  ...
}
```

`/window` 页面完全由 query 参数驱动。这些参数来自 `AppWindowManager` / `useAppWindowManager` 创建原生窗口时的序列化：

```ts
const query: Record<string, string> = { windowType, title: config.title };
for (const [k, v] of Object.entries(props)) {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    query[k] = String(v);
  }
}
const metaKeys = ['entryType', 'entryId', 'sessionId', 'projectId'];
for (const k of metaKeys) {
  const v = metadata?.[k];
  if (typeof v === 'string') query[k] = v;
}
```

这意味着：

- 只有 primitive 类型的 props 能被传递（string/number/boolean）。
- 函数、React 组件、对象无法通过 URL query 传递。
- `metadata` 中的 `entryType`、`entryId`、`sessionId`、`projectId` 会被显式传递。

## 第三段源码：根据 windowType 渲染内容

[packages/web/src/app/window/page.tsx 第 64—119 行](../../../../packages/web/src/app/window/page.tsx#L64)：

```tsx
{windowType === 'skill' && (
  <SkillDialog skillName={skillName} initialMessage={initialMessage} />
)}
{windowType === 'workspace' && (
  <WorkspaceWindow
    projectId={projectId}
    projectName={projectName}
    ontologyId={ontologyId}
    entryType={entryType}
    entryId={entryId}
  />
)}
{windowType === 'project-workspace' && (
  <ProjectWorkspace projectId={projectId} projectName={projectName} ontologyId={ontologyId ?? ''} />
)}
{windowType === 'interview' && (
  <InterviewWindow projectId={projectId} sessionId={sessionId} projectName={projectName} ontologyId={ontologyId} />
)}
{(windowType === 'agent' || windowType === 'role-agent') && (
  <AgentDialogContent agentId={agentId} agentName={agentName} agentType={agentType} initialMessage={initialMessage} />
)}
{windowType === 'solution' && (
  <SolutionDesign projectId={projectId} projectName={projectName} projectDescription={projectDescription} />
)}
{windowType === 'collaboration' && (
  <CollaborationWindow projectId={projectId} projectName={projectName} />
)}
{windowType === 'sandbox' && (
  <SandboxWindow initialAppId={entryId} />
)}
```

`/window` 是一个巨型 switch：根据 `windowType` 渲染对应内容组件。它把 Electron 原生窗口的“外壳”和“内容”分离：

- 外壳：BrowserWindow（Electron 主进程管理）。
- 内容：`/window` 页面里的动态组件。

这种设计让原生窗口和 Web 窗口可以复用同一套内容组件，只是承载层不同。

## 第四段源码：Native 窗口的透明背景

[packages/web/src/app/window/page.tsx 第 21—29 行](../../../../packages/web/src/app/window/page.tsx#L21)：

```tsx
useEffect(() => {
  if (!isNativeWindow || !isElectron()) return;
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
  const root = document.getElementById('__next') ?? document.querySelector('[data-nextjs-root]');
  if (root instanceof HTMLElement) {
    root.style.background = 'transparent';
  }
}, [isNativeWindow]);
```

当 `nativeWindow=1` 时，页面把 `html`、`body`、Next.js root 都设为透明背景。这样 BrowserWindow 可以显示自定义的 Acrylic/毛玻璃效果，而不是白底。

注意这里直接操作 DOM style，而不是通过 Tailwind 类名。因为 Next.js 的 root 元素在应用代码中不可控，只能通过 DOM API 修改。

## 第五段源码：Suspense 包装

[packages/web/src/app/window/page.tsx 第 125—130 行](../../../../packages/web/src/app/window/page.tsx#L125)：

```tsx
export default function WindowPage() {
  return (
    <Suspense fallback={<div className="w-screen h-screen flex items-center justify-center bg-background text-foreground">Loading...</div>}>
      <WindowContent />
    </Suspense>
  );
}
```

`useSearchParams` 需要 Suspense 边界。`WindowPage` 作为外层提供 fallback UI。原生窗口刚打开时会显示 "Loading..."，直到动态组件加载完成。

## 与 Web 模式的对比

| 维度 | Web 模式 | Electron Native 模式 |
| --- | --- | --- |
| 窗口外壳 | React Portal + `AppWindow` | BrowserWindow |
| 内容挂载 | `AppWindowContainer` 渲染 | `/window` 路由渲染 |
| props 传递 | React props | URL query 参数 |
| 标题栏 | `WindowTitleBar` 组件 | 原生标题栏 |
| 背景 | `page.tsx` 内联或 `Background` | `/window` 页面透明背景 |
| Dock 同步 | 通过 store | 通过 IPC 广播 |

## 本节小结

- `/window` 路由是 Electron 原生窗口的内容入口。
- 它根据 URL query 中的 `windowType` 动态渲染对应内容组件。
- 所有内容组件都使用 `dynamic(..., { ssr: false })`，避免 SSR 问题并实现代码分割。
- 只有 primitive 类型的 props 和特定 metadata 能通过 query 传递。
- `nativeWindow=1` 时，页面设置透明背景，支持自定义 Acrylic 效果。
- `WindowPage` 用 `Suspense` 包裹 `WindowContent`，提供加载 fallback。

下一节课，我们将看 Electron 原生窗口的创建和通信机制：`useElectronWindow` 和 Core Electron window 集成。
