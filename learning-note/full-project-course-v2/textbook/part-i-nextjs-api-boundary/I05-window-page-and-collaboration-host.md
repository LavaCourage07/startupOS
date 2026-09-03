# I05：/window 页面与协作窗口：用 query 参数分发多种窗口类型

Electron 版本的 OriginOS 需要一个通用页面来渲染各种独立窗口。`/window?windowType=skill&skillName=...` 就是这样一个入口。这节课解决的问题是：同一个页面如何根据 query 参数渲染完全不同的内容？协作窗口在这个架构中扮演什么角色？

## 1. /window 是一个通用窗口容器

`app/window/page.tsx` 只有 130 行，核心逻辑是：

1. 读取 URL query 参数。
2. 根据 `windowType` 动态导入并渲染对应组件。
3. 如果是 Electron 原生窗口，设置透明背景。

```tsx
'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { isElectron } from '@originos/core/lib/integrations/electron/env';

const SkillDialog = dynamic<any>(() => import('@/components/skills/SkillDialog').then(m => ({ default: m.SkillDialog })), { ssr: false });
const WorkspaceWindow = dynamic<any>(() => import('@/components/os/workspace/WorkspaceWindow').then(m => ({ default: m.WorkspaceWindow })), { ssr: false });
// ... 更多动态导入

function WindowContent() {
  const params = useSearchParams();
  const isNativeWindow = params.get('nativeWindow') === '1';
  const windowType = params.get('windowType') ?? '';
  // ...
}

export default function WindowPage() {
  return (
    <Suspense fallback={...}>
      <WindowContent />
    </Suspense>
  );
}
```

## 2. 为什么用动态导入

所有窗口内容组件都使用 `next/dynamic` 并设置 `ssr: false`：

```tsx
const SkillDialog = dynamic<any>(
  () => import('@/components/skills/SkillDialog').then(m => ({ default: m.SkillDialog })),
  { ssr: false }
);
```

原因有两个：

1. **这些组件依赖客户端 API**：`window`、Zustand、localStorage、IPC 等。服务端渲染会失败或产生 hydration 问题。
2. **按需加载**：如果用户只打开 Skill 窗口，不需要加载 Workspace 或 Collaboration 的代码。

注意 `dynamic` 的 `any` 类型断言。项目规约要求严格 TypeScript、禁止 `any`，但这里使用 `any` 是为了绕过动态导入的类型推断困难。阅读时要意识到这是类型妥协，不是推荐做法。

## 3. query 参数到组件的映射

`WindowContent` 从 `useSearchParams` 读取参数，然后按 `windowType` 分发：

| windowType | 渲染组件 | 关键参数 |
| --- | --- | --- |
| `skill` | `SkillDialog` | `skillName`, `initialMessage` |
| `workspace` | `WorkspaceWindow` | `projectId`, `projectName`, `ontologyId`, `entryType`, `entryId` |
| `project-workspace` | `ProjectWorkspace` | `projectId`, `projectName`, `ontologyId` |
| `interview` | `InterviewWindow` | `projectId`, `sessionId`, `projectName`, `ontologyId` |
| `agent` / `role-agent` | `AgentDialogContent` | `agentId`, `agentName`, `agentType`, `initialMessage` |
| `solution` | `SolutionDesign` | `projectId`, `projectName`, `projectDescription` |
| `collaboration` | `CollaborationWindow` | `projectId`, `projectName` |
| `sandbox` | `SandboxWindow` | `entryId`（作为 `initialAppId`） |

这个映射表解释了为什么 `/window` 能替代多个独立页面：它把“窗口类型”参数化，而不是为每种窗口写一个页面文件。

## 4. Electron 原生窗口的透明处理

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

当 `nativeWindow=1` 且处于 Electron 环境时，这段 effect 把从 `html` 到 Next.js root 的所有背景都设为透明。这与 `app/dock/page.tsx` 的透明处理类似，但范围更广。

## 5. 协作窗口：/window 中的一种特殊内容

`app/window/CollaborationWindow.tsx` 是 `windowType='collaboration'` 时渲染的内容。它不是一个简单的组件挂载，而是需要先加载用户设置：

