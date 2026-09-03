# J54：包基础：工具、配置、样式与类型

## 本单元的"地基"层

上节课讲了服务适配器。这节课读 Web 包里最基础的文件——它们不包含业务逻辑，但为整个包提供工具函数、类型声明、样式变量和 Core 包的 re-export 桥接。

| 分组 | 文件 | 说明 |
| --- | --- | --- |
| 工具函数 | `lib/utils.ts` | `cn()` 函数 |
| 业务 Hook | `lib/hooks/use-file-upload.ts`、`lib/hooks/use-projects.ts` | 文件上传、项目管理 |
| Feature re-export | `lib/features/ontology-data-store/store.ts`、`lib/features/culture/services/*` | Core → Web 桥接 |
| Storage re-export | `lib/storage/json-store.ts` | Core → Web 桥接 |
| 配置 | `config/system-apps.ts` | 系统内置应用定义 |
| 样式 | `styles/globals.css` | 全局 CSS 变量、主题色、动画 |
| 类型声明 | `ambient.d.ts`、`svg.d.ts`、`vitest.d.ts`、`test-setup.ts` | SVG 导入、测试环境 |
| 模块桩 | `modules/collaboration-runtime/facade.ts`、`modules/neural-channel/`、`modules/view-manager/`、`modules/view-reconciler/` | Core re-export 和未实现桩 |

---

## 第一段源码：lib/utils.ts 的 cn 函数

