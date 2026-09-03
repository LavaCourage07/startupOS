# J47：目录树、文件列表与文件对话框

## 文件管理的四个 UI 组件

`WorkspaceWindow` 的文件管理依赖四个 UI 组件：

1. `DirectoryTree`：左侧目录树，层级展示文件和文件夹；
2. `FileList`：表格文件列表，按修改时间排序，支持删除；
3. `CreateFileDialog`：新建文件弹窗；
4. `DeleteConfirmDialog`：删除确认弹窗。

这节课读这四个组件，以及 Web 包里的 `use-workspace.ts` re-export。

## 第一段源码：use-workspace 的 re-export

[packages/web/src/hooks/use-workspace.ts 第 1 行](../../../../packages/web/src/hooks/use-workspace.ts#L1)：

```ts
export { useWorkspace } from '@originos/core/lib/hooks/use-workspace';
```

Web 包的 `use-workspace.ts` 只有一行，把 Core 里的 `useWorkspace` Hook 重新导出。这说明工作区的核心逻辑（文件加载、打开、保存、删除）都在 Core 里实现，Web 包只是提供一个本地入口。

> 这种 re-export 模式在 monorepo 里很常见：Web 包的组件用 `@/hooks/use-workspace` 导入，实际用的是 Core 的实现。好处是 Web 包可以后续加一层封装或替换实现，而不影响组件代码。

## 第二段源码：DirectoryTree 的 props 与状态

[packages/web/src/components/os/workspace/DirectoryTree.tsx 第 7–26 行](../../../../packages/web/src/components/os/workspace/DirectoryTree.tsx#L7)：

```tsx
interface DirectoryTreeProps {
  files: ProjectFile[];
  selectedFileId: string | null;
  onFileSelect: (file: ProjectFile) => void;
  onOpenInSandbox?: (folderPath: string) => void;
}

export function DirectoryTree({ files, selectedFileId, onFileSelect, onOpenInSandbox }: DirectoryTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const treeFiles = useMemo(() => normalizeFilesForTree(files), [files]);

  // Auto-expand root folders on mount
  useEffect(() => {
    const rootFolders = treeFiles.filter(f => f.type === 'folder' && !f.parentPath);
    setExpandedFolders(new Set(rootFolders.map(f => f.path)));
  }, [treeFiles]);
```

`DirectoryTree` 接收 `files` 数组，用 `normalizeFilesForTree` 补全缺失的文件夹节点，然后用 `expandedFolders` state 控制哪些文件夹展开。

自动展开根文件夹的逻辑：

1. 过滤出 `type === 'folder'` 且没有 `parentPath` 的节点；
2. 把这些节点的 `path` 加入 `expandedFolders`。

> 这样用户打开工作区时，根目录默认展开，不需要手动点击。

## 第三段源码：normalizeFilesForTree 的文件夹补全

[packages/web/src/components/os/workspace/DirectoryTree.tsx 第 169–213 行](../../../../packages/web/src/components/os/workspace/DirectoryTree.tsx#L169)：

```tsx
export function normalizeFilesForTree(files: ProjectFile[]): ProjectFile[] {
  const byPath = new Map<string, ProjectFile>();

  const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');

  const ensureFolder = (projectId: string, folderPath: string, timestamp: number) => {
    const normalizedFolderPath = normalizePath(folderPath);
    if (!normalizedFolderPath || byPath.has(normalizedFolderPath)) return;

    const segments = normalizedFolderPath.split('/');
    const parentPath = segments.length > 1 ? segments.slice(0, -1).join('/') : undefined;
    byPath.set(normalizedFolderPath, {
      id: `folder:${normalizedFolderPath}`,
      projectId,
      path: normalizedFolderPath,
      name: segments[segments.length - 1] ?? normalizedFolderPath,
      size: 0,
      createdAt: timestamp,
      modifiedAt: timestamp,
      type: 'folder',
      parentPath,
    });
  };

  for (const file of files) {
    const normalizedPath = normalizePath(file.path);
    if (!normalizedPath) continue;

    const segments = normalizedPath.split('/');
    for (let depth = 1; depth < segments.length; depth += 1) {
      ensureFolder(file.projectId, segments.slice(0, depth).join('/'), file.modifiedAt);
    }

    const parentPath = segments.length > 1 ? segments.slice(0, -1).join('/') : undefined;
    byPath.set(normalizedPath, {
      ...file,
      id: file.id || `${file.type}:${normalizedPath}`,
      path: normalizedPath,
      name: file.name || segments[segments.length - 1] || normalizedPath,
      parentPath,
    });
  }

  return Array.from(byPath.values());
}
```

`normalizeFilesForTree` 解决一个问题：后端返回的 `files` 数组可能只有文件，没有文件夹节点。比如返回 `["a/b/c.md"]`，但没有 `a/` 和 `a/b/` 这两个文件夹。

处理流程：

1. 用 `byPath` Map 去重，key 是规范化后的路径；
2. `normalizePath` 统一路径格式：反斜杠转正斜杠、去重复斜杠、去首尾斜杠；
3. 遍历每个文件，按路径段逐级 `ensureFolder`，补全所有祖先文件夹；
4. 最后把文件本身也加入 Map；
5. 返回 `Array.from(byPath.values())`。

> 这种"从文件路径推导文件夹"的策略很常见，避免了后端存储冗余的文件夹节点。

## 第四段源码：DirectoryTree 的递归渲染

[packages/web/src/components/os/workspace/DirectoryTree.tsx 第 40–146 行](../../../../packages/web/src/components/os/workspace/DirectoryTree.tsx#L40)：

```tsx
  // Build tree structure
  const buildTree = () => {
    const rootItems: ProjectFile[] = [];
    const childrenMap = new Map<string, ProjectFile[]>();

    treeFiles.forEach(file => {
      if (!file.parentPath) {
        rootItems.push(file);
      } else {
        if (!childrenMap.has(file.parentPath)) {
          childrenMap.set(file.parentPath, []);
        }
        childrenMap.get(file.parentPath)!.push(file);
      }
    });

    // Sort: folders first, then by name
    const sortItems = (items: ProjectFile[]) => {
      return items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    };

    const renderItem = (file: ProjectFile, depth: number = 0): JSX.Element => {
      const isFolder = file.type === 'folder';
      const isExpanded = expandedFolders.has(file.path);
      const isSelected = file.id === selectedFileId;
      const children = childrenMap.get(file.path) || [];

      // Detect sandboxable: folder with direct index.html child, or any .html file
      const isHtmlFile = !isFolder && file.name.endsWith('.html');
      const isIndexHtml = !isFolder && file.name === 'index.html';
      const hasSandboxApp = isFolder && children.some(c => c.type === 'file' && (c.name === 'index.html' || c.name.endsWith('.html')));

      return (
        <div key={file.id}>
          <div className="flex items-center group">
            <button
              onClick={() => {
                if (isFolder) {
                  toggleFolder(file.path);
                } else {
                  onFileSelect(file);
                }
              }}
              className={`flex-1 flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
                isSelected
                  ? 'bg-blue-100 text-blue-900'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {isFolder ? (
                <>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                  <Folder className="w-4 h-4 shrink-0 text-blue-500" />
                </>
              ) : (
                <>
                  <div className="w-4" />
                  <File className={`w-4 h-4 shrink-0 ${isIndexHtml ? 'text-emerald-500' : 'text-gray-400'}`} />
                </>
              )}
              <span className="truncate">{file.name}</span>
              {(hasSandboxApp || isHtmlFile) && (
                <span className="text-xs text-emerald-600 shrink-0">🔬</span>
              )}
            </button>
            {(hasSandboxApp || isHtmlFile) && onOpenInSandbox && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isIndexHtml) {
                    onOpenInSandbox(file.parentPath ?? '');
                  } else if (isHtmlFile) {
                    const dirPath = file.parentPath ?? '';
                    onOpenInSandbox(dirPath ? `${dirPath}/${file.name}` : file.name);
                  } else {
                    onOpenInSandbox(file.path);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 mr-1 px-1.5 py-0.5 text-xs rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-all shrink-0"
                title="在沙箱中打开"
              >
                打开
              </button>
            )}
          </div>
          {isFolder && isExpanded && children.length > 0 && (
            <div>
              {sortItems(children).map(child => renderItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    };

    return sortItems(rootItems).map(item => renderItem(item));
  };
```

`buildTree` 的逻辑：

1. 把 `treeFiles` 分成 `rootItems`（没有 `parentPath`）和 `childrenMap`（按 `parentPath` 分组）；
2. `sortItems` 排序：文件夹在前，文件在后，同类型按名称字母序；
3. `renderItem` 递归渲染：
   - 文件夹显示展开/收起箭头 + 文件夹图标；
   - 文件显示文件图标，`index.html` 用绿色；
   - 如果文件夹包含 HTML 文件或本身就是 HTML 文件，显示 🔬 图标和"打开"按钮；
   - 点击文件夹切换展开状态，点击文件触发 `onFileSelect`；
   - `paddingLeft` 按 `depth * 12 + 8` 计算，形成层级缩进。

> 沙箱检测逻辑：`hasSandboxApp` 检查文件夹的直接子文件里有没有 `index.html` 或其他 `.html` 文件。如果有，就在文件夹旁边显示 🔬 图标和"打开"按钮。

## 第五段源码：FileList 的表格渲染

[packages/web/src/components/os/workspace/FileList.tsx 第 17–83 行](../../../../packages/web/src/components/os/workspace/FileList.tsx#L17)：

```tsx
export function FileList({ projectId, onFileSelect }: FileListProps) {
  const { files, isLoading, error, loadFiles, selectFile, selectedFileId, deleteFile } = useWorkspace();
  const [deleteTarget, setDeleteTarget] = useState<ProjectFile | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const projectFiles = (files as any)[projectId] || [];

  useEffect(() => {
    if (projectId) {
      loadFiles(projectId);
    }
  }, [projectId, loadFiles]);

  const handleFileClick = (file: ProjectFile) => {
    if (file.type === 'folder') {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        if (next.has(file.path)) {
          next.delete(file.path);
        } else {
          next.add(file.path);
        }
        return next;
      });
    } else {
      selectFile(file.id);
      onFileSelect?.(file);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, file: ProjectFile) => {
    e.stopPropagation();
    setDeleteTarget(file);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      try {
        await deleteFile(projectId, deleteTarget.path);
        setDeleteTarget(null);
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    }
  };

  // Build folder tree structure
  const buildFileTree = () => {
    const rootFiles: ProjectFile[] = [];
    const folderMap = new Map<string, ProjectFile[]>();

    projectFiles.forEach((file: any) => {
      if (!file.parentPath) {
        rootFiles.push(file);
      } else {
        if (!folderMap.has(file.parentPath)) {
          folderMap.set(file.parentPath, []);
        }
        folderMap.get(file.parentPath)!.push(file);
      }
    });

    return { rootFiles, folderMap };
  };

  const { rootFiles, folderMap } = buildFileTree();
```

`FileList` 和 `DirectoryTree` 的区别：

- `DirectoryTree` 是侧边栏，用 div + 缩进渲染树；
- `FileList` 是表格，用 `<table>` 渲染，显示名称、修改时间、大小、操作四列。

`FileList` 也用 `buildFileTree` 构建树结构，但渲染时用 `<tr>` 和 `paddingLeft` 缩进。

> 注意 `FileList` 当前没有被 `WorkspaceWindow` 使用，说明它是一个备选方案或历史遗留组件。

## 第六段源码：FileList 的表格行渲染

[packages/web/src/components/os/workspace/FileList.tsx 第 85–178 行](../../../../packages/web/src/components/os/workspace/FileList.tsx#L85)：

```tsx
  const renderFile = (file: ProjectFile, level: number = 0) => {
    const isFolder = file.type === 'folder';
    const isExpanded = expandedFolders.has(file.path);
    const children = isFolder ? folderMap.get(file.path) || [] : [];

    return (
      <div key={file.id}>
        <tr
          className={`hover:bg-gray-50 transition-colors ${
            selectedFileId === file.id ? 'bg-blue-50' : ''
          }`}
        >
          <td
            className="px-4 py-3 whitespace-nowrap cursor-pointer"
            onClick={() => handleFileClick(file)}
            style={{ paddingLeft: `${16 + level * 24}px` }}
          >
            <div className="flex items-center">
              {isFolder && (
                <svg className={`w-4 h-4 mr-2 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                  <path d="M9 5l7 7-7 7" />
                </svg>
              )}
              {isFolder ? (
                <svg className="w-5 h-5 mr-2 text-yellow-500">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 mr-2 text-gray-400">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              <span className="text-sm text-gray-900">{file.name}</span>
            </div>
          </td>
          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 cursor-pointer" onClick={() => handleFileClick(file)}>
            {formatDate(file.modifiedAt)}
          </td>
          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 cursor-pointer" onClick={() => handleFileClick(file)}>
            {formatFileSize(file.size)}
          </td>
          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
            <button onClick={(e) => handleDeleteClick(e, file)} className="text-red-600 hover:text-red-800 transition-colors">
              <svg>...</svg>
            </button>
          </td>
        </tr>
        {isFolder && isExpanded && children.map((child) => renderFile(child, level + 1))}
      </div>
    );
  };
```

每行显示：

- **名称列**：文件夹显示展开箭头 + 黄色文件夹图标，文件显示灰色文件图标；
- **修改时间列**：用 `formatDate` 格式化为相对时间（"刚刚"、"5 分钟前"、"2 天前"等）；
- **大小列**：用 `formatFileSize` 格式化为 KB/MB；
- **操作列**：删除按钮，点击弹出确认对话框。

> `formatDate` 和 `formatFileSize` 是工具函数，放在组件内部。如果其他组件也需要，应该提取到 `lib/utils`。

## 第七段源码：CreateFileDialog 的文件名校验

[packages/web/src/components/os/workspace/CreateFileDialog.tsx 第 14–43 行](../../../../packages/web/src/components/os/workspace/CreateFileDialog.tsx#L14)：

```tsx
export function CreateFileDialog({ isOpen, onClose, onConfirm }: CreateFileDialogProps) {
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate file name
    if (!fileName.trim()) {
      setError('文件名不能为空');
      return;
    }

    if (fileName.includes('/') || fileName.includes('\\')) {
      setError('文件名不能包含路径分隔符');
      return;
    }

    onConfirm(fileName.trim());
    setFileName('');
    setError('');
  };

  const handleClose = () => {
    setFileName('');
    setError('');
    onClose();
  };
```

`CreateFileDialog` 的校验很简单：

- 不能为空；
- 不能包含 `/` 或 `\`（防止路径穿越）。

> 这里没有校验文件名是否已存在，也没有校验特殊字符（如 `:`、`*`、`?` 等）。如果后端不处理，可能会导致创建失败或覆盖已有文件。

## 第八段源码：DeleteConfirmDialog 的确认交互

[packages/web/src/components/os/workspace/DeleteConfirmDialog.tsx 第 13–88 行](../../../../packages/web/src/components/os/workspace/DeleteConfirmDialog.tsx#L13)：

```tsx
export function DeleteConfirmDialog({
  isOpen,
  fileName,
  onClose,
  onConfirm,
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-96 max-w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg>...</svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-600">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700">
                确定要删除文件 <span className="font-semibold">{fileName}</span> 吗？
              </p>
              <p className="mt-2 text-sm text-gray-500">此操作无法撤销。</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-lg">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">
            取消
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700">
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
```

`DeleteConfirmDialog` 是一个标准的确认弹窗：

- 红色警告图标；
- 显示要删除的文件名；
- 提示"此操作无法撤销"；
- 两个按钮：取消（灰色）和删除（红色）。

> 弹窗用 `fixed inset-0 z-50` 全屏遮罩，和 `WelcomeScreen` 等模态组件一样，不走窗口管理器。

## 本节小结

- `use-workspace.ts` 在 Web 包只是 re-export，实际实现在 Core。
- `DirectoryTree` 用 `normalizeFilesForTree` 补全缺失的文件夹节点，递归渲染树结构。
- `DirectoryTree` 检测 HTML 文件并显示沙箱打开按钮。
- `FileList` 是表格形式的文件列表，当前未被 `WorkspaceWindow` 使用。
- `CreateFileDialog` 校验文件名非空且不含路径分隔符。
- `DeleteConfirmDialog` 是标准的确认删除弹窗。

下一节课读 `MarkdownEditor`、`MarkdownViewer`、`ImageViewer`、`DataTabView`、`OntologyTabView`，完成工作区的文件查看和本体标签页。