```tsx
export default function CollaborationWindow({ projectId, projectName }: CollaborationWindowProps) {
  const [mounted, setMounted] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const llm = useSettingsStore((state) => state.llm);
  const getEffectiveConfig = useSettingsStore((state) => state.getEffectiveConfig);
  const loadFromServer = useSettingsStore((state) => state.loadFromServer);
  const llmConfig = useMemo(
    () => normalizeRuntimeLLMConfig(getEffectiveConfig()),
    [getEffectiveConfig, llm],
  );

  useEffect(() => {
    setMounted(true);
    loadFromServer().then(() => setSettingsLoaded(true));
  }, [loadFromServer]);

  if (!mounted || !settingsLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <MultiAgentLauncher
      projectId={projectId}
      projectName={projectName}
      llmConfig={llmConfig}
      uiDeps={{ MarkdownContent, ChatInputBar, AskUserQuestionComponent, parseAskUserQuestion, removeYamlBlock, useFileUpload }}
    />
  );
}
```

这里有几个要点：

1. **设置需要异步加载**：`loadFromServer()` 从服务端读取用户 LLM 配置，完成后才渲染 `MultiAgentLauncher`。
2. **LLM 配置归一化**：`normalizeRuntimeLLMConfig` 把 store 中的设置转成运行时配置。
3. **注入 UI 依赖**：`MultiAgentLauncher` 来自 Core 的 collaboration-runtime 模块，但它不直接引用 Web 组件，而是通过 `uiDeps` 注入。这是跨包依赖规则的体现（Core 不能依赖 Web，所以 Web 把组件传给 Core）。

## 6. /window 与主页内窗口的关系

主页内也使用 `AppWindowManager.openComponentWindow` 打开 Skill、Workspace 等窗口。`/window` 页面则是 Electron 独立 BrowserWindow 的渲染目标。两者最终挂载的组件相同，但生命周期不同：

```mermaid
flowchart TD
    A[用户动作] -->|Web 模式| B[主页 AppWindowManager]
    A -->|Electron 模式| C[Dock IPC]
    C --> D[主进程打开 BrowserWindow]
    D --> E[/window?windowType=...]
    B --> F[在主页 DOM 中渲染组件]
    E --> G[在新页面 DOM 中渲染组件]
    F --> H[SkillDialog]
    G --> H
```

这种设计的好处是：组件只写一次，既能嵌入主页，也能独立成窗口。

## 7. 失败路径

### 7.1 windowType 缺失或错误

如果 `/window` 没有 `windowType` 参数，或 `windowType` 不在映射表中，页面会渲染一个几乎空白的容器。当前实现没有明确的错误提示分支。

### 7.2 SSR 与 dynamic 的冲突

虽然所有内容组件都设置了 `ssr: false`，但 `WindowContent` 本身使用了 `useSearchParams`，必须在 `Suspense` 内使用。`WindowPage` 已经包裹了 `Suspense`，这是正确的。

### 7.3 协作窗口设置加载失败

如果 `loadFromServer()` 失败，`settingsLoaded` 永远不会变成 `true`，页面会一直显示 Loading。当前实现没有错误分支。

## 8. 测试证据

| 验证动作 | 能证明 | 不能证明 |
| --- | --- | --- |
| 访问 `/window?windowType=skill&skillName=...` | SkillDialog 能独立渲染 | Electron 原生窗口打开时同样工作 |
| 访问 `/window?windowType=collaboration&projectId=...` | CollaborationWindow 能加载设置并渲染 | 多 Agent 协作后端已就绪 |
| 检查 Network 面板 | `loadFromServer` 会请求用户配置 | 配置解析一定正确 |

## 9. 小实验

不运行项目，根据 `app/window/page.tsx` 的代码，预测下面 URL 会渲染什么：

1. `/window?windowType=skill&skillName=trip-planner`
2. `/window?windowType=workspace&projectId=p1`
3. `/window?windowType=unknown`
4. `/window?windowType=collaboration&projectId=p1`

参考答案：

1. `SkillDialog`，传入 `skillName='trip-planner'`。
2. `WorkspaceWindow`，传入 `projectId='p1'`。
3. 没有匹配分支，渲染一个空容器（只有背景）。
4. `CollaborationWindow`，传入 `projectId='p1'`，先加载设置再渲染 `MultiAgentLauncher`。

## 10. 章节收束

本节课看了 OriginOS 最灵活的入口 `/window`。它通过 query 参数和动态导入，把同一个页面变成了多种窗口类型的容器。协作窗口则是其中需要先加载运行时配置、再注入 UI 依赖的特殊内容。

下一节课是本单元小结工作坊，会把所有入口放进同一张地图，并练习从 URL 预测渲染结果。