[packages/web/src/lib/utils.ts 第 1–5 行](../../../../packages/web/src/lib/utils.ts#L1)：

```ts
import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
```

`cn()` 是整个 Web 包使用频率最高的工具函数——每个组件都用它合并 Tailwind 类名。

当前实现只是 `clsx` 的薄封装。注意：J51 里提到 `cn()` 应该是 `clsx` + `tailwind-merge` 的组合，但实际源码里只有 `clsx`，没有 `tailwind-merge`。

> 这意味着如果同时传入 `bg-red-500` 和 `bg-blue-500`，`clsx` 会保留两者，而 `tailwind-merge` 会去重只保留后者。当前实现可能导致 Tailwind 类名冲突。

## 第二段源码：use-file-upload 的文件验证与上传

[packages/web/src/lib/hooks/use-file-upload.ts 第 44–73 行](../../../../packages/web/src/lib/hooks/use-file-upload.ts#L44)：

```ts
function validateFiles(
  files: File[], maxSize: number, allowedTypes: string[] | undefined,
  onError?: (error: Error) => void,
): boolean {
  for (const file of files) {
    if (file.size > maxSize) {
      onError?.(new Error(`文件 "${file.name}" 超过 ${formatFileSize(maxSize)} 大小限制`));
      return false;
    }
    if (allowedTypes && !matchesType(file.type, allowedTypes)) {
      onError?.(new Error(`文件 "${file.name}" 的类型 "${file.type || 'unknown'}" 不被支持`));
      return false;
    }
  }
  return true;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
```

`useFileUpload` 的两个工具函数：

**`validateFiles`**：遍历文件数组，检查大小和类型。`matchesType` 支持通配符模式（如 `image/*`）。

**`fileToBase64`**：把 `File` 对象转为 base64 字符串。分块读取（`chunkSize = 0x8000 = 32768`）避免调用栈溢出——`String.fromCharCode(...chunk)` 如果参数太多会超出 V8 的参数数量限制。

> `btoa` 只接受 Latin1 字符，所以先把 `Uint8Array` 逐字节转为字符串。对于 UTF-8 多字节字符（如中文），这种方式会出错，但文件内容是二进制数据，逐字节处理是正确的。

## 第三段源码：use-file-upload 的隐藏 input 与上传流程

[packages/web/src/lib/hooks/use-file-upload.ts 第 75–175 行](../../../../packages/web/src/lib/hooks/use-file-upload.ts#L75)：

```ts
export function useFileUpload({
  basePath, onUploaded, onError, onStateChange,
  maxSize = DEFAULT_MAX_SIZE, allowedTypes,
}: UseFileUploadOptions) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const getInput = useCallback(() => {
    if (inputRef.current && document.body.contains(inputRef.current)) {
      return inputRef.current;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    // ... 隐藏到屏幕外
    document.body.appendChild(input);
    inputRef.current = input;
    return input;
  }, []);

  return useCallback(async () => {
    const resolvedBasePath = typeof basePath === 'function' ? basePath() : basePath;
    if (!resolvedBasePath) return;

    const input = getInput();
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      input.value = '';

      if (files.length === 0) { cleanup(); return; }
      if (!validateFiles(files, maxSize, allowedTypes, onError)) {
        onStateChange?.('error');
        cleanup();
        return;
      }

      onStateChange?.('uploading');
      try {
        const uploadFiles = await Promise.all(
          Array.from(files).map(async (file) => ({
            name: file.name,
            content: await fileToBase64(file),
            encoding: 'base64' as const,
          })),
        );
        const result = await uploadWorkspaceFiles({
          basePath: resolvedBasePath,
          files: uploadFiles,
        });
        if (result.success) {
          onStateChange?.('done');
          onUploaded?.(result.data?.files ?? []);
          setTimeout(() => onStateChange?.('idle'), 1000);
        } else {
          onStateChange?.('error');
          onError?.(new Error(result.error?.message || 'Upload failed'));
        }
      } catch (error) {
        onStateChange?.('error');
        onError?.(error as Error);
      } finally {
        cleanup();
      }
    };

    input.value = '';
    input.click();
  }, [basePath, onUploaded, onError, onStateChange, maxSize, allowedTypes, getInput]);
}
```

`useFileUpload` 的设计：

1. **隐藏 input**：动态创建 `<input type="file">`，定位到屏幕外（`left: -9999px`），不占 DOM 空间；
2. **复用 input**：`inputRef` 缓存创建的 input 元素，避免重复创建；
3. **basePath 支持函数**：`typeof basePath === 'function'` 时调用获取最新值，避免闭包捕获过期路径；
4. **上传状态机**：`idle` → `uploading` → `done` → 1 秒后 `idle`，或 `idle` → `uploading` → `error`；
5. **调用 Core**：`uploadWorkspaceFiles` 来自 `@originos/core/lib/integrations/electron/services/workspace`。

> 组件卸载时（`useEffect` cleanup）移除隐藏的 input 元素，避免内存泄漏。

## 第四段源码：use-projects 的分页与轮询

[packages/web/src/lib/hooks/use-projects.ts 第 58–99 行](../../../../packages/web/src/lib/hooks/use-projects.ts#L58)：

```ts
export function useProjects(options: UseProjectsOptions = {}): UseProjectsReturn {
  const {
    autoLoad = false,
    query: baseQuery = {},
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
  } = options;

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const memoizedBaseQuery = useMemo(
    () => baseQuery,
    [JSON.stringify(baseQuery)]
  );

  const loadProjects = useCallback(async (queryOverride?: ProjectQuery) => {
    try {
      setIsLoading(true);
      setError(null);

      const query = { ...memoizedBaseQuery, ...queryOverride };
      const response = await listProjectsApi({
        status: query.status,
        userId: query.userId,
        domain: query.domain,
        page: query.page || 1,
        limit: query.limit || 20,
      });

      if (response.success) {
        const newProjects = response.data || [];
        if (queryOverride === undefined) {
          setProjects(newProjects);
        } else {
          setProjects(prev => [...prev, ...newProjects]);
        }
        setHasMore(newProjects.length === (query.limit || 20));
        if (query.page) setCurrentPage(query.page);
      } else {
        throw new Error(response.error?.message || 'Failed to load projects');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加载项目列表失败";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [memoizedBaseQuery]);
```

`useProjects` 的分页设计：

| 特性 | 实现 | 说明 |
| --- | --- | --- |
| 分页加载 | `loadProjects` 无参数时替换列表，有参数时追加 | `queryOverride === undefined` 区分首次加载和加载更多 |
| .hasMore 判断 | `newProjects.length === limit` | 返回数量等于页大小就认为还有更多 |
| 查询缓存 | `useMemo(() => baseQuery, [JSON.stringify(baseQuery)])` | 深比较避免对象引用变化触发不必要的重渲染 |
| 自动加载 | `autoLoad` + `useEffect` | 挂载时自动加载 |
| 定时轮询 | `setInterval(refreshProjects, refreshInterval)` | 默认 30 秒刷新一次 |

> `JSON.stringify(baseQuery)` 作为 `useMemo` 依赖是一种"穷人版深比较"。对于小型查询对象够用，但如果 `baseQuery` 包含函数或循环引用就会出错。

## 第五段源码：use-projects 的 CRUD 与导入导出

[packages/web/src/lib/hooks/use-projects.ts 第 116–266 行](../../../../packages/web/src/lib/hooks/use-projects.ts#L116)：

```ts
const createProject = useCallback(async (data) => {
  const response = await createProjectApi(data);
  if (response.success && response.data) {
    await loadProjects();  // 创建后重新加载列表
    return response.data;
  }
}, [loadProjects]);

const updateProject = useCallback(async (projectId, data) => {
  const response = await updateProjectApi(projectId, data);
  if (response.success && response.data) {
    setProjects(prev =>
      prev.map(p => p.id === projectId
        ? { ...p, name: updatedProject.name, description: updatedProject.description }
        : p)
    );
    if (activeProject?.id === projectId) setActiveProject(updatedProject);
    return updatedProject;
  }
}, [activeProject]);

const deleteProject = useCallback(async (projectId) => {
  const response = await deleteProjectApi(projectId);
  if (response.success && response.data?.deleted) {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    if (activeProject?.id === projectId) setActiveProject(null);
    return true;
  }
  return false;
}, [activeProject]);

const loadMore = useCallback(async () => {
  if (!hasMore || isLoading) return;
  await loadProjects({ ...memoizedBaseQuery, page: currentPage + 1 });
}, [hasMore, isLoading, currentPage, loadProjects, memoizedBaseQuery]);
```

CRUD 操作的更新策略差异：

| 操作 | 列表更新方式 | 说明 |
| --- | --- | --- |
| `createProject` | `await loadProjects()` 重新加载 | 创建后全量刷新 |
| `updateProject` | `setProjects(prev => prev.map(...))` | 局部更新，只修改匹配项 |
| `deleteProject` | `setProjects(prev => prev.filter(...))` | 局部更新，过滤掉匹配项 |
| `loadMore` | `setProjects(prev => [...prev, ...newProjects])` | 追加到列表末尾 |

> `updateProject` 只更新 `name` 和 `description`，不更新其他字段。如果 API 返回了更多字段的变化，这里会丢失。

---

## 第六段源码：Feature 与 Storage 的 re-export

[packages/web/src/lib/features/ontology-data-store/store.ts 第 1 行](../../../../packages/web/src/lib/features/ontology-data-store/store.ts#L1)：

```ts
export * from '@originos/core/lib/features/ontology-data-store/store';
```

[packages/web/src/lib/features/culture/services/CultureSessionService.ts 第 1 行](../../../../packages/web/src/lib/features/culture/services/CultureSessionService.ts#L1)：

```ts
export { CultureSessionService, getSessionService } from '@originos/core/lib/features/culture/services/CultureSessionService';
export type * from '@originos/core/lib/features/culture/services/CultureSessionService';
```

[packages/web/src/lib/storage/json-store.ts 第 1 行](../../../../packages/web/src/lib/storage/json-store.ts#L1)：

```ts
export * from '@originos/core/lib/storage/json-store';
```

Web 包的 `lib/features/` 和 `lib/storage/` 没有自己的业务实现，全部是 Core 包的 re-export：

| Web 文件 | Core 来源 | 说明 |
| --- | --- | --- |
| `lib/features/ontology-data-store/store.ts` | `@originos/core/lib/features/ontology-data-store/store` | 本体数据存储 |
| `lib/features/culture/services/CultureSessionService.ts` | `@originos/core/lib/features/culture/services/CultureSessionService` | 文化品味会话服务 |
| `lib/features/culture/services/CultureDetectionService.ts` | `@originos/core/lib/features/culture/services/CultureDetectionService` | 文化品味检测服务 |
| `lib/storage/json-store.ts` | `@originos/core/lib/storage/json-store` | JSON 文件存储 |

> 这种 re-export 模式是 monorepo 的标准做法：Web 包保持目录结构完整性，实际实现全部委托给 Core 包。如果未来需要在 Web 包中覆盖某些实现，只需替换 re-export 为本地实现。

## 第七段源码：config/system-apps.ts 的系统应用定义

[packages/web/src/config/system-apps.ts 第 10–31 行](../../../../packages/web/src/config/system-apps.ts#L10)：

```ts
export interface SystemAppConfig {
  code: string;
  name: string;
}

export const SYSTEM_APPS: SystemAppConfig[] = [
  { code: 'role-agent-creator', name: '角色 Agent 创建助手' },
  { code: 'skill-creator-app', name: 'Skill 技能创建助手' },
  { code: 'agent-creator', name: 'Agent 创建助手' },
  { code: 'search-and-install-skill', name: '搜索并安装市场技能' },
  { code: 'bmad-brainstorming', name: '头脑风暴' },
  { code: 'sandbox', name: '代码沙箱' },
  { code: 'bmad-workflow-builder', name: '工作流构建' },
];

export function isSystemApp(code: string): boolean {
  return SYSTEM_APPS.some(a => a.code === code);
}

export function getSystemApp(code: string): SystemAppConfig | undefined {
  return SYSTEM_APPS.find(a => a.code === code);
}
```

`system-apps.ts` 定义七个系统内置应用：

| code | 名称 | 说明 |
| --- | --- | --- |
| `role-agent-creator` | 角色 Agent 创建助手 | 创建 RoleAgent |
| `skill-creator-app` | Skill 技能创建助手 | 创建技能 |
| `agent-creator` | Agent 创建助手 | 创建普通 Agent |
| `search-and-install-skill` | 搜索并安装市场技能 | 技能市场 |
| `bmad-brainstorming` | 头脑风暴 | BMAD 头脑风暴 |
| `sandbox` | 代码沙箱 | 代码执行沙箱 |
| `bmad-workflow-builder` | 工作流构建 | BMAD 工作流 |

`isSystemApp` 和 `getSystemApp` 提供查询接口。

> 注意文件头注释提到"工作目录（CWD）和输出目录（outputDir）已分离"，但 `SystemAppConfig` 接口只有 `code` 和 `name` 两个字段，没有 `workingDirectory` 或 `outputDir`。这些目录在运行时由技能加载逻辑动态计算。

## 第八段源码：globals.css 的主题变量与桌面适配

[packages/web/src/styles/globals.css 第 11–105 行](../../../../packages/web/src/styles/globals.css#L11)：

```css
@layer base {
  :root {
    /* 核心颜色系统 - Dark Mode (默认) */
    --background: 214 100% 3%;
    --foreground: 215 20% 90%;
    --card: 220 30% 13%;
    --primary: 217 91% 60%;
    --secondary: 220 30% 20%;
    --muted: 220 30% 20%;
    --accent: 217 91% 60%;
    --destructive: 0 84% 60%;
    --border: 220 15% 28%;
    --ring: 217 91% 60%;
    --radius: 0.75rem;

    /* 视觉设计规范特定颜色 - Dark Mode */
    --panel-bg: 220 30% 13%;
    --input-bg: 220 35% 10%;
    --border-subtle: 220 15% 25%;
    --text-primary: 215 20% 90%;
    --text-secondary: 215 10% 60%;
    --text-tertiary: 210 10% 40%;
    --overlay-bg: 214 100% 3%;

    /* 交互元素颜色 - Dark Mode */
    --interactive-bg: 220 30% 20%;
    --interactive-bg-hover: 220 30% 25%;
    --interactive-bg-active: 220 30% 30%;
    --interactive-border: 217 91% 60%;
  }

  .light {
    /* Light Mode 变量... */
  }
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground;
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "SF Pro", ...;
  }

  html:has(.native-window-surface),
  html:has(.native-window-surface) body {
    background: transparent;
  }
}

@layer components {
  .native-window-surface { background: transparent; }
  .native-drag-region { -webkit-app-region: drag; }
  .native-no-drag, .native-no-drag * { -webkit-app-region: no-drag; }
}
```

`globals.css` 的三层设计：

**1. 主题变量（`:root` + `.light`）**

颜色使用 HSL 分量格式（如 `214 100% 3%`），在 Tailwind 里通过 `bg-background`、`text-primary` 等语义类使用。`:root` 默认是深色主题，`.light` 类覆盖为浅色主题。

除了 shadcn 标准变量外，还有项目自定义变量：

| 变量 | 用途 |
| --- | --- |
| `--panel-bg` | 模态面板背景 |
| `--input-bg` | 输入框背景 |
| `--border-subtle` | 细边框 |
| `--text-primary/secondary/tertiary` | 三级文本颜色 |
| `--overlay-bg` | 遮罩层背景 |
| `--interactive-bg/hover/active` | 交互元素三态 |

**2. 全局基础样式**

- `*` 统一边框颜色为 `--border`；
- `body` 使用系统字体栈（`-apple-system`、`BlinkMacSystemFont`、`Inter` 等）；
- `html:has(.native-window-surface)` 让包含原生窗口表面的页面背景透明（Electron 适配）。

**3. Electron 桌面组件类**

- `.native-window-surface`：透明背景，用于 Electron 原生窗口；
- `.native-drag-region`：`-webkit-app-region: drag`，允许拖拽窗口；
- `.native-no-drag`：取消拖拽，用于窗口内的可交互元素。

> `:has()` 选择器让祖先元素的样式受后代影响——这是 CSS 的"父选择器"，现代浏览器已广泛支持。

## 第九段源码：globals.css 的动画工具类

[packages/web/src/styles/globals.css 第 122–180 行](../../../../packages/web/src/styles/globals.css#L122)：

```css
@layer utilities {
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes scaleIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-4px); }
  }

  .animate-fade-in {
    animation: fadeIn 0.3s cubic-bezier(0.0, 0.0, 0.2, 1);
  }

  .animate-scale-in {
    animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .animate-bounce-delay-1 { animation: bounce 0.6s ease-in-out infinite; animation-delay: 0ms; }
  .animate-bounce-delay-2 { animation: bounce 0.6s ease-in-out infinite; animation-delay: 150ms; }
  .animate-bounce-delay-3 { animation: bounce 0.6s ease-in-out infinite; animation-delay: 300ms; }
}
```

三个动画工具类：

| 类名 | 效果 | 用途 |
| --- | --- | --- |
| `animate-fade-in` | 淡入 + 上移 10px | 消息出现 |
| `animate-scale-in` | 缩放 0.8→1 + 淡入 | 成功图标（弹性缓动） |
| `animate-bounce-delay-1/2/3` | 弹跳，依次延迟 0/150/300ms | 打字指示器（三个点） |

> `scaleIn` 的 `cubic-bezier(0.34, 1.56, 0.64, 1)` 是弹性缓动——控制点 y 值超过 1 会产生"过冲"效果，看起来像弹簧。

---

## 第十段源码：类型声明文件

[packages/web/src/ambient.d.ts 第 1–8 行](../../../../packages/web/src/ambient.d.ts#L1)：

```ts
declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "@/styles/icon/*.svg" {
  const content: string;
  export default content;
}
```

[packages/web/src/svg.d.ts 第 1 行](../../../../packages/web/src/svg.d.ts#L1)：

```ts
/// <reference types="vitest/globals" />
```

[packages/web/src/vitest.d.ts 第 1 行](../../../../packages/web/src/vitest.d.ts#L1)：

```ts
/// <reference types="vitest/globals" />
```

[packages/web/src/test-setup.ts 第 1–3 行](../../../../packages/web/src/test-setup.ts#L1)：

```ts
import '@testing-library/jest-dom';
import React from 'react';

globalThis.React = React;
```

四个声明/配置文件：

| 文件 | 职责 |
| --- | --- |
| `ambient.d.ts` | 告诉 TypeScript `.svg` 导入返回字符串（webpack `asset/resource` 的 URL） |
| `svg.d.ts` | 名字误导——实际是 Vitest 全局类型引用 |
| `vitest.d.ts` | Vitest 全局类型引用（`describe`、`it`、`expect` 等） |
| `test-setup.ts` | 导入 `@testing-library/jest-dom` 扩展匹配器，把 `React` 挂到 `globalThis` |

> `svg.d.ts` 的文件名暗示它应该处理 SVG 类型声明，但实际内容是 Vitest 引用。这是历史遗留的命名混乱。

## 第十一段源码：模块桩与 Core re-export

[packages/web/src/modules/collaboration-runtime/facade.ts 第 1 行](../../../../packages/web/src/modules/collaboration-runtime/facade.ts#L1)：

```ts
export * from '@originos/core/modules/collaboration-runtime/facade';
```

[packages/web/src/modules/neural-channel/src/index.ts 第 1–2 行](../../../../packages/web/src/modules/neural-channel/src/index.ts#L1)：

```ts
// Stub module - neural-channel not yet implemented
export default {};
```

[packages/web/src/modules/view-manager/src/index.ts 第 1–2 行](../../../../packages/web/src/modules/view-manager/src/index.ts#L1)：

```ts
// Stub module - view-manager not yet implemented
export default {};
```

[packages/web/src/modules/view-reconciler/src/index.ts 第 1–2 行](../../../../packages/web/src/modules/view-reconciler/src/index.ts#L1)：

```ts
// Stub module - view-reconciler not yet implemented
export default {};
```

Web 包的 `modules/` 目录有两种文件：

| 模块 | 类型 | 说明 |
| --- | --- | --- |
| `collaboration-runtime/facade.ts` | Core re-export | 协作运行时的入口，委托给 Core |
| `neural-channel/src/index.ts` | 空桩 | 导出空对象，未实现 |
| `view-manager/src/index.ts` | 空桩 | 导出空对象，未实现 |
| `view-reconciler/src/index.ts` | 空桩 | 导出空对象，未实现 |

> 三个空桩模块对应 `ViewReconcilerAdapter` 里动态导入的 `@neural-nexus/view-manager` 和 `@neural-nexus/neural-channel`。它们还没实现，所以适配器在运行时会走 fallback 路径（简单 iframe）。

---

## 本节小结

- `lib/utils.ts` 的 `cn()` 只是 `clsx` 的薄封装，没有 `tailwind-merge`，可能导致类名冲突。
- `useFileUpload` 动态创建隐藏的 `<input type="file">`，支持文件验证（大小、类型）、base64 编码、分块读取避免栈溢出。
- `useProjects` 提供完整的 CRUD + 分页 + 30 秒轮询，`hasMore` 通过返回数量等于页大小判断。
- `lib/features/` 和 `lib/storage/` 全部是 Core 包的 re-export，保持 Web 包目录结构完整。
- `system-apps.ts` 定义七个系统内置应用，`isSystemApp`/`getSystemApp` 提供查询。
- `globals.css` 用 HSL 分量格式定义深色/浅色主题变量，包含 Electron 桌面适配类和三个动画工具类。
- 类型声明文件中 `svg.d.ts` 命名混乱，实际是 Vitest 引用。
- `modules/` 目录有一个 Core re-export（`collaboration-runtime/facade.ts`）和三个空桩（`neural-channel`、`view-manager`、`view-reconciler`）。

下一节课是单元六总结：回顾、源码台账、概念图、小黑插图。
