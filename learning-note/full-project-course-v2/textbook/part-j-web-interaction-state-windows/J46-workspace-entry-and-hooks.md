# J46：工作区入口、侧边栏与项目 Hook

## 工作区：从文件树到本体标签页

`WorkspaceWindow` 是 OriginOS 里最"重"的窗口之一：左侧是目录树，右侧是文件查看/编辑器，顶部还有"项目/数据"两个标签页。它要解决的核心问题是：**给定一个项目 ID，如何把文件系统里的内容组织成一个可浏览、可编辑、可刷新的工作区。**

这节课读工作区入口相关的六个文件：

- `WorkspaceWindow`：主窗口，负责路径解析、标签切换、文件监听；
- `ProjectWorkspace`：项目管理区，含数据/本体/方案三个标签；
- `ProjectSidebar`：项目列表侧边栏；
- `project-identity.ts`：ID 规范化工具；
- `use-projects.ts`：项目列表 Hook；
- `useLocalFS.ts`：本地文件系统 Hook。

## 第一段源码：WorkspaceWindow 的 props 与路径解析

[packages/web/src/components/os/workspace/WorkspaceWindow.tsx 第 25–87 行](../../../../packages/web/src/components/os/workspace/WorkspaceWindow.tsx#L25)：

```tsx
interface WorkspaceWindowProps {
  projectId: string;
  projectName: string;
  entryType?: string;
  entryId?: string;
  ontologyId?: string;
  basePath?: string;
}

export function WorkspaceWindow({ projectId, projectName, entryType, entryId, ontologyId: propOntologyId, basePath }: WorkspaceWindowProps) {
  const { files, openedFile, isLoading, loadFiles, openFile, createFile, saveFile, setActiveProject } = useWorkspace();
  const { watchPath, unwatchPath, onChanged } = useLocalFS();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('项目');
  const [viewMode, setViewMode] = useState<'tree' | 'editor'>('tree');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [currentProjectId] = useState(projectId);
  const [currentProjectName] = useState(projectName);
  const [resolvedBasePath, setResolvedBasePath] = useState<string | null>(null);
  const [resolvedOntologyId, setResolvedOntologyId] = useState<string | null>(
    normalizeOntologyId(propOntologyId, projectId),
  );

  // Resolve base path via API
  useEffect(() => {
    if (basePath) {
      setResolvedBasePath(basePath);
      if (!resolvedOntologyId && (entryType === 'project' || projectId.startsWith('project-') || projectId.startsWith('proj-'))) {
        const projectDirId = normalizeProjectEntryId(entryId ?? projectId);
        setResolvedOntologyId(`ontology-${projectDirId}`);
      }
      return;
    }

    if (!entryType || !entryId) {
      const projectDirId = normalizeProjectEntryId(projectId);
      const fallback = projectId.startsWith('agent-')
        ? `data/agents/${projectId.slice('agent-'.length)}`
        : `data/projects/${projectDirId}`;
      setResolvedBasePath(fallback);
      if (!resolvedOntologyId && !projectId.startsWith('agent-')) {
        setResolvedOntologyId(`ontology-${projectDirId}`);
      }
      return;
    }

    resolveWorkspace(entryType, entryId)
      .then(result => {
        if (result.success) {
          setResolvedBasePath((result.data as any).baseDir);
          if ((result.data as any).ontologyId) {
            setResolvedOntologyId(normalizeOntologyId((result.data as any).ontologyId, (result.data as any).entryId ?? entryId));
          } else if (!resolvedOntologyId && entryType === 'project') {
            setResolvedOntologyId(`ontology-${normalizeProjectEntryId((result.data as any).entryId ?? entryId)}`);
          }
        }
      })
      .catch(console.error);
  }, [basePath, entryType, entryId, projectId, resolvedOntologyId]);
```

`WorkspaceWindow` 接收的 props 很宽，因为不同入口传的参数不一样：

- 从项目列表打开：传 `projectId` + `projectName`；
- 从技能产出物打开：传 `entryType: 'skill'` + `entryId`；
- 从 Agent 工作目录打开：传 `entryType: 'agent'` + `entryId`；
- 直接指定路径：传 `basePath`。

路径解析分三种情况：

1. **有 `basePath`**：直接用，并从 `projectId` 推导 `ontologyId`；
2. **没有 `entryType`/`entryId`**：根据 `projectId` 拼出 `data/projects/xxx` 或 `data/agents/xxx`；
3. **有 `entryType`/`entryId`**：调用 `resolveWorkspace` API 获取 `baseDir`。

> 这里 `resolveWorkspace` 是 Core 里的服务，封装了 Electron IPC 和 HTTP 两种调用方式。Web 包不需要关心底层是哪种。

## 第二段源码：文件监听与自动刷新

[packages/web/src/components/os/workspace/WorkspaceWindow.tsx 第 96–127 行](../../../../packages/web/src/components/os/workspace/WorkspaceWindow.tsx#L96)：

```tsx
  useEffect(() => {
    if (!resolvedBasePath || !isElectron()) {
      return;
    }

    void watchPath(resolvedBasePath).catch((error: unknown) => {
      console.error('[WorkspaceWindow] Failed to watch workspace path:', error);
    });

    const dispose = onChanged(({ path }) => {
      if (!path.startsWith(resolvedBasePath)) {
        return;
      }

      void loadFiles(currentProjectId).catch((error: unknown) => {
        console.error('[WorkspaceWindow] Failed to refresh workspace files:', error);
      });

      if (openedFile && path === `${resolvedBasePath}/${openedFile.file.path}`) {
        void openFile(currentProjectId, openedFile.file.path).catch((error: unknown) => {
          console.error('[WorkspaceWindow] Failed to refresh opened file:', error);
        });
      }
    });

    return () => {
      dispose();
      void unwatchPath(resolvedBasePath).catch((error: unknown) => {
        console.error('[WorkspaceWindow] Failed to unwatch workspace path:', error);
      });
    };
  }, [currentProjectId, loadFiles, onChanged, openFile, openedFile, resolvedBasePath, unwatchPath, watchPath]);
```

文件监听只在 Electron 环境启用（`isElectron()` 检查），因为 Web 版本没有本地文件系统。

监听流程：

1. 调用 `watchPath(resolvedBasePath)` 告诉主进程监听这个目录；
2. 主进程通过 IPC 推送文件变化事件；
3. `onChanged` 回调收到事件后，检查变化路径是否在 `resolvedBasePath` 下；
4. 如果在，调用 `loadFiles` 刷新文件树；
5. 如果变化的文件正好是当前打开的文件，调用 `openFile` 重新读取内容。

> 这种"主进程监听 + IPC 推送"的模式避免了 Web 端轮询，性能更好。

## 第三段源码：沙箱检测与打开

[packages/web/src/components/os/workspace/WorkspaceWindow.tsx 第 131–177 行](../../../../packages/web/src/components/os/workspace/WorkspaceWindow.tsx#L131)：

```tsx
  // Detect if this workspace can be opened in sandbox
  const sandboxAppId = useMemo(() => {
    if (!resolvedBasePath) return null;

    // Handle both relative ('data/projects/abc') and absolute ('/abs/path/data/skills/x')
    const dataIdx = resolvedBasePath.lastIndexOf('/data/');
    const basePath = dataIdx !== -1
      ? resolvedBasePath.slice(dataIdx + '/data/'.length)
      : resolvedBasePath.replace(/^data\//, '');

    // 优先检测 index.html
    const hasIndexHtml = projectFiles.some(
      (f: any) => f.type === 'file' && f.name === 'index.html' && !f.parentPath
    );
    if (hasIndexHtml) return basePath;

    // 其次检测独立 .html 文件（技能产出物场景）
    const htmlFile = projectFiles.find(
      (f: any) => f.type === 'file' && f.name.endsWith('.html') && f.name !== 'index.html' && !f.parentPath
    );
    if (htmlFile) return `${basePath}/${htmlFile.name}`;

    return null;
  }, [projectFiles, resolvedBasePath]);

  const handleOpenInSandbox = () => {
    if (!sandboxAppId) return;
    window.dispatchEvent(
      new CustomEvent('dock:action', {
        detail: { action: 'launch-sandbox', appId: sandboxAppId },
      })
    );
  };

  const handleOpenInSandboxFromTree = (folderRelPath: string) => {
    if (!resolvedBasePath) return;
    const dataIdx = resolvedBasePath.lastIndexOf('/data/');
    const basePart = dataIdx !== -1
      ? resolvedBasePath.slice(dataIdx + '/data/'.length)
      : resolvedBasePath.replace(/^data\//, '');
    const appId = folderRelPath ? `${basePart}/${folderRelPath}` : basePart;
    window.dispatchEvent(
      new CustomEvent('dock:action', {
        detail: { action: 'launch-sandbox', appId },
      })
    );
  };
```

`WorkspaceWindow` 会检测当前工作区是否包含 HTML 文件，如果包含就显示"在沙箱中打开"按钮：

1. 优先检测根目录的 `index.html`；
2. 其次检测根目录的其他 `.html` 文件（技能产出物场景）；
3. 如果找到，计算 `sandboxAppId`（从 `data/` 后面的路径）；
4. 点击按钮时派发 `dock:action` 自定义事件，由 Dock 监听并打开沙箱窗口。

> 这里用自定义事件而不是直接调用 `AppWindowManager`，是因为 `WorkspaceWindow` 不想直接依赖 Dock 的实现。事件驱动解耦了组件。

## 第四段源码：标签切换与内容渲染

[packages/web/src/components/os/workspace/WorkspaceWindow.tsx 第 274–310 行](../../../../packages/web/src/components/os/workspace/WorkspaceWindow.tsx#L274)：

```tsx
        {/* Tab content */}
        <div className="flex-1 min-h-0">
          {activeTab === '项目' ? (
            <>
              {viewMode === 'tree' ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <p>从左侧选择文件查看或编辑</p>
                </div>
              ) : openedFile && isImageFileExtension(openedFile.file.extension || '') ? (
                <ImageViewer fileContent={openedFile} />
              ) : openedFile?.file.extension === 'md' ? (
                <MarkdownEditor fileContent={openedFile} onSave={handleSaveFile} isLoading={isLoading} />
              ) : (
                <MarkdownViewer fileContent={openedFile} isLoading={isLoading} />
              )}
            </>
          ) : (
            resolvedOntologyId ? (
              <DataTabView ontologyId={resolvedOntologyId} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                未关联本体
              </div>
            )
          )}
        </div>
```

"项目"标签页根据 `viewMode` 和文件类型渲染不同内容：

| 状态 | 渲染 |
| --- | --- |
| `viewMode === 'tree'` | 空状态提示"从左侧选择文件" |
| 图片文件 | `ImageViewer` |
| `.md` 文件 | `MarkdownEditor`（可编辑） |
| 其他文件 | `MarkdownViewer`（只读） |

"数据"标签页渲染 `DataTabView`，如果 `resolvedOntologyId` 为空则显示"未关联本体"。

## 第五段源码：ProjectWorkspace 的三标签结构

[packages/web/src/components/os/workspace/ProjectWorkspace.tsx 第 15–49 行](../../../../packages/web/src/components/os/workspace/ProjectWorkspace.tsx#L15)：

```tsx
export function ProjectWorkspace({ projectId, projectName, ontologyId }: ProjectWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<PwTab>('数据');

  useEffect(() => {
    console.log('[ProjectWorkspace] mounted', { projectId, projectName, ontologyId });
  }, [projectId, projectName, ontologyId]);

  const handleTabChange = (tab: PwTab) => {
    console.log('[ProjectWorkspace] tab change', { projectId, ontologyId, tab });
    setActiveTab(tab);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="native-drag-region flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-gray-50">
        <span className="text-sm font-semibold text-gray-700 mr-4">{projectName}</span>
        <TabButton label="数据" active={activeTab === '数据'} onClick={() => handleTabChange('数据')} />
        <TabButton label="本体" active={activeTab === '本体'} onClick={() => handleTabChange('本体')} />
        <TabButton label="方案" active={activeTab === '方案'} onClick={() => handleTabChange('方案')} />
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === '数据' && <DataTabView ontologyId={ontologyId} />}
        {activeTab === '本体' && <OntologyTabView ontologyId={ontologyId} />}
        {activeTab === '方案' && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            解决方案设计 — 即将推出
          </div>
        )}
      </div>
    </div>
  );
}
```

`ProjectWorkspace` 比 `WorkspaceWindow` 简单得多，只有三个标签：

- **数据**：`DataTabView`，展示本体实例数据；
- **本体**：`OntologyTabView`，展示本体结构（Schema）；
- **方案**：占位，显示"即将推出"。

注意顶部用了 `native-drag-region`，说明这个窗口是 Electron 原生窗口，标题栏可以拖拽。

## 第六段源码：ProjectSidebar 的项目列表

[packages/web/src/components/os/workspace/ProjectSidebar.tsx 第 15–95 行](../../../../packages/web/src/components/os/workspace/ProjectSidebar.tsx#L15)：

```tsx
export function ProjectSidebar({ activeProjectId, onProjectSelect }: ProjectSidebarProps) {
  const { projects, isLoading } = useProjects({
    autoLoad: true,
    query: { status: 'active' },
  });

  const getProjectColor = (project: ProjectListItem) => {
    return project.color || '#3b82f6';
  };

  if (isLoading) {
    return (
      <div className="w-64 border-r border-gray-200 bg-gray-50 p-4">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">项目</h3>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-2">
        {projects.length === 0 ? (
          <div className="px-2 py-4 text-sm text-gray-400 text-center">暂无项目</div>
        ) : (
          <div className="space-y-1">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onProjectSelect(project.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeProjectId === project.id
                    ? 'bg-blue-100 text-blue-900'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                  style={{ backgroundColor: getProjectColor(project) }}
                >
                  {project.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{project.name}</div>
                  <div className="text-xs text-gray-500 truncate">{project.domain}</div>
                </div>
                {activeProjectId === project.id && (
                  <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="text-xs text-gray-500">{projects.length} 个项目</div>
      </div>
    </div>
  );
}
```

`ProjectSidebar` 是一个简单的项目列表：

- 用 `useProjects` Hook 加载 `status: 'active'` 的项目；
- 每个项目显示首字母图标、名称、领域；
- 当前激活的项目用蓝色背景和圆点标记；
- 点击项目触发 `onProjectSelect` 回调。

> 注意 `ProjectSidebar` 当前没有被 `WorkspaceWindow` 使用，说明它是一个预留组件，可能用于多项目切换场景。

## 第七段源码：project-identity 的 ID 规范化

[packages/web/src/components/os/workspace/project-identity.ts 第 1–35 行](../../../../packages/web/src/components/os/workspace/project-identity.ts#L1)：

```ts
export function normalizeProjectEntryId(projectId: string): string {
  if (projectId.startsWith('project-proj-')) {
    return projectId.slice('project-'.length);
  }
  if (/^project-\d/.test(projectId)) {
    return projectId.slice('project-'.length);
  }
  return projectId;
}

export function normalizeOntologyId(
  ontologyId: string | undefined | null,
  projectId: string | undefined | null,
): string | null {
  if (ontologyId && ontologyId.trim().length > 0) {
    const trimmed = ontologyId.trim();
    if (trimmed.startsWith('ontology_')) {
      return `ontology-${normalizeProjectEntryId(trimmed.slice('ontology_'.length))}`;
    }
    if (trimmed.startsWith('ontology-project-proj-')) {
      return `ontology-${trimmed.slice('ontology-project-'.length)}`;
    }
    if (/^ontology-project-\d/.test(trimmed)) {
      return `ontology-${trimmed.slice('ontology-project-'.length)}`;
    }
    return trimmed;
  }

  if (!projectId) {
    return null;
  }

  return `ontology-${normalizeProjectEntryId(projectId)}`;
}
```

`project-identity.ts` 处理两种 ID 规范化：

**`normalizeProjectEntryId`**：
- `project-proj-xxx` → `proj-xxx`
- `project-123` → `123`
- 其他原样返回

**`normalizeOntologyId`**：
- `ontology_xxx` → `ontology-{normalizeProjectEntryId(xxx)}`
- `ontology-project-proj-xxx` → `ontology-proj-xxx`
- `ontology-project-123` → `ontology-123`
- 如果没传 `ontologyId`，从 `projectId` 推导

> 这些规范化函数处理的是历史遗留的 ID 格式不一致问题。不同时期、不同模块生成的 ID 前缀不同，需要统一转换才能正确访问数据。

## 第八段源码：useProjects 的 API 封装

[packages/web/src/lib/hooks/use-projects.ts 第 58–113 行](../../../../packages/web/src/lib/hooks/use-projects.ts#L58)：

```tsx
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
      console.error("加载项目列表失败:", err);
    } finally {
      setIsLoading(false);
    }
  }, [memoizedBaseQuery]);
```

`useProjects` 是一个功能完整的项目列表 Hook：

- **状态**：`projects`、`activeProject`、`isLoading`、`error`、`hasMore`、`currentPage`；
- **方法**：`loadProjects`、`refreshProjects`、`createProject`、`updateProject`、`deleteProject`、`getProject`、`setActiveProject`、`exportProject`、`importProject`、`loadMore`；
- **选项**：`autoLoad`（自动加载）、`query`（过滤条件）、`refreshInterval`（轮询间隔，默认 30 秒）。

`loadProjects` 的逻辑：

1. 合并 `baseQuery` 和 `queryOverride`；
2. 调用 `listProjectsApi`；
3. 如果是全量加载（`queryOverride === undefined`），替换 `projects`；
4. 如果是加载更多，追加到 `projects`；
5. 根据返回数量判断是否还有更多。

> `memoizedBaseQuery` 用 `JSON.stringify` 做深比较，避免 `baseQuery` 对象引用变化导致 `loadProjects` 重新定义。这是一种常见的 React 性能优化技巧。

## 第九段源码：useLocalFS 的文件系统封装

[packages/web/src/hooks/useLocalFS.ts 第 17–62 行](../../../../packages/web/src/hooks/useLocalFS.ts#L17)：

```tsx
export function useLocalFS() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(isElectron());
  }, []);

  const readFile = useCallback(async (filePath: string): Promise<LocalReadFileResult> => {
    return readLocalFile(filePath);
  }, []);

  const writeFile = useCallback(async (filePath: string, content: string): Promise<void> => {
    await writeLocalFile(filePath, content);
  }, []);

  const listFiles = useCallback(async (dirPath: string): Promise<LocalFileEntry[]> => {
    return listLocalFiles(dirPath);
  }, []);

  const deleteFile = useCallback(async (filePath: string): Promise<void> => {
    await deleteLocalFile(filePath);
  }, []);

  const watchPath = useCallback(async (targetPath: string): Promise<void> => {
    await watchLocalPath(targetPath);
  }, []);

  const unwatchPath = useCallback(async (targetPath: string): Promise<void> => {
    await unwatchLocalPath(targetPath);
  }, []);

  const onChanged = useCallback((listener: (payload: { path: string }) => void): (() => void) => {
    return subscribeToLocalFsChanges(listener);
  }, []);

  return {
    isReady,
    readFile,
    writeFile,
    listFiles,
    deleteFile,
    watchPath,
    unwatchPath,
    onChanged,
  };
}
```

`useLocalFS` 是对 Core 里 `local-fs` 服务的薄封装：

- `isReady`：检查是否在 Electron 环境；
- `readFile` / `writeFile` / `listFiles` / `deleteFile`：基础文件操作；
- `watchPath` / `unwatchPath` / `onChanged`：文件监听。

所有方法都用 `useCallback` 包装，避免每次渲染都创建新函数。

> `useLocalFS` 放在 Web 包而不是 Core，是因为它是 Web 组件直接使用的 Hook。Core 里的 `local-fs` 服务才是跨平台实现。

## 本节小结

- `WorkspaceWindow` 是文件工作区主窗口，支持路径解析、标签切换、文件监听、沙箱检测。
- 路径解析分三种情况：直接指定 `basePath`、从 `projectId` 推导、调用 `resolveWorkspace` API。
- 文件监听只在 Electron 环境启用，通过主进程 IPC 推送变化事件。
- 沙箱检测通过查找 `index.html` 或独立 `.html` 文件，用自定义事件通知 Dock 打开沙箱。
- `ProjectWorkspace` 是项目管理区，含数据/本体/方案三个标签，方案标签是占位。
- `ProjectSidebar` 是预留的项目列表侧边栏，当前未被使用。
- `project-identity.ts` 处理历史遗留的 ID 格式不一致问题。
- `useProjects` 是功能完整的项目列表 Hook，支持分页、轮询、CRUD、导入导出。
- `useLocalFS` 是本地文件系统的薄封装，只在 Electron 环境可用。

下一节课读 `DirectoryTree`、`FileList`、`CreateFileDialog`、`DeleteConfirmDialog` 和 `use-workspace`。
